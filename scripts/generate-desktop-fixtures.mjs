// Generates deterministic desktop test fixtures in tmp/desktop-fixtures.
// Dev-only: never ship these files and never point the app at real data.
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import XLSX from 'xlsx';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'tmp', 'desktop-fixtures');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const FIXED_TIME = 1767225600000; // 2026-01-01T00:00:00Z

function cell(rawValue, style) {
  return style ? { rawValue, style } : { rawValue };
}

function makeSheet(name, cells, options = {}) {
  return {
    id: `sheet-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    cells,
    defaultColWidth: options.defaultColWidth ?? 96,
    defaultRowHeight: options.defaultRowHeight ?? 24,
    columnWidths: options.columnWidths ?? {},
    rowHeights: options.rowHeights ?? {},
    columnCount: options.columnCount ?? 26,
    rowCount: options.rowCount ?? 1000,
    frozenColumns: 0,
    frozenRows: 0,
  };
}

function makeWorkbook(id, title, sheets, extra = {}) {
  return {
    id,
    title,
    sheets,
    activeSheetIndex: 0,
    lastModified: FIXED_TIME,
    ...extra,
  };
}

function writeJson(name, value) {
  writeFileSync(join(outDir, name), JSON.stringify(value, null, 2) + '\n');
}

// ─── Small workbook: formulas, styles, named ranges ─────────────────────────
const smallCells = {};
const headers = ['Item', 'Q1', 'Q2', 'Q3', 'Q4', 'Total'];
headers.forEach((label, col) => {
  smallCells[`0:${col}`] = cell(label, {
    fontWeight: 'bold',
    backgroundColor: '#e8f0fe',
    textAlign: 'center',
  });
});
for (let row = 1; row <= 20; row += 1) {
  smallCells[`${row}:0`] = cell(`Item ${row}`);
  for (let col = 1; col <= 4; col += 1) {
    smallCells[`${row}:${col}`] = cell(String(((row * col) % 97) * 10));
  }
  smallCells[`${row}:5`] = cell(`=SUM(B${row + 1}:E${row + 1})`, {
    fontWeight: 'bold',
  });
}
const smallWorkbook = makeWorkbook(
  'fixture-small',
  'Fixture Small',
  [makeSheet('Data', smallCells)],
  {
    namedRanges: [
      {
        id: 'nr-1',
        name: 'SalesData',
        reference: 'Data!$A$1:$F$21',
        scope: 'workbook',
        comment: 'Fixture range',
      },
    ],
  },
);
writeJson('small.ssjson', smallWorkbook);

// ─── Large workbook: 50,000 rows, 20 columns, 3 populated ───────────────────
// Three populated columns keep the pretty-printed document near the 10 MB
// budget while still exercising 50,000 rows and a 20-column sheet.
const LARGE_ROWS = 50000;
const LARGE_COLS = 20;
const largeCells = {};
for (let col = 0; col < 3; col += 1) {
  largeCells[`0:${col}`] = cell(`Column ${col + 1}`, { fontWeight: 'bold' });
}
for (let row = 1; row <= LARGE_ROWS; row += 1) {
  largeCells[`${row}:0`] = cell(String((row * 31) % 100000));
  largeCells[`${row}:1`] = cell(String((row * 17) % 1000));
  largeCells[`${row}:2`] = cell(`Item ${row}`);
}
const largeWorkbook = makeWorkbook(
  'fixture-large',
  'Fixture Large',
  [
    makeSheet('Large', largeCells, {
      rowCount: LARGE_ROWS + 10,
      columnCount: LARGE_COLS,
    }),
  ],
);
writeJson('large.ssjson', largeWorkbook);

// ─── Extensions workbook ────────────────────────────────────────────────────
const extensionCells = {
  '0:0': cell('Task', { fontWeight: 'bold' }),
  '0:1': cell('Start', { fontWeight: 'bold' }),
  '0:2': cell('End', { fontWeight: 'bold' }),
  '1:0': cell('Design'),
  '1:1': cell('2026-01-05'),
  '1:2': cell('2026-01-09'),
};
const extensionsWorkbook = makeWorkbook(
  'fixture-extensions',
  'Fixture Extensions',
  [makeSheet('Project', extensionCells)],
  {
    extensions: {
      'project-wbs': {
        extensionId: 'project-wbs',
        schemaVersion: '1.0.0',
        data: {
          project: {
            id: 'project-fixture',
            name: 'Fixture Project',
            description: 'Desktop fixture project',
            startDate: '2026-01-05',
            endDate: '2026-01-09',
            tasks: [
              {
                id: 'task-1',
                name: 'Design',
                startDate: '2026-01-05',
                endDate: '2026-01-09',
                duration: 5,
                parentId: null,
                dependencies: [],
                progress: 50,
                resourceId: null,
                isMilestone: false,
                color: '#3b82f6',
                notes: '',
              },
            ],
            risks: [],
            resources: [],
            materials: [],
            actuals: [],
            allocations: [],
            consumptions: [],
          },
          columnMapping: null,
          sourceSheetId: 'sheet-project',
        },
      },
      'creator-canvas': {
        extensionId: 'creator-canvas',
        schemaVersion: '1.0.0',
        data: {
          version: 1,
          nodes: [],
          connections: [],
          collections: [],
          tags: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      },
    },
  },
);
writeJson('extensions.ssjson', extensionsWorkbook);

// ─── Unicode workbook ───────────────────────────────────────────────────────
const unicodeWorkbook = makeWorkbook(
  'fixture-unicode',
  'Résumé — 売上',
  [
    makeSheet('Données', {
      '0:0': cell('こんにちは'),
      '0:1': cell('Grüße'),
      '0:2': cell('🎉 emoji'),
      '1:0': cell('=LEN(A1)'),
    }),
  ],
);
writeJson('unicode.ssjson', unicodeWorkbook);

// ─── Invalid / edge inputs ──────────────────────────────────────────────────
writeFileSync(
  join(outDir, 'corrupt.ssjson'),
  '{"id":"fixture-corrupt","title":"Truncated","sheets":[',
);
writeFileSync(join(outDir, 'empty.ssjson'), '');
writeFileSync(
  join(outDir, 'wrong-extension.txt'),
  JSON.stringify(smallWorkbook, null, 2) + '\n',
);

const readonlyPath = join(outDir, 'readonly.ssjson');
writeJson('readonly.ssjson', smallWorkbook);
chmodSync(readonlyPath, 0o444);

writeJson('locked.ssjson', smallWorkbook);

// ─── Legacy localStorage payloads ───────────────────────────────────────────
writeJson('legacy-mru.json', [
  {
    id: 'mru-legacy-1',
    name: 'Legacy Budget.ssjson',
    size: 1234,
    timestamp: FIXED_TIME,
    source: 'local',
    path: join(outDir, 'small.ssjson'),
    canReopen: true,
  },
  {
    id: 'mru-legacy-2',
    name: 'Legacy Handle.ssjson',
    size: 4321,
    timestamp: FIXED_TIME - 1000,
    source: 'local',
    handleId: 'h-legacy',
    canReopen: true,
  },
]);
writeJson('legacy-autosave.json', smallWorkbook);

// ─── Recovery payloads ──────────────────────────────────────────────────────
writeJson('recovery-valid.json', {
  schemaVersion: 1,
  path: join(outDir, 'small.ssjson'),
  name: 'small.ssjson',
  timestamp: FIXED_TIME,
  clean: false,
  workbook: smallWorkbook,
});
writeFileSync(join(outDir, 'recovery-corrupt.json'), '{"schemaVersion":1,');

// ─── Spreadsheet import fixtures ────────────────────────────────────────────
const xlsxRows = [headers];
for (let row = 1; row <= 5000; row += 1) {
  xlsxRows.push([
    `Item ${row}`,
    row,
    row * 2,
    row * 3,
    row * 4,
    row * 10,
  ]);
}
const xlsxSheet = XLSX.utils.aoa_to_sheet(xlsxRows);
const xlsxBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(xlsxBook, xlsxSheet, 'Data');
XLSX.writeFile(xlsxBook, join(outDir, 'import.xlsx'));

const csvLines = ['Item,Q1,Q2,Q3,Q4,Total'];
let csvBytes = csvLines[0].length + 1;
let csvRow = 1;
while (csvBytes < 20 * 1024 * 1024) {
  const line = `Item ${csvRow},${csvRow},${csvRow * 2},${csvRow * 3},${csvRow * 4},${csvRow * 10}`;
  csvLines.push(line);
  csvBytes += line.length + 1;
  csvRow += 1;
}
writeFileSync(join(outDir, 'import-large.csv'), csvLines.join('\n') + '\n');

// ─── Manifest ───────────────────────────────────────────────────────────────
const manifest = {
  generatedAt: new Date().toISOString(),
  fixedTimestamp: FIXED_TIME,
  files: [
    'small.ssjson',
    'large.ssjson',
    'extensions.ssjson',
    'unicode.ssjson',
    'corrupt.ssjson',
    'empty.ssjson',
    'wrong-extension.txt',
    'readonly.ssjson',
    'locked.ssjson',
    'legacy-mru.json',
    'legacy-autosave.json',
    'recovery-valid.json',
    'recovery-corrupt.json',
    'import.xlsx',
    'import-large.csv',
  ],
};
writeJson('manifest.json', manifest);

console.log(`[fixtures] wrote ${manifest.files.length} files to ${outDir}`);
