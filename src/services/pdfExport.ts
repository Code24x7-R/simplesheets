// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * PDF Export Service
 *
 * Generates PDF documents from the spreadsheet grid using html2pdf.js.
 * Respects page setup settings (orientation, margins, scaling, print range,
 * footers).
 *
 * Design notes:
 * - The output contains **no row/column headings** by default (`showHeaders`).
 * - The output contains **no generic grid pattern**. Borders are drawn only
 *   where the cells themselves define them — a "table style" is simply cell
 *   borders (`CellStyle.borderTop/Bottom/Left/Right`). Apply borders to a
 *   range and the grid appears; leave them unset and the sheet prints clean.
 * - Page breaks are inserted automatically by html2pdf's pagebreak plugin
 *   (each row is marked `break-inside: avoid`), so rows are never split across
 *   pages without any hand-rolled pagination.
 */

import type { Cell, Sheet } from '../types';
import { colToLetter } from '../types';
import type { PageSize, PrintRange, PrintScaling, PrintSetup } from '../context/PrintSetupContext';
import { parseRange } from '../utils/chartData';
import { extractChartData, getMinMax, generateColors } from '../utils/chartData';
import type { ChartConfig } from '../types';

/** Millimetres → pixels (matches jsPDF's mm→pt→px conversion). */
const MM_TO_PX = 96 / 25.4;

/** Physical page sizes in millimetres (portrait). */
const PAGE_SIZES_MM: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
};

/** Fixed width reserved for the row-number heading column. */
const ROW_HEADER_WIDTH_PX = 36;

/** Default footer template. */
export const DEFAULT_FOOTER = 'Page {page} of {total}';

/**
 * Options for PDF generation.
 */
export interface PdfExportOptions {
  /** Page setup configuration. */
  setup: PrintSetup;
  /** Sheet title (appears in PDF header). */
  title?: string;
  /**
   * Whether to include row/column headings. Defaults to `setup.showHeaders`
   * (which itself defaults to false).
   */
  showHeaders?: boolean;
  /** Custom filename (without extension). */
  filename?: string;
  /**
   * Explicit range of cells to print. Accepts an A1-style string
   * (`"A1:D20"`) or a {@link PrintRange}. Defaults to `setup.range`, then to
   * the sheet's used range.
   */
  range?: string | PrintRange;
  /**
   * Footer text printed on every page. Supports `{page}` and `{total}`
   * placeholders. Defaults to `setup.footer`.
   */
  footer?: string;
}

/** Inclusive, zero-based bounds of the sheet's used range. */
interface UsedRange {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

/**
 * Minimal shape of the jsPDF document we use for footer post-processing.
 * html2pdf returns the live jsPDF instance from `outputPdf()` (no argument).
 */
export interface JsPdfLike {
  internal: {
    getNumberOfPages(): number;
    pageSize: { getWidth(): number; getHeight(): number };
  };
  setPage(page: number): unknown;
  setFontSize(size: number): unknown;
  setTextColor(r: number, g: number, b: number): unknown;
  text(text: string, x: number, y: number, options?: { align?: string }): unknown;
  output(type?: string): unknown;
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
  const { setup, title = sheet.name } = options;
  const showHeaders = options.showHeaders ?? setup.showHeaders;
  const range = options.range ?? setup.range;
  const footer = options.footer ?? setup.footer;

  // Dynamically import html2pdf.js to keep it out of the main bundle
  const html2pdf = (await import('html2pdf.js')).default;

  // Build the printable HTML and scale it to the configured paper size.
  const container = buildPrintableHtml(sheet, { title, showHeaders, range });
  applyPrintScale(container, setup);

  // Configure html2pdf options based on page setup. `pagebreak.avoid` marks
  // every data row as unbreakable, which makes html2pdf insert page breaks
  // between rows automatically.
  const pdfOptions = {
    margin: [
      setup.margins.top,
      setup.margins.right,
      setup.margins.bottom,
      setup.margins.left,
    ],
    filename: `${sanitizeFilename(title)}.pdf`,
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
    pagebreak: { mode: ['css', 'legacy'], avoid: ['.pdf-row'] },
  };

  // `toPdf()` renders the document and stores the live jsPDF instance on the
  // worker; `get('pdf')` retrieves it so we can stamp footers on every page
  // before serialising. (`outputPdf()` without a type returns the raw PDF
  // string, not the document.)
  const worker = html2pdf().set(pdfOptions).from(container);
  await worker.toPdf();
  const doc = (await worker.get('pdf')) as JsPdfLike;

  if (footer && footer.trim()) {
    addFooters(doc, { text: footer, bottomMargin: setup.margins.bottom });
  }

  return doc.output('blob') as Blob;
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
  a.download = `${sanitizeFilename(name)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke only after the browser has had a chance to start the download,
  // otherwise the blob URL is invalidated and the download is canceled.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Formats a print range as an A1-style string (e.g. "A1:D20").
 */
export function formatPrintRange(range: PrintRange): string {
  return `${colToLetter(range.startCol)}${range.startRow + 1}:${colToLetter(range.endCol)}${range.endRow + 1}`;
}

/**
 * Computes the scale factor applied to the rendered content.
 *
 * - `actual-size` never scales.
 * - `fit-to-width` scales down so the content width fits the printable width.
 * - `fit-to-page` scales down so the content fits a single page.
 *
 * @param scaling - The configured scaling mode.
 * @param contentWidthPx - Natural content width in pixels.
 * @param contentHeightPx - Natural content height in pixels.
 * @param pageWidthMm - Page width in millimetres.
 * @param pageHeightMm - Page height in millimetres.
 * @param margins - Page margins in millimetres.
 * @returns A scale factor in the range (0, 1].
 */
export function computePrintScale(
  scaling: PrintScaling,
  contentWidthPx: number,
  contentHeightPx: number,
  pageWidthMm: number,
  pageHeightMm: number,
  margins: PrintSetup['margins']
): number {
  if (scaling === 'actual-size') return 1;

  const innerWidthPx = (pageWidthMm - margins.left - margins.right) * MM_TO_PX;
  const widthScale = contentWidthPx > 0 ? innerWidthPx / contentWidthPx : 1;

  if (scaling === 'fit-to-width') return clampScale(widthScale);

  const innerHeightPx = (pageHeightMm - margins.top - margins.bottom) * MM_TO_PX;
  const heightScale = contentHeightPx > 0 ? innerHeightPx / contentHeightPx : 1;
  return clampScale(Math.min(widthScale, heightScale));
}

/**
 * Stamps a footer (with `{page}` / `{total}` placeholders) on every page.
 */
export function addFooters(
  pdf: JsPdfLike,
  options: { text: string; bottomMargin: number }
): void {
  const total = pdf.internal.getNumberOfPages();
  if (total <= 0) return;

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const y = pageHeight - Math.max(0, options.bottomMargin) / 2;

  for (let page = 1; page <= total; page++) {
    pdf.setPage(page);
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    const label = options.text
      .replace(/\{page\}/g, String(page))
      .replace(/\{total\}/g, String(total));
    pdf.text(label, pageWidth / 2, y, { align: 'center' });
  }
}

/**
 * Builds an HTML element suitable for PDF rendering.
 */
function buildPrintableHtml(
  sheet: Sheet,
  options: { title: string; showHeaders: boolean; range?: string | PrintRange | null }
): HTMLElement {
  const { title, showHeaders, range } = options;

  const container = document.createElement('div');
  container.className = 'pdf-document';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.fontSize = '10pt';
  container.style.color = '#000';
  container.style.width = '100%';
  container.style.boxSizing = 'border-box';

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

  const bounds = normalizePrintRange(range, sheet, usedRange);

  // Resolve column widths so relative widths match the on-screen grid.
  const colWidths: number[] = [];
  let totalWidth = 0;
  for (let c = bounds.startCol; c <= bounds.endCol; c++) {
    const w = sheet.columnWidths[c] ?? sheet.defaultColWidth;
    colWidths.push(w);
    totalWidth += w;
  }

  // Optional column-letter heading row.
  if (showHeaders) {
    container.appendChild(
      buildRow(sheet, bounds.startRow, bounds, colWidths, totalWidth, true, true)
    );
  }

  // Data rows
  for (let r = bounds.startRow; r <= bounds.endRow; r++) {
    container.appendChild(
      buildRow(sheet, r, bounds, colWidths, totalWidth, showHeaders, false)
    );
  }

  // Charts
  const charts = sheet.charts ?? [];
  if (charts.length > 0) {
    const chartsTitle = document.createElement('h3');
    chartsTitle.textContent = 'Charts';
    chartsTitle.style.margin = '16px 0 8px 0';
    chartsTitle.style.fontSize = '12pt';
    container.appendChild(chartsTitle);

    for (const chart of charts) {
      const chartContainer = document.createElement('div');
      chartContainer.className = 'pdf-chart';
      chartContainer.style.marginBottom = '12px';
      chartContainer.style.breakInside = 'avoid';
      chartContainer.style.pageBreakInside = 'avoid';

      // Generate SVG and embed as a data URL (avoids leaking blob URLs).
      const svgString = generateChartSvg(chart, sheet);

      const img = document.createElement('img');
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
      img.width = chart.width;
      img.height = chart.height;
      img.style.maxWidth = '100%';
      chartContainer.appendChild(img);
      container.appendChild(chartContainer);
    }
  }

  return container;
}

/**
 * Builds a single row (either the column-letter heading row or a data row).
 */
function buildRow(
  sheet: Sheet,
  r: number,
  bounds: PrintRange,
  colWidths: number[],
  totalWidth: number,
  showHeaders: boolean,
  isHeaderRow: boolean
): HTMLElement {
  const row = document.createElement('div');
  row.className = isHeaderRow ? 'pdf-row pdf-header-row' : 'pdf-row';
  row.style.display = 'flex';
  row.style.width = '100%';
  // Marks this row as unbreakable so html2pdf moves it whole to the next page.
  row.style.breakInside = 'avoid';
  row.style.pageBreakInside = 'avoid';

  if (!isHeaderRow) {
    row.style.minHeight = `${sheet.rowHeights[r] ?? sheet.defaultRowHeight}px`;
  }

  // Row-number heading cell
  if (showHeaders) {
    const rowHeader = document.createElement('div');
    rowHeader.className = 'pdf-row-header';
    rowHeader.style.flex = `0 0 ${ROW_HEADER_WIDTH_PX}px`;
    rowHeader.style.boxSizing = 'border-box';
    rowHeader.style.padding = '2px 6px';
    rowHeader.style.backgroundColor = '#f0f0f0';
    rowHeader.style.fontWeight = 'bold';
    rowHeader.style.textAlign = 'center';
    rowHeader.style.borderBottom = '1px solid #999';
    rowHeader.textContent = isHeaderRow ? '' : String(r + 1);
    row.appendChild(rowHeader);
  }

  // Data cells
  const cells = document.createElement('div');
  cells.className = 'pdf-row-cells';
  cells.style.display = 'flex';
  cells.style.flex = '1';
  cells.style.minWidth = '0';
  row.appendChild(cells);

  const colCount = bounds.endCol - bounds.startCol + 1;
  for (let c = bounds.startCol; c <= bounds.endCol; c++) {
    const cell = sheet.cells[`${r}:${c}`];
    const cellEl = document.createElement('div');
    cellEl.className = 'pdf-cell';
    const widthPct =
      totalWidth > 0
        ? (colWidths[c - bounds.startCol] / totalWidth) * 100
        : 100 / colCount;
    cellEl.style.flex = `0 0 ${widthPct}%`;
    cellEl.style.boxSizing = 'border-box';
    cellEl.style.padding = '2px 6px';
    cellEl.style.overflow = 'hidden';
    cellEl.style.whiteSpace = 'nowrap';
    cellEl.style.textOverflow = 'ellipsis';

    if (isHeaderRow) {
      cellEl.style.backgroundColor = '#f0f0f0';
      cellEl.style.fontWeight = 'bold';
      cellEl.style.textAlign = 'center';
      cellEl.style.borderBottom = '1px solid #999';
      cellEl.textContent = colToLetter(c);
    } else {
      applyCellBorders(cellEl, cell, r, c, bounds, sheet);
      applyCellStyle(cellEl, cell);
      cellEl.textContent = getCellValue(cell);
    }

    cells.appendChild(cellEl);
  }

  return row;
}

/**
 * Draws cell borders. Borders are taken from the cell's own style only — no
 * generic grid is drawn. Shared edges are deduplicated so a range with "all
 * borders" renders as a single clean grid rather than doubled lines.
 */
function applyCellBorders(
  el: HTMLElement,
  cell: Cell | undefined,
  r: number,
  c: number,
  bounds: PrintRange,
  sheet: Sheet
): void {
  const style = cell?.style;
  const leftNeighbor = c > 0 ? sheet.cells[`${r}:${c - 1}`] : undefined;
  const rightNeighbor = c < sheet.columnCount - 1 ? sheet.cells[`${r}:${c + 1}`] : undefined;
  const topNeighbor = r > 0 ? sheet.cells[`${r - 1}:${c}`] : undefined;
  const bottomNeighbor = r < sheet.rowCount - 1 ? sheet.cells[`${r + 1}:${c}`] : undefined;

  // Right edge (this cell owns it unless the next cell draws its own left).
  const rightEdge = style?.borderRight ?? (c === bounds.endCol ? rightNeighbor?.style?.borderLeft : undefined);
  if (rightEdge) el.style.borderRight = rightEdge;

  // Bottom edge (this cell owns it unless the next cell draws its own top).
  const bottomEdge = style?.borderBottom ?? (r === bounds.endRow ? bottomNeighbor?.style?.borderTop : undefined);
  if (bottomEdge) el.style.borderBottom = bottomEdge;

  // Left edge — skip when the left neighbour already drew the shared edge.
  if (c === bounds.startCol) {
    const leftEdge = style?.borderLeft ?? leftNeighbor?.style?.borderRight;
    if (leftEdge) el.style.borderLeft = leftEdge;
  } else if (!leftNeighbor?.style?.borderRight && style?.borderLeft) {
    el.style.borderLeft = style.borderLeft;
  }

  // Top edge — skip when the top neighbour already drew the shared edge.
  if (r === bounds.startRow) {
    const topEdge = style?.borderTop ?? topNeighbor?.style?.borderBottom;
    if (topEdge) el.style.borderTop = topEdge;
  } else if (!topNeighbor?.style?.borderBottom && style?.borderTop) {
    el.style.borderTop = style.borderTop;
  }
}

/**
 * Applies a cell's visual style to its rendered element.
 */
function applyCellStyle(el: HTMLElement, cell: Cell | undefined): void {
  const style = cell?.style;
  if (!style) return;

  if (style.fontWeight !== undefined) el.style.fontWeight = String(style.fontWeight);
  if (style.fontStyle) el.style.fontStyle = style.fontStyle;
  if (style.fontSize) el.style.fontSize = `${style.fontSize}px`;
  if (style.color) el.style.color = style.color;
  if (style.backgroundColor) el.style.backgroundColor = style.backgroundColor;
  if (style.textAlign) el.style.textAlign = style.textAlign;
  if (style.textDecoration) el.style.textDecoration = style.textDecoration;
  if (style.whiteSpace === 'normal') {
    el.style.whiteSpace = 'normal';
    el.style.textOverflow = 'clip';
    el.style.overflow = 'visible';
  }
}

/**
 * Resolves a cell's display value (computed value preferred over raw input).
 */
function getCellValue(cell: Cell | undefined): string {
  if (!cell) return '';
  if (cell.computedValue !== undefined && cell.computedValue !== null) {
    return String(cell.computedValue);
  }
  return cell.rawValue;
}

/**
 * Normalises a user-supplied print range against the sheet bounds. Falls back
 * to the used range when the request is missing or invalid.
 */
function normalizePrintRange(
  range: string | PrintRange | null | undefined,
  sheet: Sheet,
  used: UsedRange
): PrintRange {
  const fallback: PrintRange = {
    startRow: used.minRow,
    endRow: used.maxRow,
    startCol: used.minCol,
    endCol: used.maxCol,
  };

  let candidate: PrintRange | null = null;

  if (typeof range === 'string') {
    const parsed = parseRange(range);
    if (parsed.startRow >= 0 && parsed.startCol >= 0) candidate = parsed;
  } else if (range && typeof range === 'object') {
    candidate = range;
  }

  if (!candidate) return fallback;

  const maxRow = Math.max(0, sheet.rowCount - 1);
  const maxCol = Math.max(0, sheet.columnCount - 1);
  const startRow = Math.max(0, Math.min(candidate.startRow, candidate.endRow));
  const endRow = Math.min(maxRow, Math.max(candidate.startRow, candidate.endRow));
  const startCol = Math.max(0, Math.min(candidate.startCol, candidate.endCol));
  const endCol = Math.min(maxCol, Math.max(candidate.startCol, candidate.endCol));

  if (endRow < startRow || endCol < startCol) return fallback;
  return { startRow, endRow, startCol, endCol };
}

/**
 * Applies the configured scaling to the rendered container. For `fit-to-*`
 * modes the container is measured at its natural size and then shrunk (via
 * CSS `zoom`) so it fits the printable area. The rendered height is then
 * re-measured and the scale corrected, because browser layout rounds heights
 * and an uncorrected scale can spill a sliver onto an extra page.
 */
function applyPrintScale(container: HTMLElement, setup: PrintSetup): void {
  const page = PAGE_SIZES_MM[setup.pageSize];
  const pageWidthMm = setup.orientation === 'landscape' ? page.height : page.width;
  const pageHeightMm = setup.orientation === 'landscape' ? page.width : page.height;
  const innerHeightPx = (pageHeightMm - setup.margins.top - setup.margins.bottom) * MM_TO_PX;
  // html2pdf's pagebreak plugin floors the page height (toPx), so target the
  // floored value to avoid spilling a sub-pixel sliver onto an extra page.
  const pageHeightPx = Math.floor(innerHeightPx);

  if (setup.scaling === 'actual-size') {
    // Shrink-wrap to the natural content width (may overflow the page, which
    // is the expected behaviour for "actual size").
    container.style.display = 'inline-block';
    container.style.width = 'auto';
    return;
  }

  const natural = measureContainer(container, 'max-content');
  let scale = computePrintScale(
    setup.scaling,
    natural.width,
    natural.height,
    pageWidthMm,
    pageHeightMm,
    setup.margins
  );

  // Apply and re-measure. For `fit-to-page` the rendered height must not
  // exceed the printable height, otherwise html2pdf's pagebreak plugin (whose
  // page height is floored) inserts a break and leaves a near-empty page.
  for (let attempt = 0; attempt < 3; attempt++) {
    applyScale(container, scale, natural.width);
    if (setup.scaling === 'fit-to-width') break;
    const rendered = measureContainer(container, `${natural.width}px`);
    if (rendered.height <= pageHeightPx) break;
    scale *= pageHeightPx / rendered.height;
  }
}

/**
 * Measures a container's rendered size at a given CSS width, off-screen.
 */
function measureContainer(
  container: HTMLElement,
  width: string
): { width: number; height: number } {
  const prevWidth = container.style.width;
  const prevPosition = container.style.position;
  const prevVisibility = container.style.visibility;

  container.style.position = 'absolute';
  container.style.visibility = 'hidden';
  container.style.width = width;
  document.body.appendChild(container);
  const rect = container.getBoundingClientRect();
  const result = { width: rect.width, height: rect.height };

  document.body.removeChild(container);
  container.style.position = prevPosition;
  container.style.visibility = prevVisibility;
  container.style.width = prevWidth;
  return result;
}

/**
 * Applies a scale factor to the container via CSS `zoom`, keeping the CSS
 * width at the natural size so the zoom performs the shrinking.
 */
function applyScale(container: HTMLElement, scale: number, naturalWidth: number): void {
  if (scale < 1 && naturalWidth > 0) {
    container.style.setProperty('zoom', String(scale));
    container.style.width = `${naturalWidth}px`;
  } else {
    container.style.removeProperty('zoom');
    container.style.width = '100%';
  }
}

/**
 * Generates an SVG string for chart PDF export.
 */
function generateChartSvg(chart: ChartConfig, sheet: Sheet): string {
  const data = extractChartData(sheet, chart.dataRange);
  const { min: minVal, max: maxVal } = getMinMax(data);
  const colors = generateColors(data.series.length);
  const { width, height } = chart;

  // Margins
  const mTop = 40, mBottom = 40, mLeft = 50, mRight = 20;
  const plotW = width - mLeft - mRight;
  const plotH = height - mTop - mBottom;
  // getMinMax guarantees a non-zero range (it widens equal-value ranges).
  const range = maxVal - minVal;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  // Title
  if (chart.title) {
    svg += `<text x="${width / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold" fill="#374151">${chart.title}</text>`;
  }

  // Axes
  svg += `<line x1="${mLeft}" y1="${mTop}" x2="${mLeft}" y2="${height - mBottom}" stroke="#D1D5DB"/>`;
  svg += `<line x1="${mLeft}" y1="${height - mBottom}" x2="${width - mRight}" y2="${height - mBottom}" stroke="#D1D5DB"/>`;

  // Y-axis ticks
  for (let i = 0; i <= 4; i++) {
    const val = minVal + (range * i) / 4;
    const y = height - mBottom - (plotH * i) / 4;
    svg += `<text x="${mLeft - 8}" y="${y + 3}" text-anchor="end" font-size="9" fill="#6B7280">${Math.round(val)}</text>`;
  }

  // Bars (simplified - works for bar/column/line)
  if (data.categories.length > 0 && data.series.length > 0) {
    const barW = (plotW / data.categories.length) * 0.6 / data.series.length;
    const gap = (plotW / data.categories.length) * 0.2;

    data.categories.forEach((_, ci) => {
      data.series.forEach((s, si) => {
        const val = s.values[ci] ?? 0;
        const barH = ((val - minVal) / range) * plotH;
        const x = mLeft + gap + ci * (plotW / data.categories.length) + si * barW;
        const y = height - mBottom - barH;
        svg += `<rect x="${x}" y="${y}" width="${Math.max(1, barW)}" height="${Math.max(0, barH)}" fill="${colors[si]}" opacity="0.9" rx="2"/>`;
      });
    });

    // X-axis labels
    data.categories.forEach((cat, i) => {
      const x = mLeft + (plotW * (i + 0.5)) / data.categories.length;
      svg += `<text x="${x}" y="${height - mBottom + 14}" text-anchor="middle" font-size="9" fill="#6B7280">${cat}</text>`;
    });
  }

  svg += '</svg>';
  return svg;
}

/**
 * Finds the bounding box of all non-empty cells.
 */
function findUsedRange(sheet: Sheet): UsedRange | null {
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

/**
 * Clamps a scale factor to (0, 1], guarding against non-finite input.
 */
function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(1, scale);
}

/**
 * Strips characters that are unsafe in filenames.
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_');
}
