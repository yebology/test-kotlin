# Untestable Steps

These are SPECIFIC STEPS within flows that cannot be automated. The rest of each flow IS testable.

| Module | Step | Reason |
|--------|------|--------|
| Sign Up | Email OTP verification (step 9) | Requires access to email inbox |
| Payment | Real card charge confirmation | Requires actual payment processing |
| Push Notifications | Triggering the notification | Requires server-side event |
| Camera | Taking a photo/scanning QR | Requires physical camera hardware |
| Biometrics | Fingerprint/Face ID verification | Requires physical biometric hardware |

## Important
- ONLY these specific steps are untestable
- All OTHER steps in these flows MUST still be tested
- Example: Sign Up form validation, password strength, field masking are ALL testable even though OTP is not
