# Excel Report Generation

## Overview

Generate test reports in `.xlsx` format (Excel) instead of `.docx`. The report includes test steps, expected/actual results, and status — matching the standard QA test report format.

## Report Format

### Columns

| Column | Description | Example |
|--------|-------------|---------|
| **User Flow** | Feature group / screen being tested | "Home - Before sign in" |
| **Test No.** | Unique test ID | "T001" |
| **Test Scenario** | Short description of what's being tested | "Greeting flow with valid name" |
| **Test Steps** | Numbered steps performed | "1. Tap name field\n2. Type 'Kiro'\n3. Tap Say Hello" |
| **Expected Results** | What should happen | "Greeting 'Hello, Kiro!' is displayed" |
| **Status** | Pass / Fail / Skip | "Passed" |
| **Actual Results** | What actually happened (if Pass: same as Expected) | "Greeting 'Hello, Kiro!' is displayed" |
| **Screenshot** | Filename of the screenshot taken | "e2e-android-01-greeting-pass.png" |

### Rules

- **Status = Passed** → Actual Results = copy of Expected Results
- **Status = Failed** → Actual Results = what actually happened (different from expected)
- **Status = Skip** → Actual Results = reason for skipping

### Color Coding

- **Passed** → green background on Status cell
- **Failed** → red/orange background on Status cell
- **Skip** → yellow background on Status cell

## Python Script Template

```python
"""Generate E2E test report as .xlsx (Excel)."""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime
import os


def generate_excel_report(
    app_name: str,
    device_info: dict,
    test_results: list,
    output_path: str
):
    """
    Generate Excel test report.

    Args:
        app_name: Name of the app tested
        device_info: Dict with keys: name, platform, version
        test_results: List of dicts with keys:
            - user_flow: str (feature group)
            - test_no: str (T001, T002, ...)
            - scenario: str (test description)
            - steps: str (numbered steps, newline-separated)
            - expected: str (expected result)
            - status: str (Passed / Failed / Skip)
            - actual: str (actual result — same as expected if passed)
            - screenshot: str (filename)
        output_path: Where to save the .xlsx file
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "E2E Test Results"

    # --- Header styling ---
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )

    # --- Metadata rows ---
    ws.append([f"E2E Test Report — {app_name}"])
    ws.merge_cells('A1:H1')
    ws['A1'].font = Font(bold=True, size=14)

    ws.append([f"Device: {device_info['name']} ({device_info['platform']}, v{device_info['version']})"])
    ws.append([f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}"])
    ws.append([])  # Empty row

    # --- Summary ---
    total = len(test_results)
    passed = sum(1 for t in test_results if t['status'] == 'Passed')
    failed = sum(1 for t in test_results if t['status'] == 'Failed')
    skipped = sum(1 for t in test_results if t['status'] == 'Skip')
    ws.append([f"Total: {total} | Passed: {passed} | Failed: {failed} | Skipped: {skipped}"])
    ws.append([])  # Empty row

    # --- Headers ---
    headers = ["User Flow", "Test No.", "Test Scenario", "Test Steps", "Expected Results", "Status", "Actual Results", "Screenshot"]
    header_row = 7
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = thin_border

    # --- Data rows ---
    status_colors = {
        "Passed": PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid"),
        "Failed": PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid"),
        "Skip": PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid"),
    }

    for row_idx, test in enumerate(test_results, start=header_row + 1):
        ws.cell(row=row_idx, column=1, value=test['user_flow']).border = thin_border
        ws.cell(row=row_idx, column=2, value=test['test_no']).border = thin_border
        ws.cell(row=row_idx, column=3, value=test['scenario']).border = thin_border
        ws.cell(row=row_idx, column=4, value=test['steps']).border = thin_border
        ws.cell(row=row_idx, column=5, value=test['expected']).border = thin_border

        status_cell = ws.cell(row=row_idx, column=6, value=test['status'])
        status_cell.border = thin_border
        status_cell.fill = status_colors.get(test['status'], PatternFill())
        status_cell.alignment = Alignment(horizontal='center')

        ws.cell(row=row_idx, column=7, value=test['actual']).border = thin_border
        ws.cell(row=row_idx, column=8, value=test['screenshot']).border = thin_border

        # Wrap text for steps and results
        for col in [3, 4, 5, 7]:
            ws.cell(row=row_idx, column=col).alignment = Alignment(wrap_text=True, vertical='top')

    # --- Column widths ---
    col_widths = [20, 10, 30, 40, 35, 10, 35, 35]
    for i, width in enumerate(col_widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = width

    # --- Save ---
    wb.save(output_path)
    print(f"✅ Excel report saved to: {output_path}")
```

## Dependencies

```bash
pip3 install openpyxl
```

## How Agent Uses This

During "Execute Test Scripts":

1. Create Excel file with headers at the start
2. After **each test case** completes → immediately append result row to Excel (open, write, save)
3. If a test is blocked/skipped → mark as Skip, write to Excel, move to next independent module
4. Report progress to user **per module** (not per test case)
5. After all done → finalize with metadata header and color coding
```python
test_results = [
    {
        "user_flow": "Home - Main Screen",
        "test_no": "T001",
        "scenario": "Greeting flow with valid name",
        "steps": "1. Tap 'Name Input' field\n2. Type 'Kiro'\n3. Tap 'Say Hello' button",
        "expected": "Greeting 'Hello, Kiro!' is displayed below the button",
        "status": "Passed",
        "actual": "Greeting 'Hello, Kiro!' is displayed below the button",  # same as expected
        "screenshot": "e2e-android-01-greeting-pass.png"
    },
    {
        "user_flow": "Home - Main Screen",
        "test_no": "T002",
        "scenario": "Counter increment x3",
        "steps": "1. Tap '+1' button\n2. Tap '+1' button\n3. Tap '+1' button",
        "expected": "Counter displays 'Counter: 3'",
        "status": "Passed",
        "actual": "Counter displays 'Counter: 3'",
        "screenshot": "e2e-android-02-counter-increment-pass.png"
    },
    {
        "user_flow": "Home - Main Screen",
        "test_no": "T003",
        "scenario": "Empty name greeting",
        "steps": "1. Leave name field empty\n2. Tap 'Say Hello' button",
        "expected": "Error message or button disabled",
        "status": "Failed",
        "actual": "Shows 'Hello, !' with empty name — no validation",
        "screenshot": "e2e-android-03-empty-name-FAIL.png"
    }
]
```

2. Generate excel report:
```python
generate_excel_report(
    app_name="TesAxrail",
    device_info={"name": "Pixel 7", "platform": "android", "version": "17"},
    test_results=test_results,
    output_path="e2e-test-report.xlsx"
)
```

## Output

File saved as `e2e-test-report.xlsx` in project root.

## Notes

- Use `openpyxl` (not `python-docx`) for Excel files
- Screenshots are referenced by filename (not embedded — Excel doesn't support inline images well)
- Color coding makes pass/fail immediately visible
- Wrap text enabled for steps and results columns
- Report is compatible with Google Sheets (upload directly)
