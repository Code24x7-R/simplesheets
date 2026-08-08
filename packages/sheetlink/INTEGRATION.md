# SimpleDocs + SheetLink Integration Guide

> How to embed live SimpleSheet data in SimpleDocs documents

## Overview

SimpleDocs can display live, linked tables from SimpleSheet using SheetLink. When the spreadsheet data updates, the document table automatically reflects the change.

## Architecture

```
SimpleDocs Tab                          SimpleSheet Tab
┌─────────────────────┐                ┌─────────────────────┐
│                     │                │                     │
│  ┌───────────────┐  │  BroadcastChannel ┌───────────────┐  │
│  │ LinkedTable   │  │ ◄──────────────► │ Provider      │  │
│  │ Component     │  │  "simplesheets-link" │ (in App.tsx) │  │
│  └───────────────┘  │                └─────────────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ RangePicker   │  │  ← Opens modal in SimpleSheet tab
│  │ Button        │  │
│  └───────────────┘  │
└─────────────────────┘
```

## Setup

### 1. Install the Package

```bash
npm install @simplesheets/sheetlink
```

### 2. Create the LinkedTable Component

```tsx
// SimpleDocs/src/components/LinkedTable.tsx
import { useEffect, useState, useCallback } from 'react';
import { SheetLinkClient, SheetLinkError } from '@simplesheets/sheetlink';

interface LinkedTableProps {
  sheet: string;
  range: string;
  onRangeChange?: (range: string) => void;
}

export function LinkedTable({ sheet, range, onRangeChange }: LinkedTableProps) {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [client, setClient] = useState(null);

  // Connect on mount
  useEffect(() => {
    const c = new SheetLinkClient();
    setClient(c);

    c.onConnectionChange(setConnected);
    c.connect().catch(setError);

    return () => c.disconnect();
  }, []);

  // Fetch and subscribe when connected + range changes
  useEffect(() => {
    if (!client || !connected) return;

    client.getRangeValues(sheet, range).then(setData).catch(setError);

    const unsub = client.subscribe(sheet, range, newData => {
      setData(newData);
    });

    return unsub;
  }, [client, connected, sheet, range]);

  // Handle range picker
  const handlePickRange = useCallback(async () => {
    if (!client) return;
    try {
      const newRange = await client.pickRange('Select data for this table');
      onRangeChange?.(newRange);
    } catch (err) {
      if (err.code !== 'PICK_CANCELLED') setError(err);
    }
  }, [client, onRangeChange]);

  // Render states
  if (error?.code === 'NO_PROVIDER') {
    return (
      <div className="sheetlink-error">
        <p>SimpleSheet is not open.</p>
        <button onClick={() => window.open('/simplesheets', '_blank')}>
          Open SimpleSheet
        </button>
      </div>
    );
  }

  if (!data) {
    return <div className="sheetlink-loading">Loading data...</div>;
  }

  return (
    <div className="sheetlink-table-wrapper">
      <div className="sheetlink-toolbar">
        <span className="sheetlink-range">{sheet}!{range}</span>
        <button onClick={handlePickRange}>📎 Change Range</button>
        <span className={`sheetlink-status ${connected ? 'connected' : ''}`}>
          {connected ? '🟢' : '🔴'}
        </span>
      </div>
      <table className="sheetlink-table">
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={cell.isFormula ? 'formula' : ''}>
                  {String(cell.computedValue ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 3. Use in a Document

```tsx
// SimpleDocs/src/components/DocumentEditor.tsx
import { LinkedTable } from './LinkedTable';

function DocumentEditor() {
  const [tableRange, setTableRange] = useState({
    sheet: 'Sheet1',
    range: 'A1:D10',
  });

  return (
    <div className="document">
      <h1>Quarterly Report</h1>
      <p>Live data from SimpleSheet:</p>

      <LinkedTable
        sheet={tableRange.sheet}
        range={tableRange.range}
        onRangeChange={(newRange) => {
          // Parse "Sheet1!A1:D10" → { sheet, range }
          const [sheet, range] = newRange.split('!');
          setTableRange({ sheet, range });
        }}
      />

      <p>The table above updates automatically when the spreadsheet changes.</p>
    </div>
  );
}
```

### 4. CSS Styling

```css
/* SimpleDocs/src/styles/sheetlink.css */
.sheetlink-table-wrapper {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin: 1rem 0;
  overflow: hidden;
}

.sheetlink-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.sheetlink-range {
  font-family: monospace;
  font-size: 0.875rem;
  color: #374151;
}

.sheetlink-status {
  margin-left: auto;
}

.sheetlink-table {
  width: 100%;
  border-collapse: collapse;
}

.sheetlink-table td {
  padding: 0.5rem;
  border: 1px solid #f3f4f6;
  font-size: 0.875rem;
}

.sheetlink-table td.formula {
  color: #2563eb;
  font-style: italic;
}

.sheetlink-error {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #991b1b;
}

.sheetlink-loading {
  padding: 1rem;
  color: #6b7280;
  font-style: italic;
}
```

## User Flow

### Inserting a Table

1. User clicks "Insert → Linked Spreadsheet Table" in SimpleDocs
2. SheetLink shows connection status
3. If SimpleSheet is open and authorized, the range picker modal appears IN the SimpleSheet tab
4. User selects a range visually (or types it)
5. Table appears in the document with live data

### Editing Data

1. User edits a cell in SimpleSheet
2. SheetLink auto-pushes the update
3. The table in SimpleDocs re-renders automatically

### Refreshing / Re-authorizing

- If SimpleSheet reloads, the trust prompt appears again
- If SimpleSheet is closed, the table shows "Open SimpleSheet" button
- Clicking the status indicator re-connects

## Security

- **Same-origin only**: Both tabs must be on the same domain
- **Explicit trust**: SimpleSheet shows an "Allow" prompt before sharing data
- **Session-scoped**: Authorization clears when SimpleSheet reloads
- **Read-only**: SheetLink never modifies spreadsheet data

## Error Handling

| Scenario | User Experience |
|----------|----------------|
| SimpleSheet not open | "Open SimpleSheet" button |
| Trust denied | "Access denied — click Allow in SimpleSheet" |
| Range invalid | Inline error, keep input for correction |
| Sheet deleted | "Sheet not found — pick a new range" |
| Connection lost | Status turns 🔴, auto-reconnects on return |

## Bundling

SheetLink is a self-contained package. Bundle it with your SimpleDocs build:

```javascript
// vite.config.ts (SimpleDocs)
export default defineConfig({
  build: {
    rollupOptions: {
      // SheetLink has no external dependencies — no config needed
    },
  },
});
```

## Troubleshooting

**Q: Why isn't my table updating?**
A: Ensure a SimpleSheet tab is open on the same origin with `SheetLinkProvider` mounted.

**Q: Why does the trust prompt keep appearing?**
A: Authorization is session-scoped. Reloading SimpleSheet clears it. This is by design.

**Q: Can I use SheetLink across different domains?**
A: No. BroadcastChannel is same-origin only. For cross-origin, a postMessage iframe bridge would be needed (not currently implemented).

**Q: Does SheetLink work in private/incognito mode?**
A: Yes, as long as both tabs are in the same browsing session.
