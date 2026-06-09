# Android E2E Testing Guide

## Device Setup

### Starting an Emulator
1. Open Android Studio → Tools → AVD Manager
2. Click the play button on your desired virtual device
3. Wait for the emulator to fully boot (home screen visible)
4. Verify with `mobile_list_available_devices` — device should show `state: "online"`

### ADB Path Resolution
The ADB binary is typically located at:
- **macOS:** `~/Library/Android/sdk/platform-tools/adb`
- **Linux:** `~/Android/Sdk/platform-tools/adb`
- **Windows:** `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`

Find it dynamically:
```bash
find ~/Library/Android -name "adb" -type f 2>/dev/null | head -1
```

## Text Input Strategy

### Problem: Compose TextField Input
Jetpack Compose text fields often don't respond to `mobile_type_keys` on Android emulators. The stylus/handwriting overlay can also intercept input.

### Solution: ADB Input (Recommended)

**Step 1:** Disable stylus handwriting (one-time per emulator session):
```bash
adb -s {device_id} shell settings put secure stylus_handwriting_enabled 0
```

**Step 2:** Tap the text field to focus it:
```
mobile_click_on_screen_at_coordinates(device, x, y)
```

**Step 3:** Type via ADB — **MUST escape special characters:**
```bash
# Safe characters (no escape needed): a-z A-Z 0-9 . - _
# Characters that MUST be escaped: ! @ # $ % ^ & * ( ) < > | ; ' " ` ~ space

# Examples:
adb -s {device_id} shell input text "Kiro"                    # simple, no escape needed
adb -s {device_id} shell input text "TestPass1234\!"          # ! escaped
adb -s {device_id} shell input text "user\@company.com"       # @ escaped
adb -s {device_id} shell input text "hello\ world"            # space escaped
adb -s {device_id} shell input text "P\@ss\!word\#1"          # multiple special chars

# NEVER do this (will hang/stuck):
# adb shell input text "TestPass1234!"     ← ! not escaped = shell hangs
# adb shell input text "user@company.com"  ← @ not escaped = unpredictable
```

**Step 4:** Dismiss keyboard:
```
mobile_press_button(device, "BACK")
```

### Fallback: mobile_type_keys
If ADB escaping is too complex for certain text, try `mobile_type_keys` — it doesn't have shell escaping issues but may not work on all devices/fields:
```
mobile_type_keys(device, "P@ss!word#1", submit=false)
```

### Clearing Text Fields
```bash
# FAST method (select all + delete — under 1 second):
adb -s {device_id} shell input keyevent KEYCODE_CTRL_A
adb -s {device_id} shell input keyevent KEYCODE_DEL

# NEVER use longpress with many KEYCODE_DEL — it's extremely slow (~30 sec for 60 chars)
# BAD: adb shell input keyevent --longpress KEYCODE_DEL KEYCODE_DEL KEYCODE_DEL ...
```

## Important ADB Rules

- **NEVER append `2>&1`** to ANY shell command (ADB, pip, python, mkdir, etc.) — it causes the terminal to hang waiting for output
- **NEVER use `--longpress` with multiple keyevents** — extremely slow
- **ALWAYS escape special characters** in `input text` commands
- Keep each ADB command as a separate single command (no chaining with &&)

## Navigation

### Back Navigation
```
mobile_press_button(device, "BACK")
```
Note: On Android, BACK can:
- Dismiss keyboard
- Close dialogs/overlays
- Navigate back in the app
- Exit the app (if on root screen)

### Home
```
mobile_press_button(device, "HOME")
```

## Common Android Issues

### Issue: Stylus Handwriting Overlay
**Symptom:** A "Try out your stylus" overlay appears when tapping text fields
**Fix:**
```bash
adb -s {device_id} shell settings put secure stylus_handwriting_enabled 0
```
Then terminate and relaunch the app.

### Issue: Keyboard Covering Elements
**Symptom:** Buttons below the text field can't be tapped
**Fix:** Dismiss keyboard with BACK button before tapping other elements:
```
mobile_press_button(device, "BACK")
```

### Issue: App Not Responding
**Symptom:** Taps don't register, UI frozen
**Fix:**
```
mobile_terminate_app(device, packageName)
mobile_launch_app(device, packageName)
```

### Issue: Permission Dialogs
**Symptom:** System permission dialog blocks the app
**Fix:** Grant via ADB:
```bash
adb -s {device_id} shell pm grant {package} android.permission.{PERMISSION}
```
Or tap "Allow" on the dialog using coordinates from `list_elements_on_screen`.

## Android-Specific Assertions

### Checking Element Existence
Use `mobile_list_elements_on_screen` and search for:
- `text` field for visible text content
- `label` field for accessibility labels (contentDescription in Compose)
- `type` field for widget type

### Example Assertion Pattern
```
1. Call mobile_list_elements_on_screen(device)
2. Search results for element with expected text/label
3. If found → PASS, take screenshot
4. If not found → FAIL, take screenshot immediately
```

## Screenshot Tips

- Take screenshots AFTER dismissing the keyboard for cleaner captures
- If testing scrollable content, scroll to the relevant section first
- Use `mobile_save_screenshot` with descriptive filenames
- Screenshots capture the full device screen including status bar
