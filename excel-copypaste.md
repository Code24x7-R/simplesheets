# Excel and Sheets Copy/Paste

The default copy and paste behavior in Excel copies all cell contents and formatting, updates relative formula references based on the destination position, and replaces any existing data in the target range.

## Content and Formatting Behavior

- **All-in-one transfer:** Excel copies everything by default, including text, numbers, formulas, cell colors, fonts, borders, and data validation rules.
- **Destination overwrite:** Pasting automatically overwrites any values, formulas, and formatting already present in the target destination cells.
- **Clipboard retention:** The copied range stays active on the clipboard (surrounded by a moving dashed border) until you press Esc or start typing in a new cell.

## Formula and Reference Behavior

- **Relative adjustment:** Formulas adjust their row and column references automatically to match the distance between the source and destination cells.
- **Locked references:** Absolute references (marked with dollar signs, like $A$1) do not change when pasted within the same sheet, across different sheets, or into other workbooks.
- **Same-workbook cross-sheet links:** Pasting formulas onto another sheet within the same workbook maintains live mathematical links back to the original source sheet unless changed to absolute or values.

## Single Destination Cell vs. Range

Excel's paste behavior depends on whether you select a single destination cell or a range:

### Single Cell (Top-Left)

Selecting only the first cell of the destination and pressing Ctrl+V pastes the entire copied range outward, using that cell as the starting point. The paste expands to fit the source dimensions.

### Exact Same Size Range

Selecting a destination range that matches the source dimensions exactly replaces the contents cell-for-cell. Each source cell maps 1:1 to the corresponding destination cell.

### Tiled Paste (Evenly Dividing Range)

Selecting a destination range that evenly divides into the source size (e.g., pasting a 2×2 range into a 4×4 destination) tiles the source pattern across the destination.

### Mismatched Range Error

Selecting a destination range that is a different size and does not evenly divide into the source size triggers an error stating the area is not the same size. For example, pasting a 2×2 range into a 3×3 destination shows: "Paste error: destination range (3×3) does not match copied range (2×2)"

## Special Pasting Rules

### Skip Blanks

Using Paste Special with the **Skip blanks** option checked prevents empty source cells from overwriting existing destination data. This is useful when you want to paste only non-empty values onto a range that already has data.

Access via: **Edit → Paste Special… → Skip blanks**

### Filtered/Hidden Rows

Pasting into a filtered range may overwrite hidden cells unless you explicitly select visible cells only before pasting. (Note: This implementation does not currently filter hidden cells.)

## Paste Special Dialog

The Paste Special dialog (Edit → Paste Special…) provides options for pasting:

- **Skip blanks** — When enabled, empty cells in the copied range will not overwrite existing data in the destination. Non-empty cells paste normally.