# Skill: Web Spreadsheet Data & Formula Entry Engine (`excel-dataentry`)
name: excel-dataentry
description: Technical specification and behavioral rules for web-based spreadsheet cell editing, keyboard navigation, formula creation, and POINT mode single/range selection.
version: 1.1.0
target_environment: Web / Browser-based Canvas or DOM Grid Engine (Excel Online / Google Sheets style)


This skill document defines the deterministic UI/UX interaction logic, state machine transitions, keyboard navigation rules, and formula range selection ("POINT mode") mechanics required for a browser-based spreadsheet application.

---

## 1. System State Machine

The spreadsheet engine operates under a strict finite-state machine (FSM). At any given timestamp, the grid focus rests on a primary active cell $(R, C)$ and exists in exactly **one** of four operational states.

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
│   cell or range parameters)   │
└───────────────────────────────┘

### 1.1 Primary State Definitions

| State | Mode Code | Description | Visual Caret | Arrow Key Behavior | Input Text Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SELECT** | `ST_SEL` | Default grid state. Highlight box around active cell $(R, C)$. | Hidden | Navigates cell focus to $(R \pm 1, C \pm 1)$. | Overwrites cell value and transitions to `ST_ENT`. |
| **ENTER** | `ST_ENT` | Activated by direct typing over a selected cell. | End of text | Commits value and moves grid focus. | Appends typed characters to new value buffer. |
| **EDIT** | `ST_EDT` | Activated by `F2`, double-clicking, or clicking formula bar. | Active inside string | Moves text caret within cell string buffer. | Inserts/deletes text at caret offset. |
| **POINT** | `ST_PNT` | Activated while constructing/editing formulas. | Active at formula tail or current token | Navigates bounding box or expands range selection. | Appends operators/tokens and reverts to `ST_EDT`. |

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
| `F4` | No-op | Cycle absolute/relative refs on highlighted reference token | Cycle absolute/relative refs on token at caret position | Cycle absolute/relative refs for target pointing reference/range |
| `Up / Down` | Move grid focus $(R \pm 1, C)$ | Commit buffer & move focus $(R \pm 1, C)$ | Move caret up/down lines (or commit & move if single line) | Move pointing reference focus or adjust active range anchor $(R \pm 1, C)$ |
| `Left / Right` | Move grid focus $(R, C \pm 1)$ | Commit buffer & move focus $(R, C \pm 1)$ | Move text caret left/right by 1 character | Move pointing reference focus or adjust active range anchor $(R, C \pm 1)$ |
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
2. The current caret position is positioned directly after a **Token Separator** or inside an existing cell/range reference token:
   * Structural Separators: `=`, `(`, `,`, `:`, `{`, `;`
   * Mathematical Operators: `+`, `-`, `*`, `/`, `^`, `&`, `>`, `<`, `=`
3. The user initiates a navigation event (`Arrow Key` press, `Shift + Arrow` key press, or Mouse `Click` / `Drag` on a grid cell or handle).

```typescript
// Deterministic POINT Mode Trigger Check
function shouldTriggerPointMode(buffer: string, caretOffset: number, inputEvent: InputEvent): boolean {
  if (!buffer.startsWith('=')) return false;
  const charBeforeCaret = buffer.slice(0, caretOffset).trim().slice(-1);
  const isSeparator = ['=', '(', ',', ':', '+', '-', '*', '/', '^', '&', '>', '<'].includes(charBeforeCaret);
  const isNavEvent = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'MouseDown', 'MouseMove'].includes(inputEvent.type);
  return (isSeparator && isNavEvent) || isCursorOnReferenceToken(buffer, caretOffset);
}

### 3.2 Reference & Range Cycling Mechanics (F4 Key Execution Algorithm)
When F4 is pressed while the caret touches or resides within a single cell reference token (e.g., B5) or a range reference token (e.g., B5:C10), the target token cycles through address reference types in the exact order below:
```
Single Cell Token
  ┌──────────┐      F4      ┌──────────┐      F4      ┌──────────┐      F4      ┌──────────┐
  │   A1     │ ───────────► │   $A$1   │ ───────────► │   A$1    │ ───────────► │   $A1    │
  │ (Rel/Rel)│              │ (Abs/Abs)│              │ (Rel/Abs)│              │ (Abs/Rel)│
  └──────────┘              └──────────┘              └──────────┘              └──────────┘
       ▲                                                                              │
       └──────────────────────────────────────────────────────────────────────────────┘
                                             F4


                                             Range Parameter Token  ┌─────────────┐      F4      ┌───────────────┐      F4      ┌─────────────┐      F4      ┌──────────────┐
  │   A1:B5     │ ───────────► │   $A$1:$B$5   │ ───────────► │   A$1:B$5   │ ───────────► │   $A1:$B5    │
  │ (Both Rel)  │              │  (Both Abs)   │              │ (Abs Rows)  │              │  (Abs Cols)  │
  └─────────────┘              └───────────────┘              └─────────────┘              └──────────────┘
         ▲                                                                                        │
         └────────────────────────────────────────────────────────────────────────────────────────┘
                                                    F4
### 3.3 POINT Mode Range Parameter Creation & Editing Rules

#### 3.3.1 Range Construction RulesInitial Selection (Single Cell to Range via Keyboard):Pressing an Arrow key creates a single cell reference (e.g., A1).
Holding Shift while pressing Arrow keys converts A1 into a range parameter string (e.g., A1:B2) in the formula buffer, establishing A1 as the fixed anchor cell and the moving cell focus as the dynamic endpoint.
Initial Selection via Mouse Drag:Clicking a cell MouseDown inserts its reference (e.g., A1).
Dragging while holding MouseDown across grid boundaries live-updates the buffer string into a range reference parameter (A1:C5). 
Releasing MouseUp freezes the reference string in ST_PNT mode until an operator key is pressed or focus shifts.
Explicit Range Colon (:) Insertion:If a user types : manually after a single cell reference (e.g., =SUM(A1:), the engine automatically duplicates the single reference as the default trailing range endpoint (=SUM(A1:A1)) and maintains ST_PNT state, positioning the pointing cursor on the secondary endpoint parameter.

### 3.3.2 Modifying Existing Range ParametersWhen the formula caret is placed adjacent to or inside an existing range parameter (e.g., A1:C5):Bounding Box Focus: The grid highlights the target range with its designated token overlay color and displays boundary corner handles.
Handle Drag Resizing:Dragging any of the 4 selection corner handles recalculates the coordinates $(R_1, C_1):(R_2, C_2)$ and replaces the range string in real time.
Dragging an edge line shifts the whole range parameter offset (e.g., shifting A1:B2 right turns it into B1:C2).
Keyboard Parameter Endpoint Adjustment:In ST_PNT mode, pressing Shift + Arrow Keys expands or contracts the dynamic endpoint $(R_2, C_2)$ while keeping the origin anchor $(R_1, C_1)$ stationary.

### 3.3.3 Operator Auto-Commit & State ReversionEntering any structural separator or mathematical operator (+, -, *, /, ,, ), :, ;) while in ST_PNT:Closes and commits the active cell or range reference string into the formula text stream. Appends the typed character.
Transitions UI state back to ST_EDT with the text caret positioned immediately after the character.4. Visual Feedback & Highlighting Rules4.1 Token Palette ArrayCell reference tokens and range parameters within the formula, alongside their corresponding bounding overlays on the grid canvas, must share identical color coding mapped by token index.
```
JavaScriptconst TOKEN_COLOR_PALETTE = [
  { hex: '#1E88E5', rgb: 'rgb(30, 136, 229)',  name: 'Primary Blue' },
  { hex: '#D81B60', rgb: 'rgb(216, 27, 96)',   name: 'Magenta' },
  { hex: '#8E24AA', rgb: 'rgb(142, 36, 170)',  name: 'Purple' },
  { hex: '#004D40', rgb: 'rgb(0, 77, 64)',     name: 'Teal' },
  { hex: '#F57C00', rgb: 'rgb(245, 124, 0)',   name: 'Orange' },
  { hex: '#43A047', rgb: 'rgb(67, 160, 71)',   name: 'Green' }
];
```
### 4.2 Overlay Rendering SpecificationsTarget Grid Bounding Box & Range Highlights:Border Width: 2px (Dashed animation while actively pointing/dragging in ST_PNT, Solid once committed in ST_EDT).Border 
Color: TOKEN_COLOR_PALETTE[tokenIndex % PALETTE_LENGTH].hex.Fill Opacity: 10% (rgba using matching RGB values across the entire bounded cell area).
Corner Drag Handles: 6px filled squares rendered on the 4 corners of active single or range selection overlays, enabling cursor resize interactions.
Formula Syntax Token Rendering:Font Weight: 600 (Semi-bold) for reference and range strings inside the Formula Bar and In-Cell Editor.
Text Color: Matches the corresponding target grid bounding box color.

## 5. Edge Cases & Boundary Handling┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 EDGE CASE BOUNDARY MATRIX                                │
├───────────────────────────────┬──────────────────────────────────────────────────────────┤
│ Edge Condition                │ Mandated System Behavior                                 │
├───────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Left Arrow at Index 0         │ In EDIT mode at text index 0, Left Arrow MUST NOT        │
│                               │ trigger POINT mode. It remains in EDIT mode at index 0.  │
├───────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Inverted Range Dragging       │ Dragging range selection up/left past origin anchor      │
│                               │ automatically normalizes token coordinates in formula    │
│                               │ buffer (e.g., converts lower-right to top-left `A1:C5`).│
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


## 6. Keyboard Shortcut Reference

The following table documents all keyboard shortcuts for cell editing and navigation, based on the Excel Web Editor specification (`excel_web_editor_shortcuts-v4.json`).

### 6.1 Entering & Exiting Edit Mode

| Key | Action | In Formula Bar | Implemented |
| :--- | :--- | :--- | :--- |
| F2 | Edit active cell, place cursor at end; toggle Point mode for formulas | ✅ | ✅ |
| Ctrl + F2 | Move focus between in-cell editor and formula bar | ✅ | ❌ Planned |
| Enter | Complete cell entry and move down | ✅ | ✅ |
| Ctrl + Enter | Complete cell entry and stay in same cell | ✅ | ✅ |
| Shift + Enter | Complete cell entry and move up | ✅ | ✅ |
| Tab | Complete cell entry and move right | ✅ | ✅ |
| Shift + Tab | Complete cell entry and move left | ✅ | ✅ |
| Esc | Cancel editing and discard changes | ✅ | ✅ |

### 6.2 Navigation & Text Selection

| Key | Action | In Formula Bar | Implemented |
| :--- | :--- | :--- | :--- |
| Backspace | Delete one character to the left | ✅ | ✅ (native) |
| Delete | Delete one character to the right | ✅ | ✅ (native) |
| Left Arrow | Move cursor one character left | ✅ | ✅ (native) |
| Right Arrow | Move cursor one character right | ✅ | ✅ (native) |
| Ctrl + Left Arrow | Move cursor one word to the left | ✅ | ✅ |
| Ctrl + Right Arrow | Move cursor one word to the right | ✅ | ✅ |
| Home | Move cursor to beginning of line | ✅ | ✅ |
| End | Move cursor to end of line | ✅ | ✅ |
| Shift + Left Arrow | Select text one character left | ✅ | ✅ (native) |
| Shift + Right Arrow | Select text one character right | ✅ | ✅ (native) |
| Ctrl + Shift + Left Arrow | Select text one word left | ✅ | ✅ (native) |
| Ctrl + Shift + Right Arrow | Select text one word right | ✅ | ✅ (native) |
| Shift + Home | Select text from cursor to beginning | ✅ | ✅ (native) |
| Shift + End | Select text from cursor to end | ✅ | ✅ (native) |
| Alt + Enter | Insert line break inside cell | ❌ | ✅ |

### 6.3 Formula Navigation & Building

| Key | Action | Requires Selection | Implemented |
| :--- | :--- | :--- | :--- |
| F4 | Cycle absolute/relative/mixed references | ❌ | ✅ |
| Tab | Accept highlighted autocomplete item | ✅ | ✅ |
| Up Arrow | Navigate up in autocomplete dropdown | ✅ | ✅ |
| Down Arrow | Navigate down in autocomplete dropdown | ✅ | ✅ |

### 6.4 Implementation Status Legend

| Symbol | Meaning |
| :--- | :--- |
| ✅ | Fully implemented and tested |
| ⚠️ | Partially implemented |
| ❌ | Not yet implemented |
| (native) | Handled by browser input behavior |

---

## 7. Verification & Implementation Checklist
When integrating this specification into an AI agent or UI engine:

[ ] Core state machine enforces deterministic transitions between ST_SEL, ST_ENT, ST_EDT, and ST_PNT.

[ ] Keyboard navigation matches standard Excel/Sheets mappings across all states.

[ ] Formula pointing activates correctly after operator tokens and mouse/arrow input.

[ ] Range parameter creation via Shift + Arrows, mouse drag, or manual colon : typing works continuously.

[ ] Range resize handle dragging updates range string token values live in formula editor.

[ ] F4 reference cycling follows single cell (A1 → $A$1 → A$1 → $A1) and range parameter (A1:B5 → $A$1:$B$5 → A$1:B$5 → $A1:$B5) sequences correctly.

[ ] Multi-color token matching between grid canvas overlays and text syntax highlighting.

[ ] Edge cases (focus loss, unparsed syntax, index 0 bounds, inverted range drags) handle gracefully without application freeze.
