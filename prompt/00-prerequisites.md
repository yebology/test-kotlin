# Prerequisites

## Test Environment
- Platform: Android Emulator (Pixel 7, API 34)
- App: Must be installed and launchable
- State: Fresh install or logged out state before each module

## Required Accounts
- Test account must be created before running (use sign-in module first)
- Any accounts created during testing are disposable

## Network
- Internet connection required for API calls
- No VPN or proxy needed (dev/staging environment)

## Known Device Quirks
- Stylus handwriting must be disabled: `adb shell settings put secure stylus_handwriting_enabled 0`
- Keyboard dismiss: use BACK button after typing
- Some animations may need extra wait time (500ms)
