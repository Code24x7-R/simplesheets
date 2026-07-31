import packageJson from '../../package.json';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const APP_VERSION = packageJson.version;

function getBuildInfo(): { date: string; time: string; raw: string; commit: string } {
  const ts = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '';
  const commit = typeof __GIT_COMMIT_HASH__ !== 'undefined' ? __GIT_COMMIT_HASH__ : 'unknown';
  if (!ts) return { date: 'dev', time: '', raw: '', commit };
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    raw: ts,
    commit,
  };
}

const ABOUT_CONTENT = `# SimpleSheet

A lightweight, browser-based spreadsheet for small businesses. No bloat — just a fast, offline-capable grid that reads and writes Excel files.

---

## Features

- **Cell editing** with Excel/Sheets-style interactions (point mode, F4 ref cycling, auto-complete)
- **Formulas** — 50+ functions (SUM, AVERAGE, IF, date, math, string, logical) + arithmetic
- **Copy / paste & drag-fill** series extension
- **Undo / redo** — 50 levels
- **Column & row resizing** + freeze panes
- **Import** — .xlsx, .csv, .tsv, .json
- **Export** — .xlsx, .csv, .tsv, .json, .pdf
- **PDF export** with page setup (orientation, margins, scaling)
- **Auto-save** to localStorage + named save slots
- **Multi-sheet workbooks** — add, rename, copy, delete sheets with cross-sheet formula references
- **Virtualized grid** — smooth scrolling for 100k+ rows × unlimited columns
- **Clean menu-based UI** — File, Edit, View, Insert, Format, Help dropdown menus
- **Function bar** — one-click access to common functions (SUM, AVERAGE, COUNT, MAX, MIN, IF, etc.)
- **R1C1 reference format** — toggle between A1 and R1C1 notation by clicking the cell reference
- **Formula Wizard** — interactive step-by-step formula builder with nested function support
- **Find & Replace** — search across cells with options for case sensitivity, exact match, formulas, and multi-sheet scope

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Build | Vite 5 |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Virtualization | @tanstack/react-virtual |
| Excel | SheetJS (xlsx) |
| CSV/TSV | PapaParse |
| PDF | html2pdf.js |
| Testing | Jest |

---

## License

MIT
`;

/**
 * Simple markdown renderer for the about content.
 * Handles headings, horizontal rules, bold text, bullet lists, and code.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Horizontal rule
    if (line.trim() === '---') {
      elements.push(<hr key={i} className="my-2 border-gray-200" />);
      continue;
    }

    // H1
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-xl font-bold text-gray-900 mb-1">
          {renderInline(line.slice(2))}
        </h1>
      );
      continue;
    }

    // H2
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-base font-bold text-gray-800 mt-3 mb-1">
          {renderInline(line.slice(3))}
        </h2>
      );
      continue;
    }

    // Table
    if (line.startsWith('|')) {
      // Collect table rows
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableRows.push(lines[i]);
        i++;
      }
      i--; // Step back since the outer loop will increment

      if (tableRows.length >= 2) {
        const headerCells = parseTableRow(tableRows[0]);
        const dataRows = tableRows.slice(2); // Skip header and separator
        elements.push(
          <table key={i} className="text-xs border-collapse my-2 w-full">
            <thead>
              <tr>
                {headerCells.map((cell, ci) => (
                  <th key={ci} className="text-left py-1 px-2 bg-gray-100 border border-gray-200 font-semibold text-gray-700">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => {
                const cells = parseTableRow(row);
                return (
                  <tr key={ri}>
                    {cells.map((cell, ci) => (
                      <td key={ci} className="py-1 px-2 border border-gray-200 text-gray-600">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      }
      continue;
    }

    // Bullet list
    if (line.startsWith('- ')) {
      elements.push(
        <div key={i} className="flex items-start gap-2 text-sm text-gray-700 ml-1">
          <span className="text-gray-400 mt-px">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm text-gray-700">
        {renderInline(line)}
      </p>
    );
  }

  return elements;
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.startsWith('|') && trimmed.endsWith('|')
    ? trimmed.slice(1, -1)
    : trimmed;
  return inner.split('|').map((c) => c.trim());
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold** and `code` segments
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`([^`]+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    /* istanbul ignore next - edge case: text before first match */
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      parts.push(
        <strong key={match.index} className="font-semibold text-gray-900">
          {match[2]}
        </strong>
      );
    } else
      /* istanbul ignore next - ABOUT_CONTENT has no inline code markers */
      if (match[4]) {
        parts.push(
          <code key={match.index} className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-800">
            {match[4]}
          </code>
        );
      }

    lastIndex = regex.lastIndex;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/**
 * Modal displaying the SimpleSheet README / about information.
 * Triggered from the Help → About SimpleSheet menu.
 */
export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;
  const build = getBuildInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-[720px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">About SimpleSheet</h2>
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">v{APP_VERSION}</span>
            <span className="text-xs text-gray-400" title={`${build.raw} (${build.commit})`}>build {build.date}{build.time ? ` ${build.time}` : ''} ({build.commit})</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {renderMarkdown(ABOUT_CONTENT)}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-gray-200">
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
