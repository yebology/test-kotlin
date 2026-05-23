# iOS E2E Testing Guide

## Device Setup

### Starting a Simulator
1. Open Xcode → Window → Devices and Simulators → Simulators tab
2. Or from terminal: `open -a Simulator`
3. Boot a specific device:
   ```bash
   xcrun simctl boot "iPhone 15 Pro"
   ```
4. Verify with `mobile_list_available_devices` — device should show `platform: "ios"` and `state: "online"`

### Listing Available Simulators
```bash
xcrun simctl list devices available
```

## Text Input Strategy

### Standard Input (Works Well on iOS)
Unlike Android, `mobile_type_keys` works reliably on iOS simulators:
```
mobile_click_on_screen_at_coordinates(device, x, y)  // Focus field
mobile_type_keys(device, "Hello World", submit=false)
```

### Submitting Text
To press Return/Done after typing:
```
mobile_type_keys(device, "search query", submit=true)
```

### Clearing Text Fields
1. Triple-tap to select all text:
```
mobile_double_tap_on_screen(device, x, y)  // Select word
// Or use Select All via long press menu
```
2. Type new text (replaces selection)

### Alternative: Simctl Input
```bash
xcrun simctl io {device_id} input text "Hello"
```

## Navigation

### Back Navigation (No Hardware Back Button)
iOS has no hardware back button. Options:
1. **Tap navigation back button** — Find it via `list_elements_on_screen` (usually top-left)
2. **Swipe from left edge** — Swipe right from the left edge of the screen:
   ```
   mobile_swipe_on_screen(device, direction="right", x=20, y=500)
   ```

### Home Button
```
mobile_press_button(device, "HOME")
```

### Dismissing Keyboard
- Tap outside the text field
- Swipe down on the keyboard area
- Press "Done" or "Return" button on keyboard (find via elements)

## Common iOS Issues

### Issue: Simulator Not Detected
**Symptom:** `list_available_devices` doesn't show iOS devices
**Fix:**
1. Ensure Xcode is installed: `xcode-select --install`
2. Boot simulator: `xcrun simctl boot "iPhone 15"`
3. Open Simulator app: `open -a Simulator`

### Issue: App Not Installed
**Symptom:** `launch_app` fails with app not found
**Fix:** Install the app:
```
mobile_install_app(device, "/path/to/YourApp.app")
```
For simulators, use `.app` directory or `.zip` file.

### Issue: System Alerts Blocking
**Symptom:** iOS permission alerts ("Allow Notifications", "Allow Location") block the app
**Fix:**
1. Find alert buttons via `list_elements_on_screen`
2. Tap "Allow" or "Don't Allow" as appropriate
3. Or pre-grant permissions:
   ```bash
   xcrun simctl privacy {device_id} grant all {bundle_id}
   ```

### Issue: Keyboard Not Appearing
**Symptom:** Tapping text field doesn't show keyboard in simulator
**Fix:** Toggle software keyboard:
- In Simulator menu: I/O → Keyboard → Toggle Software Keyboard
- Or shortcut: ⌘+K

### Issue: Dark Mode Affecting Screenshots
**Symptom:** Screenshots look different than expected
**Fix:** Set appearance:
```bash
xcrun simctl ui {device_id} appearance light
```

## iOS-Specific Assertions

### Checking Element Existence
Use `mobile_list_elements_on_screen` and search for:
- `text` field for visible text
- `label` field for accessibility labels
- `type` field for element type (UIButton, UITextField, etc.)

### SwiftUI Accessibility
SwiftUI elements use `.accessibilityIdentifier()` and `.accessibilityLabel()`:
- `label` in element list corresponds to `accessibilityLabel`
- Elements without labels may only show `text` content

### Example Assertion Pattern
```
1. Call mobile_list_elements_on_screen(device)
2. Search results for element with expected text/label
3. If found → PASS, save screenshot with -pass suffix
4. If not found → FAIL, save screenshot with -FAIL suffix immediately
```

## App Lifecycle

### Fresh Start
```
mobile_terminate_app(device, bundleId)
mobile_launch_app(device, bundleId)
```

### Reset App State
For a completely fresh state, uninstall and reinstall:
```
mobile_uninstall_app(device, bundleId)
mobile_install_app(device, "/path/to/App.app")
mobile_launch_app(device, bundleId)
```

### Background and Foreground
```
mobile_press_button(device, "HOME")      // Background
mobile_launch_app(device, bundleId)       // Foreground again
```

## Screenshot Tips

- iOS simulators include the notch/Dynamic Island in screenshots
- Status bar shows simulated time (not real time)
- For cleaner screenshots, dismiss any keyboards first
- Use `mobile_save_screenshot` with platform prefix: `e2e-ios-{test-name}.png`
- Landscape screenshots: use `mobile_set_orientation(device, "landscape")` first
