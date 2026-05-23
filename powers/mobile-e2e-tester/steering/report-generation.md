# Report Generation Guide

## Overview

After E2E tests complete, generate a `.docx` report with:
- Test results summary table
- Embedded screenshots (failures prominently displayed)
- Device metadata and timestamps
- Findings and observations

## Prerequisites

Install python-docx:
```bash
pip3 install python-docx
```

## Report Generation Script

### Template Script

Create a Python script at `{project_root}/generate_e2e_report.py`:

```python
"""Generate E2E test report as .docx with embedded screenshots."""
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
import os
from datetime import datetime

def generate_report(
    app_name: str,
    device_info: dict,
    test_results: list,
    screenshots_dir: str,
    output_path: str
):
    """
    Generate E2E test report.
    
    Args:
        app_name: Name of the app tested
        device_info: Dict with keys: name, platform, version, id
        test_results: List of dicts with keys: number, name, expected, actual, status, screenshot
        screenshots_dir: Path to screenshots directory
        output_path: Where to save the .docx file
    """
    doc = Document()

    # Title
    title = doc.add_heading(f"E2E Test Report — {app_name}", level=1)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Metadata
    doc.add_paragraph(f"Device: {device_info['name']} ({device_info['platform']}, {device_info['version']})")
    doc.add_paragraph(f"Device ID: {device_info['id']}")
    doc.add_paragraph(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    
    # Summary
    total = len(test_results)
    passed = sum(1 for t in test_results if 'PASS' in t['status'].upper())
    failed = total - passed
    doc.add_paragraph(f"Results: {passed}/{total} passed, {failed} failed")
    doc.add_paragraph("")

    # Test Results Table
    doc.add_heading("Test Results", level=2)

    table = doc.add_table(rows=total + 1, cols=5)
    table.style = "Table Grid"

    # Header row
    headers = ["#", "Test Case", "Expected", "Actual", "Status"]
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = h
        cell.paragraphs[0].runs[0].bold = True

    # Data rows
    for row_idx, test in enumerate(test_results, start=1):
        table.rows[row_idx].cells[0].text = str(test['number'])
        table.rows[row_idx].cells[1].text = test['name']
        table.rows[row_idx].cells[2].text = test['expected']
        table.rows[row_idx].cells[3].text = test['actual']
        table.rows[row_idx].cells[4].text = test['status']

    doc.add_paragraph("")

    # Failure Screenshots (prominently displayed)
    failures = [t for t in test_results if 'FAIL' in t['status'].upper()]
    if failures:
        doc.add_heading("❌ Failures", level=2)
        for test in failures:
            doc.add_paragraph(f"Test #{test['number']}: {test['name']}")
            doc.add_paragraph(f"Expected: {test['expected']}")
            doc.add_paragraph(f"Actual: {test['actual']}")
            screenshot_path = os.path.join(screenshots_dir, test.get('screenshot', ''))
            if os.path.exists(screenshot_path):
                doc.add_picture(screenshot_path, width=Inches(3))
            doc.add_paragraph("")

    # All Screenshots
    doc.add_heading("Screenshots", level=2)
    for test in test_results:
        screenshot_path = os.path.join(screenshots_dir, test.get('screenshot', ''))
        if os.path.exists(screenshot_path):
            status_icon = "✅" if 'PASS' in test['status'].upper() else "❌"
            doc.add_paragraph(f"{status_icon} Test #{test['number']}: {test['name']}")
            doc.add_picture(screenshot_path, width=Inches(2.5))
            doc.add_paragraph("")

    # Findings
    doc.add_heading("Findings & Observations", level=2)
    doc.add_paragraph("(Add observations about app behavior, UX issues, or bugs found during testing)")

    # Save
    doc.save(output_path)
    print(f"Report saved to: {output_path}")


# Example usage:
if __name__ == "__main__":
    # This would be populated by the test runner
    generate_report(
        app_name="My App",
        device_info={
            "name": "Pixel 7",
            "platform": "android",
            "version": "17",
            "id": "emulator-5554"
        },
        test_results=[
            {
                "number": 1,
                "name": "Login Flow",
                "expected": "User sees dashboard",
                "actual": "User sees dashboard",
                "status": "✅ PASS",
                "screenshot": "e2e-android-01-login-flow-pass.png"
            },
            {
                "number": 2,
                "name": "Empty Form Submit",
                "expected": "Error message shown",
                "actual": "No error displayed",
                "status": "❌ FAIL",
                "screenshot": "e2e-android-02-empty-form-FAIL.png"
            },
        ],
        screenshots_dir="./e2e-screenshots",
        output_path="./e2e-test-report.docx"
    )
```

## How the Agent Uses This

During a test run, the agent:

1. **Collects results** — Builds a list of test results as tests execute
2. **Saves screenshots** — Uses `mobile_save_screenshot` to `e2e-screenshots/` directory
3. **Generates script** — Creates a customized version of the template with actual results
4. **Runs script** — Executes with `python3 generate_e2e_report.py`
5. **Reports location** — Tells user where the .docx file was saved

## Customization

### Adding Custom Sections
Add sections to the report by extending the script:
- Architecture diagrams
- Performance metrics
- Device comparison tables
- Bug tracking references

### Multi-Device Reports
For cross-platform testing, generate one report with sections per device:
```python
doc.add_heading("Android Results", level=2)
# ... android table and screenshots ...

doc.add_heading("iOS Results", level=2)
# ... ios table and screenshots ...

doc.add_heading("Cross-Platform Comparison", level=2)
# ... comparison table ...
```

### Report Formats
The default is `.docx`. For other formats:
- **PDF:** Use `docx2pdf` package after generating .docx
- **HTML:** Use a Jinja2 template instead
- **Markdown:** Generate `.md` file directly (no python-docx needed)

## File Organization

```
{project_root}/
├── e2e-screenshots/           # All test screenshots
│   ├── e2e-android-01-login-pass.png
│   ├── e2e-android-02-form-FAIL.png
│   ├── e2e-ios-01-login-pass.png
│   └── ...
├── e2e-test-report.docx       # Generated report
└── generate_e2e_report.py     # Report generation script
```

## Tips

- Always include device info in the report — helps reproduce issues
- Embed failure screenshots at full width for visibility
- Keep pass screenshots smaller to save space
- Add timestamps to report filename for versioning: `e2e-report-2024-01-15.docx`
- Include the app version/build number if available
