/**
 * JSON Import / Export Service
 *
 * Serializes and deserializes the full Workbook model including
 * all sheets, cells, styles, frozen panes, and column/row dimensions.
 */

import type { Workbook } from '../types';

/**
 * Options for JSON export.
 */
export interface JsonExportOptions {
  /** Whether to pretty-print the JSON. */
  pretty?: boolean;
}

/**
 * Result of a JSON import operation.
 */
export interface JsonImportResult {
  success: boolean;
  workbook?: Workbook;
  error?: string;
}

/**
 * Exports a Workbook to a JSON string.
 * @param workbook - The workbook to serialize.
 * @param options - Export options.
 * @returns JSON string.
 */
export function exportJson(workbook: Workbook, options: JsonExportOptions = {}): string {
  const { pretty = true } = options;
  return JSON.stringify(workbook, null, pretty ? 2 : undefined);
}

/**
 * Imports a Workbook from a JSON string.
 * @param json - The JSON string to parse.
 * @returns Import result with validation.
 */
export function importJson(json: string): JsonImportResult {
  try {
    const parsed = JSON.parse(json);

    if (!isValidWorkbook(parsed)) {
      return { success: false, error: 'Invalid workbook format: missing required fields' };
    }

    // Restore the workbook with a new ID
    const workbook: Workbook = {
      ...parsed,
      id: `json-wb-${Date.now()}`,
      lastModified: Date.now(),
    };

    return { success: true, workbook };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'JSON parse error',
    };
  }
}

/**
 * Downloads the workbook as a .json file.
 */
export function downloadJson(workbook: Workbook, filename?: string): void {
  const json = exportJson(workbook);
  const name = filename ?? workbook.title.replace(/[^a-zA-Z0-9-_]/g, '_');
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates that an object conforms to the Workbook structure.
 */
function isValidWorkbook(obj: unknown): obj is Workbook {
  if (typeof obj !== 'object' || obj === null) return false;
  const wb = obj as Record<string, unknown>;

  return (
    typeof wb.id === 'string' &&
    typeof wb.title === 'string' &&
    Array.isArray(wb.sheets) &&
    typeof wb.activeSheetIndex === 'number' &&
    wb.sheets.length > 0 &&
    isValidSheet(wb.sheets[0])
  );
}

function isValidSheet(obj: unknown): boolean {
  /* istanbul ignore next - defensive validation */
  if (typeof obj !== 'object' || obj === null) return false;
  const sheet = obj as Record<string, unknown>;

  return (
    typeof sheet.id === 'string' &&
    typeof sheet.name === 'string' &&
    typeof sheet.cells === 'object' &&
    typeof sheet.defaultColWidth === 'number' &&
    typeof sheet.defaultRowHeight === 'number' &&
    typeof sheet.columnCount === 'number' &&
    typeof sheet.rowCount === 'number'
  );
}
