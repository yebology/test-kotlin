# Testable Flows

## Fully Automatable
1. **Sign In** — Email + password login, validation errors, forgot password link
2. **Home Navigation** — Bottom nav tabs, screen transitions, back navigation
3. **Search** — Query input, results display, filters, empty state
4. **Booking** — Select item, fill form, confirm, view confirmation
5. **Ticketing** — View tickets list, ticket details, status changes
6. **Profile** — View profile, edit fields, save changes, avatar
7. **Settings** — Toggle switches, language change, logout

## Partially Automatable (up to boundary)
- **Sign Up** — Steps 1-8 (form fill, validation) testable. Step 9 (email OTP) is boundary.
- **Payment** — All steps up to actual payment gateway. Mock confirmation testable.
- **Push Notifications** — Cannot trigger from outside. Can verify UI state if notification received manually.
