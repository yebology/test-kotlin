# Generate Test Scripts from Codebase Analysis (POB-202)

## Overview

Analyze the mobile app's source code to auto-generate **detailed** E2E test scripts. The agent reads the codebase + prompt context, identifies UI elements and user flows, then outputs structured YAML test scripts with comprehensive coverage (happy path, negative, edge cases).

## Input

The agent reads (in this order):
1. **prompt/*.md** — additional context (credentials, flow order, business logic)
2. **UI source files** — Compose (Kotlin), SwiftUI (Swift), XML layouts
3. **Navigation graphs** — NavHost definitions, screen routes
4. **ViewModel/State** — State variables that drive UI

## Output

- YAML test script files in `e2e-tests/` directory
- `e2e-tests/coverage.yaml` — element coverage
- `e2e-tests/version.yaml` — incremented version

## How to Trigger

Click ▶️ **"Generate Tests from Codebase"** in Agent Hooks panel.

## Analysis Strategy

### Step 1: Read Context
- Check `prompt/` folder — read ALL .md files for:
  - Test credentials
  - Flow order / dependencies
  - Business rules
  - Workarounds / known issues

### Step 2: Identify Screens
- Look for Activity/Fragment classes (Android) or View structs (iOS)
- Parse navigation graph to understand screen flow
- List all screens with their entry points

### Step 3: Identify UI Elements per Screen
- Find Composables/Views with user interaction:
  - `TextField` / `OutlinedTextField` → text input
  - `Button` → tap action
  - `Checkbox` / `Switch` → toggle
  - `LazyColumn` / `RecyclerView` → scrollable list
- Extract `contentDescription` / `accessibilityIdentifier` for element targeting
- Extract `testTag` / `accessibilityLabel` values

### Step 4: Identify User Flows
- Trace state changes: what happens when button is clicked?
- Follow navigation: which screen comes after this action?
- Identify conditional UI: what shows/hides based on state?
- Use prompt context for flow order if available

### Step 5: Generate DETAILED Test Cases

For EACH interactive element or user flow, generate **multiple** test cases:

| Type | What to test | Example |
|------|-------------|---------|
| **Happy path** | Normal usage with valid data | Type "Kiro", tap Submit → "Hello, Kiro!" |
| **Negative path** | Invalid input, empty fields | Tap Submit with empty field → error or "Hello, !" |
| **Boundary values** | Max length, special chars, emoji | Type "A" × 100, type "!@#$%", type "🎉🔥" |
| **State transitions** | Repeated actions, sequence | Tap +1 five times → Counter: 5, then Reset → 0 |
| **Error handling** | What shouldn't happen | Counter should never show NaN or crash |

**Minimum 3-5 test cases per feature/flow.**

### Step 6: Write YAML with Specifics

Each test case must have:
- **Specific test data** — not "enter text" but "enter 'TestUser_123!'"
- **Specific expected results** — not "verify it works" but "text 'Hello, TestUser_123!!' with label 'Greeting Result' is visible"
- **Detailed numbered steps** — every tap, type, dismiss keyboard, etc.

## Test Script Schema

```yaml
name: string                    # Descriptive test name
description: string             # What is being tested and why
platform: [android, ios]        # Target platforms
precondition: string            # Required starting state
source_file: string             # Which source file this was generated from
test_type: string               # happy_path | negative | boundary | state_transition

steps:
  - action: tap | type | swipe | assert | wait | press_button | clear
    target:                     # For tap/type/swipe/clear
      label: string             # accessibility label (preferred)
      text: string              # visible text (fallback)
      type: string              # widget type (last resort)
    text: string                # For type action — SPECIFIC test data
    direction: up|down|left|right  # For swipe action
    button: BACK|HOME           # For press_button action
    duration: number            # For wait action (ms)
    condition:                  # For assert action
      element:
        label: string
        text: string
      text_contains: string     # Partial match
      text_equals: string       # Exact match
      exists: boolean
      not_exists: boolean
    screenshot: boolean         # Take screenshot after this step
    description: string         # Human-readable step description
```

## Example: Detailed Test Generation

Given a Compose text field + button, generate these tests:

**Test 1: Happy Path**
```yaml
name: "Greeting - Valid Name"
test_type: "happy_path"
steps:
  - action: tap
    target: { label: "Name Input" }
    description: "Focus name field"
  - action: type
    text: "Kiro"
    description: "Type valid name"
  - action: press_button
    button: "BACK"
    description: "Dismiss keyboard"
  - action: tap
    target: { label: "Greet Button" }
    description: "Tap Say Hello"
  - action: assert
    condition:
      element: { label: "Greeting Result" }
      text_equals: "Hello, Kiro!"
    screenshot: true
    description: "Verify greeting shows exactly 'Hello, Kiro!'"
```

**Test 2: Empty Input (Negative)**
```yaml
name: "Greeting - Empty Name"
test_type: "negative"
steps:
  - action: tap
    target: { label: "Greet Button" }
    description: "Tap Say Hello without entering name"
  - action: assert
    condition:
      element: { label: "Greeting Result" }
      text_equals: "Hello, !"
    screenshot: true
    description: "Verify behavior with empty name — shows 'Hello, !'"
```

**Test 3: Special Characters (Boundary)**
```yaml
name: "Greeting - Special Characters"
test_type: "boundary"
steps:
  - action: tap
    target: { label: "Name Input" }
  - action: type
    text: "Test!@#$%^&*()"
  - action: press_button
    button: "BACK"
  - action: tap
    target: { label: "Greet Button" }
  - action: assert
    condition:
      element: { label: "Greeting Result" }
      text_contains: "Hello, Test!@#$%^&*()!"
    screenshot: true
    description: "Verify special characters render correctly in greeting"
```

**Test 4: Very Long Name (Boundary)**
```yaml
name: "Greeting - Long Name (50 chars)"
test_type: "boundary"
steps:
  - action: tap
    target: { label: "Name Input" }
  - action: type
    text: "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWX"
  - action: press_button
    button: "BACK"
  - action: tap
    target: { label: "Greet Button" }
  - action: assert
    condition:
      element: { label: "Greeting Result" }
      text_contains: "Hello, ABCDEFGHIJ"
    screenshot: true
    description: "Verify long name doesn't crash or overflow"
```

**Test 5: Counter State Transitions**
```yaml
name: "Counter - Increment Then Reset"
test_type: "state_transition"
steps:
  - action: tap
    target: { label: "Increment Button" }
    description: "Tap +1"
  - action: tap
    target: { label: "Increment Button" }
    description: "Tap +1 again"
  - action: tap
    target: { label: "Increment Button" }
    description: "Tap +1 third time"
  - action: assert
    condition:
      element: { label: "Counter Display" }
      text_equals: "Counter: 3"
    screenshot: true
    description: "Verify counter is 3 after 3 increments"
  - action: tap
    target: { label: "Reset Button" }
    description: "Tap Reset"
  - action: assert
    condition:
      element: { label: "Counter Display" }
      text_equals: "Counter: 0"
    screenshot: true
    description: "Verify counter resets to 0"
```

## Version Tracking

After generating, update `e2e-tests/version.yaml`:
```yaml
version: "2"
generated_date: "2026-06-09"
generated_by: "Kiro Agent"
generated_from: "codebase"
source: "app/src/main/java/com/example/"
total_test_cases: 12
breakdown:
  happy_path: 4
  negative: 3
  boundary: 3
  state_transition: 2
```

## Coverage Tracking

```yaml
# e2e-tests/coverage.yaml
generated_from: "app/src/main/java/com/example/tesaxrail/MainActivity.kt"
total_screens: 1
total_interactive_elements: 6
total_test_cases: 12
elements_covered:
  - element: "Name Input"
    tests: ["01-greeting-valid", "02-greeting-empty", "03-greeting-special", "04-greeting-long"]
  - element: "Greet Button"
    tests: ["01-greeting-valid", "02-greeting-empty", "03-greeting-special", "04-greeting-long"]
  - element: "Increment Button"
    tests: ["05-counter-increment", "08-counter-state-transition"]
  - element: "Decrement Button"
    tests: ["06-counter-decrement", "07-counter-negative"]
  - element: "Reset Button"
    tests: ["08-counter-state-transition"]
elements_not_covered: []
coverage_percentage: 100

