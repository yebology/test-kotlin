# test-playwright (FE-E2E-Automation) — Detailed Flow Analysis

## What is This?

A framework that **auto-generates Playwright E2E tests** for React web apps by browsing the **real running application** — not guessing from source code.

Key insight: instead of reading code to figure out what to test, it literally opens a browser, navigates the live app, extracts real DOM selectors, and writes test files from what it sees.

---

## Core Architecture

```
┌───────────────────────────────────────────────────────────┐
│  wizard.sh / wizard.ts (Orchestrator)                      │
│  - Interactive terminal UI (Clack prompts)                  │
│  - Handles: clone, install, build, serve, auth config       │
│  - Spawns Kiro CLI agent                                    │
│  - Generates reports after agent finishes                   │
└────────────────────────┬──────────────────────────────────┘
                         │ spawns
                         ▼
┌───────────────────────────────────────────────────────────┐
│  kiro-cli chat (AI Agent)                                  │
│  - Uses prompts/generate-tests.md as system prompt          │
│  - Controls browser via Playwright MCP                      │
│  - Browses live app, extracts DOM selectors                 │
│  - Generates .ts Playwright spec files                      │
│  - Runs tests + self-repairs failures                       │
└────────────────────────┬──────────────────────────────────┘
                         │ uses
                         ▼
┌───────────────────────────────────────────────────────────┐
│  e2e-seed/ (Reusable Infrastructure)                       │
│  - helpers/core.ts — navigation, retry, auth recovery       │
│  - helpers/adapters/ — UI framework detection (MUI, Ant..)  │
│  - helpers/generators/ — test scaffolding by module type    │
│  - helpers/recipes/ — interaction pattern plugins           │
│  - fixtures.ts, auth.setup.ts, playwright.config.ts         │
└───────────────────────────────────────────────────────────┘
```

---

## Full Flow (Step by Step)

### Step 1: Setup (wizard.ts)

User runs `./wizard.sh` → interactive prompts:

```
1. What to do? → Generate manifest / Generate tests / Both
2. Model? → claude-opus-4.6 / claude-sonnet-4.6 / custom
3. Target? → Local repo (clone+build+serve) OR External URL (already running)
4. Auth? → Email + password, MFA/TOTP, session file, or no auth
5. Workers? → Number of parallel Playwright workers
```

Wizard then:
- Clones target repo (if local)
- Installs dependencies (auto-detects npm/yarn/pnpm/bun)
- Builds the app
- Starts dev server on specified port
- Copies `e2e-seed/` into workspace as reusable helpers

### Step 2: Authentication

5 fallback modes (tries in order):
1. **Session reuse** — if `session.json` is fresh (<2h), skip login entirely
2. **Microsoft AAD** — handles redirect to login.microsoftonline.com, multi-step, "Stay signed in?" prompt
3. **Automated TOTP** — email + password + MFA secret → fully headless
4. **Semi-automated** — agent fills creds, user completes MFA manually
5. **No auth** — if no credentials configured, skip

### Step 3: Discovery

Agent opens browser (Playwright MCP) and:
- Navigates to every route in the app
- Takes DOM snapshots of each page
- Detects UI framework (MUI, Ant Design, Chakra, shadcn, plain HTML)
- Identifies modules: what pages exist, what components are on each
- Validates against manifest (if provided)
- Outputs: `e2e-manifest.yaml` (auto-generated or validated)

### Step 4: Test Plan Generation

Agent generates `test-plan.md` with 4 levels of tests:

| Level | Name | What it tests | Example |
|-------|------|---------------|---------|
| L1 | Structure | Page loads, elements present, no console errors | "Dashboard page renders without errors" |
| L2 | Interaction | Search, sort, filter, form validation | "Typing in search filters the table" |
| L3 | CRUD | Create → verify → edit → delete | "Create invoice → appears in list → edit → delete" |
| L4 | Business Logic | Cross-module flows, conditional rules | "Approved invoice can't be edited" |

**CRITICAL: Agent STOPS here and waits for human review.**
- User reads test-plan.md
- User can toggle tests on/off
- User says "proceed" → agent continues

### Step 5: Generate + Repair (Per Module)

For EACH module in the manifest:

```
Generate Playwright .ts spec
        │
        ▼
Run spec (smoke test)
        │
        ├── All pass? → ✅ Done, move to next module
        │
        └── Some fail? → Self-repair:
                │
                ├── Attempt 1: Fix selectors/timing
                │   └── Rerun → pass? → ✅ Done
                │
                ├── Attempt 2: Fix logic/assertions
                │   └── Rerun → pass? → ✅ Done
                │
                └── Attempt 3: Last try
                    └── Rerun → still fail? → ❌ Mark as failed, move on
```

After each module: write result to `progress.md`

```markdown
# Progress: My App — 2026-04-29
✔ Dashboard — 8 tests, 8 passed (0 repairs)
✔ Invoice — 12 tests, 10 passed → repaired → 12 passed (2 repairs)
✖ eInvoice Form — 15 tests, 10 passed, 5 failed (3 repair attempts exhausted)
```

### Step 6: Full Run

After all modules generated individually:
- Run ALL specs together in one Playwright run
- Catches cross-module issues (shared state, auth session expiry, etc.)

### Step 7: Self-Review

Agent reviews results:
- Identifies coverage gaps (modules with no L3/L4 tests)
- Attempts to fix remaining failures
- Generates `coverage-report.md` (gap analysis)

### Step 8: Report

Automated report generation from Playwright JSON results:

```
output/{app-name}/{date}-run-{nn}/
├── report.md              ← Pass/fail summary, level breakdown
├── coverage-report.md     ← L1-L4 gap analysis
├── specs/                 ← Generated Playwright .ts files
├── test-plan.md           ← What was planned
├── progress.md            ← Per-module pass/fail log
├── defect-analysis.json   ← Structured failure analysis
├── *-combined-detail.csv  ← All tests in one CSV
├── *-detail.csv           ← Per-module CSVs
└── report.xlsx            ← Excel with summary + per-module tabs
```

---

## Key Design Decisions

### 1. Browse Live App (not read source code)

**Why:** Source code doesn't tell you what the DOM actually looks like at runtime. CSS classes, dynamic IDs, framework-generated attributes — all change. Browsing the real app gives you real selectors that actually work.

### 2. Self-Repair Loop (max 3 attempts)

**Why:** First-time generated tests often have wrong selectors or timing issues. Instead of human fixing, agent analyzes the error, fixes the spec, and retries. Most issues resolve in 1-2 repairs.

### 3. Human Review at Test Plan Stage

**Why:** Prevents agent from generating useless tests. Human approves what to test BEFORE expensive generation runs. Catches: wrong assumptions, features that shouldn't be tested, priority mismatches.

### 4. Manifest-Driven (Optional)

**Why:** Without manifest → agent discovers everything (slower, less precise). With manifest → agent knows exactly what modules exist, their types, and field definitions (faster, more accurate).

### 5. Recipes (Plugin Pattern)

**Why:** Common interaction patterns (search, date filter, CRUD) have boilerplate. Recipes encapsulate these patterns so agent doesn't reinvent each time. Just declare in manifest → tests auto-generated.

---

## Manifest Example

```yaml
app:
  name: My App
  baseUrl: http://localhost:3000
  uiLibrary: mui
  authMode: aad

modules:
  - name: Invoice
    path: /invoices
    type: crud
    fields:
      - { name: invoiceNo, type: text, required: true }
      - { name: amount, type: number, min: 0 }
      - { name: status, type: select, options: [Draft, Approved, Paid] }
    recipes:
      multi-field-search:
        fields: [invoiceNo, customerName]
      date-filter:
        trigger: "#date-range"
      status-toggle:
        column: Status
        values: [Active, Inactive]

  - name: Dashboard
    path: /dashboard
    type: hub

  - name: eInvoice Form
    path: /einvoice
    type: form-wizard
    steps: 4
```

---

## What Makes This Powerful

1. **Zero manual test writing** — agent generates everything from live app
2. **Self-healing** — tests fix themselves (up to 3x)
3. **Framework-aware** — adapters for MUI, Ant Design, Chakra, shadcn
4. **Levels (L1-L4)** — structured coverage from basic to business logic
5. **Reports auto-generated** — deterministic from JSON results, not hand-written
6. **Scalable** — works locally or on EC2 via platform dashboard

---

## Comparison: test-playwright vs Our Mobile Tester

| Aspect | test-playwright (Web) | Our Mobile Tester |
|--------|----------------------|-------------------|
| Target | Web apps (browser) | Mobile apps (emulator/simulator) |
| Discovery | Browse live DOM, extract selectors | Scan source code + list_elements_on_screen |
| Test format | Playwright .ts spec files | YAML scripts |
| Execution | Playwright runner | mobile-mcp tool calls |
| Self-repair | ✅ Run → fail → fix → rerun (3x) | ❌ Not yet |
| Test levels | L1-L4 (structure → business logic) | Flat (happy/negative/boundary) |
| Human review | ✅ Review test-plan before proceed | ❌ Auto (no approval step) |
| Auth handling | Integrated (AAD/TOTP/session) | Manual (prompt/credentials.md) |
| Manifest | YAML with module types + fields | prompt/ folder + module-order.yaml |
| Report | Excel + MD + CSV + defect analysis | Excel per module |
| Deployment | Local + EC2 + Web dashboard | Local only |
| UI framework | Auto-detect (MUI, Ant, Chakra) | N/A (mobile native) |
| Recipes | Plugin pattern (search, filter, CRUD) | ❌ Not yet |

---

## What We Could Adopt for Mobile

1. **Self-repair loop** — if test fails, agent tries to fix (wrong element, timing) and rerun
2. **Test levels** — L1 (app loads), L2 (interactions), L3 (full flows), L4 (cross-module business logic)
3. **Human review step** — generate test plan → user approves → then execute
4. **Manifest/schema** — structured YAML describing the app's modules (like their e2e-manifest.yaml)
5. **Progress tracking** — write progress.md as tests run (like their per-module log)
6. **Defect analysis** — after failures, generate structured analysis (severity, cause, fix suggestion)
