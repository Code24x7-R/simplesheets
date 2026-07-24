# SimpleSheet — Technical Feasibility Matrix

| Dependency | Pros | Cons | Risk Level | Go / No‑Go |
|------------|------|------|------------|------------|
| **Vite + TypeScript + Tailwind** | Fast HMR, excellent DX, type safety, utility‑first CSS. Industry‑standard stack with huge community. | Tailwind CDN approach means no tree‑shaking; full CSS bundle loaded. | **Low** | ✅ **Go** |
| **react‑virtual** (@tanstack/react-virtual) | Lightweight virtualization; handles 100k+ rows smoothly. Great TypeScript support. | Only renders visible items — complex cells need careful CSS (row height must be predictable). | **Low** | ✅ **Go** |
| **xlsx** (SheetJS) | De‑facto library for .xlsx read/write. Handles formulas, styles, multiple sheets. | Large bundle (~400KB minified). Community edition has some limitations on styling. | **Medium** | ✅ **Go** (accept bundle cost; lazy‑load if needed) |
| **papaparse** | Fast, zero‑dependency CSV/TSV parser. Streaming support for large files. Handles quoted fields, newlines in cells. | None significant for our scope. | **Low** | ✅ **Go** |
| **html2pdf.js** | One‑click PDF generation from DOM elements. Respects Tailwind styles. | Rasterizes to image — text is not selectable in PDF. Large output for big sheets. | **Medium** | ✅ **Go** (acceptable for small‑business use; can upgrade to jsPDF later) |
| **Lucide icons** | Beautiful, consistent icon set. Tree‑shakeable, MIT licensed, React components available. | None significant. | **Low** | ✅ **Go** |

---

## Summary

All six dependencies are **Go**. The highest risk is the **xlsx** bundle size, which we mitigate by:
- Lazy‑loading the import/export code only when the user clicks the button.
- Using Vite code‑splitting to keep the initial load lean.

The **html2pdf.js** limitation (non‑selectable text) is acceptable for the target audience and can be revisited in a future phase if needed.
