"""
excel_generator.py — Generates the URL Discovery Report as a styled .xlsx file.
Extracted from the download_urls route for reusability and cleanliness.
"""

import io
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill


def generate_url_report_xlsx(preview_data: dict, safe_name: str) -> io.BytesIO:
    """
    Build a styled Excel workbook from the URL discovery preview data.
    Returns a BytesIO buffer ready to be sent as a file download.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'URL Report'

    bold_font = Font(bold=True)
    header_font = Font(bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='1E293B', end_color='1E293B', fill_type='solid')
    success_fill = PatternFill(start_color='DCFCE7', end_color='DCFCE7', fill_type='solid')
    danger_fill = PatternFill(start_color='FEE2E2', end_color='FEE2E2', fill_type='solid')

    # Title + meta
    ws.append([f'URL DISCOVERY REPORT — {safe_name}', ''])
    ws['A1'].font = Font(bold=True, size=14)
    ws.append(['Generated on:', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
    ws.append(['', ''])

    # Summary section
    working = preview_data.get('working_urls', [])
    failed = preview_data.get('failed_urls', [])
    total = len(working) + len(failed)

    ws.append(['--- SUMMARY ---', ''])
    ws[f'A{ws.max_row}'].font = bold_font
    ws.append(['Total URLs Discovered', total])
    ws.append(['Working URLs', len(working)])
    ws.append(['Failed / Broken URLs', len(failed)])
    ws.append(['', ''])

    # Detail table header
    ws.append(['--- DETAILED URL LIST ---', ''])
    ws[f'A{ws.max_row}'].font = bold_font

    header_row = ws.max_row + 1
    ws.append(['URL', 'STATUS', 'REASON'])
    for col_idx in range(1, 4):
        cell = ws.cell(row=header_row, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill

    # Working URLs
    for url in working:
        row = ws.max_row + 1
        ws.cell(row=row, column=1, value=url)
        status_cell = ws.cell(row=row, column=2, value='Working')
        status_cell.fill = success_fill
        ws.cell(row=row, column=3, value='')

    # Failed URLs
    for item in failed:
        if isinstance(item, dict):
            url_val = item.get('url', '')
            reason_val = item.get('reason', 'Unknown Error')
        else:
            url_val = str(item)
            reason_val = 'Unknown Error'

        row = ws.max_row + 1
        ws.cell(row=row, column=1, value=url_val)
        status_cell = ws.cell(row=row, column=2, value='Failed')
        status_cell.fill = danger_fill
        reason_cell = ws.cell(row=row, column=3, value=reason_val)
        reason_cell.font = Font(color='991B1B')

    # Column widths
    ws.column_dimensions['A'].width = 80
    ws.column_dimensions['B'].width = 15
    ws.column_dimensions['C'].width = 40

    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return out
