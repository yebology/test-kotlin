# Mobile E2E Tester — How to Use

## What is This?

An automated E2E testing tool that runs on your Android emulator or iOS simulator. You click one button in Kiro IDE, and it:

1. Detects your running device
2. Launches your app
3. Runs through test flows (tap, type, swipe)
4. Takes a screenshot on every assertion
5. Generates a `.docx` report with all screenshots embedded

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

### 3. Run Tests

**Option A — One Click:**
1. Open **Agent Hooks** panel (sidebar)
2. Find **"Run Mobile E2E Tests"**
3. Click ▶️
4. Done — wait for results

**Option B — Chat:**
```
Run E2E tests on my app
```

---

## What Happens When You Run It

```
You click ▶️
    │
    ▼
Agent detects your emulator/simulator
    │
    ▼
Kills and relaunches your app (fresh state)
    │
    ▼
Takes initial screenshot (baseline)
    │
    ▼
For each test:
    ├── Performs action (tap button, type text, etc.)
    ├── Checks if expected result appeared
    ├── Takes screenshot → saves to e2e-screenshots/
    │       ├── PASS → e2e-android-01-test-name-pass.png
    │       └── FAIL → e2e-android-01-test-name-FAIL.png
    └── Continues to next test
    │
    ▼
Generates e2e-test-report.docx
    │
    ▼
Done ✅ — report + screenshots saved in project root
```

---

## Output Files

After a test run, you'll find:

```
your-project/
├── e2e-screenshots/
│   ├── e2e-android-00-initial-state.png
│   ├── e2e-android-01-greeting-flow-pass.png
│   ├── e2e-android-02-counter-increment-pass.png
│   └── e2e-android-03-some-test-FAIL.png    ← failures highlighted
└── e2e-test-report.docx                      ← full report with screenshots
```

The `.docx` report contains:
- Device info + timestamp
- Pass/fail summary
- Results table (test name, expected, actual, status)
- All screenshots embedded (failures shown prominently)
- Findings & observations

---

## Supported Platforms

| Platform | Device Type | Text Input Method |
|----------|-------------|-------------------|
| Android | Emulator | ADB (`adb shell input text`) |
| Android | Physical device | ADB (`adb shell input text`) |
| iOS | Simulator | `mobile_type_keys` (native) |
| iOS | Physical device | `mobile_type_keys` (native) |

Both platforms use the same test flow — the agent automatically adapts based on which device it detects.

---

## Customizing Tests

The agent infers tests from your app's UI. But you can also tell it what to test:

```
Run E2E tests on my app. Test these flows:
1. Type "John" in the name field, tap Submit, verify "Hello, John!" appears
2. Tap the +1 button 5 times, verify counter shows 5
3. Tap Reset, verify counter goes back to 0
```

The agent will follow your instructions and screenshot each step.

---

## Cross-Platform Testing

If you have both Android emulator and iOS simulator running:

```
Run E2E tests on all available devices
```

The agent will:
1. Run tests on Android first
2. Run the same tests on iOS
3. Generate one combined report comparing both platforms

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No devices found" | Start your emulator/simulator first |
| Text not typing (Android) | Run: `adb shell settings put secure stylus_handwriting_enabled 0` |
| App won't launch | Verify package name — run `adb shell pm list packages` to check |
| mobile-mcp not working | Check `.kiro/settings/mcp.json` has correct `ANDROID_HOME` path, restart Kiro |
| "python-docx not found" | Run: `pip3 install python-docx` |

---

## What's Already Included (Workspace Level)

When you clone this repo, everything is already set up:

| What | Location | You Get |
|------|----------|---------|
| **MCP Config** | `.kiro/settings/mcp.json` | mobile-mcp auto-connects to your emulator/simulator |
| **Hook** | `.kiro/hooks/mobile-e2e-test.kiro.hook` | One-click ▶️ button to run E2E tests |
| **Power** | `powers/mobile-e2e-tester/` | Agent knows best practices, platform tricks, report format |
| **Steering** | `.kiro/steering/mobile-e2e-testing.md` | Extra context available via `#mobile-e2e-testing` in chat |

**No additional setup needed in Kiro** — just update `ANDROID_HOME` path and you're good.

---

## Sharing This Tool

Want someone else to use this?

1. They clone this repo
2. Open in Kiro IDE
3. Update `ANDROID_HOME` in `.kiro/settings/mcp.json`
4. Start their emulator
5. Install the app on emulator
6. Click ▶️ on "Run Mobile E2E Tests" hook

That's it — hook, power, steering, and MCP config all come with the repo.

---

## Limitations

- Runs on **local devices only** (no cloud device farms yet)
- Tests run **one device at a time** (sequential)
- Report saved **locally** (manual upload to Google Docs needed)
- Needs emulator/simulator **already running** before you start
