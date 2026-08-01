// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * PDF Export Service
 *
 * Generates PDF documents from the spreadsheet grid using html2pdf.js.
 * Respects page setup settings (orientation, margins, scaling).
 */

import type { Sheet } from '../types';
import type { PrintSetup } from '../context/PrintSetupContext';
import { colToLetter } from '../types';

/**
 * Options for PDF generation.
 */
export interface PdfExportOptions {
  /** Page setup configuration. */
  setup: PrintSetup;
  /** Sheet title (appears in PDF header). */
  title?: string;
  /** Whether to include grid lines. */
  showGrid?: boolean;
  /** Whether to include row/column headers. */
  showHeaders?: boolean;
  /** Custom filename (without extension). */
  filename?: string;
}

/**
 * Generates a PDF Blob from a sheet.
 * @param sheet - The sheet to render as PDF.
 * @param options - PDF generation options.
 * @returns A Promise resolving to a Blob containing the PDF.
 */
export async function generatePdf(
  sheet: Sheet,
  options: PdfExportOptions
): Promise<Blob> {
  const { setup, title = sheet.name, showGrid = true, showHeaders = true } = options;

  // Dynamically import html2pdf.js to keep it out of the main bundle
  const html2pdf = (await import('html2pdf.js')).default;

  // Build the printable HTML table
  const container = buildPrintableHtml(sheet, { title, showGrid, showHeaders });

  // Configure html2pdf options based on page setup
  const pdfOptions = {
    margin: [
      setup.margins.top,
      setup.margins.right,
      setup.margins.bottom,
      setup.margins.left,
    ],
    filename: `${title.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
    },
    jsPDF: {
      unit: 'mm',
      format: setup.pageSize.toLowerCase(),
      orientation: setup.orientation,
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  return html2pdf().set(pdfOptions).from(container).outputPdf('blob');
}

/**
 * Downloads a sheet as a PDF file.
 */
export async function downloadPdf(sheet: Sheet, options: PdfExportOptions): Promise<void> {
  const blob = await generatePdf(sheet, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = options.filename ?? options.title ?? sheet.name;
  a.download = `${name.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Builds an HTML element suitable for PDF rendering.
 */
function buildPrintableHtml(
  sheet: Sheet,
  options: { title: string; showGrid: boolean; showHeaders: boolean }
): HTMLElement {
  const { title, showGrid, showHeaders } = options;

  const container = document.createElement('div');
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.fontSize = '10pt';
  container.style.width = '100%';

  // Title
  const titleEl = document.createElement('h2');
  titleEl.textContent = title;
  titleEl.style.margin = '0 0 8px 0';
  titleEl.style.fontSize = '14pt';
  container.appendChild(titleEl);

  // Find the used range
  const usedRange = findUsedRange(sheet);
  if (!usedRange) {
    const empty = document.createElement('p');
    empty.textContent = '(Empty sheet)';
    container.appendChild(empty);
    return container;
  }

  const { minRow, maxRow, minCol, maxCol } = usedRange;

  // Build table
  const table = document.createElement('table');
  table.style.borderCollapse = 'collapse';
  table.style.width = 'auto';

  for (let r = minRow; r <= maxRow; r++) {
    const tr = document.createElement('tr');

    for (let c = minCol; c <= maxCol; c++) {
      const cell = sheet.cells[`${r}:${c}`];
      const td = document.createElement('td');

      td.style.padding = '2px 6px';
      td.style.minWidth = '60px';

      if (showGrid) {
        td.style.border = '1px solid #ccc';
      }

      if (showHeaders && r === minRow) {
        td.style.backgroundColor = '#f0f0f0';
        td.style.fontWeight = 'bold';
        td.textContent = colToLetter(c);
      } else if (showHeaders && c === minCol) {
        td.style.backgroundColor = '#f0f0f0';
        td.style.fontWeight = 'bold';
        td.textContent = String(r + 1);
      } else {
        const value = cell?.computedValue !== undefined && cell?.computedValue !== null
          ? String(cell.computedValue)
          : cell?.rawValue ?? '';
        td.textContent = value;

        // Apply basic formatting
        if (cell?.style) {
          if (cell.style.fontWeight === 'bold') td.style.fontWeight = 'bold';
          if (cell.style.fontStyle === 'italic') td.style.fontStyle = 'italic';
          if (cell.style.color) td.style.color = cell.style.color;
          if (cell.style.backgroundColor) td.style.backgroundColor = cell.style.backgroundColor;
          if (cell.style.textAlign) td.style.textAlign = cell.style.textAlign;
        }
      }

      tr.appendChild(td);
    }

    table.appendChild(tr);
  }

  container.appendChild(table);
  return container;
}

/**
 * Finds the bounding box of all non-empty cells.
 */
function findUsedRange(sheet: Sheet): {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
} | null {
  const keys = Object.keys(sheet.cells);
  if (keys.length === 0) return null;

  let minRow = Infinity, maxRow = -Infinity;
  let minCol = Infinity, maxCol = -Infinity;

  for (const key of keys) {
    const [rowStr, colStr] = key.split(':');
    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  }

  return { minRow, maxRow, minCol, maxCol };
}
