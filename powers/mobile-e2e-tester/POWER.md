---
name: "mobile-e2e-tester"
displayName: "Mobile E2E Tester"
description: "Automated end-to-end testing for Android and iOS mobile apps with screenshot capture on every assertion. Generates .docx reports with embedded screenshots for test documentation."
keywords: ["mobile", "e2e", "testing", "screenshot", "android", "ios", "emulator", "simulator", "test-script", "coverage", "requirements", "codebase"]
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
- **generate-from-codebase** — Auto-generate test scripts by analyzing source code (POB-202)
- **generate-from-requirements** — Auto-generate test scripts from functional requirement docs (POB-203)
- **report-coverage** — Enhanced reporting with coverage metrics and requirement traceability (POB-205)

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
6. Generate Excel report per module

### Workflow 2: Generate from Excel (Ground Truth)

**Goal:** Upload a manually-written Excel test plan and convert to executable YAML scripts.

**Steps:**
1. Place your Excel test plan (.xlsx) in `docs/` or project root
2. Click ▶️ "Generate Tests from Excel"
3. Agent parses Excel → creates YAML per module in `e2e-tests/`
4. Click ▶️ "Execute Test Scripts" to run them

### Workflow 3: Cross-Platform Test Run

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

### Workflow 4: Generate Test Scripts from Codebase (POB-202)

**Goal:** Read app source code and auto-generate reusable YAML test scripts.

**Trigger:**
```
Generate test scripts from the codebase
```

**Steps:**
1. Agent reads `prompt/*.md` for additional context (flow order, credentials, business logic)
2. Agent reads source files (Compose/SwiftUI/XML)
3. Identifies screens, interactive elements, and state changes
4. Generates YAML test scripts in `e2e-tests/` directory (ordered by flow from prompt context)
5. Outputs coverage.yaml showing element coverage
6. Increments version in version.yaml

### Workflow 5: Generate Test Scripts from Requirements (POB-203)

**Goal:** Parse requirement docs and auto-generate test scripts with traceability.

**Trigger:**
```
Generate test scripts from docs/requirements.md
```

**Steps:**
1. Agent reads `prompt/*.md` for additional context (flow order, test data, special instructions)
2. Agent reads requirement documents (MD, PDF, DOCX, TXT in docs/ or requirements/)
3. Extracts testable acceptance criteria
4. Generates YAML test scripts with `requirement_id` field (ordered by flow from prompt context)
5. Outputs traceability.yaml mapping requirements → test scripts
6. Increments version in version.yaml

### Workflow 6: Report with Coverage & Traceability (POB-205)

**Goal:** Generate enhanced Excel report with coverage metrics and requirement traceability.

**Trigger:**
```
Run E2E tests with coverage report
```

**Steps:**
1. Agent reads `prompt/*.md` for context (credentials, workarounds, special handling)
2. Execute tests (screenshots at every step, saved to e2e-runs/)
3. Generate .xlsx report with:
   - Results table (User Flow, Test No., Scenario, Steps, Expected, Status, Actual, Screenshot)
   - Pass = Actual same as Expected; Fail = what actually happened
   - Color coding (green/red/yellow)
4. Save to `e2e-runs/run-{DD-MM-YY}_(HH-MM)/`

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
  **IMPORTANT — Escape special characters to avoid shell hang:**
  ```bash
  # Characters that MUST be escaped with backslash: ! @ # $ % ^ & * ( ) < > | ; ' " ` ~ space
  
  # Examples:
  adb shell input text "TestPass1234\!"        # ! escaped
  adb shell input text "user\@company.com"     # @ escaped  
  adb shell input text "hello\ world"          # space escaped
  adb shell input text "price\$100"            # $ escaped
  adb shell input text "test\#tag"             # # escaped
  
  # Multiple special chars:
  adb shell input text "P\@ss\!word\#1"        # P@ss!word#1
  ```
  **If text has many special chars, type character by character as fallback:**
  ```bash
  adb shell input text "TestPass1234"
  adb shell input keyevent 74  # keycode for specific char
  ```
  **Or use mobile_type_keys instead** — it doesn't have shell escaping issues (but may not work on all Android devices).
- **Keyboard dismiss:** `mobile_press_button` with button="BACK"
- **Stylus overlay fix:** If handwriting overlay appears:
  ```bash
  {adb_path} -s {device_id} shell settings put secure stylus_handwriting_enabled 0
  ```
- **Clear text field:** Select all + delete (fast):
  ```bash
  {adb_path} -s {device_id} shell input keyevent KEYCODE_CTRL_A
  {adb_path} -s {device_id} shell input keyevent KEYCODE_DEL
  ```
  Never use `--longpress KEYCODE_DEL` repeated — it's extremely slow.
- **ADB path (macOS):** `~/Library/Android/sdk/platform-tools/adb`

### iOS
- **No BACK button** — Use swipe gesture or tap navigation back button
- **Text input:** `mobile_type_keys` works reliably on iOS simulators
- **Home button:** `mobile_press_button` with button="HOME"
- **App install:** Use `.app` directory or `.zip` for simulators, `.ipa` for real devices
- **Keyboard dismiss:** Tap outside the text field or use "Done"/"Return" key

## Report Generation

### Format
Reports are generated as `.xlsx` (Excel) files with this structure:
- **Sheet 1: Executive Summary** (FIRST sheet) containing:
  - Module Overview table: Module Name, Total Test Cases, Passed, Failed, Skipped, Pass Rate %
  - Bugs by Criticality: Critical (crash/data loss), High (feature broken), Medium (works incorrectly), Low (cosmetic)
  - Overall metrics: total modules, total tests, overall pass rate, coverage %
  - Key Findings: top issues discovered
- **Sheet per module** (e.g., "Home Landing", "Search", "Booking") — test results with summary row at bottom
- **Coverage Summary sheet** (last) — grand totals

All sheets update after every single test case completion.

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

### MaterialCardView buttons not clickable
**Problem:** Buttons using MaterialCardView don't respond to accessibility tap
**Solution:**
- Get button coordinates from `list_elements_on_screen`
- Use direct coordinate tap: `mobile_click_on_screen_at_coordinates`
- If still not working, try `adb shell input tap X Y` with raw pixel coordinates
- Ensure text field focus is removed first (tap elsewhere, or press BACK)

## Test Account Strategy

**THIS IS A DEV/TEST ENVIRONMENT. There is nothing to worry about.**

The agent is ALLOWED and ENCOURAGED to:
- Create new accounts freely
- Change passwords
- Delete accounts
- Create bookings/tickets
- Modify any data

It's test data, not production. Never skip a test because of "side effects."

### Untestable = Per STEP, Never Per FLOW

**NEVER classify an entire flow as untestable.** Break every flow into steps. Test ALL steps up to the point where automation truly cannot proceed. Only the SPECIFIC step that's impossible is the "untestable boundary."

**Example — Sign Up:**
- Steps 1-8 (form fill, validation, password policies, submit) → ALL TESTABLE
- Step 9 (email OTP verification) → untestable boundary
- ✅ Generate tests for steps 1-8
- ❌ WRONG: "Sign Up is untestable because it creates accounts"

**Example — Change Password:**
- Steps 1-3 (navigate, fill current password, fill new password, confirm) → ALL TESTABLE
- Step 4 (if OTP required) → untestable boundary
- ✅ Generate tests for form validation, password policies, mismatch errors

### The ONLY valid reasons a step is untestable:
1. Requires OTP/verification code from external email that cannot be accessed
2. Requires interaction inside third-party WebView whose elements cannot be inspected
3. Requires physical hardware input (camera, fingerprint)
4. Requires real money payment processing

### NEVER valid reasons (explicitly allowed):
- "Creates real accounts" → allowed, it's dev
- "Changes password" → allowed, use throwaway account
- "Deletes data" → allowed, it's test data
- "Requires server state" → set it up or test what you can
- "File uploads" → try adb push

## Best Practices

- Always start tests from a fresh app state (terminate + relaunch)
- Use `list_elements_on_screen` for assertions — call it ONLY ONCE per assertion, never repeat
- Take ONE screenshot per test case (after final assertion) — not after every step
- If an action fails after 1 retry, mark as Failed and move on — never loop
- Name tests descriptively — a failing test name should explain what broke
- Run the same tests on both platforms when possible for comparison
- Keep test flows short and focused — one feature per test
- Always capture failure screenshots immediately (before any cleanup)
- Generate reports even for passing runs — they serve as documentation
- These efficiency rules prevent hitting the 1000 tool call limit per session

## Configuration

**No additional configuration required** — works with any app that's installed on an available Android emulator/device or iOS simulator/device. Just ensure mobile-mcp is configured in your Kiro MCP settings.

## Prompt Context (prompt/ folder)

Create a `prompt/` folder in your project root to give the agent additional context for generating and executing tests. The agent reads ALL `.md` files in this folder before running.

**Common use cases:**
```
prompt/
├── credentials.md     ← Login credentials, API keys for testing
├── flow-order.md      ← Which flows to test first, dependencies between tests
├── workarounds.md     ← Known issues, popups to dismiss, special handling
└── business-logic.md  ← Domain-specific rules the agent should know
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

This folder is optional. Without it, the agent infers everything from code/docs alone.
