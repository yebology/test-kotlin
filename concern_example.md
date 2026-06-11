# Untestable Flows

Flows that CANNOT be fully automated via UI automation.

**Handling Rule**: Do NOT generate test scripts for these flows. If encountered during execution, mark as Skip with reference to this file.

---

## Flow: Forgot Password (OTP Verification)
- **Screens**: ForgotPassword1VC → ForgotPassword2VC → ForgotPassword3VC
- **Reason**: Requires real OTP code sent to email via AWS Cognito. The 6-digit code cannot be programmatically retrieved in a simulator without email access or backend override.
- **What would be needed**: A test OTP bypass on the backend, or access to a test email inbox API.

## Flow: Sign Up (Full Registration)
- **Screens**: SignUp1VC → SignUp2VC → SignUpSuccessVC
- **Reason**: Creates real accounts in AWS Cognito. Each test run would create new users requiring cleanup. Also involves server-side state that persists.
- **What would be needed**: A test environment with account cleanup hooks, or mock Cognito.

## Flow: Book Inventory (Full Booking)
- **Screens**: BookFormVC → signature capture → PaymentVC (WebView) → BookingDetailVC
- **Reason**: Multiple untestable dependencies:
  1. Signature capture (custom SignaturePad → touch drawing)
  2. Payment via third-party WebView (redirect URLs, external payment gateway)
  3. Creates real bookings with financial implications
  4. Requires valid inventory availability (server-side time-dependent state)
- **What would be needed**: Mock payment gateway, signature bypass, test inventory with guaranteed availability.

## Flow: Payment Processing
- **Screens**: PaymentVC (WKWebView)
- **Reason**: Loads external payment gateway in WebView. Cannot inspect or interact with third-party payment form elements. Polling-based status check after redirect.
- **What would be needed**: A sandbox payment gateway with auto-complete, or mock payment response.

## Flow: E-Invoice Request
- **Screens**: RequestEinvoiceVC → EinvoiceVC
- **Reason**: Requires a completed booking with specific status. Server-side state dependency on active booking.
- **What would be needed**: Pre-seeded test booking in ACTIVE state.

## Flow: Push Notification Handling
- **Screens**: AppDelegate notification handlers → Redirect logic
- **Reason**: Requires sending actual push notifications via APNs. Simulator has limited push support, and testing redirects requires specific notification payloads.
- **What would be needed**: APNs simulation tool or local notification injection with correct payload structure.

## Flow: Change Password
- **Screens**: PasswordSecurityVC
- **Reason**: Changes actual password in AWS Cognito. Would invalidate test credentials for subsequent test runs.
- **What would be needed**: Password reset after test, or dedicated throwaway test account per run.

## Flow: Delete Account
- **Screens**: SettingsVC (implied from API: `/profile/delete`)
- **Reason**: Permanently deletes the Cognito user. Destructive and irreversible for the test account.
- **What would be needed**: Account recreation automation.

## Flow: Cancel Booking
- **Screens**: PaymentVC → Cancel dialog
- **Reason**: Requires an existing pending booking. Server-side state dependency.
- **What would be needed**: Pre-seeded pending booking.

## Flow: Ticketing (Create/Reply)
- **Screens**: NewTicketVC → TicketDetailVC
- **Reason**: Creating tickets involves file attachments (upload to S3 pre-signed URL). Reply also involves server-side ticket state.
- **What would be needed**: Mock file upload, pre-seeded tickets.

## Flow: Deep Linking / Universal Links
- **Screens**: AppLinkManager → various redirects
- **Reason**: Requires external URL trigger (colabsdev:// scheme). Simulator URL scheme injection is fragile and not standard in mobile MCP.
- **What would be needed**: Programmatic URL scheme invocation support.

## Flow: Location Permission & Nearby
- **Screens**: HomeVC → LocationManager
- **Reason**: Requires GPS location permission and real coordinates. Simulator can set fake location but automation of permission dialogs is unreliable.
- **What would be needed**: Pre-granted location permission, mock coordinates.