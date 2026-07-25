# Excel and Sheets Copy/Paste

The default copy and paste behavior in Excel copies all cell contents and formatting, updates relative formula references based on the destination position, and replaces any existing data in the target range.

Content and Formatting Behavior

- **All-in-one transfer:** Excel copies everything by default, including text, numbers, formulas, cell colors, fonts, borders, and data validation rules.Destination overwrite: Pasting automatically overwrites any values, formulas, and formatting already present in the target destination cells.
-  **Clipboard retention:** The copied range stays active on the clipboard (surrounded by a moving dashed border) until you press Esc or start typing in a new cell.

-  ## Formula and Reference Behavior

  - **Relative adjustment:** Formulas adjust their row and column references automatically to match the distance between the source and destination cells.
  - **Locked references:** Absolute references (marked with dollar signs, like $A$1) do not change when pasted within the same sheet, across different sheets, or into other workbooks.
  - **Same-workbook cross-sheet links:** Pasting formulas onto another sheet within the same workbook maintains live mathematical links back to the original source sheet unless changed to absolute or values.