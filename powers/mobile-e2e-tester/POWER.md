---
name: "mobile-e2e-tester"
displayName: "Mobile E2E Tester"
description: "Automated end-to-end testing for Android and iOS mobile apps with screenshot capture on every assertion. Generates .docx reports with embedded screenshots for test documentation."
keywords: ["mobile", "e2e", "testing", "screenshot", "android", "ios", "emulator", "simulator"]
author: "Yobel"
---

# Mobile E2E Tester

## Overview

Mobile E2E Tester automates end-to-end testing on Android emulators/devices and iOS simulators/devices using mobile-mcp. It runs test flows, captures screenshots at every step, and generates a `.docx` report with embedded screenshots — especially useful for documenting test results, catching regressions, and sharing evidence with teams.

Key capabilities:
- Detect and test on all available Android and iOS devices simultaneously
- Screenshot capture on every assertion (pass and fail)
- Automatic `.docx` report generation with embedded screenshots and results table
- Platform-aware input handling (ADB for Android, native for iOS)
- Failure-first documentation — failures are always screenshotted and highlighted

## Available Steering Files

- **android-testing** — Android-specific workflows, ADB tips, and common issues
- **ios-testing** — iOS-specific workflows, simulator handling, and gesture navigation
- **report-generation** — How to generate and customize the .docx test report

## Onboarding

### Prerequisites

**For Android:**
- Android Studio installed with at least one emulator configured
- ADB available (typically at `~/Library/Android/sdk/platform-tools/adb`)
- App APK installed on the emulator

**For iOS:**
- Xcode installed with at least one simulator configured
- Simulator booted and running
- App `.app` bundle installed on the simulator

**For Report Generation:**
- Python 3 with `python-docx` package: `pip3 install python-docx`

### Verification

Before running tests, verify devices are available:
1. Use `mobile_list_available_devices` to see all online devices
2. Confirm your target device shows `state: "online"`
3. Launch your app with `mobile_launch_app`

## Common Workflows

### Workflow 1: Full E2E Test Run (Single Device)

**Goal:** Run all tests on one device with screenshots at every step.

**Steps:**
1. List available devices → pick target device
2. Launch the app on the device
3. Verify app loaded via `mobile_list_elements_on_screen`
4. Take initial screenshot as baseline
5. For each test case:
   - Perform actions (tap, type, swipe)
   - Assert expected state via element inspection
   - Take screenshot (labeled pass/fail)
6. Generate `.docx` report with all results

### Workflow 2: Cross-Platform Test Run

**Goal:** Run the same test suite on both Android and iOS.

**Steps:**
1. List all available devices (both platforms)
2. Run test suite on Android device first
3. Run same test suite on iOS device
4. Generate combined report comparing results across platforms

### Workflow 3: Failure Documentation

**Goal:** When a test fails, capture maximum evidence.

**Steps:**
1. On assertion failure, immediately take screenshot
2. Log expected vs actual values
3. Capture element tree state via `mobile_list_elements_on_screen`
4. Continue with remaining tests (don't stop)
5. Generate report with failures prominently marked ❌

## Test Execution Protocol

### Before Each Test
1. Ensure app is in a known state (relaunch if needed)
2. Dismiss any system dialogs or overlays

### During Each Test
1. **Act** — Perform the user action
2. **Wait** — Allow UI to update (check elements)
3. **Assert** — Verify expected state exists in element tree
4. **Screenshot** — Always capture current state

### After Each Test
1. Record result (pass/fail) with details
2. Save screenshot with naming convention

### Screenshot Naming Convention
```
e2e-{platform}-{test-number}-{test-name}-{result}.png
```
Examples:
- `e2e-android-01-greeting-flow-pass.png`
- `e2e-ios-03-counter-reset-FAIL.png`

### Screenshot Storage
All screenshots saved to: `{project_root}/e2e-screenshots/`

## Platform-Specific Notes

### Android
- **Text input:** Use ADB for reliable text entry:
  ```bash
  {adb_path} -s {device_id} shell input text "{text}"
  ```
- **Keyboard dismiss:** `mobile_press_button` with button="BACK"
- **Stylus overlay fix:** If handwriting overlay appears:
  ```bash
  {adb_path} -s {device_id} shell settings put secure stylus_handwriting_enabled 0
  ```
- **Clear text field:** Use ADB keyevents:
  ```bash
  {adb_path} -s {device_id} shell input keyevent KEYCODE_MOVE_END
  {adb_path} -s {device_id} shell input keyevent --longpress KEYCODE_DEL KEYCODE_DEL ...
  ```
- **ADB path (macOS):** `~/Library/Android/sdk/platform-tools/adb`

### iOS
- **No BACK button** — Use swipe gesture or tap navigation back button
- **Text input:** `mobile_type_keys` works reliably on iOS simulators
- **Home button:** `mobile_press_button` with button="HOME"
- **App install:** Use `.app` directory or `.zip` for simulators, `.ipa` for real devices
- **Keyboard dismiss:** Tap outside the text field or use "Done"/"Return" key

## Report Generation

### Format
Reports are generated as `.docx` files using `python-docx` with:
- Title and metadata (device, date, platform)
- Test results table (test name, expected, actual, status)
- Embedded screenshots (especially failures)
- Findings and observations section

### Report Structure
```
E2E Test Report — {App Name}
├── Device Info (name, platform, version)
├── Date and timestamp
├── Test Results Table
│   ├── # | Test Case | Expected | Actual | Status
│   └── ... (one row per test)
├── Screenshots Section
│   ├── Failures (prominently displayed)
│   └── Key passes
└── Findings & Observations
```

### Generating the Report
The report is generated via a Python script that:
1. Reads test results from the test run
2. Embeds screenshots from `e2e-screenshots/`
3. Creates formatted table with pass/fail indicators
4. Saves to `{project_root}/e2e-test-report.docx`

## Troubleshooting

### No devices found
**Problem:** `mobile_list_available_devices` returns empty
**Solution:**
- Android: Start emulator from Android Studio → AVD Manager
- iOS: Open Simulator from Xcode → Open Developer Tool → Simulator
- Verify device is fully booted before testing

### Text input not working (Android)
**Problem:** `mobile_type_keys` doesn't enter text
**Cause:** Stylus/handwriting overlay intercepting input
**Solution:**
1. Disable stylus: `adb shell settings put secure stylus_handwriting_enabled 0`
2. Use ADB text input instead: `adb shell input text "your text"`

### App not launching
**Problem:** `mobile_launch_app` fails
**Solution:**
- Verify package name is correct (use `mobile_list_apps`)
- Ensure app is installed on the device
- Try terminating first: `mobile_terminate_app`, then relaunch

### Screenshots are blank or wrong
**Problem:** Screenshot doesn't match expected state
**Cause:** UI hasn't finished updating
**Solution:**
- Add a brief wait or re-check elements before screenshotting
- Use `mobile_list_elements_on_screen` to verify state first

### Element not found
**Problem:** Expected element not in `list_elements_on_screen`
**Cause:** Element may be off-screen or not yet rendered
**Solution:**
- Try scrolling: `mobile_swipe_on_screen` direction="up"
- Wait for element to appear
- Check if keyboard is covering the element

## Best Practices

- Always start tests from a fresh app state (terminate + relaunch)
- Use `list_elements_on_screen` for assertions, not screenshots (screenshots are for documentation)
- Take screenshots AFTER assertions, not before
- Name tests descriptively — a failing test name should explain what broke
- Run the same tests on both platforms when possible for comparison
- Keep test flows short and focused — one feature per test
- Always capture failure screenshots immediately (before any cleanup)
- Generate reports even for passing runs — they serve as documentation

## Configuration

**No additional configuration required** — works with any app that's installed on an available Android emulator/device or iOS simulator/device. Just ensure mobile-mcp is configured in your Kiro MCP settings.
