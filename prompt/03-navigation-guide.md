# Navigation Guide

## App Entry Points
- Cold start: Opens to Sign In screen (if not logged in)
- After login: Opens to Home screen

## Bottom Navigation
- Home (index 0)
- Search (index 1)
- Bookings (index 2)
- Tickets (index 3)
- Profile (index 4)

## Navigation Patterns
- Bottom tab → tap tab item by text/label
- Detail screen → tap list item → detail opens
- Back → BACK button or left arrow in toolbar
- Modal → appears on top, dismiss via X button or BACK
- Drawer → swipe from left edge or tap hamburger icon

## State Dependencies
- Home, Search: available immediately after login
- Bookings: requires at least one booking to have meaningful content
- Tickets: requires at least one ticket created
- Profile: available immediately, shows logged-in user data
- Settings: accessible from Profile screen → gear icon

## Known Popups/Overlays
- Location permission dialog (first launch): tap "While using the app"
- Notification permission (Android 13+): tap "Allow"
- Update dialog (if version is old): tap "Later" or dismiss
