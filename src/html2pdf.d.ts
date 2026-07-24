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
    pagebreak?: { mode?: string | string[] };
  }

  interface Html2PdfInstance {
    set(options: Html2PdfOptions): Html2PdfInstance;
    from(element: HTMLElement): Html2PdfInstance;
    save(): Promise<void>;
    outputPdf(type: string): Promise<Blob>;
    toPdf(): Html2PdfInstance;
  }

  function html2pdf(): Html2PdfInstance;
  export default html2pdf;
}
