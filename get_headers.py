import openpyxl
import sys

try:
    wb = openpyxl.load_workbook('Iniciativas_Consolidadas_20260303_v02.xlsx', data_only=True)
    sheet = wb.active
    headers = [cell.value for cell in sheet[1]]
    print("HEADERS:")
    for i, h in enumerate(headers):
        print(f"[{i}] {h}")
    print("\nSAMPLE ROW:")
    row2 = [cell.value for cell in sheet[2]]
    for i, r in enumerate(row2):
        print(f"[{i}] {r}")
except Exception as e:
    print("Error:", e)
