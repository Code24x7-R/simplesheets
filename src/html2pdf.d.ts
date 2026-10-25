// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Type declarations for html2pdf.js (untyped library).
 */
declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: Record<string, unknown>;
    jsPDF?: { unit?: string; format?: string; orientation?: string };
    pagebreak?: {
      mode?: string | string[];
      before?: string | string[];
      after?: string | string[];
      avoid?: string | string[];
    };
  }

  /**
   * Minimal shape of the live jsPDF document returned by `outputPdf()` when
   * called without a type. Used to stamp page footers after rendering.
   */
  export interface JsPdfDocument {
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

  interface Html2PdfInstance {
    set(options: Html2PdfOptions): Html2PdfInstance;
    from(element: HTMLElement): Html2PdfInstance;
    save(): Promise<void>;
    /**
     * With a `type` (e.g. 'blob') resolves to the serialised output; without a
     * `type` resolves to the live jsPDF document.
     */
    outputPdf(type?: string): Promise<Blob | string>;
    toPdf(): Promise<Html2PdfInstance>;
    /** Returns a worker property (e.g. `'pdf'` for the live jsPDF document). */
    get(key: string): Promise<unknown>;
  }

  function html2pdf(): Html2PdfInstance;
  export default html2pdf;
}
