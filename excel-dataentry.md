# Skill: Web Spreadsheet Data & Formula Entry Engine (`excel-dataentry`)
name: excel-dataentry
description: Technical specification and behavioral rules for web-based spreadsheet cell editing, keyboard navigation, formula creation, and POINT mode range selection.
version: 1.0.0
target_environment: Web / Browser-based Canvas or DOM Grid Engine (Excel Online / Google Sheets style)


This skill document defines the deterministic UI/UX interaction logic, state machine transitions, keyboard navigation rules, and formula range selection ("POINT mode") mechanics required for a browser-based spreadsheet application.

---

## 1. System State Machine

The spreadsheet engine operates under a strict finite-state machine (FSM). At any given timestamp, the grid focus rests on a primary active cell $(R, C)$ and exists in exactly **one** of four operational states.

```
                  ┌───────────────────────────────┐
                  │          SELECT STATE         │
                  │   (Cell focus, key navigation)│
                  └───────────────┬───────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         │ Type printable key, press F2, or double-click   │ Press Escape (if untouched)
         ▼                                                 ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│          ENTER STATE          │               │           EDIT STATE          │
│   (Typing replaces content)   │               │  (Caret active inside cell)   │
└───────────────┬───────────────┘               └───────────────┬───────────────┘
                │                                               │
                └───────────────────────┬───────────────────────┘
                                        │ Type '=' or edit existing formula
                                        ▼
                        ┌───────────────────────────────┐
                        │          POINT STATE          │
                        │ (Arrow keys/clicks point to   │
                        │     cells, not text caret)    │
                        └───────────────────────────────┘
```

### 1.1 Primary State Definitions

| State | Mode Code | Description | Visual Caret | Arrow Key Behavior | Input Text Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SELECT** | `ST_SEL` | Default grid state. Highlight box around active cell $(R, C)$. | Hidden | Navigates cell focus to $(R \pm 1, C \pm 1)$. | Overwrites cell value and transitions to `ST_ENT`. |
| **ENTER** | `ST_ENT` | Activated by direct typing over a selected cell. | End of text | Commits value and moves grid focus. | Appends typed characters to new value buffer. |
| **EDIT** | `ST_EDT` | Activated by `F2`, double-clicking, or clicking formula bar. | Active inside string | Moves text caret within cell string buffer. | Inserts/deletes text at caret offset. |
| **POINT** | `ST_PNT` | Activated while constructing/editing formulas. | Active at formula tail | Navigates bounding box to select cell references. | Appends operators/tokens and reverts to `ST_EDT`. |

---

## 2. Comprehensive Keyboard & Focus Handling Matrix

The following table dictates key handling logic across all four application states:

| Key Binding | `SELECT` State (`ST_SEL`) | `ENTER` State (`ST_ENT`) | `EDIT` State (`ST_EDT`) | `POINT` State (`ST_PNT`) |
| :--- | :--- | :--- | :--- | :--- |
| `Enter` | Move focus down $(R+1, C)$ | Commit & move down $(R+1, C)$ | Commit & move down $(R+1, C)$ | Commit formula & move down $(R+1, C)$ |
| `Shift + Enter` | Move focus up $(R-1, C)$ | Commit & move up $(R-1, C)$ | Commit & move up $(R-1, C)$ | Commit formula & move up $(R-1, C)$ |
| `Tab` | Move focus right $(R, C+1)$ | Commit & move right $(R, C+1)$ | Commit & move right $(R, C+1)$ | Commit formula & move right $(R, C+1)$ |
| `Shift + Tab` | Move focus left $(R, C-1)$ | Commit & move left $(R, C-1)$ | Commit & move left $(R, C-1)$ | Commit formula & move left $(R, C-1)$ |
| `Escape` | Clear multi-cell selection | Cancel entry; restore original value; enter `ST_SEL` | Cancel edits; restore original value; enter `ST_SEL` | Abort current reference pointing; return to `ST_EDT` |
| `F2` | Enter `ST_EDT`; place caret at buffer end | Toggle between `ST_EDT` and `ST_PNT` | Toggle between `ST_EDT` and `ST_PNT` | Switch to `ST_EDT` at current formula caret position |
| `F4` | No-op | Cycle absolute/relative refs on highlighted reference token | Cycle absolute/relative refs on token at caret position | Cycle absolute/relative refs for target pointing token |
| `Up / Down` | Move grid focus $(R \pm 1, C)$ | Commit buffer & move focus $(R \pm 1, C)$ | Move caret up/down lines (or commit & move if single line) | Move pointing reference focus $(R \pm 1, C)$ |
| `Left / Right` | Move grid focus $(R, C \pm 1)$ | Commit buffer & move focus $(R, C \pm 1)$ | Move text caret left/right by 1 character | Move pointing reference focus $(R, C \pm 1)$ |
| `Shift + Arrows` | Expand grid selection range | Select text characters within cell buffer | Select text characters within cell buffer | Expand pointed selection range ($R_1C_1:R_2C_2$) |
| `Backspace` | Clear cell contents | Delete character left of caret | Delete character left of caret | Delete target reference token; return to `ST_EDT` |
| `Delete` | Clear cell contents | Delete character right of caret | Delete character right of caret | Delete target reference token; return to `ST_EDT` |
| `Home` | Move to Column 0 in current row | Move caret to index 0 | Move caret to index 0 | Move pointing box to Column 0 |
| `Ctrl + Home` | Move to top-left cell $(0, 0)$ | Move caret to index 0 | Move caret to index 0 | Move pointing box to $(0, 0)$ |

---

## 3. Formula Engine & POINT Mode Mechanics

### 3.1 Triggering Conditions for POINT Mode
`ST_PNT` mode is invoked dynamically when all of the following evaluation rules return `TRUE`:
1. The active buffer starts with an explicit formula trigger character (`=`, `+`, `-`).
2. The current caret position is positioned directly after a **Token Separator**:
   * Structural Separators: `=`, `(`, `,`, `:`, `{`, `;`
   * Mathematical Operators: `+`, `-`, `*`, `/`, `^`, `&`, `>`, `<`, `=`
3. The user initiates a navigation event (`Arrow Key` press or Mouse `Click` on a grid cell).

```typescript
// Deterministic POINT Mode Trigger Check
function shouldTriggerPointMode(buffer: string, caretOffset: number, inputEvent: InputEvent): boolean {
  if (!buffer.startsWith('=')) return false;
  const charBeforeCaret = buffer.slice(0, caretOffset).trim().slice(-1);
  const isSeparator = ['=', '(', ',', ':', '+', '-', '*', '/', '^', '&', '>', '<'].includes(charBeforeCaret);
  const isNavEvent = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'MouseDown'].includes(inputEvent.type);
  return isSeparator && isNavEvent;
}
```

### 3.2 Reference Cycling Mechanics (`F4` Key Execution Algorithm)
When `F4` is pressed while the caret touches or resides within a cell reference token (e.g., `B5`), the token must cycle through address reference types in the exact order below:

```
  ┌──────────┐      F4      ┌──────────┐      F4      ┌──────────┐      F4      ┌──────────┐
  │   A1     │ ───────────► │   $A$1   │ ───────────► │   A$1    │ ───────────► │   $A1    │
  │ (Rel/Rel)│              │ (Abs/Abs)│              │ (Rel/Abs)│              │ (Abs/Rel)│
  └──────────┘              └──────────┘              └──────────┘              └──────────┘
       ▲                                                                              │
       └──────────────────────────────────────────────────────────────────────────────┘
                                             F4
```

### 3.3 POINT Mode Range Expansion Protocol
* **Single Cell Pointing**: Pressing an Arrow key in `ST_PNT` initializes a single-cell pointing vector relative to the active origin cell.
* **Range Expansion**: Holding `Shift` while navigating in `ST_PNT` converts a single reference (`A1`) into a bounded range reference (`A1:C5`).
* **Operator Auto-Commit**: Entering any mathematical operator (`+`, `-`, `*`, `/`, `,`, `)`) while in `ST_PNT`:
  1. Closes and commits the active pointing reference string into the formula buffer.
  2. Appends the typed operator character.
  3. Transitions UI state back to `ST_EDT` with the caret positioned after the operator.

---

## 4. Visual Feedback & Highlighting Rules

### 4.1 Token Palette Array
Cell reference tokens within the formula and their corresponding bounding overlays on the grid canvas must share identical color coding mapped by token index.

```javascript
const TOKEN_COLOR_PALETTE = [
  { hex: '#1E88E5', rgb: 'rgb(30, 136, 229)',  name: 'Primary Blue' },
  { hex: '#D81B60', rgb: 'rgb(216, 27, 96)',   name: 'Magenta' },
  { hex: '#8E24AA', rgb: 'rgb(142, 36, 170)',  name: 'Purple' },
  { hex: '#004D40', rgb: 'rgb(0, 77, 64)',     name: 'Teal' },
  { hex: '#F57C00', rgb: 'rgb(245, 124, 0)',   name: 'Orange' },
  { hex: '#43A047', rgb: 'rgb(67, 160, 71)',   name: 'Green' }
];
```

### 4.2 Overlay Rendering Specifications
1. **Target Grid Bounding Box**:
   * Border Width: `2px` (Dashed while actively pointing in `ST_PNT`, Solid once committed in `ST_EDT`).
   * Border Color: `TOKEN_COLOR_PALETTE[tokenIndex % PALETTE_LENGTH].hex`.
   * Fill Opacity: `10%` (`rgba` using matching RGB values).
   * Corner Drag Handles: `4px` filled square rendered on the bottom-right corner of active selection ranges.
2. **Formula Syntax Token Rendering**:
   * Font Weight: `600` (Semi-bold) for reference string text inside Formula Bar and In-Cell Overlay.
   * Text Color: Matches the corresponding target grid bounding box color.

---

## 5. Edge Cases & Boundary Handling

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 EDGE CASE BOUNDARY MATRIX                                │
├───────────────────────────────┬──────────────────────────────────────────────────────────┤
│ Edge Condition                │ Mandated System Behavior                                 │
├───────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Left Arrow at Index 0         │ In EDIT mode at text index 0, Left Arrow MUST NOT        │
│                               │ trigger POINT mode. It remains in EDIT mode at index 0.  │
├───────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Focus Loss / Window Blur      │ Immediately commit active buffer to grid model, clear    │
│                               │ pointing overlays, and return state machine to SELECT.   │
├───────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Dynamic Range Auto-Scroll     │ Dragging mouse or pointing arrow keys beyond visible     │
│                               │ viewport bounds triggers auto-scrolling at 150px/sec.    │
├───────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Unmatched Parentheses/Syntax  │ Do not block commit. Store unparsed formula string,      │
│                               │ set rendered output to `#ERROR!`, and display error tip. │
├───────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Circular Reference Detection  │ Allow formula entry into state model. Evaluate graph     │
│                               │ asynchronously; surface warning status bar alert.        │
└───────────────────────────────┴──────────────────────────────────────────────────────────┘
```

---

## 6. Verification & Implementation Checklist

When integrating this specification into an AI agent or UI engine:

- [ ] Core state machine enforces deterministic transitions between `ST_SEL`, `ST_ENT`, `ST_EDT`, and `ST_PNT`.
- [ ] Keyboard navigation matches standard Excel/Sheets mappings across all states.
- [ ] Formula pointing activates correctly after operator tokens and mouse/arrow input.
- [ ] `F4` reference cycling follows `A1` $
ightarrow$ `$A$1` $
ightarrow$ `A$1` $
ightarrow$ `$A1` sequence.
- [ ] Multi-color token matching between grid canvas overlays and text syntax highlighting.
- [ ] Edge cases (focus loss, unparsed syntax, index 0 bounds) handle gracefully without application freeze.