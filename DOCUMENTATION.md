# Mobile E2E Tester — How to Use

## What is This?

An automated E2E testing tool that runs on your Android emulator or iOS simulator. It can:

1. **Generate test scripts** from your codebase or requirement docs
2. **Execute tests** automatically (tap, type, swipe, assert)
3. **Screenshot every step** (pass and fail)
4. **Generate a report** (.docx) with coverage metrics and requirement traceability

---

## Quick Start (3 Minutes)

### 1. Prerequisites

Make sure you have:
- [Kiro IDE](https://kiro.dev) installed
- Android emulator **running** (or iOS simulator on macOS)
- Your app **installed** on the emulator/simulator
- Python 3 + python-docx: `pip3 install python-docx`

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

Open **Agent Hooks** panel in Kiro sidebar. You'll see 4 hooks — use them in order:

---

## Available Hooks (Actions)

| # | Hook | What it does |
|---|------|-------------|
| 1 | **Generate Tests from Codebase** ▶️ | Scans source code → generates YAML test scripts |
| 2 | **Generate Tests from Requirements** ▶️ | Reads requirement docs (.md, .pdf, .docx) → generates YAML test scripts |
| 3 | **Execute Test Scripts** ▶️ | Runs YAML scripts on emulator → screenshots → .docx report with coverage |
| 4 | **Run Mobile E2E Tests** ▶️ | Quick mode — infers tests from UI directly, no YAML needed |

---

## Full Workflow (Recommended)

```
STEP 1: Generate test scripts (pick one)
┌─────────────────────────────────────────────────────┐
│                                                       │
│  ▶️ "Generate Tests from Codebase"                    │
│  → Agent scans your source code (Compose/SwiftUI/XML) │
│  → Finds screens, buttons, text fields, flows         │
│  → Outputs: e2e-tests/*.yaml + coverage.yaml          │
│                                                       │
│  OR                                                   │
│                                                       │
│  ▶️ "Generate Tests from Requirements"                │
│  → Agent reads docs/ folder (.md, .pdf, .docx)       │
│  → Extracts testable acceptance criteria              │
│  → Outputs: e2e-tests/*.yaml + traceability.yaml     │
│                                                       │
└─────────────────────────────────────────────────────┘

STEP 2: Execute tests
┌─────────────────────────────────────────────────────┐
│                                                       │
│  ▶️ "Execute Test Scripts"                            │
│  → Reads e2e-tests/*.yaml                            │
│  → Launches app on emulator                          │
│  → Executes each step (tap, type, assert)            │
│  → Screenshots every assertion                        │
│  → Generates e2e-test-report.docx with:              │
│     • Results table (pass/fail)                       │
│     • Requirement traceability                        │
│     • Coverage metrics                                │
│     • Coverage gaps                                   │
│     • All screenshots embedded                        │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## Quick Mode (Skip YAML generation)

If you just want a fast test without generating scripts first:

1. Click ▶️ **"Run Mobile E2E Tests"**
2. Agent infers tests directly from the UI
3. Screenshots + basic report generated

Use this for quick checks. Use the full workflow for formal testing with traceability.

---

## Output Files

After a full run:

```
your-project/
├── e2e-tests/                        ← Generated test scripts (reusable)
│   ├── 01-app-launch.yaml
│   ├── 02-greeting-flow.yaml
│   ├── 03-counter-increment.yaml
│   ├── coverage.yaml                 ← Element coverage metrics
│   └── traceability.yaml             ← Requirement → test mapping
├── e2e-screenshots/                   ← Visual evidence
│   ├── e2e-android-01-greeting-pass.png
│   ├── e2e-android-02-counter-pass.png
│   └── e2e-android-03-something-FAIL.png
└── e2e-test-report.docx              ← Full report for stakeholders
```

---

## Report Contents

The `.docx` report includes:

1. **Executive Summary** — total tests, pass/fail count, coverage %
2. **Results Table** — test name, requirement ID, expected, actual, status
3. **Requirement Traceability** — which requirement is covered by which test
4. **Coverage Metrics** — elements tested vs total, gaps identified
5. **Failure Details** — screenshots + suggested fixes for each failure
6. **All Screenshots** — embedded visual evidence

---

## Supported Platforms

| Platform | Device Type | Text Input Method |
|----------|-------------|-------------------|
| Android | Emulator | ADB (`adb shell input text`) |
| Android | Physical device | ADB (`adb shell input text`) |
| iOS | Simulator | `mobile_type_keys` (native) |
| iOS | Physical device | `mobile_type_keys` (native) |

Both platforms use the same flow — agent adapts automatically.

---

## Requirement Document Formats

For "Generate Tests from Requirements", the agent reads:

| Format | Location | Example |
|--------|----------|---------|
| Markdown | `docs/*.md` | User stories, acceptance criteria |
| PDF | `docs/*.pdf` | Functional spec documents |
| DOCX | `docs/*.docx` | Word requirement docs |
| Text | `docs/*.txt` | Plain text specs |

Put your requirement docs in `docs/` or `requirements/` folder.

---

## What's Already Included (Workspace Level)

When you clone this repo, everything is ready:

| What | Location | You Get |
|------|----------|---------|
| **MCP Config** | `.kiro/settings/mcp.json` | mobile-mcp auto-connects to device |
| **Hooks (4x)** | `.kiro/hooks/` | All 4 action triggers |
| **Power** | `powers/mobile-e2e-tester/` | Agent knowledge (SOP for testing) |
| **Steering** | Power steering files | Detailed guides (YAML schema, platform tips, report format) |

**Setup:** Just update `ANDROID_HOME` path → start emulator → click ▶️.

---

## Sharing / Reuse on Other Projects

To use this on any other mobile project:

1. Copy `.kiro/` and `powers/` folders into the project
2. Update `ANDROID_HOME` in `.kiro/settings/mcp.json`
3. Start emulator with the app installed
4. Open project in Kiro
5. Click hooks — agent scans **that project's** codebase/docs

Everything is generic — no hardcoded references to any specific app.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No devices found" | Start your emulator/simulator first |
| Text not typing (Android) | Run: `adb shell settings put secure stylus_handwriting_enabled 0` |
| App won't launch | Verify package name — run `adb shell pm list packages` to check |
| mobile-mcp not working | Check `.kiro/settings/mcp.json`, restart Kiro |
| "python-docx not found" | Run: `pip3 install python-docx` |
| No YAML files found | Run "Generate Tests from Codebase" first |

---

## Limitations

- Runs on **local devices only** (no cloud device farms yet)
- Tests run **one device at a time** (sequential)
- Report saved **locally** (manual upload needed)
- Emulator must be **already running** before you start
- **Baseline comparison** (POB-206) not yet implemented

---

## Tech Stack

| Component | What | Link |
|-----------|------|------|
| mobile-mcp | Controls Android/iOS devices via MCP | [github.com/mobile-next/mobile-mcp](https://github.com/mobile-next/mobile-mcp) |
| Kiro IDE | AI agent that orchestrates everything | [kiro.dev](https://kiro.dev) |
| python-docx | Generates .docx reports | [pypi.org/project/python-docx](https://pypi.org/project/python-docx/) |
