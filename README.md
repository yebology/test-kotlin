# Mobile E2E Test Orchestrator

Automated end-to-end testing for Android/iOS mobile apps. Generate test scripts with AI, execute them deterministically on emulators — parallel, no manual intervention, $0 per run.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  GENERATE (AI, one-time, ~$0.05-0.50)                       │
│                                                             │
│  Source: codebase / requirements / Excel / remote repo      │
│  AI scans → outputs YAML test scripts + prompt/ context     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  EXECUTE (deterministic, $0, unlimited runs)                │
│                                                             │
│  Reads YAML → calls mobile-mcp → tap/type/swipe/assert     │
│  → screenshot → write Excel → per test case                │
│  → parallel across N emulators                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  OUTPUT                                                     │
│                                                             │
│  e2e-runs/run-{date}/                                       │
│  ├── e2e-test-report.xlsx (Executive Summary + modules)    │
│  ├── report.md (markdown summary)                           │
│  ├── defect-analysis.json (structured failures)             │
│  ├── screenshots/                                           │
│  └── metadata.yaml                                          │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **Node.js 18+**
- **Android SDK** — `adb` and `emulator` in PATH
- **At least 1 AVD** — create via Android Studio AVD Manager
- **OpenAI API key** — for Generate step only (~$0.05/run with GPT-3.5)
- **App installed on emulator** — the app you want to test

## Quick Start

```bash
# 1. Install
cd orchestrator
npm install

# 2. Configure
cp .env.example .env
# Edit .env → add OPENAI_API_KEY

# 3. Start emulator (Android Studio or CLI)
emulator -avd Pixel_7_API_34 &

# 4. Run
make run
```

## Step-by-Step Usage

### Step 1: Generate Test Scripts

You have 4 options for generating YAML test scripts:

#### Option A: From Local Codebase
Place your Android/iOS project source code in this folder (or a sibling folder), then:
```bash
make generate
# Choose "Generate tests from codebase"
# Choose "No" for remote repo (uses local files)
# Select model: GPT-3.5 Turbo (cheapest)
```

#### Option B: From Remote Repo (GitHub / Bitbucket / CodeCommit / GitLab)
```bash
make generate
# Choose "Generate tests from codebase"
# Choose "Yes" for remote repo
# Paste URL: https://github.com/your-org/your-app.git
# Paste token: ghp_xxxxx (or leave empty for public repos)
# Branch: main
```

Token formats per provider:
| Provider | Token Format | How to Get |
|----------|-------------|-----------|
| GitHub | `ghp_xxxxxxxxxxxx` | Settings → Developer Settings → Personal Access Tokens |
| Bitbucket | `email@co.com:ATBBxxxx` | Personal Settings → API tokens |
| GitLab | `glpat-xxxxxxxxxxxx` | Preferences → Access Tokens |
| CodeCommit | `username:password` | IAM → HTTPS Git credentials |

#### Option C: From Requirements Documents
Place `.md`, `.txt`, or `.pdf` files in a `docs/` folder, then:
```bash
make generate-req
```

#### Option D: From Excel Test Plan
Place your `.xlsx` test plan in `docs/` folder, then:
```bash
make generate-excel
```

### Step 2: Review Generated Output

After generate completes, you'll have:
```
e2e-tests/
├── module-order.yaml          ← execution order + dependencies
├── version.yaml               ← TC version tracking
├── coverage.yaml              ← element coverage
├── sign-in/
│   ├── SI-HP-001.yaml         ← happy path test
│   ├── SI-NP-001.yaml         ← negative test
│   └── SI-EC-001.yaml         ← edge case test
├── home/
│   └── HM-HP-001.yaml
└── booking/
    └── BK-HP-001.yaml

prompt/
├── 00-prerequisites.md        ← app package, credentials
├── 01-testable-flows.md       ← what can be tested
├── 02-untestable-flows.md     ← specific steps that can't be automated
├── 03-navigation-guide.md     ← how to navigate the app
└── 04-known-issues.md         ← automation workarounds
```

You can edit any of these files before executing.

### Step 3: Execute Tests

```bash
make execute
```

The wizard will:
1. Generate recipe-based tests (if recipes defined in module-order.yaml)
2. Show **Test Plan Summary** → you approve before running
3. Ask how many parallel workers (1-4 emulators)
4. Detect/start emulators
5. Execute all test cases deterministically (no AI in the loop)
6. Write Excel report after each test case
7. Take screenshots
8. Generate final report

### Step 4: View Results

```
e2e-runs/run-13-06-26_(18-30)/
├── e2e-test-report.xlsx       ← open this in Excel/Google Sheets
├── sign-in-report.xlsx        ← per-module report
├── report.md                  ← quick markdown summary
├── defect-analysis.json       ← for CI/CD integration
├── test-plan.md               ← what was planned
├── metadata.yaml              ← run metadata
└── screenshots/
    ├── e2e-android-SI-HP-001-pass.png
    ├── e2e-android-SI-NP-001-FAIL.png
    └── ...
```

### Step 5: Resume (if interrupted)

```bash
make resume
# Picks up from last incomplete module
```

### Step 6: Compare Runs

```bash
make compare
# Select 2 runs → shows regressions and fixes
```

## All Commands

```bash
make              # show help
make run          # interactive wizard (all options)
make generate     # generate from codebase
make generate-req # generate from requirements docs
make generate-excel # generate from Excel test plan
make execute      # execute tests (2 workers)
make execute-4    # execute tests (4 workers)
make resume       # resume interrupted run
make compare      # compare 2 runs (regressions/fixes)
make verbose      # execute with full output
make typecheck    # TypeScript type check
make clean        # remove node_modules + build artifacts
```

## CLI Flags

```bash
./wizard.sh --generate codebase      # skip menu, go straight to generate
./wizard.sh --generate requirements
./wizard.sh --generate excel
./wizard.sh --workers 4              # 4 parallel emulators
./wizard.sh --workers 1              # single device (safest)
./wizard.sh --resume                 # continue from last run
./wizard.sh --compare                # compare runs
./wizard.sh --model gpt-3.5          # cheapest model
./wizard.sh --model gpt-4o-mini      # better quality
./wizard.sh --modules "SignIn,Home"   # only specific modules
./wizard.sh --verbose                # show all MCP tool calls
./wizard.sh --apk /path/to/app.apk  # auto-install APK
./wizard.sh --timeout 3600           # 1 hour timeout per module
```

## Configuration

### .env File

```env
# AI (only for Generate step)
OPENAI_API_KEY=sk-xxxxx
OPENAI_BASE_URL=                     # optional: custom endpoint

# Remote repo (optional)
REPO_URL=https://github.com/org/app.git
REPO_TOKEN=ghp_xxxxx
REPO_BRANCH=main

# Android
ANDROID_HOME=/Users/you/Library/Android/sdk
```

### Prompt Context (optional)

Create a `prompt/` folder in project root to give extra context:

```
prompt/
├── credentials.md     ← test login credentials
├── flow-order.md      ← which flows to test first
├── workarounds.md     ← known popups/issues
└── business-logic.md  ← domain rules
```

### Recipes (optional)

Add recipes to `module-order.yaml` for auto-generated pattern tests:

```yaml
modules:
  - name: Sign In
    folder: sign-in
    recipes:
      - id: login-flow
        params:
          emailField: "Email"
          passwordField: "Password"
          loginButton: "Sign In"
          testEmail: "test@example.com"
          testPassword: "Test123!"
      - id: form-validation
        params:
          submitButton: "Sign In"
```

Available recipes: `login-flow`, `form-validation`, `list-scroll`, `navigation-tabs`, `crud-flow`, `orientation-change`

## Architecture

```
orchestrator/
├── wizard.sh            # entry point (loads .env, runs wizard.ts)
├── Makefile             # convenience commands
├── .env.example         # configuration template
├── package.json
├── tsconfig.json
└── src/
    ├── wizard.ts        # main flow (Clack interactive UI)
    ├── config.ts        # CLI arg parsing
    ├── types.ts         # TypeScript types
    ├── models.ts        # AI model registry (add models here)
    ├── repo.ts          # git clone/pull from remote repos
    ├── generator.ts     # AI-powered YAML generation (OpenAI)
    ├── executor.ts      # deterministic test execution (no AI)
    ├── self-repair.ts   # AI fallback when element not found
    ├── mcp-client.ts    # persistent mobile-mcp connection
    ├── emulator.ts      # start/stop/boot Android emulators
    ├── modules.ts       # module discovery + dependency resolution
    ├── excel-writer.ts  # incremental Excel report (ExcelJS)
    ├── report-merger.ts # merge per-module reports
    ├── report-generator.ts  # report.md + defect-analysis.json
    ├── test-plan.ts     # test plan approval (human gate)
    ├── recipes.ts       # reusable test pattern templates
    ├── compare-runs.ts  # run diff (regressions/fixes)
    ├── resume.ts        # run state + resume logic
    └── progress.ts      # terminal progress display
```

## Cost

| Action | Cost | When |
|--------|------|------|
| Generate (GPT-3.5) | ~$0.05-0.15 | Once, or when requirements change |
| Generate (GPT-4o Mini) | ~$0.15-0.50 | Once, better quality |
| Execute | $0 | Every run — deterministic, no AI |
| Self-repair | ~$0.01 | Only when element not found |
| **Typical total** | **~$0.10** | **One-time setup, then free** |

## Excel Report Format

### Sheet 1: Executive Summary
- Module Overview table (Module, Total, Passed, Failed, Skipped, Pass Rate %)
- Bugs table per module (Test Case ID, Severity, Reason)
- Overall Metrics (Date, TC Version, Device, Pass Rate, Coverage %)
- Key Findings
- Untestable Steps (from prompt/02-untestable-flows.md)

### Sheet 2+: Per Module
- Headers: User Flow | Test No. | Test Scenario | Test Steps | Expected Results | Status | Actual Results | Screenshot
- Color coded rows: green (pass), red (fail), yellow (skip)
- Summary row at bottom

### Last Sheet: Coverage Summary
- Total, Executed, Passed, Failed, Skipped, Pass Rate, Coverage %

## Comparison with Kiro IDE Hooks

| | Kiro Hooks | This Orchestrator |
|---|---|---|
| Trigger | Click ▶️ in IDE | `make run` in terminal |
| AI cost | $0 (Kiro subscription) | ~$0.10 one-time |
| Execute cost | $0 | $0 |
| Parallel | ❌ 1 device | ✅ 1-4 devices |
| Session limit | 1000 tool calls | Unlimited |
| Manual clicks | Per batch (10 tests) | Zero |
| CI/CD ready | ❌ | ✅ |
| IDE required | Yes | No |
| Output format | Same Excel | Same Excel |

Both produce identical output. This orchestrator is the headless/parallel version.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `OPENAI_API_KEY not set` | Add to `.env` file |
| `No e2e-tests/ directory` | Run `make generate` first |
| `No AVDs found` | Create one in Android Studio AVD Manager |
| `No emulators available` | Start emulator: `emulator -avd YourAVD &` |
| `Element not found` | Self-repair will try to find it. If persistent, update YAML selectors |
| `MCP connection failed` | Check mobile-mcp: `npx @mobilenext/mobile-mcp@latest` |
| `Git clone failed` | Check REPO_URL and REPO_TOKEN in .env |
| TypeScript errors | Run `make typecheck` |

## Adding New Models

Edit `src/models.ts`:

```typescript
{
  id: 'my-model',
  label: 'My Custom Model',
  provider: 'openai',
  apiModel: 'my-model-id',
  envKey: 'MY_API_KEY',
  baseUrlEnvKey: 'MY_BASE_URL',
  defaultBaseUrl: 'https://api.myservice.com/v1',
  costHint: '~$0.XX per generate',
}
```

Works with any OpenAI-compatible API (Azure OpenAI, LiteLLM, Ollama, vLLM, etc.)

## License

Internal tool — not open source.
