# Mobile E2E Tester — How to Use

## What is This?

An automated cross-platform E2E testing tool that runs on **Android emulators/devices** and **iOS simulators/devices**. It can:

1. **Generate test scripts** from your codebase (Compose, SwiftUI, XML) or requirement docs
2. **Execute tests** automatically on all detected platforms (tap, type, swipe, assert)
3. **Screenshot every assertion** (pass and fail)
4. **Generate an Excel report** (.xlsx) with coverage metrics, requirement traceability, and per-platform results

---

## Quick Start (3 Minutes)

### 1. Prerequisites

Make sure you have:
- [Kiro IDE](https://kiro.dev) installed
- Android emulator **running** and/or iOS simulator **running**
- Your app **installed** on the emulator/simulator
- Python 3 + openpyxl: `pip3 install openpyxl`

### 2. Configure MCP

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

**Common ANDROID_HOME paths:**
| OS | Path |
|----|------|
| macOS | `~/Library/Android/sdk` |
| Linux | `~/Android/Sdk` |
| Windows | `%LOCALAPPDATA%\Android\Sdk` |

> **Note:** For iOS-only testing, `ANDROID_HOME` is not required. mobile-mcp detects iOS simulators via Xcode tools automatically.

### 3. Run

Open **Agent Hooks** panel in Kiro sidebar. You'll see 4 hooks — use them in order:

---

## Available Hooks (Actions)

| # | Hook | What it does |
|---|------|-------------|
| 1 | **Generate Tests from Codebase** ▶️ | Scans source code (Compose/SwiftUI/XML) → generates YAML test scripts with correct platform |
| 2 | **Generate Tests from Requirements** ▶️ | Reads requirement docs (.md, .pdf, .docx) → generates YAML test scripts |
| 3 | **Execute Test Scripts** ▶️ | Runs YAML scripts on all matching devices → screenshots → .xlsx report |
| 4 | **Run Mobile E2E Tests** ▶️ | Quick mode — infers tests from UI directly, no YAML needed |

---

## Full Workflow (Recommended)

```
STEP 1: Generate test scripts (pick one)
┌─────────────────────────────────────────────────────────┐
│                                                           │
│  ▶️ "Generate Tests from Codebase"                        │
│  → Agent scans your source code                           │
│  → Kotlin/Compose → platform: ["android"]                 │
│  → Swift/SwiftUI  → platform: ["ios"]                     │
│  → Both languages → platform: ["android", "ios"]          │
│  → Finds screens, buttons, text fields, flows             │
│  → Outputs: e2e-tests/*.yaml + coverage.yaml              │
│                                                           │
│  OR                                                       │
│                                                           │
│  ▶️ "Generate Tests from Requirements"                    │
│  → Agent reads docs/ folder (.md, .pdf, .docx)           │
│  → Extracts testable acceptance criteria                  │
│  → Outputs: e2e-tests/*.yaml + traceability.yaml         │
│                                                           │
└─────────────────────────────────────────────────────────┘

STEP 2: Execute tests
┌─────────────────────────────────────────────────────────┐
│                                                           │
│  ▶️ "Execute Test Scripts"                                │
│  → Detects all online devices (Android + iOS)             │
│  → Matches each script's platform field to device         │
│  → Adapts input method per platform automatically         │
│  → Executes each step (tap, type, assert)                 │
│  → Screenshots every assertion                            │
│  → Generates e2e-runs/run-{date}_(time)/ with:           │
│     • e2e-test-report.xlsx (per-platform results)         │
│     • metadata.yaml                                       │
│     • screenshots/ folder                                 │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Mode (Skip YAML generation)

If you just want a fast test without generating scripts first:

1. Click ▶️ **"Run Mobile E2E Tests"**
2. Agent infers tests directly from the UI on all online devices
3. Screenshots + basic .docx report generated

Use this for quick checks. Use the full workflow for formal testing with traceability.

---

## Cross-Platform Behavior

The agent **auto-detects** which devices are online and adapts behavior per platform:

| Aspect | Android | iOS |
|--------|---------|-----|
| **Text Input** | ADB (`adb shell input text`) | `mobile_type_keys` (native) |
| **Clear Field** | `KEYCODE_CTRL_A` + `KEYCODE_DEL` | Triple-tap select all + retype |
| **Dismiss Keyboard** | `BACK` button | Tap outside field or press Done |
| **Back Navigation** | Hardware `BACK` button | Swipe right from left edge |
| **Permission Alerts** | `adb shell pm grant` or tap Allow | Tap Allow/Don't Allow |
| **Stylus Overlay Fix** | `adb shell settings put secure stylus_handwriting_enabled 0` | N/A |

### Multi-Device Scenarios

| Devices Online | What Happens |
|----------------|-------------|
| Android only | Tests run on Android, report shows Android results |
| iOS only | Tests run on iOS, report shows iOS results |
| Both Android + iOS | Tests run on **both** devices, report grouped by platform |
| Script has `platform: ["android"]` only | Skipped on iOS device |
| Script has `platform: ["ios"]` only | Skipped on Android device |
| Script has `platform: ["android", "ios"]` | Runs on both |

---

## Output Files

After a full run (with baseline integration):

```
your-project/
├── e2e-tests/                              ← Generated test scripts (reusable)
│   ├── 01-app-launch.yaml
│   ├── 02-greeting-flow.yaml
│   ├── 03-counter-increment.yaml
│   ├── coverage.yaml                       ← Element coverage metrics
│   ├── traceability.yaml                   ← Requirement → test mapping
│   └── version.yaml                        ← TC version metadata
└── e2e-runs/                               ← History of all runs
    └── run-09-06-26_(12-17)/
        ├── e2e-test-report.xlsx            ← Excel report
        ├── metadata.yaml                   ← Run metadata
        └── screenshots/                    ← All screenshots for this run
            ├── e2e-android-01-app-launch-pass.png
            ├── e2e-ios-01-app-launch-pass.png
            └── ...
```

---

## Report Contents (.xlsx)

The Excel report includes:

1. **Metadata Header** — app name, device(s), date, TC version, pass/fail summary
2. **Results Table** — User Flow, Test No., Test Scenario, Test Steps, Expected Results, Status (color-coded), Actual Results, Screenshot filename
3. **Color Coding** — Green for Passed, Red for Failed, Yellow for Skipped
4. **Multi-Platform** — If both platforms tested, results are grouped or include a Platform column

---

## Supported Platforms

| Platform | Device Type | Text Input Method | Back Navigation |
|----------|-------------|-------------------|-----------------|
| Android | Emulator | ADB (`adb shell input text`) | `BACK` button |
| Android | Physical device | ADB (`adb shell input text`) | `BACK` button |
| iOS | Simulator | `mobile_type_keys` (native) | Swipe right from left edge |
| iOS | Physical device | `mobile_type_keys` (native) | Swipe right from left edge |

---

## iOS Setup Guide

### Starting an iOS Simulator

```bash
# Option 1: From terminal
open -a Simulator

# Option 2: Boot specific device
xcrun simctl boot "iPhone 15 Pro"

# Option 3: From Xcode
# Xcode → Window → Devices and Simulators → Simulators tab
```

### Installing App on Simulator

```bash
# Install .app directory or .zip
xcrun simctl install booted /path/to/YourApp.app

# For real devices, use .ipa file via mobile_install_app
```

### Pre-granting Permissions (Optional)

```bash
xcrun simctl privacy booted grant all com.your.bundleid
```

### Verifying iOS Device is Detected

After booting the simulator, the agent will detect it via `mobile_list_available_devices` showing:
```json
{"id": "SIMULATOR_ID", "name": "iPhone 15 Pro", "platform": "ios", "state": "online"}
```

---

## Android Setup Guide

### Starting an Emulator

1. Open Android Studio → Tools → AVD Manager
2. Click play on your virtual device
3. Wait for home screen to appear

### Verifying Android Device is Detected

```bash
adb devices
# Should show: emulator-5554   device
```

### Fixing Common Android Input Issues

```bash
# Disable stylus overlay (do once per emulator session)
adb -s emulator-5554 shell settings put secure stylus_handwriting_enabled 0
```

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
| **MCP Config** | `.kiro/settings/mcp.json` | mobile-mcp auto-connects to Android/iOS devices |
| **Hooks (4x)** | `.kiro/hooks/` | All 4 action triggers (cross-platform) |
| **Power** | `powers/mobile-e2e-tester/` | Agent knowledge (SOP for testing) |
| **Steering** | Power steering files | Platform-specific guides (Android, iOS, report format) |

**Setup:** Update `ANDROID_HOME` path (if using Android) → start emulator/simulator → click ▶️.

---

## Sharing / Reuse on Other Projects

To use this on any other mobile project:

1. Copy `.kiro/` and `powers/` folders into the project
2. Update `ANDROID_HOME` in `.kiro/settings/mcp.json` (Android projects)
3. Start emulator/simulator with the app installed
4. Open project in Kiro
5. Click hooks — agent scans **that project's** codebase/docs

Works with:
- **Android** — Kotlin/Compose, Java, XML layouts
- **iOS** — SwiftUI, UIKit (Storyboard/XIB)
- **Cross-platform** — KMP, Flutter, React Native (generates tests for both platforms)

---

## Troubleshooting

### Common Issues

| Problem | Platform | Fix |
|---------|----------|-----|
| "No devices found" | Both | Start your emulator/simulator first |
| Text not typing | Android | Run: `adb shell settings put secure stylus_handwriting_enabled 0` |
| Text not typing | iOS | Toggle software keyboard: Simulator → I/O → Keyboard → Toggle Software Keyboard (⌘+K) |
| App won't launch | Android | Verify package name: `adb shell pm list packages \| grep yourapp` |
| App won't launch | iOS | Verify bundle ID: `xcrun simctl listapps booted` |
| Permission alert blocking | iOS | Pre-grant: `xcrun simctl privacy booted grant all {bundle_id}` |
| Keyboard covering elements | Android | Agent auto-dismisses with BACK button before next tap |
| Keyboard covering elements | iOS | Agent taps outside field to dismiss |
| mobile-mcp not working | Both | Check `.kiro/settings/mcp.json`, restart Kiro |
| "openpyxl not found" | Both | Run: `pip3 install openpyxl` |
| No YAML files found | Both | Run "Generate Tests from Codebase" first |
| Dark mode affecting screenshots | iOS | Run: `xcrun simctl ui booted appearance light` |

---

## Baseline Integration (Run History)

Every test execution is saved as a timestamped run:

```
e2e-runs/
├── run-08-06-26_(14-30)/     ← First run
│   ├── metadata.yaml
│   ├── e2e-test-report.xlsx
│   └── screenshots/
├── run-09-06-26_(12-17)/     ← Second run
│   ├── metadata.yaml
│   ├── e2e-test-report.xlsx
│   └── screenshots/
└── ...
```

Run folder format: `run-{DD-MM-YY}_(HH-MM)` — unique and sortable by date.

You can ask the agent to **compare runs**: "Compare run-08-06-26_(14-30) vs run-09-06-26_(12-17)" to see regressions and fixes.

---

## Limitations

- Runs on **local devices only** (no cloud device farms yet)
- Tests run **sequentially** per device (one device at a time)
- Report saved **locally** (manual upload needed)
- Emulator/simulator must be **already running** before you start
- iOS real devices require `.ipa` file (not `.app` directory)

---

## Tech Stack

| Component | What | Link |
|-----------|------|------|
| mobile-mcp | Controls Android/iOS devices via MCP | [github.com/mobile-next/mobile-mcp](https://github.com/mobile-next/mobile-mcp) |
| Kiro IDE | AI agent that orchestrates everything | [kiro.dev](https://kiro.dev) |
| openpyxl | Generates .xlsx Excel reports | [pypi.org/project/openpyxl](https://pypi.org/project/openpyxl/) |
