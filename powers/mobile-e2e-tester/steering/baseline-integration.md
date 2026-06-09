# Baseline Integration (POB-206)

## Overview

Baseline integration tracks **test run history**. Every time you execute tests, results are saved as a numbered run. You can view and download any previous run's report.

## Concepts

- **Test Case Version** = which version of test scripts was used (e.g., "Version 1")
- **Run** = one execution of the test suite (Run 1, Run 2, Run 3...)
- **Result** = downloadable Excel report for that run

## File Structure

```
{project_root}/
├── e2e-tests/                       ← Test scripts (versioned)
│   ├── 01-app-launch.yaml
│   ├── 02-greeting-flow.yaml
│   └── version.yaml                 ← Test case version metadata
└── e2e-runs/                        ← History of all runs
    ├── run-08-06-26_(14-30)/
    │   ├── metadata.yaml           ← Date, device, who ran, TC version
    │   ├── e2e-test-report.xlsx    ← Excel report
    │   └── screenshots/            ← Screenshots for this run
    ├── run-09-06-26_(09-15)/
    │   ├── metadata.yaml
    │   ├── e2e-test-report.xlsx
    │   └── screenshots/
    └── ...
```

## Workflow

### Generate TC (one-time or when requirements change)
1. Click ▶️ "Generate Tests from Codebase" or "Generate Tests from Requirements"
2. Test scripts saved to `e2e-tests/`
3. Version metadata saved to `e2e-tests/version.yaml`

### Run TC (every time you test)
1. Click ▶️ "Execute Test Scripts"
2. Tests run on emulator → screenshots + results
3. Auto-detect next run number (Run 1, Run 2, ...)
4. Save results to `e2e-runs/run-{N}/`
5. Report downloadable as `.xlsx`

## Version File

```yaml
# e2e-tests/version.yaml
version: "1"
generated_date: "2026-06-08"
generated_by: "Kiro Agent"
generated_from: "codebase"  # or "requirements"
source: "app/src/main/java/com/example/"
total_test_cases: 5
```

## Run Metadata

```yaml
# e2e-runs/run-1/metadata.yaml
run_number: 1
date: "2026-06-08 14:30"
device:
  name: "Pixel 7"
  platform: "android"
  version: "17"
tc_version: "1"
total_tests: 5
passed: 5
failed: 0
skipped: 0
report_file: "e2e-test-report.xlsx"
```

## Run Numbering

Agent creates run folder with timestamp format:
```
run-{DD-MM-YY}_(HH-MM)
```

Examples:
- `run-08-06-26_(14-30)` → June 8, 2026 at 14:30
- `run-09-06-26_(09-15)` → June 9, 2026 at 09:15

This makes each run unique and sortable by date.

## Agent Behavior

### When executing tests:
1. Check `e2e-runs/` for latest run folder with existing Excel
2. If Excel exists → read all Test No. values → **skip any test already recorded** (never re-run)
3. If no existing run → create new `e2e-runs/run-{DD-MM-YY}_(HH-MM)/`
4. Execute max 10 test cases per session (batch limit) — only unrecorded ones
5. Write each result to Excel immediately after completion
6. After 10 new test cases or all done → stop, report progress
7. User clicks ▶️ again → agent reads Excel, skips recorded tests, continues with remaining
8. Repeat until all test cases complete

### Comparing runs:
If user asks "compare run 1 vs run 2":
1. Load metadata from both runs
2. Compare test-by-test: status changes
3. Report regressions (was pass, now fail) and fixes (was fail, now pass)
