# E2E Test Orchestrator

Multi-agent orchestrator that runs E2E mobile tests **in parallel** across multiple Android emulators. Each agent is a Claude API conversation with tool-use that directly controls its assigned device.

## How It Works

```
./wizard.sh
    │
    ▼
wizard.ts (interactive Clack UI)
    │
    ├── Detects/starts N emulators
    ├── Reads e2e-tests/ modules + module-order.yaml
    ├── Assigns 1 module per emulator
    │
    ├── Spawns N parallel Claude API conversations:
    │   ├── Agent 1: Module A → emulator-5554 (Claude + tool-use loop)
    │   ├── Agent 2: Module B → emulator-5556 (Claude + tool-use loop)
    │   └── Agent 3: Module C → emulator-5558 (Claude + tool-use loop)
    │
    ├── Each agent calls mobile-mcp tools (tap, type, swipe, assert, screenshot)
    ├── Real-time progress: ✔ Module A — 8/8 | ◐ Module B — running (3/7) | ○ Module C — pending
    │
    └── Merges per-module Excel reports into 1 combined report
```

## Prerequisites

1. **Node.js 18+**
2. **Android SDK** with emulator + adb in PATH
3. **At least 1 AVD** created (Android Studio → AVD Manager)
4. **Anthropic API Key** — get one at https://console.anthropic.com
5. **Python 3 + openpyxl** — `pip3 install openpyxl` (for Excel report scripts)
6. **Test scripts generated** — run "Generate Tests from Codebase" hook in Kiro first

## Setup

```bash
cd orchestrator

# Install dependencies
npm install

# Configure API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Run

```bash
# Interactive mode (recommended)
./wizard.sh

# With options
./wizard.sh --workers 4 --verbose

# Resume interrupted run
./wizard.sh --resume

# Run specific modules only
./wizard.sh --modules "Search,Profile" --workers 2

# With APK auto-install
./wizard.sh --apk /path/to/app.apk --workers 3
```

## CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--modules "A,B"` | all | Comma-separated module names to run |
| `--workers N` | 2 | Number of parallel agents/emulators |
| `--resume` | false | Resume from last incomplete run |
| `--verbose` | false | Show all tool calls in real-time |
| `--timeout N` | 1800 | Timeout per module in seconds |
| `--apk path` | — | APK to install before running |

## Architecture

Each "agent" is a Claude API conversation loop:

```
┌─────────────────────────────────────────────┐
│  Claude API (claude-sonnet-4-20250514)            │
│  System prompt: module instructions + context│
│                                             │
│  ←→ Tool calls:                             │
│      • mobile_list_elements_on_screen       │
│      • mobile_click_on_screen_at_coordinates│
│      • mobile_type_keys                     │
│      • mobile_swipe_on_screen               │
│      • mobile_save_screenshot               │
│      • run_adb_command                      │
│      • write_file (Excel scripts)           │
│      • run_python_script (reports)          │
│                                             │
│  Loop until all test cases complete or      │
│  MAX_TURNS (200) reached                    │
└─────────────────────────────────────────────┘
```

No `kiro-cli` dependency. No IDE required. Just the API + emulators.

## Project Structure

```
orchestrator/
├── wizard.sh               # Entry point
├── .env.example            # API key template
├── package.json
├── tsconfig.json
└── src/
    ├── wizard.ts           # Main flow (Clack prompts, orchestration)
    ├── types.ts            # TypeScript types
    ├── config.ts           # CLI arg parsing
    ├── emulator.ts         # Start/stop/boot emulators via ADB
    ├── modules.ts          # Module discovery + dependency resolution
    ├── agent.ts            # Claude API tool-use loop (core engine)
    ├── prompt-generator.ts # Per-module system prompt builder
    ├── report-merger.ts    # Excel merge (ExcelJS)
    ├── progress.ts         # Terminal progress UI
    └── resume.ts           # Run state + resume logic
```

## Cost Estimation

Each agent (module) uses approximately:
- ~100-200 Claude API calls (tool-use turns)
- ~500K-1M input tokens, ~100K-200K output tokens
- **~$3-8 per module** (Sonnet pricing)
- 4 modules parallel = **~$12-32 per full run**

vs. current approach: ~30 min per 10 test cases (human time cost).

## Performance

| Metric | Sequential (Kiro IDE) | Parallel (this orchestrator) |
|--------|----------------------|------------------------------|
| 10 tests | ~30 min | ~10 min |
| 40 tests | ~120 min (4 sessions) | ~15 min (4 workers) |
| Manual intervention | per batch | none |
| Devices | 1 | 1-4 configurable |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "ANTHROPIC_API_KEY not set" | Export it or add to `.env` |
| "No e2e-tests/ directory" | Run "Generate Tests from Codebase" in Kiro first |
| "No AVDs found" | Create one in Android Studio AVD Manager |
| "No emulators available" | Start at least 1 emulator: `emulator -avd YourAVD &` |
| Agent timeout | Increase: `--timeout 3600` |
| High API cost | Reduce workers: `--workers 1` |
