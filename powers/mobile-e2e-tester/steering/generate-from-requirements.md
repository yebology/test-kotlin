# Generate Test Scripts from Functional Requirements (POB-203)

## Overview

Parse functional requirement documents and auto-generate **detailed** E2E test scripts with traceability. The agent reads requirements + prompt context, extracts acceptance criteria, and outputs comprehensive YAML test scripts (happy path, negative, boundary, edge cases).

## Input

The agent reads (in this order):
1. **prompt/*.md** — additional context (credentials, flow order, business logic)
2. **Requirement docs** — .md, .pdf, .docx, .txt files in `docs/` or `requirements/`

## Output

- YAML test script files in `e2e-tests/` directory
- `e2e-tests/traceability.yaml` — requirement → test mapping
- `e2e-tests/version.yaml` — incremented version

## How to Trigger

Click ▶️ **"Generate Tests from Requirements"** in Agent Hooks panel.

## Parsing Strategy

### Step 1: Read Context
- Check `prompt/` folder — read ALL .md files for:
  - Test credentials
  - Flow order / dependencies
  - Business rules
  - Workarounds / known issues

### Step 2: Find and Read Requirements
- Scan `docs/`, `requirements/`, and root for: *.md, *.pdf, *.docx, *.txt
- Parse each document for testable content

### Step 3: Extract Testable Requirements
From each document, identify:
- **User stories** — "As a [role], I want [feature], so that [benefit]"
- **Acceptance criteria** — specific conditions that must be true
- **Business rules** — if X then Y logic
- **Edge cases** — mentioned explicitly or inferred

### Step 4: Generate DETAILED Test Cases

For EACH requirement/acceptance criterion, generate **multiple** test cases:

| Type | What to test | Example |
|------|-------------|---------|
| **Happy path** | Normal usage fulfilling the requirement | Login with valid credentials → dashboard shown |
| **Negative path** | Invalid input, wrong actions | Login with wrong password → error message |
| **Boundary values** | Empty, max length, special chars | Login with 1-char password, 100-char email |
| **Alternative flows** | Interruptions, back navigation | Start login, go back, come back — form still filled? |

**Minimum 3-5 test cases per requirement.**

Each test case must have:
- **Specific test data** — exact values to type/select
- **Specific expected results** — exact text/element that should appear
- **requirement_id** — traces back to source requirement

### Step 5: Write YAML Scripts

```yaml
name: "Login - Valid Credentials"
description: "User can login with correct email and password"
requirement_id: "REQ-001"
requirement_text: "User can login with email and password"
platform: ["android", "ios"]
precondition: "App is on login screen, user is logged out"
test_type: "happy_path"

steps:
  - action: tap
    target: { label: "Email Input" }
    description: "Focus email field"
  - action: type
    text: "testuser@company.com"
    description: "Enter valid email"
  - action: tap
    target: { label: "Password Input" }
    description: "Focus password field"
  - action: type
    text: "Test123!"
    description: "Enter valid password"
  - action: tap
    target: { label: "Login Button" }
    description: "Tap Login"
  - action: assert
    condition:
      element: { label: "Dashboard Title" }
      exists: true
    screenshot: true
    description: "Verify user lands on dashboard after login"
```

### Step 6: Generate Traceability

```yaml
# e2e-tests/traceability.yaml
requirements_source: "docs/requirements.md"
generated_date: "2026-06-09"
total_requirements: 5
total_test_scripts: 15

mapping:
  - requirement_id: "REQ-001"
    requirement_text: "User can login with email and password"
    test_scripts:
      - "01-login-valid.yaml"
      - "02-login-wrong-password.yaml"
      - "03-login-empty-fields.yaml"
      - "04-login-invalid-email.yaml"
    test_types: ["happy_path", "negative", "negative", "boundary"]
    coverage: "full"

  - requirement_id: "REQ-002"
    requirement_text: "User sees greeting with name on home screen"
    test_scripts:
      - "05-greeting-valid.yaml"
      - "06-greeting-empty.yaml"
      - "07-greeting-special-chars.yaml"
    test_types: ["happy_path", "negative", "boundary"]
    coverage: "full"

uncovered_requirements: []
coverage_percentage: 100
```

## Requirement Document Formats Supported

### Format 1: User Story + Acceptance Criteria
```markdown
## US-001: User Login
As a user, I want to login with my email and password.

**Acceptance Criteria:**
- [ ] Email and password fields visible
- [ ] Valid credentials → navigate to dashboard
- [ ] Invalid credentials → show error message
- [ ] Empty fields → show validation
```

### Format 2: Table
```markdown
| ID | Feature | Input | Expected | Priority |
|----|---------|-------|----------|----------|
| F-001 | Login | Valid creds | Dashboard | High |
| F-002 | Login | Wrong pass | Error msg | High |
```

### Format 3: BDD/Gherkin
```markdown
Feature: Login
  Scenario: Valid login
    Given I am on login screen
    When I enter "test@co.com" and "Pass123!"
    Then I should see the dashboard
```

### Format 4: PDF/DOCX
Agent extracts text content and parses same patterns as above.

## Version Tracking

After generating, update `e2e-tests/version.yaml`:
```yaml
version: "3"
generated_date: "2026-06-09"
generated_by: "Kiro Agent"
generated_from: "requirements"
source: "docs/requirements.md"
total_test_cases: 15
breakdown:
  happy_path: 5
  negative: 5
  boundary: 3
  alternative_flow: 2
```
