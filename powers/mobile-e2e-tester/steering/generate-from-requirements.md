# Generate Test Scripts from Functional Requirements (POB-203)

## Overview

Parse functional requirement documents (PDF, DOCX, Markdown) and auto-generate E2E test scripts. The agent reads the requirements, identifies testable acceptance criteria, and outputs structured YAML test scripts.

## Input

The agent accepts:
- **Markdown files** (.md) — requirement docs in the repo
- **Text descriptions** — pasted in chat
- **Jira ticket descriptions** — copy-pasted user stories
- **PDF/DOCX** — attached in chat (if supported)

## Output

YAML test script files saved to `e2e-tests/` directory, with traceability back to requirements.

## How to Trigger

```
Generate test scripts from requirements in docs/requirements.md
```

Or paste directly:
```
Generate test scripts from this requirement:
As a user, I want to enter my name and see a greeting message,
so that I feel welcomed when using the app.
Acceptance criteria:
- User can type name in text field
- Tapping "Say Hello" shows "Hello, {name}!"
- Empty name shows appropriate error
```

## Parsing Strategy

### Step 1: Extract Testable Requirements
From the document, identify:
- **User stories** — "As a [role], I want [feature], so that [benefit]"
- **Acceptance criteria** — specific conditions that must be true
- **Business rules** — if X then Y logic
- **Edge cases** — mentioned explicitly or inferred

### Step 2: Map to Test Cases
For each acceptance criterion:
- Identify the **action** (what the user does)
- Identify the **expected result** (what should happen)
- Identify **preconditions** (what state is needed first)
- Identify **test data** (what input values to use)

### Step 3: Generate Test Scripts

Each requirement maps to one or more test scripts:

```yaml
# e2e-tests/req-greeting-happy-path.yaml
name: "Greeting - Happy Path"
description: "User enters name and sees greeting"
requirement_id: "REQ-001"              # Traceability
requirement_text: "User can type name and see Hello, {name}!"
platform: ["android", "ios"]
precondition: "App is on main screen, name field is empty"

steps:
  - action: tap
    target:
      label: "Name Input"
    description: "Focus the name input"

  - action: type
    text: "Alice"
    description: "Enter the name Alice"

  - action: tap
    target:
      label: "Greet Button"
    description: "Tap Say Hello"

  - action: assert
    condition:
      element:
        label: "Greeting Result"
      text_equals: "Hello, Alice!"
    screenshot: true
    description: "Verify greeting shows Hello, Alice!"
```

### Step 4: Generate Edge Case Tests

For each requirement, also generate negative/edge case tests:

```yaml
# e2e-tests/req-greeting-empty-name.yaml
name: "Greeting - Empty Name (Edge Case)"
description: "Test behavior when name is empty"
requirement_id: "REQ-001"
requirement_text: "Empty name shows appropriate error"
platform: ["android", "ios"]
precondition: "App is on main screen, name field is empty"

steps:
  - action: tap
    target:
      label: "Greet Button"
    description: "Tap Say Hello without entering name"

  - action: assert
    condition:
      element:
        label: "Greeting Result"
      not_exists: true
    screenshot: true
    description: "Verify no greeting or error shown for empty name"
```

## Requirement Document Formats

### Format 1: User Story + Acceptance Criteria

```markdown
## US-001: User Greeting
As a user, I want to enter my name and see a personalized greeting.

**Acceptance Criteria:**
- [ ] Name text field is visible on main screen
- [ ] Tapping "Say Hello" with name entered shows "Hello, {name}!"
- [ ] Greeting disappears when name is cleared
- [ ] Maximum name length is 50 characters
```

### Format 2: Functional Specification Table

```markdown
| ID | Feature | Input | Expected Output | Priority |
|----|---------|-------|-----------------|----------|
| F-001 | Greeting | Name = "Bob" | Shows "Hello, Bob!" | High |
| F-002 | Counter | Tap +1 three times | Counter = 3 | High |
| F-003 | Reset | Tap Reset | Counter = 0 | Medium |
```

### Format 3: BDD/Gherkin-style

```markdown
Feature: Greeting
  Scenario: Happy path greeting
    Given I am on the main screen
    When I type "Charlie" in the name field
    And I tap "Say Hello"
    Then I should see "Hello, Charlie!"

  Scenario: Empty name
    Given I am on the main screen
    When I tap "Say Hello" without entering a name
    Then I should see an error message
```

## Traceability Matrix

After generating scripts, output a traceability matrix:

```yaml
# e2e-tests/traceability.yaml
requirements_source: "docs/requirements.md"
generated_date: "2026-06-08"
total_requirements: 5
total_test_scripts: 8

mapping:
  - requirement_id: "REQ-001"
    requirement_text: "User can type name and see greeting"
    test_scripts:
      - "req-greeting-happy-path.yaml"
      - "req-greeting-empty-name.yaml"
      - "req-greeting-long-name.yaml"
    coverage: "full"

  - requirement_id: "REQ-002"
    requirement_text: "Counter increments by 1 on tap"
    test_scripts:
      - "req-counter-increment.yaml"
    coverage: "full"

  - requirement_id: "REQ-003"
    requirement_text: "Counter can be reset to 0"
    test_scripts:
      - "req-counter-reset.yaml"
    coverage: "full"

uncovered_requirements: []
coverage_percentage: 100
```

## Output Location

```
{project_root}/
├── e2e-tests/
│   ├── req-greeting-happy-path.yaml
│   ├── req-greeting-empty-name.yaml
│   ├── req-counter-increment.yaml
│   ├── req-counter-reset.yaml
│   ├── coverage.yaml              # Element coverage (from codebase)
│   └── traceability.yaml          # Requirement traceability
└── docs/
    └── requirements.md             # Source requirement doc
```

## Combining with Codebase Analysis

For best results, combine both approaches:
1. **Requirements** → define WHAT to test (user-facing behavior)
2. **Codebase** → define HOW to target elements (labels, selectors)

```
Generate test scripts from docs/requirements.md using codebase for element targeting
```

Agent will:
1. Read requirements → extract test cases
2. Read source code → find exact element labels/selectors
3. Merge → generate accurate, executable test scripts
