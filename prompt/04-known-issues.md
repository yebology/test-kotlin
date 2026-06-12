# Known Issues & Workarounds

## Current Known Bugs
1. **Search empty state flickers** — After clearing search, empty state shows for 200ms then disappears. Wait 500ms before asserting.
2. **Profile avatar upload timeout** — Sometimes takes >5s. If element not found after 5s, retry once.
3. **Booking calendar scroll** — Calendar month scroll sometimes doesn't register. Use coordinate-based swipe instead of element swipe.

## Workarounds for Testing
| Issue | Workaround |
|-------|-----------|
| Keyboard covers button | Press BACK to dismiss keyboard before tapping buttons below |
| Element not found | Try scrolling down once, then check again |
| Tap not registering | Use coordinate-based tap instead of element-based |
| Text field not clearing | Use CTRL+A then DEL (keycode sequence) |
| Loading spinner blocking | Wait 2s then retry the assertion |

## Flaky Areas (May Need Retry)
- Network-dependent screens (Search results, Booking confirmation)
- Animations (bottom sheet, page transitions) — add 500ms wait
- Pull-to-refresh — swipe distance must be sufficient

## Agent Behavior Notes
- If a test fails on first try, retry ONCE with a different approach (e.g., coordinate tap instead of element tap)
- If still failing after retry, mark as Failed and move on
- Never loop more than 2 attempts per action
