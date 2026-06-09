---
inclusion: manual
---

# Mobile E2E Testing with Screenshots

## Overview
Automated E2E testing workflow for Android and iOS using mobile-mcp. Runs tests on available devices, captures screenshots on every step (especially failures), and generates a report.

## Workflow

### Step 1: Device Discovery
- Call `mobile_list_available_devices` to find all available Android emulators/devices and iOS simulators/devices.
- Report which devices are online and their platform/version.
- If no devices are found, instruct the user to start an emulator or simulator.

### Step 2: App Launch
- For each target device, launch the app using `mobile_launch_app` with the package name.
- Wait for the app to load, then call `mobile_list_elements_on_screen` to verify the UI is ready.
- Take an initial screenshot as baseline: `mobile_save_screenshot` with filename `e2e-{platform}-{test-name}-initial.png`.

### Step 3: Test Execution
For each test case:
1. **Arrange** — Set up the precondition (navigate to screen, clear state, etc.)
2. **Act** — Perform the action (tap, type, swipe)
3. **Assert** — Call `mobile_list_elements_on_screen` and verify expected elements/text exist
4. **Screenshot** — Always take a screenshot after assertion:
   - On **PASS**: save as `e2e-{platform}-{test-name}-pass.png`
   - On **FAIL**: save as `e2e-{platform}-{test-name}-FAIL.png`

### Step 4: Report Generation
After all tests complete, generate a `.docx` report with:
- Test results table (test name, expected, actual, status)
- Embedded screenshots (especially failures)
- Device info and timestamp
- Save to project root as `e2e-test-report.docx`

## Platform-Specific Notes

### Android
- Use `BACK` button to dismiss keyboard: `mobile_press_button` with button="BACK"
- For text input, prefer ADB if `mobile_type_keys` doesn't work:
  ```
  {adb_path} -s {device_id} shell input text "{text}"
  ```
- Disable stylus handwriting if it interferes:
  ```
  {adb_path} -s {device_id} shell settings put secure stylus_handwriting_enabled 0
  ```
- ADB path on macOS: `~/Library/Android/sdk/platform-tools/adb`

### iOS
- No `BACK` button — use swipe right from left edge or tap navigation back button
- For text input, `mobile_type_keys` generally works well on iOS simulators
- Use `mobile_press_button` with button="HOME" to go to home screen
- App install uses `.app` directory or `.zip` for simulators, `.ipa` for real devices

## Screenshot Naming Convention
```
e2e-{platform}-{test-number}-{test-name}-{result}.png
```
Examples:
- `e2e-android-01-greeting-flow-pass.png`
- `e2e-ios-03-counter-reset-FAIL.png`

## Screenshot Storage
Save all screenshots to: `{project_root}/e2e-screenshots/`

## Test Case Format
When the user provides test cases, structure them as:
```
Test: {name}
Precondition: {setup needed}
Steps:
  1. {action}
  2. {action}
Expected: {what should happen}
```

## Failure Handling
- On failure, ALWAYS take a screenshot immediately
- Log the expected vs actual values
- Continue with remaining tests (don't stop on first failure)
- Mark failed tests prominently in the report with ❌

## Multi-Device Testing
If multiple devices are available (e.g., Android emulator + iOS simulator):
- Run the same test suite on each device
- Save screenshots with platform prefix
- Generate a combined report comparing results across platforms
