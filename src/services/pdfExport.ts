// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * PDF Export Service
 *
 * Renders the spreadsheet grid to a PDF using html2canvas + jsPDF.
 * Respects page setup settings (orientation, margins, scaling, print range,
 * footers).
 *
 * Design notes:
 * - The output contains **no row/column headings** by default (`showHeaders`).
 * - The output contains **no generic grid pattern**. Borders are drawn only
 *   where the cells themselves define them — a "table style" is simply cell
 *   borders (`CellStyle.borderTop/Bottom/Left/Right`). Apply borders to a
 *   range and the grid appears; leave them unset and the sheet prints clean.
 * - Pagination is deterministic: rows (and charts) are grouped into fixed-size
 *   "page" blocks, each of which is rendered to its own canvas and placed on
 *   its own PDF page. Rows are never split across pages, and the footer lives
 *   in the bottom margin so it cannot overlap cell content.
 * - Scaling is applied by resizing column widths / row heights / font sizes —
 *   never with CSS `zoom` (which misaligns html2canvas output).
 */

import type { Cell, Sheet } from '../types';
import { colToLetter } from '../types';
import type { PageSize, PrintRange, PrintScaling, PrintSetup } from '../context/PrintSetupContext';
import { parseRange } from '../utils/chartData';
import { extractChartData, getMinMax, generateColors } from '../utils/chartData';
import { formatCellDisplayValue } from '../utils/numberFormat';
import { countWrappedLines, isWrappedCell } from '../utils/rowHeight';
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

/** Estimated height of the sheet-title heading in pixels. */
const TITLE_HEIGHT_PX = 28;

/** Height of the column-letter heading row in pixels. */
const HEADER_ROW_HEIGHT_PX = 24;

/** Estimated height of the "Charts" section heading in pixels. */
const CHARTS_TITLE_HEIGHT_PX = 28;

/** Font used to render cell text in the PDF. */
const PDF_FONT = 'Arial, sans-serif';

/** Base cell font size in pixels (≈10pt). */
const PDF_BASE_FONT_SIZE_PX = 13.33;

/** Line-height ratio used for PDF cell text (no grid minimum, so it scales). */
const PDF_LINE_HEIGHT_RATIO = 1.5;

/** Extra bottom room added to wrapped rows so descenders aren't clipped. */
const CELL_VERTICAL_BUFFER_PX = 4;

/** Line height in px for a given font size, scaled with the font. */
function pdfLineHeight(fontSize: number): number {
  return Math.max(1, Math.round(fontSize * PDF_LINE_HEIGHT_RATIO));
}

/** Default footer template. */
export const DEFAULT_FOOTER = 'Page {page} of {total}';

/**
 * Options for PDF generation.
 */
export interface PdfExportOptions {
  /** Page setup configuration. */
  setup: PrintSetup;
  /** Sheet title (appears at the top of the first PDF page). */
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

/** A renderable block (row, title, chart, …) with an estimated pixel height. */
interface Block {
  el: HTMLElement;
  height: number;
}

/**
 * Minimal shape of the jsPDF document we use for footer post-processing.
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

  // Dynamically import rendering libraries to keep them out of the main bundle.
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  const pages = buildPrintablePages(sheet, { title, showHeaders, range, setup });

  const page = PAGE_SIZES_MM[setup.pageSize];
  const pageWidthMm = setup.orientation === 'landscape' ? page.height : page.width;
  const pageHeightMm = setup.orientation === 'landscape' ? page.width : page.height;
  const innerWidthMm = pageWidthMm - setup.margins.left - setup.margins.right;
  const innerHeightMm = pageHeightMm - setup.margins.top - setup.margins.bottom;

  const pdf = new jsPDF({
    unit: 'mm',
    format: setup.pageSize.toLowerCase(),
    orientation: setup.orientation,
  });

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage();
    const canvas = await renderPageToCanvas(pages[i], html2canvas);
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(
      imgData,
      'JPEG',
      setup.margins.left,
      setup.margins.top,
      innerWidthMm,
      innerHeightMm,
    );
  }

  if (footer && footer.trim()) {
    addFooters(pdf as unknown as JsPdfLike, { text: footer, bottomMargin: setup.margins.bottom });
  }

  return pdf.output('blob') as Blob;
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
 * Builds one fixed-size HTML page per PDF page, each containing whole rows.
 */
function buildPrintablePages(
  sheet: Sheet,
  options: { title: string; showHeaders: boolean; range?: string | PrintRange | null; setup: PrintSetup }
): HTMLElement[] {
  const { title, showHeaders, range, setup } = options;

  const page = PAGE_SIZES_MM[setup.pageSize];
  const pageWidthMm = setup.orientation === 'landscape' ? page.height : page.width;
  const pageHeightMm = setup.orientation === 'landscape' ? page.width : page.height;
  const innerWidthMm = pageWidthMm - setup.margins.left - setup.margins.right;
  const innerHeightMm = pageHeightMm - setup.margins.top - setup.margins.bottom;
  // Pixel dimensions preserve the printable-area aspect ratio (width:height =
  // innerWidthMm:innerHeightMm), so the canvas can be stretched to the
  // printable area in mm without distortion.
  const innerWidthPx = innerWidthMm * MM_TO_PX;
  const pageHeightPx = innerHeightMm * MM_TO_PX;

  const usedRange = findUsedRange(sheet);
  if (!usedRange) {
    const pageEl = createPageElement(innerWidthPx, pageHeightPx);
    const empty = document.createElement('p');
    empty.textContent = '(Empty sheet)';
    empty.style.margin = '8px';
    pageEl.appendChild(empty);
    return [pageEl];
  }

  const bounds = normalizePrintRange(range, sheet, usedRange);

  // Natural column widths.
  const naturalColWidths: number[] = [];
  let naturalWidth = showHeaders ? ROW_HEADER_WIDTH_PX : 0;
  for (let c = bounds.startCol; c <= bounds.endCol; c++) {
    const w = sheet.columnWidths[c] ?? sheet.defaultColWidth;
    naturalColWidths.push(w);
    naturalWidth += w;
  }

  // All columns have zero width — fall back to equal columns filling the page.
  if (naturalColWidths.reduce((sum, w) => sum + w, 0) <= 0) {
    const colCount = naturalColWidths.length || 1;
    for (let i = 0; i < naturalColWidths.length; i++) {
      naturalColWidths[i] = innerWidthPx / colCount;
    }
    naturalWidth = (showHeaders ? ROW_HEADER_WIDTH_PX : 0) + innerWidthPx;
  }

  // Natural content height (used for fit-to-page scaling).
  let naturalHeight = TITLE_HEIGHT_PX;
  if (showHeaders) naturalHeight += HEADER_ROW_HEIGHT_PX;
  for (let r = bounds.startRow; r <= bounds.endRow; r++) {
    naturalHeight += computeRowRenderedHeight(sheet, r, bounds, naturalColWidths, 1, 1);
  }
  const charts = sheet.charts ?? [];
  if (charts.length > 0) {
    naturalHeight += CHARTS_TITLE_HEIGHT_PX;
    for (const chart of charts) naturalHeight += chart.height + 12;
  }

  const { widthScale, heightScale, fontScale } = resolveScales(
    setup, naturalWidth, naturalHeight, pageWidthMm, pageHeightMm,
  );
  const colWidths = naturalColWidths.map((w) => w * widthScale);
  const rowHeaderWidth = ROW_HEADER_WIDTH_PX * widthScale;
  const contentWidth = naturalWidth * widthScale;

  // ── Blocks ────────────────────────────────────────────────────────────────
  const blocks: Block[] = [];

  const titleEl = document.createElement('h2');
  titleEl.textContent = title;
  titleEl.style.margin = '0';
  titleEl.style.fontSize = `${14 * fontScale}pt`;
  titleEl.style.lineHeight = `${TITLE_HEIGHT_PX * heightScale}px`;
  titleEl.style.overflow = 'hidden';
  blocks.push({ el: titleEl, height: TITLE_HEIGHT_PX * heightScale });

  if (showHeaders) {
    const headerHeight = HEADER_ROW_HEIGHT_PX * heightScale;
    blocks.push({
      el: buildRow(sheet, -1, bounds, colWidths, contentWidth, rowHeaderWidth, true, true, headerHeight, fontScale),
      height: headerHeight,
    });
  }

  for (let r = bounds.startRow; r <= bounds.endRow; r++) {
    const rowHeight = computeRowRenderedHeight(sheet, r, bounds, colWidths, heightScale, fontScale);
    blocks.push({
      el: buildRow(sheet, r, bounds, colWidths, contentWidth, rowHeaderWidth, showHeaders, false, rowHeight, fontScale),
      height: rowHeight,
    });
  }

  if (charts.length > 0) {
    const chartsTitle = document.createElement('h3');
    chartsTitle.textContent = 'Charts';
    chartsTitle.style.margin = '0';
    chartsTitle.style.fontSize = `${12 * fontScale}pt`;
    chartsTitle.style.lineHeight = `${CHARTS_TITLE_HEIGHT_PX * heightScale}px`;
    chartsTitle.style.overflow = 'hidden';
    blocks.push({ el: chartsTitle, height: CHARTS_TITLE_HEIGHT_PX * heightScale });

    for (const chart of charts) {
      const chartContainer = document.createElement('div');
      chartContainer.className = 'pdf-chart';
      chartContainer.style.marginBottom = '12px';

      const svgString = generateChartSvg(chart, sheet);
      const img = document.createElement('img');
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
      img.width = Math.max(1, Math.round(chart.width * widthScale));
      img.height = Math.max(1, Math.round(chart.height * heightScale));
      img.style.maxWidth = '100%';
      chartContainer.appendChild(img);

      blocks.push({ el: chartContainer, height: chart.height * heightScale + 12 });
    }
  }

  // ── Paginate ──────────────────────────────────────────────────────────────
  return paginateBlocks(blocks, pageHeightPx).map((group) => {
    const pageEl = createPageElement(innerWidthPx, pageHeightPx, fontScale);
    for (const block of group) pageEl.appendChild(block.el);
    return pageEl;
  });
}

/**
 * Creates a fixed-size, white page container.
 */
function createPageElement(widthPx: number, heightPx: number, fontScale = 1): HTMLElement {
  const el = document.createElement('div');
  el.className = 'pdf-page';
  el.style.width = `${widthPx}px`;
  el.style.height = `${heightPx}px`;
  el.style.overflow = 'hidden';
  el.style.position = 'relative';
  el.style.backgroundColor = '#ffffff';
  el.style.boxSizing = 'border-box';
  el.style.fontFamily = 'Arial, sans-serif';
  el.style.fontSize = `${10 * fontScale}pt`;
  el.style.color = '#000';
  return el;
}

/**
 * Groups blocks into pages so no block is split across a page boundary.
 */
function paginateBlocks(blocks: Block[], pageHeightPx: number): Block[][] {
  const pages: Block[][] = [];
  let current: Block[] = [];
  let used = 0;

  for (const block of blocks) {
    // A small tolerance absorbs sub-pixel rounding so a block that fits within
    // a hair of the page boundary isn't pushed onto an extra page.
    if (current.length > 0 && used + block.height > pageHeightPx + 0.5) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(block);
    used += block.height;
  }

  if (current.length > 0) pages.push(current);
  return pages;
}

/**
 * Resolves the scale factors for the configured scaling mode.
 */
function resolveScales(
  setup: PrintSetup,
  naturalWidthPx: number,
  naturalHeightPx: number,
  pageWidthMm: number,
  pageHeightMm: number
): { widthScale: number; heightScale: number; fontScale: number } {
  if (setup.scaling === 'actual-size') {
    return { widthScale: 1, heightScale: 1, fontScale: 1 };
  }

  if (setup.scaling === 'fit-to-width') {
    return {
      widthScale: computePrintScale('fit-to-width', naturalWidthPx, naturalHeightPx, pageWidthMm, pageHeightMm, setup.margins),
      heightScale: 1,
      fontScale: 1,
    };
  }

  // fit-to-page: a single uniform scale keeps the sheet proportional.
  const scale = computePrintScale('fit-to-page', naturalWidthPx, naturalHeightPx, pageWidthMm, pageHeightMm, setup.margins);
  return { widthScale: scale, heightScale: scale, fontScale: scale };
}

/**
 * Renders a page element to a canvas (off-screen, then removed).
 */
async function renderPageToCanvas(
  pageEl: HTMLElement,
  html2canvas: (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>
): Promise<HTMLCanvasElement> {
  const holder = document.createElement('div');
  holder.style.position = 'absolute';
  holder.style.left = '-10000px';
  holder.style.top = '0';
  holder.appendChild(pageEl);
  document.body.appendChild(holder);

  try {
    return await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
  } finally {
    if (pageEl.parentNode === holder) holder.removeChild(pageEl);
    if (holder.parentNode === document.body) document.body.removeChild(holder);
  }
}

/**
 * Computes the rendered height of a data row, accounting for wrapped cells
 * and larger fonts. The result is in rendered (post-scale) pixels.
 */
function computeRowRenderedHeight(
  sheet: Sheet,
  r: number,
  bounds: PrintRange,
  colWidths: number[],
  heightScale: number,
  fontScale: number,
): number {
  const base = (sheet.rowHeights[r] ?? sheet.defaultRowHeight) * heightScale;
  let needed = base;

  for (let c = bounds.startCol; c <= bounds.endCol; c++) {
    const cell = sheet.cells[`${r}:${c}`];
    if (!cell) continue;

    const fontSize = (cell.style?.fontSize ?? PDF_BASE_FONT_SIZE_PX) * fontScale;
    const lineHeight = pdfLineHeight(fontSize);

    if (isWrappedCell(cell)) {
      const font = `${fontSize}px ${PDF_FONT}`;
      const value = getCellValue(cell);
      const width = colWidths[c - bounds.startCol];
      const lines = countWrappedLines(value, width, font, cell.style?.whiteSpace === 'pre');
      needed = Math.max(needed, lines * lineHeight + CELL_VERTICAL_BUFFER_PX);
    } else {
      needed = Math.max(needed, lineHeight);
    }
  }

  return needed;
}

/**
 * Builds a single row (either the column-letter heading row or a data row).
 */
function buildRow(
  sheet: Sheet,
  r: number,
  bounds: PrintRange,
  colWidths: number[],
  contentWidth: number,
  rowHeaderWidth: number,
  showHeaders: boolean,
  isHeaderRow: boolean,
  rowHeight: number,
  fontScale: number
): HTMLElement {
  const row = document.createElement('div');
  row.className = isHeaderRow ? 'pdf-row pdf-header-row' : 'pdf-row';
  row.style.display = 'flex';
  row.style.flexWrap = 'nowrap';
  row.style.width = `${contentWidth}px`;
  row.style.boxSizing = 'border-box';
  row.style.overflow = 'hidden';
  row.style.height = `${rowHeight}px`;

  // Row-number heading cell.
  if (showHeaders) {
    const rowHeader = document.createElement('div');
    rowHeader.className = 'pdf-row-header';
    rowHeader.style.flex = '0 0 auto';
    rowHeader.style.width = `${rowHeaderWidth}px`;
    rowHeader.style.boxSizing = 'border-box';
    rowHeader.style.padding = '0 6px';
    rowHeader.style.lineHeight = `${rowHeight}px`;
    rowHeader.style.backgroundColor = '#f0f0f0';
    rowHeader.style.fontWeight = 'bold';
    rowHeader.style.textAlign = 'center';
    rowHeader.style.borderBottom = '1px solid #999';
    rowHeader.style.overflow = 'hidden';
    rowHeader.textContent = isHeaderRow ? '' : String(r + 1);
    row.appendChild(rowHeader);
  }

  for (let c = bounds.startCol; c <= bounds.endCol; c++) {
    const cell = sheet.cells[`${r}:${c}`];
    const cellEl = document.createElement('div');
    cellEl.className = 'pdf-cell';
    cellEl.style.flex = '0 0 auto';
    cellEl.style.width = `${colWidths[c - bounds.startCol]}px`;
    cellEl.style.boxSizing = 'border-box';
    cellEl.style.padding = '0 6px';
    cellEl.style.overflow = 'hidden';
    cellEl.style.whiteSpace = 'nowrap';
    cellEl.style.textOverflow = 'ellipsis';

    if (isHeaderRow) {
      cellEl.style.backgroundColor = '#f0f0f0';
      cellEl.style.fontWeight = 'bold';
      cellEl.style.textAlign = 'center';
      cellEl.style.borderBottom = '1px solid #999';
      cellEl.style.lineHeight = `${rowHeight}px`;
      cellEl.textContent = colToLetter(c);
    } else {
      const fontSize = (cell?.style?.fontSize ?? PDF_BASE_FONT_SIZE_PX) * fontScale;
      // Single-line cells use the full row height as line-height, which
      // vertically centres the text and leaves slack above/below so html2canvas
      // never clips the bottom of the glyphs.
      cellEl.style.lineHeight = isWrappedCell(cell)
        ? `${pdfLineHeight(fontSize)}px`
        : `${rowHeight}px`;
      applyCellBorders(cellEl, cell, r, c, bounds, sheet);
      applyCellStyle(cellEl, cell, fontScale);
      cellEl.textContent = getCellValue(cell);
    }

    row.appendChild(cellEl);
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
function applyCellStyle(el: HTMLElement, cell: Cell | undefined, fontScale: number): void {
  const style = cell?.style;
  if (!style) return;

  if (style.fontWeight !== undefined) el.style.fontWeight = String(style.fontWeight);
  if (style.fontStyle) el.style.fontStyle = style.fontStyle;
  if (style.fontSize) el.style.fontSize = `${style.fontSize * fontScale}px`;
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
 * Resolves a cell's display value, matching the on-screen grid (number
 * formats, ISO date auto-formatting, leading-quote text marker stripping).
 */
function getCellValue(cell: Cell | undefined): string {
  return formatCellDisplayValue(cell);
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
