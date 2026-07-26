import {
  detectNumeric,
  parsePlainText,
  parseHtmlTable,
  classifyPasteContent,
} from './clipboardParse';

describe('clipboardParse', () => {
  describe('detectNumeric', () => {
    it('detects plain integers', () => {
      expect(detectNumeric('42')).toEqual({ value: '42', format: null });
      expect(detectNumeric('-7')).toEqual({ value: '-7', format: null });
      expect(detectNumeric('0')).toEqual({ value: '0', format: null });
    });

    it('detects decimals', () => {
      expect(detectNumeric('3.14')).toEqual({ value: '3.14', format: null });
      expect(detectNumeric('-0.5')).toEqual({ value: '-0.5', format: null });
    });

    it('detects thousands separators with format', () => {
      expect(detectNumeric('1,234')).toEqual({ value: '1234', format: '#,##0' });
      expect(detectNumeric('10,000,000')).toEqual({ value: '10000000', format: '#,##0' });
    });

    it('detects currency', () => {
      expect(detectNumeric('$1,234.56')).toEqual({ value: '1234.56', format: '$#,##0.00' });
      expect(detectNumeric('£50')).toEqual({ value: '50', format: '$#,##0.00' });
      expect(detectNumeric('€100.50')).toEqual({ value: '100.5', format: '$#,##0.00' });
    });

    it('detects percentages as decimals', () => {
      expect(detectNumeric('50%')).toEqual({ value: '0.5', format: '0.00%' });
      expect(detectNumeric('12.5%')).toEqual({ value: '0.125', format: '0.00%' });
      expect(detectNumeric('-10%')).toEqual({ value: '-0.1', format: '0.00%' });
    });

    it('detects parentheses negatives (accounting)', () => {
      expect(detectNumeric('(123)')).toEqual({ value: '-123', format: '#,##0' });
      expect(detectNumeric('(1,234)')).toEqual({ value: '-1234', format: '#,##0' });
    });

    it('returns null for non-numeric strings', () => {
      expect(detectNumeric('hello')).toBeNull();
      expect(detectNumeric('')).toBeNull();
      expect(detectNumeric('   ')).toBeNull();
      expect(detectNumeric('abc123')).toBeNull();
      expect(detectNumeric('12abc')).toBeNull();
    });
  });

  describe('parsePlainText', () => {
    it('parses TSV (tab-separated) data', () => {
      const result = parsePlainText('A\tB\tC\n1\t2\t3');
      expect(result.rowCount).toBe(2);
      expect(result.colCount).toBe(3);
      expect(result.values[0]).toEqual(['A', 'B', 'C']);
      expect(result.values[1]).toEqual(['1', '2', '3']);
    });

    it('treats comma-separated text as single cell (Excel paste behavior)', () => {
      // Commas are NOT delimiters - each line is a single cell
      const result = parsePlainText('Name,Age,City\nAlice,30,NYC');
      expect(result.rowCount).toBe(2);
      expect(result.colCount).toBe(1);
      expect(result.values[0]).toEqual(['Name,Age,City']);
      expect(result.values[1]).toEqual(['Alice,30,NYC']);
    });

    it('auto-detects numeric values in single-cell lines', () => {
      const result = parsePlainText('Item\n$1.50');
      expect(result.values[1][0]).toBe('1.5');
      expect(result.styles[1][0]).toEqual({ numberFormat: '$#,##0.00' });
      // Non-numeric cells have no style
      expect(result.styles[0][0]).toBeNull();
    });

    it('handles commas in text without splitting', () => {
      // Text with commas is preserved as-is in a single cell
      const result = parsePlainText('Smith, John\nHas a, comma here');
      expect(result.values[0]).toEqual(['Smith, John']);
      expect(result.values[1]).toEqual(['Has a, comma here']);
    });

    it('handles empty trailing newline', () => {
      const result = parsePlainText('A\tB\n1\t2\n');
      expect(result.rowCount).toBe(2);
    });

    it('handles empty input', () => {
      const result = parsePlainText('');
      expect(result.rowCount).toBe(0);
      expect(result.colCount).toBe(0);
    });

    it('pads rows to uniform width', () => {
      const result = parsePlainText('A\tB\tC\n1\t2');
      expect(result.colCount).toBe(3);
      expect(result.values[1]).toEqual(['1', '2', '']);
    });

    it('handles CRLF line endings', () => {
      const result = parsePlainText('A\tB\r\n1\t2\r\n');
      expect(result.rowCount).toBe(2);
    });


  });

  describe('parseHtmlTable', () => {
    it('parses a simple HTML table', () => {
      const html = '<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.rowCount).toBe(2);
      expect(result.colCount).toBe(2);
      expect(result.values[0]).toEqual(['A', 'B']);
      expect(result.values[1]).toEqual(['1', '2']);
    });

    it('extracts bold style from font-weight', () => {
      const html = '<table><tr><td style="font-weight: bold">Hello</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.fontWeight).toBe('bold');
    });

    it('extracts italic style', () => {
      const html = '<table><tr><td style="font-style: italic">Hello</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.fontStyle).toBe('italic');
    });

    it('extracts underline style', () => {
      const html = '<table><tr><td style="text-decoration: underline">Hello</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.textDecoration).toBe('underline');
    });

    it('extracts text color', () => {
      const html = '<table><tr><td style="color: #ff0000">Hello</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.color).toBe('#ff0000');
    });

    it('extracts background color', () => {
      const html = '<table><tr><td style="background-color: rgb(0, 0, 255)">Hello</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.backgroundColor).toBe('#0000ff');
    });

    it('extracts text alignment', () => {
      const html = '<table><tr><td style="text-align: center">Hello</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.textAlign).toBe('center');
    });

    it('auto-detects numeric values even in HTML tables', () => {
      const html = '<table><tr><td>$1,234.56</td><td>50%</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.values[0][0]).toBe('1234.56');
      expect(result.styles[0][0]?.numberFormat).toBe('$#,##0.00');
      expect(result.values[0][1]).toBe('0.5');
      expect(result.styles[0][1]?.numberFormat).toBe('0.00%');
    });

    it('falls back to plain text when no table found', () => {
      const html = '<div>Just some text</div>';
      const result = parseHtmlTable(html);
      expect(result.values[0][0]).toBe('Just some text');
    });

    it('handles <th> elements', () => {
      const html = '<table><tr><th>Header</th></tr><tr><td>Data</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.rowCount).toBe(2);
      expect(result.values[0][0]).toBe('Header');
      expect(result.values[1][0]).toBe('Data');
    });

    it('drops fully empty trailing rows', () => {
      const html = '<table><tr><td>A</td></tr><tr><td></td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.rowCount).toBe(1);
    });

    it('extracts normal font-weight (400)', () => {
      const html = '<table><tr><td style="font-weight: 400">Normal</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.fontWeight).toBe('normal');
    });

    it('extracts line-through text-decoration', () => {
      const html = '<table><tr><td style="text-decoration: line-through">Strike</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.textDecoration).toBe('line-through');
    });

    it('extracts short hex color (#abc → #aabbcc)', () => {
      const html = '<table><tr><td style="color: #f00">Red</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.color).toBe('#ff0000');
    });

    it('extracts named color (red)', () => {
      const html = '<table><tr><td style="color: red">Red</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.color).toBe('#ff0000');
    });

    it('extracts rgb() color', () => {
      const html = '<table><tr><td style="color: rgb(0, 128, 255)">Blue</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.color).toBe('#0080ff');
    });

    it('extracts Excel mso-number-format (currency)', () => {
      const html = '<table><tr><td style="mso-number-format: $#,##0.00">$100</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.numberFormat).toBe('$#,##0.00');
    });

    it('extracts Excel mso-number-format (percentage)', () => {
      const html = '<table><tr><td style="mso-number-format: 0.00%">50%</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.numberFormat).toBe('0.00%');
    });

    it('extracts Excel mso-number-format (date)', () => {
      const html = '<table><tr><td style="mso-number-format: yyyy-mm-dd">2024</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.numberFormat).toBe('mm/dd/yyyy');
    });

    it('extracts Excel mso-number-format (thousands)', () => {
      const html = '<table><tr><td style="mso-number-format: #,##0">1000</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.numberFormat).toBe('#,##0');
    });

    it('extracts Excel mso-number-format (£ pound currency)', () => {
      const html = '<table><tr><td style="mso-number-format: \u00A3#,##0.00">£100</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.numberFormat).toBe('$#,##0.00');
    });

    it('falls back to General for unknown mso-number-format', () => {
      const html = '<table><tr><td style="mso-number-format: @">Text</td></tr></table>';
      const result = parseHtmlTable(html);
      expect(result.styles[0][0]?.numberFormat).toBe('General');
    });

    it('returns trimmed color string for unrecognized format', () => {
      const html = '<table><tr><td style="color: hsl(120, 100%, 50%)">Green</td></tr></table>';
      const result = parseHtmlTable(html);
      // hsl is not supported, returns trimmed as-is
      expect(result.styles[0][0]?.color).toBe('hsl(120, 100%, 50%)');
    });
  });

  describe('classifyPasteContent', () => {
    it('classifies plain text as grid', () => {
      expect(classifyPasteContent('Hello world', null)).toBe('grid');
    });

    it('classifies empty string as grid', () => {
      expect(classifyPasteContent('', null)).toBe('grid');
    });

    it('classifies multi-line text as grid', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      expect(classifyPasteContent(text, null)).toBe('grid');
    });

    it('classifies tab-delimited data as grid', () => {
      const text = 'A\tB\tC\n1\t2\t3';
      expect(classifyPasteContent(text, null)).toBe('grid');
    });

    it('classifies CSV data as grid', () => {
      const text = 'Name,Age,City\nAlice,30,NYC\nBob,25,LA';
      expect(classifyPasteContent(text, null)).toBe('grid');
    });

    it('classifies HTML table as rich-grid', () => {
      const html = '<table><tr><td>A</td></tr></table>';
      expect(classifyPasteContent('A', html)).toBe('rich-grid');
    });

    it('classifies multi-line with inconsistent commas as grid', () => {
      const text = 'Hello, world\nNo comma here\nOne, two, three';
      expect(classifyPasteContent(text, null)).toBe('grid');
    });

    it('classifies HTML without table as grid (avoids unnecessary parsing)', () => {
      // MathJax content has HTML but no table
      const html = '<span class="math"><mjx-container><svg>...</svg></mjx-container></span>';
      expect(classifyPasteContent('test', html)).toBe('grid');
    });

    it('classifies HTML with table attribute in style as grid (no false positive)', () => {
      // display:table-cell doesn't contain '<table' substring
      const html = '<div style="display:table-cell">test</div>';
      expect(classifyPasteContent('test', html)).toBe('grid');
    });
  });

  describe('parseHtmlTable safety limit', () => {
    it('caps processing at MAX_HTML_TABLE_CELLS to prevent lockups', () => {
      // Generate a very large table that would cause performance issues
      let html = '<table>';
      for (let r = 0; r < 200; r++) {
        html += '<tr>';
        for (let c = 0; c < 100; c++) {
          html += `<td style="font-weight:bold;color:red;text-align:center;background-color:#f0f0f0">Cell ${r}-${c}</td>`;
        }
        html += '</tr>';
      }
      html += '</table>';

      // Should complete without hanging and return at most 10000 cells
      const result = parseHtmlTable(html);

      // Total cells should be capped at 10000 (100 rows x 100 cols = 10000)
      const totalCells = result.rowCount * result.colCount;
      expect(totalCells).toBeLessThanOrEqual(10000);
    });

    it('processes small tables completely', () => {
      // Small tables should be processed completely
      let html = '<table>';
      for (let r = 0; r < 5; r++) {
        html += '<tr>';
        for (let c = 0; c < 5; c++) {
          html += `<td>Cell ${r}-${c}</td>`;
        }
        html += '</tr>';
      }
      html += '</table>';

      const result = parseHtmlTable(html);
      expect(result.rowCount).toBe(5);
      expect(result.colCount).toBe(5);
    });
  });
});
