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

**Step 3:** Type via ADB:
```bash
adb -s {device_id} shell input text "{text}"
```

**Step 4:** Dismiss keyboard:
```
mobile_press_button(device, "BACK")
```

### Clearing Text Fields
```bash
# Move cursor to end
adb -s {device_id} shell input keyevent KEYCODE_MOVE_END

# Select all
adb -s {device_id} shell input keyevent KEYCODE_CTRL_A

# Delete
adb -s {device_id} shell input keyevent KEYCODE_DEL
```

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
