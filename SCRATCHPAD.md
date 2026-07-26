<!-- 2026-07-27 -->
- [ ] Fixed: Plain text starting with = no longer activates POINT mode (looksLikeFormula helper)
- [ ] Fixed: Formula parser handles dots in named references (e.g., Hello.World)
- [ ] Fixed: Selection collapse on Arrow keys without Shift in formula bar
- [ ] 1397 tests pass, lint clean, type-check clean
<!-- 2026-07-27 (continued) -->
- [ ] Fixed: Paste text starting with = as plain text (prefix with single quote)
- [ ] Fixed: Grid displays cells with leading single quote without showing the quote
- [ ] Reverted looksLikeFormula change - content starting with = IS a formula
- [ ] 1387 tests pass, lint clean, type-check clean
