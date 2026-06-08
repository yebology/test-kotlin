# Generate Test Scripts from Codebase Analysis (POB-202)

## Overview

Analyze the mobile app's source code to auto-generate E2E test scripts. The agent reads the codebase, identifies UI elements, user flows, and API calls, then outputs structured YAML test scripts.

## Input

The agent reads:
- **UI source files** — Compose (Kotlin), SwiftUI (Swift), XML layouts
- **Navigation graphs** — NavHost definitions, screen routes
- **ViewModel/State** — State variables that drive UI
- **API calls** — Retrofit interfaces, URLSession calls

## Output

YAML test script files saved to `e2e-tests/` directory.

## How to Trigger

```
Generate test scripts from the codebase
```

Or with specific path:
```
Generate test scripts from app/src/main/java/com/example/
```

## Analysis Strategy

### Step 1: Identify Screens
- Look for Activity/Fragment classes (Android) or View structs (iOS)
- Parse navigation graph to understand screen flow
- List all screens with their entry points

### Step 2: Identify UI Elements per Screen
- Find Composables/Views with user interaction:
  - `TextField` / `OutlinedTextField` → text input
  - `Button` → tap action
  - `Checkbox` / `Switch` → toggle
  - `LazyColumn` / `RecyclerView` → scrollable list
- Extract `contentDescription` / `accessibilityIdentifier` for element targeting
- Extract `testTag` / `accessibilityLabel` values

### Step 3: Identify User Flows
- Trace state changes: what happens when button is clicked?
- Follow navigation: which screen comes after this action?
- Identify conditional UI: what shows/hides based on state?

### Step 4: Identify Assertions
- Text that appears after actions (e.g., greeting result, error messages)
- Navigation changes (new screen appears)
- State changes (counter value, list items)

### Step 5: Generate Test Script

For each identified flow, generate a YAML test file:

```yaml
# e2e-tests/flow-name.yaml
name: "Flow Name"
description: "What this flow tests"
platform: ["android", "ios"]  # or just one
precondition: "App is on home screen"

steps:
  - action: tap
    target:
      label: "Name Input"          # contentDescription / accessibilityLabel
      # OR
      text: "Enter your name"      # visible text
      # OR
      type: "EditText"             # widget type
    description: "Focus the name input field"

  - action: type
    text: "Test User"
    description: "Enter a name"

  - action: tap
    target:
      label: "Greet Button"
    description: "Tap the greet button"

  - action: assert
    condition:
      element:
        label: "Greeting Result"
      text_contains: "Hello, Test User!"
    screenshot: true
    description: "Verify greeting message appears"

  - action: assert
    condition:
      element:
        label: "Counter Display"
      text_equals: "Counter: 0"
    screenshot: true
    description: "Verify counter starts at 0"
```

## Test Script Schema

```yaml
name: string                    # Test name
description: string             # What is being tested
platform: [android, ios]        # Target platforms
precondition: string            # Required starting state
source_file: string             # Which source file this was generated from

steps:
  - action: tap | type | swipe | assert | wait | press_button | clear
    target:                     # For tap/type/swipe/clear
      label: string             # accessibility label (preferred)
      text: string              # visible text (fallback)
      type: string              # widget type (last resort)
      coordinates:              # absolute fallback
        x: number
        y: number
    text: string                # For type action
    direction: up|down|left|right  # For swipe action
    button: BACK|HOME           # For press_button action
    duration: number            # For wait action (ms)
    condition:                  # For assert action
      element:
        label: string
        text: string
      text_contains: string
      text_equals: string
      exists: boolean
      not_exists: boolean
    screenshot: boolean         # Take screenshot after this step
    description: string         # Human-readable step description
```

## Example: Analyzing Compose Code

Given this Compose code:
```kotlin
OutlinedTextField(
    value = nameInput,
    onValueChange = { nameInput = it },
    modifier = Modifier.semantics { contentDescription = "Name Input" }
)

Button(
    onClick = { greetingResult = "Hello, $nameInput!" },
    modifier = Modifier.semantics { contentDescription = "Greet Button" }
) { Text("Say Hello") }

Text(
    text = greetingResult,
    modifier = Modifier.semantics { contentDescription = "Greeting Result" }
)
```

Agent generates:
```yaml
name: "Greeting Flow"
description: "Test name input and greeting display"
source_file: "app/src/main/java/com/example/tesaxrail/MainActivity.kt"
platform: ["android"]
precondition: "App is on main screen"

steps:
  - action: tap
    target:
      label: "Name Input"
    description: "Focus name input field"

  - action: type
    text: "Kiro"
    description: "Type a name"

  - action: tap
    target:
      label: "Greet Button"
    description: "Tap Say Hello button"

  - action: assert
    condition:
      element:
        label: "Greeting Result"
      text_contains: "Hello, Kiro!"
    screenshot: true
    description: "Verify greeting shows Hello, Kiro!"
```

## Output Location

All generated test scripts go to:
```
{project_root}/e2e-tests/
├── 01-greeting-flow.yaml
├── 02-counter-increment.yaml
├── 03-counter-decrement.yaml
└── 04-counter-reset.yaml
```

## Coverage Tracking

After generating scripts, output a coverage summary:
```yaml
# e2e-tests/coverage.yaml
generated_from: "app/src/main/java/com/example/tesaxrail/MainActivity.kt"
total_screens: 1
total_interactive_elements: 6
total_test_flows: 4
elements_covered:
  - "Name Input" → covered in: 01-greeting-flow.yaml
  - "Greet Button" → covered in: 01-greeting-flow.yaml
  - "Greeting Result" → covered in: 01-greeting-flow.yaml
  - "Counter Display" → covered in: 02, 03, 04
  - "Increment Button" → covered in: 02-counter-increment.yaml
  - "Decrement Button" → covered in: 03-counter-decrement.yaml
  - "Reset Button" → covered in: 04-counter-reset.yaml
elements_not_covered: []
coverage_percentage: 100
```
