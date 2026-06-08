# Report with Coverage Metrics & Traceability (POB-205)

## Overview

Enhanced report generation that includes:
- Standard test results (pass/fail with screenshots)
- **Coverage metrics** — which UI elements and requirements are tested
- **Requirement traceability** — map each test back to its source requirement
- **Coverage gaps** — what's NOT tested

## Report Sections

### 1. Executive Summary
```
Total Tests: 8
Passed: 7 (87.5%)
Failed: 1 (12.5%)
Requirements Covered: 5/5 (100%)
UI Elements Covered: 6/7 (85.7%)
```

### 2. Test Results Table (existing)
| # | Test | Requirement | Expected | Actual | Status |
|---|------|-------------|----------|--------|--------|
| 1 | Greeting Flow | REQ-001 | "Hello, Kiro!" | "Hello, Kiro!" | ✅ |
| 2 | Empty Name | REQ-001 | Error shown | "Hello, !" | ❌ |

### 3. Requirement Traceability
| Requirement ID | Description | Tests | Result |
|---|---|---|---|
| REQ-001 | Greeting feature | Test 1, Test 2 | ⚠️ Partial (1 fail) |
| REQ-002 | Counter increment | Test 3 | ✅ Covered |
| REQ-003 | Counter reset | Test 5 | ✅ Covered |

### 4. Coverage Metrics
| Metric | Value |
|---|---|
| Requirements covered | 5/5 (100%) |
| UI elements tested | 6/7 (85.7%) |
| Happy paths tested | 4/4 (100%) |
| Edge cases tested | 3/5 (60%) |
| Platforms tested | 1/2 (Android only) |

### 5. Coverage Gaps
- ❌ "Settings Button" — not tested (no requirement mapped)
- ⚠️ Edge case: very long name (>50 chars) — not tested
- ⚠️ iOS platform — not tested this run

### 6. Failure Details (with screenshots)
For each failed test, show:
- Requirement it maps to
- Expected vs actual
- Screenshot
- Suggested fix for backend engineer

### 7. Screenshots (all)

## Report Generation Script (Enhanced)

```python
"""Enhanced E2E report with coverage metrics and traceability."""
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
import os
import yaml
from datetime import datetime


def generate_coverage_report(
    app_name: str,
    device_info: dict,
    test_results: list,
    traceability_file: str,
    coverage_file: str,
    screenshots_dir: str,
    output_path: str
):
    doc = Document()

    # Title
    title = doc.add_heading(f"E2E Test Report — {app_name}", level=1)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Metadata
    doc.add_paragraph(f"Device: {device_info['name']} ({device_info['platform']}, {device_info['version']})")
    doc.add_paragraph(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    doc.add_paragraph("")

    # --- Executive Summary ---
    doc.add_heading("Executive Summary", level=2)
    total = len(test_results)
    passed = sum(1 for t in test_results if 'PASS' in t['status'].upper())
    failed = total - passed

    summary_table = doc.add_table(rows=5, cols=2)
    summary_table.style = "Table Grid"
    summary_data = [
        ("Total Tests", str(total)),
        ("Passed", f"{passed} ({passed*100//total}%)"),
        ("Failed", f"{failed} ({failed*100//total}%)"),
        ("Requirements Covered", "See traceability section"),
        ("UI Elements Covered", "See coverage section"),
    ]
    for i, (label, value) in enumerate(summary_data):
        summary_table.rows[i].cells[0].text = label
        summary_table.rows[i].cells[1].text = value

    doc.add_paragraph("")

    # --- Test Results ---
    doc.add_heading("Test Results", level=2)
    results_table = doc.add_table(rows=total + 1, cols=6)
    results_table.style = "Table Grid"
    headers = ["#", "Test Case", "Requirement", "Expected", "Actual", "Status"]
    for i, h in enumerate(headers):
        cell = results_table.rows[0].cells[i]
        cell.text = h
        cell.paragraphs[0].runs[0].bold = True

    for row_idx, test in enumerate(test_results, start=1):
        results_table.rows[row_idx].cells[0].text = str(test['number'])
        results_table.rows[row_idx].cells[1].text = test['name']
        results_table.rows[row_idx].cells[2].text = test.get('requirement_id', 'N/A')
        results_table.rows[row_idx].cells[3].text = test['expected']
        results_table.rows[row_idx].cells[4].text = test['actual']
        results_table.rows[row_idx].cells[5].text = test['status']

    doc.add_paragraph("")

    # --- Requirement Traceability ---
    doc.add_heading("Requirement Traceability", level=2)

    if os.path.exists(traceability_file):
        with open(traceability_file) as f:
            traceability = yaml.safe_load(f)

        trace_table = doc.add_table(rows=len(traceability.get('mapping', [])) + 1, cols=4)
        trace_table.style = "Table Grid"
        trace_headers = ["Req ID", "Description", "Test Scripts", "Coverage"]
        for i, h in enumerate(trace_headers):
            trace_table.rows[0].cells[i].text = h
            trace_table.rows[0].cells[i].paragraphs[0].runs[0].bold = True

        for i, req in enumerate(traceability.get('mapping', []), start=1):
            trace_table.rows[i].cells[0].text = req['requirement_id']
            trace_table.rows[i].cells[1].text = req['requirement_text']
            trace_table.rows[i].cells[2].text = ", ".join(req['test_scripts'])
            trace_table.rows[i].cells[3].text = req['coverage']
    else:
        doc.add_paragraph("No traceability.yaml found. Run 'generate from requirements' first.")

    doc.add_paragraph("")

    # --- Coverage Metrics ---
    doc.add_heading("Coverage Metrics", level=2)

    if os.path.exists(coverage_file):
        with open(coverage_file) as f:
            coverage = yaml.safe_load(f)

        doc.add_paragraph(f"Source: {coverage.get('generated_from', 'unknown')}")
        doc.add_paragraph(f"Total Interactive Elements: {coverage.get('total_interactive_elements', 'N/A')}")
        doc.add_paragraph(f"Total Test Flows: {coverage.get('total_test_flows', 'N/A')}")
        doc.add_paragraph(f"Coverage: {coverage.get('coverage_percentage', 'N/A')}%")

        # Elements covered
        doc.add_heading("Elements Covered", level=3)
        for elem in coverage.get('elements_covered', []):
            doc.add_paragraph(f"  ✅ {elem}", style='List Bullet')

        # Elements not covered
        not_covered = coverage.get('elements_not_covered', [])
        if not_covered:
            doc.add_heading("Coverage Gaps", level=3)
            for elem in not_covered:
                doc.add_paragraph(f"  ❌ {elem}", style='List Bullet')
        else:
            doc.add_paragraph("No coverage gaps — all elements tested.")
    else:
        doc.add_paragraph("No coverage.yaml found. Run 'generate from codebase' first.")

    doc.add_paragraph("")

    # --- Failures ---
    failures = [t for t in test_results if 'FAIL' in t['status'].upper()]
    if failures:
        doc.add_heading("❌ Failures (Action Required)", level=2)
        for test in failures:
            doc.add_paragraph(f"Test #{test['number']}: {test['name']}")
            doc.add_paragraph(f"Requirement: {test.get('requirement_id', 'N/A')}")
            doc.add_paragraph(f"Expected: {test['expected']}")
            doc.add_paragraph(f"Actual: {test['actual']}")
            doc.add_paragraph(f"Suggested Fix: {test.get('suggested_fix', 'Review logic')}")
            screenshot_path = os.path.join(screenshots_dir, test.get('screenshot', ''))
            if os.path.exists(screenshot_path):
                doc.add_picture(screenshot_path, width=Inches(3))
            doc.add_paragraph("")

    # --- All Screenshots ---
    doc.add_heading("Screenshots", level=2)
    for test in test_results:
        screenshot_path = os.path.join(screenshots_dir, test.get('screenshot', ''))
        if os.path.exists(screenshot_path):
            icon = "✅" if 'PASS' in test['status'].upper() else "❌"
            doc.add_paragraph(f"{icon} Test #{test['number']}: {test['name']}")
            doc.add_picture(screenshot_path, width=Inches(2.5))
            doc.add_paragraph("")

    # Save
    doc.save(output_path)
    print(f"✅ Report saved to: {output_path}")
```

## How Agent Uses This

During a test run with coverage:

1. **Before testing** — Check if `e2e-tests/traceability.yaml` and `e2e-tests/coverage.yaml` exist
2. **During testing** — Track which elements/requirements are being tested
3. **After testing** — Generate enhanced report with all metrics
4. **Output** — `e2e-test-report.docx` with full traceability + coverage

## Triggering Coverage Report

```
Run E2E tests with coverage report
```

Or:
```
Generate test report with requirement traceability from e2e-tests/traceability.yaml
```

## Coverage Calculation

```
Element Coverage = (elements tested / total interactive elements) × 100%
Requirement Coverage = (requirements with at least 1 passing test / total requirements) × 100%
Flow Coverage = (test scripts generated / identified user flows) × 100%
```
