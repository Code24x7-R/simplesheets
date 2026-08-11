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

 ## Formulas

- This text provides a comprehensive guide to Excel functions, focusing on range handling, copy/paste behavior, and data bounds.

Here is the reformatted information, organized by category for clarity:

---

## 📊 Excel Formula Codification Guide

### I. Basic Math & Range Aggregations

| Function | Example | Copy/Paste Rules | Bounds & Constraints |
| :--- | :--- | :--- | :--- |
| **Sum of range** | `=SUM(A1:A10)` | Row and column bounds shift relatively. | Max array size: $1,048,576$ rows $\times$ $16,384$ columns. Ignores text and blank cells. |
| **Average of range** | `=AVERAGE(A1:A10)` | Reference bounds shift relatively. | Ignores non-numeric cells; returns `#DIV/0!` if no numbers exist in range. |
| **Minimum** | `=MIN(A1:A10)` | Shifts relatively. | Returns $0$ if range contains only text/blanks. |
| **Maximum** | `=MAX(A1:A10)` | Shifts relatively. | Returns $0$ if range contains only text/blanks. |
| **Count numbers** | `=COUNT(A1:A10)` | Shifts relatively. | Only counts numeric values (dates and booleans as numbers included). |
| **Count non-blank** | `=COUNTA(A1:A10)` | Shifts relatively. | Counts cells containing text, numbers, formulas, or empty strings (""). |
| **Product** | `=PRODUCT(A1:A10)` | Shifts relatively. | Multiplies all numbers; ignores text and empty cells. |
| **Round** | `=ROUND(A1, 2)` | Cell reference A1 shifts relatively. | Second argument determines decimal places (negative values round to tens/hundreds). |
| **Round up** | `=ROUNDUP(A1, 2)` | Cell reference A1 shifts relatively. | Always rounds away from zero. |
| **Round down** | `=ROUNDDOWN(A1, 2)` | Cell reference A1 shifts relatively. | Always rounds toward zero. |
| **Integer part** | `=INT(A1)` | Shifts relatively. | Rounds down to nearest integer (e.g., `INT(-1.5)` evaluates to -2). |
| **Floor** | `=FLOOR(A1, 1)` | Shifts relatively. | Second argument (significance) must have matching sign or returns `#NUM!`. |
| **Ceiling** | `=CEILING(A1, 1)` | Shifts relatively. | Significance parameter must match number's sign or returns `#NUM!`. |
| **Modulo** | `=MOD(A1, B1)` | Both references shift relatively. | Divisor B1 cannot be $0$ (returns `#DIV/0!`). |
| **Absolute value** | `=ABS(A1)` | Shifts relatively. | Input must evaluate to a numeric value. |
| **Square root** | `=SQRT(A1)` | Shifts relatively. | Number must be $\ge 0$; returns `#NUM!` if negative. |
| **Power** | `=POWER(A1, B1)` | Both references shift relatively. | Base A1 cannot be negative if exponent is fractional. |
| **Exponential (e^x)** | `=EXP(A1)` | Shifts relatively. | Upper numerical precision limit $\approx 709.78$. |
| **Natural logarithm** | `=LN(A1)` | Shifts relatively. | A1 must be strictly $> 0$. |
| **Log base 10** | `=LOG10(A1)` | Shifts relatively. | A1 must be strictly $> 0$. |
| **Log base N** | `=LOG(A1, N1)` | Both references shift relatively. | Both A1 and base N1 must be $> 0$; N1 cannot equal $1$. |
| **Pi constant** | `=PI()` | Static output; takes no arguments. | Precise to $15$ digits ($3.14159265358979$). |
| **Sign (+1/0/-1)** | `=SIGN(A1)` | Shifts relatively. | Returns $1$ for positive, $0$ for zero, $-1$ for negative numbers. |
| **Truncate** | `=TRUNC(A1, [digits])` | Reference shifts relatively. | Drops fractional part without rounding. |

### II. Trigonometry & Advanced Math Functions

| Function | Example | Copy/Paste Rules | Bounds & Constraints |
| :--- | :--- | :--- | :--- |
| **Sine (radians)** | `=SIN(A1)` | Shifts relatively. | Angle must be in radians. Output range $[-1, 1]$. |
| **Cosine (radians)** | `=COS(A1)` | Shifts relatively. | Angle must be in radians. Output range $[-1, 1]$. |
| **Tangent (radians)** | `=TAN(A1)` | Shifts relatively. | Undefined at odd multiples of $\pi/2$. |
| **Arcsine** | `=ASIN(A1)` | Shifts relatively. | Input must be in range $[-1, 1]$; returns output in radians $[-\pi/2, \pi/2]$. |
| **Arccosine** | `=ACOS(A1)` | Shifts relatively. | Input must be in range $[-1, 1]$; returns output in radians $[0, \pi]$. |
| **Arctangent** | `=ATAN(A1)` | Shifts relatively. | Output range $[-\pi/2, \pi/2]$. |
| **Atan2** | `=ATAN2(x_num, y_num)` | Both coordinates shift relatively. | Returns angle in radians from x-axis; both inputs cannot be $0$. |
| **Radians → Degrees** | `=DEGREES(A1)` | Shifts relatively. | Multiplies input by $180/\pi$. |
| **Degrees → Radians** | `=RADIANS(A1)` | Shifts relatively. | Multiplies input by $\pi/180$. |

### III. Random & Logical Functions

| Function | Example | Copy/Paste Rules | Bounds & Constraints |
| :--- | :--- | :--- | :--- |
| **Random 0–1** | `=RAND()` | Volatile (recalculates on every sheet edit). | Output range $[0, 1)$. |
| **Random in range** | `=RANDBETWEEN(min, max)` | Volatile. | Arguments must be integers where $min \le max$. |
| **Logical IF** | `=IF(TRUE, "Yes", "No")` | N/A | Logic based on condition. |
| **AND (both true)** | `=AND(A1>0, B1>0)` | N/A |