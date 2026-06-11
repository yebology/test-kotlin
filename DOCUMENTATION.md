# Mobile E2E Tester — How to Use

## What is This?

An automated E2E testing tool that runs on your Android emulator or iOS simulator. It can:

1. **Generate test scripts** from your codebase or requirement docs
2. **Execute tests** automatically (tap, type, swipe, assert)
3. **Screenshot every step** (pass and fail)
4. **Generate an Excel report** (.xlsx) with test steps, status, and results
5. **Save run history** — every execution stored with timestamps

---

## Quick Start (3 Minutes)

### 1. Prerequisites

Make sure you have:
- [Kiro IDE](https://kiro.dev) installed
- Android emulator **running** (or iOS simulator on macOS)
- Your app **installed** on the emulator/simulator
- Python 3 + openpyxl: `pip3 install openpyxl`

### 2. Configure ANDROID_HOME

Open `.kiro/settings/mcp.json` and update the path to your Android SDK:

```json
{
  "mcpServers": {
    "mobile-mcp": {
      "command": "npx",
      "args": ["-y", "@mobilenext/mobile-mcp@latest"],
      "env": {
        "ANDROID_HOME": "/path/to/your/Android/sdk"
      }
    }
  }
}
```

**Common paths:**
| OS | Path |
|----|------|
| macOS | `~/Library/Android/sdk` |
| Linux | `~/Android/Sdk` |
| Windows | `%LOCALAPPDATA%\Android\Sdk` |

### 3. Run

Open **Agent Hooks** panel in Kiro sidebar. You'll see 4 hooks:

---

## Available Hooks

| # | Hook | What it does |
|---|------|-------------|
| 1 | **Generate Tests from Codebase** ▶️ | Scans source code → generates prompt/ + YAML test scripts per module |
| 2 | **Generate Tests from Requirements** ▶️ | Reads docs (.md, .pdf, .docx) → generates YAML test scripts |
| 3 | **Generate Tests from Excel** ▶️ | Reads Excel test plan (ground truth) → converts to YAML per module |
| 4 | **Execute Test Scripts** ▶️ | Runs YAML scripts on device → screenshots → Excel report per module |
| 5 | **Run Mobile E2E Tests** ▶️ | Quick mode — infers tests from UI directly, no YAML |

---

## Full Workflow (Recommended)

```
STEP 1: Generate test scripts
┌─────────────────────────────────────────────────────────┐
│                                                           │
│  ▶️ "Generate Tests from Codebase"                        │
│  → Deep scans entire source code                         │
│  → Auto-generates prompt/ files (prerequisites,          │
│    testable flows, untestable boundaries, navigation,    │
│    known issues)                                         │
│  → Generates YAML test scripts PER MODULE:               │
│    e2e-tests/sign-in/, e2e-tests/booking/, etc.         │
│  → Each module has: happy path + negative + boundary     │
│    + edge cases (comprehensive, strict QA)               │
│  → Increments version.yaml                               │
│                                                           │
│  OR                                                       │
│                                                           │
│  ▶️ "Generate Tests from Requirements"                    │
│  → Reads prompt/*.md + docs/ folder (.md, .pdf, .docx)   │
│  → Generates YAML test scripts + traceability.yaml       │
│  → Increments version.yaml                               │
│                                                           │
└─────────────────────────────────────────────────────────┘

STEP 2: Execute tests (per module, in order)
┌─────────────────────────────────────────────────────────┐
│                                                           │
│  ▶️ "Execute Test Scripts"                                │
│  → Reads prompt/*.md for context                         │
│  → Executes modules IN DEPENDENCY ORDER                  │
│    (sign-in → home → booking → ticketing → ...)         │
│  → Completes one module fully before moving to next      │
│  → Maintains app state between modules (stays logged in) │
│  → Writes to Excel after EACH test case                  │
│  → Batch limit per session, auto-resumes on next click   │
│  → Screenshots after final assertion per test case       │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Test Environment Philosophy

**This is a dev/test environment. The agent is allowed to:**
- Create accounts freely
- Change passwords, delete accounts
- Create bookings, tickets, modify data
- Do anything needed to test — it's not production

**Untestable = per STEP, never per FLOW.** Agent tests all steps up to the point where automation truly cannot proceed (e.g., OTP input). Everything before that boundary is tested.

---

## Prompt Context (prompt/ folder)

Create a `prompt/` folder in project root to give the agent extra context:

```
prompt/
├── credentials.md     ← Login test data
├── flow-order.md      ← Which flows to test first
├── workarounds.md     ← Known popups to dismiss, special handling
└── business-logic.md  ← Domain rules the agent should know
```

**Example `prompt/credentials.md`:**
```markdown
# Test Credentials
- Email: testuser@company.com
- Password: Test123!
- Pin: 1234
```

**Example `prompt/flow-order.md`:**
```markdown
# Test Flow Order
1. Login first (required for all other tests)
2. Home screen tests
3. Profile tests
4. Logout test (last)
```

This folder is **optional**. Without it, agent infers everything from code/docs alone.

---

## Output Structure

After a test run:

```
your-project/
├── prompt/                                 ← Auto-generated context (by Generate hook)
│   ├── 00-prerequisites.md
│   ├── 01-testable-flows.md
│   ├── 02-untestable-flows.md             ← Only specific STEPS, never entire flows
│   ├── 03-navigation-guide.md
│   └── 04-known-issues.md
├── e2e-tests/                              ← Test scripts organized by module
│   ├── module-order.yaml                   ← Execution order (dependencies)
│   ├── sign-in/
│   │   ├── SI-HP-001.yaml
│   │   ├── SI-NP-001.yaml
│   │   └── SI-EC-001.yaml
│   ├── home-navigation/
│   │   └── MN-HP-001.yaml
│   ├── booking/
│   │   └── BK-HP-001.yaml
│   ├── coverage.yaml
│   ├── traceability.yaml
│   └── version.yaml
└── e2e-runs/                               ← Run history
    └── run-10-06-26_(14-30)/
        ├── metadata.yaml
        ├── e2e-test-report.xlsx
        └── screenshots/
```

---

## Excel Report Format

The Excel has **one sheet per module** + a Coverage Summary sheet:

### Module Sheets (e.g., "Home Landing", "Search", "Booking")

Each module gets its own sheet with:

| User Flow | Test No. | Test Scenario | Test Steps | Expected Results | Status | Actual Results | Screenshot |
|-----------|----------|---------------|------------|-----------------|--------|---------------|------------|
| Home | HL-HP-001 | Landing loads | 1. Open app... | Home screen shown | Passed | Home screen shown | HL-HP-001.png |
| ... | ... | ... | ... | ... | ... | ... | ... |
| **Summary** | | | | | | **5 Passed, 1 Failed, 0 Skipped (Total: 6)** | |

### Coverage Summary Sheet (last sheet)

| Metric | Value |
|--------|-------|
| Total Test Cases | 50 |
| Executed | 45 |
| Passed | 40 |
| Failed | 3 |
| Skipped | 2 |
| Pass Rate | 93% |
| Coverage | 90% |

**Rules:**
- Passed → Actual Results = same as Expected
- Failed → Actual Results = what actually happened
- Skip → Actual Results = reason for skipping
- Color coded: green (pass), red (fail), yellow (skip)

**Writing behavior:**
- Excel file created at the START of the run (with headers)
- Each test case result written IMMEDIATELY after completion
- Sheet 2 and summary row recalculated after EVERY test case
- If interrupted mid-run, all completed test cases are already saved
- Progress reported to user per module (not per test case)
- **Batch limit: 10 test cases per session** — prevents hitting platform tool call limit
- **Auto-resume:** Click ▶️ again → agent reads existing Excel, finds last test case, continues from there
- Multiple sessions write to the SAME Excel file until all test cases complete

---

## Version Tracking

Every time you generate test scripts, `version.yaml` increments:

```yaml
# e2e-tests/version.yaml
version: "2"
generated_date: "2026-06-09"
generated_from: "codebase"
```

Each run's `metadata.yaml` records which TC version was used — so you know which scripts produced which results.

---

## Quick Mode (Skip YAML generation)

If you just want a fast test without generating scripts first:

1. Click ▶️ **"Run Mobile E2E Tests"**
2. Agent infers tests directly from the UI
3. Screenshots + basic report generated

Use this for quick checks. Use the full workflow for formal testing with traceability.

---

## Supported Platforms

| Platform | Device Type | Text Input Method |
|----------|-------------|-------------------|
| Android | Emulator | ADB (`adb shell input text`) |
| Android | Physical device | ADB (`adb shell input text`) |
| iOS | Simulator | `mobile_type_keys` (native) |
| iOS | Physical device | `mobile_type_keys` (native) |

Agent adapts automatically based on which device it detects.

---

## What's Already Included (Workspace Level)

When you clone this repo, everything is ready:

| What | Location | You Get |
|------|----------|---------|
| **MCP Config** | `.kiro/settings/mcp.json` | mobile-mcp auto-connects to device |
| **Hooks (4x)** | `.kiro/hooks/` | All 4 action triggers |
| **Power** | `powers/mobile-e2e-tester/` | Agent knowledge (SOP for testing) |

**Setup:** Just update `ANDROID_HOME` path → start emulator → click ▶️.

---

## Sharing / Reuse on Other Projects

To use on any other mobile project:

1. Copy `.kiro/` and `powers/` folders into the project
2. Update `ANDROID_HOME` in `.kiro/settings/mcp.json`
3. (Optional) Create `prompt/` folder with test context
4. (Optional) Put requirement docs in `docs/`
5. Start emulator with app installed
6. Open project in Kiro → click hooks

Everything is generic — no hardcoded references to any specific app.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No devices found" | Start your emulator/simulator first |
| Text not typing (Android) | Agent auto-runs: `adb shell settings put secure stylus_handwriting_enabled 0` |
| App won't launch | Verify package name — run `adb shell pm list packages` |
| mobile-mcp not working | Check `.kiro/settings/mcp.json`, restart Kiro |
| "openpyxl not found" | Agent auto-installs, or run: `pip3 install openpyxl` |
| No YAML files for execute | Run "Generate Tests from Codebase" first |

---

## Limitations

- Runs on **local devices only** (no cloud device farms yet)
- Tests run **sequentially** (one device at a time)
- Report saved **locally** (manual upload needed)
- Emulator must be **already running** before you start
- **~30 test cases per run** — platform limit of 1000 tool calls per session. Agent auto-batches (10 per session) and resumes on next click.

---

## Tech Stack

| Component | What | Link |
|-----------|------|------|
| mobile-mcp | Controls Android/iOS devices via MCP | [github.com/mobile-next/mobile-mcp](https://github.com/mobile-next/mobile-mcp) |
| Kiro IDE | AI agent that orchestrates everything | [kiro.dev](https://kiro.dev) |
| openpyxl | Generates Excel reports | [pypi.org/project/openpyxl](https://pypi.org/project/openpyxl/) |
