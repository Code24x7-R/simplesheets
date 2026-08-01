import { extractHighlights, findCrossSheetRefAtCursor } from './FormulaBar';
import { computeHighlightSegments } from './FormulaHighlightOverlay';

describe('extractHighlights — cross-sheet reference handling (B-020)', () => {
  it('returns ranges for same-sheet formula', () => {
    const highlights = extractHighlights('=SUM(A1:B5)');
    expect(highlights.length).toBe(1);
    expect(highlights[0]).toEqual(expect.objectContaining({
      startRow: 0,
      startCol: 0,
      endRow: 4,
      endCol: 1,
      colorIndex: 0,
    }));
  });

  it('returns cell highlight for same-sheet ref', () => {
    const highlights = extractHighlights('=A1+B2');
    expect(highlights.length).toBe(2);
    expect(highlights[0]).toEqual(expect.objectContaining({ startRow: 0, startCol: 0, endRow: 0, endCol: 0, colorIndex: 0 }));
    expect(highlights[1]).toEqual(expect.objectContaining({ startRow: 1, startCol: 1, endRow: 1, endCol: 1, colorIndex: 1 }));
  });

  it('SKIPS cross-sheet ranges (should not highlight on current sheet)', () => {
    const highlights = extractHighlights('=SUM(Sheet1!B2:Sheet1!B21)');
    // Cross-sheet range should NOT produce highlights on current sheet
    expect(highlights.length).toBe(0);
  });

  it('SKIPS cross-sheet single cell refs', () => {
    const highlights = extractHighlights('=Sheet1!A1');
    expect(highlights.length).toBe(0);
  });

  it('SKIPS cross-sheet ref in mixed formula', () => {
    // Only the same-sheet part (C1) should be highlighted
    const highlights = extractHighlights('=Sheet1!A1+C1');
    expect(highlights.length).toBe(1);
    expect(highlights[0]).toEqual(expect.objectContaining({ startRow: 0, startCol: 2, endRow: 0, endCol: 2, colorIndex: 0 }));
  });

  it('SKIPS cross-sheet ref with quoted sheet name', () => {
    const highlights = extractHighlights("='My Sheet'!A1:B5");
    expect(highlights.length).toBe(0);
  });

  it('returns empty for non-formula', () => {
    expect(extractHighlights('hello')).toEqual([]);
    expect(extractHighlights('')).toEqual([]);
  });

  it('handles multiple same-sheet ranges', () => {
    const highlights = extractHighlights('=SUM(A1:B5)+SUM(C1:D5)');
    expect(highlights.length).toBe(2);
    expect(highlights[0].colorIndex).toBe(0);
    expect(highlights[1].colorIndex).toBe(1);
  });
});

describe('findCrossSheetRefAtCursor — cross-sheet navigation (B-021)', () => {
  it('finds cross-sheet ref at cursor position', () => {
    // =SUM(Sheet1!B2:Sheet1!B21)
    //    0123456789...
    const result = findCrossSheetRefAtCursor('=SUM(Sheet1!B2:Sheet1!B21)', 8);
    expect(result).not.toBeNull();
    expect(result?.sheetName).toBe('Sheet1');
    expect(result?.startRow).toBe(1); // B2
    expect(result?.startCol).toBe(1);
    expect(result?.endRow).toBe(20); // B21
    expect(result?.endCol).toBe(1);
  });

  it('returns null when cursor is on same-sheet ref', () => {
    const result = findCrossSheetRefAtCursor('=SUM(A1:B5)', 6);
    expect(result).toBeNull();
  });

  it('returns null when cursor is outside any ref', () => {
    const result = findCrossSheetRefAtCursor('=SUM(Sheet1!B2:Sheet1!B21)', 3); // on "M" of SUM
    expect(result).toBeNull();
  });

  it('finds cross-sheet single cell ref', () => {
    const result = findCrossSheetRefAtCursor('=Sheet1!A1+B1', 3);
    expect(result).not.toBeNull();
    expect(result?.sheetName).toBe('Sheet1');
    expect(result?.startRow).toBe(0);
    expect(result?.startCol).toBe(0);
  });

  it('returns null for non-formula', () => {
    expect(findCrossSheetRefAtCursor('hello', 2)).toBeNull();
  });

  it('finds ref at exact start position', () => {
    const result = findCrossSheetRefAtCursor('=Sheet1!A1', 1); // position of 'S'
    expect(result).not.toBeNull();
    expect(result?.sheetName).toBe('Sheet1');
  });

  it('finds ref at exact end position', () => {
    // =Sheet1!A1 -> after stripping =, formula is Sheet1!A1 (9 chars)
    // S=0,h=1,e=2,e=3,t=4,1=5,!=6,A=7,1=8, endPos=9
    const result = findCrossSheetRefAtCursor('=Sheet1!A1', 9); // = at 0, so Sheet1!A1 is 1-9
    expect(result).not.toBeNull();
    expect(result?.sheetName).toBe('Sheet1');
  });
});

describe('computeHighlightSegments — character coverage (B-022)', () => {
  it('includes leading "=" as a visible segment', () => {
    const segs = computeHighlightSegments('=A1', true);
    expect(segs).not.toBeNull();
    // First segment should be the leading '='
    expect(segs![0]).toEqual({ text: '=', colorIndex: null });
    // All segments joined should equal the full formula (including =)
    const joined = segs!.map(s => s.text).join('');
    expect(joined).toBe('=A1');
  });

  it('includes "!" separator for cross-sheet refs', () => {
    const segs = computeHighlightSegments('=Sheet1!A1', true);
    expect(segs).not.toBeNull();
    // All segments joined should equal the full formula (including =)
    const joined = segs!.map(s => s.text).join('');
    expect(joined).toBe('=Sheet1!A1');
    // The "!" must be present in the output
    expect(joined).toContain('!');
  });

  it('includes "=" operator in formulas', () => {
    const segs = computeHighlightSegments('=A1=B1', true);
    expect(segs).not.toBeNull();
    const joined = segs!.map(s => s.text).join('');
    expect(joined).toBe('=A1=B1');
    expect(joined).toContain('=');
  });

  it('covers all characters in cross-sheet range formula', () => {
    const segs = computeHighlightSegments('=SUM(Sheet1!B2:Sheet1!B21)', true);
    expect(segs).not.toBeNull();
    const joined = segs!.map(s => s.text).join('');
    expect(joined).toBe('=SUM(Sheet1!B2:Sheet1!B21)');
    expect(joined).toContain('!');
  });

  it('covers all characters in quoted sheet name formula', () => {
    const segs = computeHighlightSegments("='My Sheet'!A1:B5", true);
    expect(segs).not.toBeNull();
    const joined = segs!.map(s => s.text).join('');
    expect(joined).toBe("='My Sheet'!A1:B5");
    expect(joined).toContain('!');
  });

  it('returns null when not editing', () => {
    expect(computeHighlightSegments('=A1', false)).toBeNull();
  });

  it('returns null for non-formula', () => {
    expect(computeHighlightSegments('hello', true)).toBeNull();
  });
});
