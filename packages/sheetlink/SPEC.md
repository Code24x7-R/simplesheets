# SheetLink Specification

> Cross-tab data bridge for SimpleSheet

**Package**: `@simplesheets/sheetlink`
**Protocol Version**: 1
**Transport**: BroadcastChannel (same-origin)
**Channel Name**: `simplesheets-link`

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Protocol](#protocol)
4. [Client API](#client-api)
5. [Operations](#operations)
6. [Error Handling](#error-handling)
7. [Provider Integration](#provider-integration)
8. [Usage Guide](#usage-guide)
9. [Examples](#examples)

---

## 1. Overview

SheetLink enables **same-origin browser tabs** to read live data from an open SimpleSheet workbook. It uses the [BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) for zero-latency, bidirectional communication between:

- **Provider**: The SimpleSheet tab (runs `SheetLinkProvider` component)
- **Consumer**: Any other tab (e.g., SimpleDocs) that imports `SheetLinkClient`

### Key Features

- **Live data**: Subscriptions auto-push updates when the workbook changes
- **Type-safe**: Full TypeScript types for all operations and responses
- **Resilient**: Automatic retry, timeout handling, connection state tracking
- **Secure**: Explicit trust prompt — provider tabs must authorize each consumer
- **Framework-agnostic**: `SheetLinkClient` is a plain TypeScript class (no React dependency)

### Requirements

- Same origin (both tabs served from the same domain)
- Modern browser with BroadcastChannel support (all evergreen browsers)
- A SimpleSheet tab with `SheetLinkProvider` mounted

---

## 2. Architecture

```
┌──────────────────────────┐      BroadcastChannel      ┌──────────────────────────┐
│   SimpleSheets (Provider)│      "simplesheets-link"    │   Consumer App           │
│                          │                              │   (e.g., SimpleDocs)     │
│  ┌────────────────────┐  │                              │  ┌────────────────────┐  │
│  │ SheetLinkProvider  │  │  ◄── HELLO ──────────────── │  │ SheetLinkClient    │  │
│  │   (in App.tsx)     │  │  ──► WELCOME ─────────────► │  │                    │  │
│  │                    │  │                              │  │ - connect()        │  │
│  │ - workbook ref     │  │  ◄── REQUEST (corrId, op) ── │  │ - getRangeValues() │  │
│  │ - trust prompt     │  │  ──► RESPONSE (result) ────► │  │ - subscribe()      │  │
│  │ - range picker     │  │                              │  │ - pickRange()      │  │
│  │ - auto-push on edit│  │  ◄── SUBSCRIBE (range) ──── │  │                    │  │
│  └────────────────────┘  │  ──► UPDATE (data) ────────► │  └────────────────────┘  │
└──────────────────────────┘                              └──────────────────────────┘
```

### Data Flow

1. **Handshake**: Client sends `SSL_HELLO` → Provider responds `SSL_WELCOME`
2. **Request/Response**: Client sends `SSL_REQUEST` with a correlation ID → Provider responds `SSL_RESPONSE` with the same ID
3. **Subscription**: Client sends `SSL_SUBSCRIBE` → Provider pushes `SSL_UPDATE` on every workbook change
4. **Range Picker**: Client sends `SSL_PICK_RANGE_REQUEST` → Provider shows modal → User selects → Provider sends `SSL_PICK_RANGE_RESULT`

---

## 3. Protocol

### 3.1 Messages

All messages are discriminated unions with a `type` field prefix `SSL_`.

```typescript
type SheetLinkMessage =
  | SheetLinkHelloMessage       // Client → Provider
  | SheetLinkWelcomeMessage      // Provider → Client
  | SheetLinkRequestMessage      // Client → Provider
  | SheetLinkSuccessResponseMessage  // Provider → Client
  | SheetLinkErrorResponseMessage     // Provider → Client
  | SheetLinkSubscribeMessage    // Client → Provider
  | SheetLinkUnsubscribeMessage  // Client → Provider
  | SheetLinkUpdateMessage       // Provider → Client
  | SheetLinkPickRangeRequestMessage  // Client → Provider
  | SheetLinkPickRangeResultMessage   // Provider → Client
  | SheetLinkPickRangeCancelMessage   // Provider → Client
```

### 3.2 Correlation IDs

Each `SSL_REQUEST` carries a unique `corrId` string. The provider echoes this ID in its `SSL_RESPONSE`, allowing the client to match responses to pending requests. Multiple requests can be in-flight simultaneously.

### 3.3 Transport

```typescript
interface SheetLinkTransport {
  send(message: SheetLinkMessage): void;
  onMessage(handler: (message: SheetLinkMessage) => void): () => void;
  close(): void;
}
```

The default implementation uses `BroadcastChannel`. Custom transports can be injected for testing.

---

## 4. Client API

### 4.1 Installation

```bash
npm install @simplesheets/sheetlink
```

### 4.2 SheetLinkClient

```typescript
import { SheetLinkClient } from '@simplesheets/sheetlink';

const client = new SheetLinkClient({
  channelName: 'simplesheets-link',  // Must match provider (default)
  timeoutMs: 5000,                   // Request timeout (default: 5000)
});
```

### 4.3 Connection Lifecycle

| Method | Returns | Description |
|--------|---------|-------------|
| `connect()` | `Promise<void>` | Send HELLO, await WELCOME. Throws if no provider. |
| `disconnect()` | `void` | Close transport, clear subscriptions, reset state |
| `isConnected()` | `boolean` | Whether connected to a provider |
| `onConnectionChange(cb)` | `() => void` | Register connection state callback. Returns unsubscribe. |

### 4.4 Data Access Methods

All methods return `Promise<T>` and throw `SheetLinkError` on failure.

| Method | Args | Returns | Description |
|--------|------|---------|-------------|
| `getCellValue(sheet, ref)` | `string, string` | `CellData` | Single cell value |
| `getRangeValues(sheet, range)` | `string, string` | `CellData[][]` | 2D array of cell data |
| `getFormula(sheet, ref)` | `string, string` | `string \| null` | Raw formula or null |
| `getFormulas(sheet, range)` | `string, string` | `(string\|null)[][]` | 2D array of formulas |
| `listSheets()` | — | `string[]` | All sheet names |
| `getUsedRange(sheet)` | `string` | `string` | A1-range of used data |
| `getDependencies(sheet, ref)` | `string, string` | `CellRef[]` | Cells a formula references |
| `pickRange(prompt?)` | `string?` | `Promise<string>` | Opens range picker, returns range |

### 4.5 Subscriptions

```typescript
// Subscribe to live updates
const unsubscribe = client.subscribe(
  'Sheet1',
  'A1:D10',
  (data: CellData[][]) => {
    console.log('Data updated:', data);
  }
);

// Later: stop receiving updates
unsubscribe();
```

### 4.6 Types

```typescript
interface CellData {
  rawValue: string;                    // User input (e.g., "=SUM(A1:A3)")
  computedValue: string | number | boolean | null;  // Evaluated result
  isFormula: boolean;                  // Whether cell contains a formula
}

interface CellRef {
  row: number;         // Zero-based
  col: number;         // Zero-based
  absoluteCol: boolean;
  absoluteRow: boolean;
  sheetName?: string;  // Cross-sheet reference qualifier
}
```

---

## 5. Operations

### 5.1 listSheets

Returns all sheet names in the workbook.

```typescript
const sheets: string[] = await client.listSheets();
// ['Sheet1', 'Sheet2', 'Data']
```

### 5.2 getCellValue

Returns a single cell's data.

```typescript
const cell = await client.getCellValue('Sheet1', 'B2');
// { rawValue: '=SUM(A1:A3)', computedValue: 42, isFormula: true }
```

### 5.3 getRangeValues

Returns a 2D array (row-major) of cell data for the given range.

```typescript
const data = await client.getRangeValues('Sheet1', 'A1:C3');
// [
//   [{ rawValue: 'Name', computedValue: 'Name', isFormula: false }, ...],
//   [{ rawValue: 'Item 1', computedValue: 'Item 1', isFormula: false }, ...],
//   ...
// ]
```

### 5.4 getFormula

Returns the raw formula string for a cell, or `null` if it's a literal value.

```typescript
const formula = await client.getFormula('Sheet1', 'B2');
// '=SUM(A1:A3)' or null
```

### 5.5 getFormulas

Returns a 2D array of formulas. Cells without formulas have `null`.

```typescript
const formulas = await client.getFormulas('Sheet1', 'A1:C3');
// [['=A1+B1', null, '=C1*2'], ...]
```

### 5.6 getUsedRange

Returns the bounding A1-range of all data on a sheet (e.g., `"A1:F25"`). Empty sheet returns `""`.

```typescript
const range = await client.getUsedRange('Sheet1');
// 'A1:F25'
```

### 5.7 getDependencies

Returns the cell references that a formula depends on. Returns `[]` for non-formula cells.

```typescript
const deps = await client.getDependencies('Sheet1', 'E5');
// [{ row: 0, col: 1, absoluteCol: false, absoluteRow: false }, ...]
```

### 5.8 pickRange

Opens the range picker modal in the provider tab. Returns the user-selected range string.

```typescript
const range = await client.pickRange('Select data for the table');
// 'Sheet1!A1:D10'
```

The provider tab shows a modal. The user selects a range and confirms. If the user cancels, the promise rejects with `PICK_CANCELLED`.

---

## 6. Error Handling

### 6.1 Error Hierarchy

All errors are instances of `SheetLinkError`:

```typescript
class SheetLinkError extends Error {
  readonly code: SheetLinkErrorCode;
  readonly recoverable: boolean;
}
```

### 6.2 Error Codes

| Code | Message | Recoverable | When |
|------|---------|-------------|------|
| `NO_PROVIDER` | No SimpleSheet tab is open | ✅ | No WELCOME received within timeout |
| `TIMEOUT` | Request timed out | ✅ | Provider didn't respond within timeout |
| `INVALID_RANGE` | Invalid cell range | ✅ | Malformed A1 notation |
| `SHEET_NOT_FOUND` | Sheet not found | ✅ | Sheet name doesn't exist |
| `INVALID_REF` | Invalid cell reference | ✅ | Bad cell ref (e.g., "ZZZ") |
| `PROTOCOL_MISMATCH` | Version mismatch | ❌ | Client/server versions differ |
| `PICK_CANCELLED` | Selection cancelled | ✅ | User closed the range picker |
| `NOT_AUTHORIZED` | Not authorized | ✅ | Trust prompt was denied |

### 6.3 Recovery Patterns

```typescript
import { SheetLinkClient, SheetLinkError } from '@simplesheets/sheetlink';

const client = new SheetLinkClient();

try {
  await client.connect();
} catch (err) {
  if (err instanceof SheetLinkError && err.code === 'NO_PROVIDER') {
    // Show "Open SimpleSheet" button
    showOpenButton();
  }
}

// In a fetch loop with retry:
async function fetchWithRetry() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await client.getRangeValues('Sheet1', 'A1:D10');
    } catch (err) {
      if (err instanceof SheetLinkError && err.recoverable) {
        await sleep(1000 * (attempt + 1));  // backoff
        continue;
      }
      throw err;
    }
  }
}
```

---

## 7. Provider Integration

### 7.1 Setup in SimpleSheets

Mount `SheetLinkProvider` once inside the main `App.tsx`:

```tsx
import { SheetLinkProvider } from './components/SheetLink';

function WorkbookView() {
  const { workbook } = useHistory();

  return (
    <>
      {/* ... existing components ... */}
      <SheetLinkProvider workbook={workbook} />
    </>
  );
}
```

### 7.2 Trust Model

When a new consumer tab sends its first request:

1. Provider shows a **trust prompt** modal: "Tab X wants to access your spreadsheet data"
2. User clicks **Allow** → tab is authorized for the session
3. User clicks **Deny** → request fails with `NOT_AUTHORIZED`

Authorization is **session-scoped** (cleared when SimpleSheets reloads).

### 7.3 Trust Prompt Component

```typescript
interface SheetLinkTrustPromptProps {
  isOpen: boolean;
  consumerTabId: string;
  consumerOrigin: string;
  requestedOperation: string;
  requestedTarget: string;
  onAllow: () => void;
  onDeny: () => void;
}
```

### 7.4 Range Picker Component

```typescript
interface SheetLinkRangePickerProps {
  isOpen: boolean;
  prompt?: string;
  workbook: Workbook;
  onConfirm: (range: string) => void;
  onCancel: () => void;
}
```

Features:
- Text input with live A1 validation
- Sheet tab buttons to prefix sheet names
- Normalizes reversed coordinates (e.g., `B2:A1` → `A1:B2`)
- Enter to confirm, Escape to cancel

---

## 8. Usage Guide

### 8.1 Quick Start

```typescript
import { SheetLinkClient } from '@simplesheets/sheetlink';

// 1. Create client
const client = new SheetLinkClient();

// 2. Connect (requires a SimpleSheet tab to be open)
await client.connect();

// 3. Read data
const data = await client.getRangeValues('Sheet1', 'A1:D10');

// 4. Subscribe to live updates
client.subscribe('Sheet1', 'A1:D10', newData => {
  renderTable(newData);
});
```

### 8.2 React Integration

```tsx
import { useEffect, useState } from 'react';
import { SheetLinkClient, SheetLinkError } from '@simplesheets/sheetlink';

function useSheetLinkRange(sheet: string, range: string) {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const client = new SheetLinkClient();

    client.onConnectionChange(setConnected);
    client.connect().catch(setError);

    // Initial fetch
    client.getRangeValues(sheet, range).then(setData).catch(setError);

    // Live updates
    const unsub = client.subscribe(sheet, range, setData);

    return () => {
      unsub();
      client.disconnect();
    };
  }, [sheet, range]);

  return { data, connected, error };
}
```

### 8.3 Connection State UI

```tsx
function ConnectionStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const client = new SheetLinkClient();
    client.onConnectionChange(setConnected);
    client.connect();
    return () => client.disconnect();
  }, []);

  return (
    <div>
      {connected
        ? '🟢 Connected to SimpleSheet'
        : '🔴 SimpleSheet not open'}
    </div>
  );
}
```

### 8.4 Range Picker Flow

```typescript
async function selectRange() {
  const client = new SheetLinkClient();
  await client.connect();

  try {
    // Opens modal in SimpleSheet tab
    const range = await client.pickRange('Select data for the report');
    console.log('Selected:', range);  // "Sheet1!A1:D10"
    return range;
  } catch (err) {
    if (err.code === 'PICK_CANCELLED') {
      // User closed the modal — fall back to manual input
      return prompt('Enter range manually:');
    }
    throw err;
  }
}
```

---

## 9. Examples

### 9.1 Building a Data Table (SimpleDocs)

```typescript
import { SheetLinkClient } from '@simplesheets/sheetlink';

async function renderLinkedTable(container: HTMLElement, sheet: string, range: string) {
  const client = new SheetLinkClient();
  await client.connect();

  // Fetch initial data
  const data = await client.getRangeValues(sheet, range);

  // Render table
  const table = document.createElement('table');
  for (const row of data) {
    const tr = document.createElement('tr');
    for (const cell of row) {
      const td = document.createElement('td');
      td.textContent = String(cell.computedValue ?? '');
      if (cell.isFormula) td.classList.add('formula');
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  container.replaceChildren(table);

  // Keep it live
  client.subscribe(sheet, range, newData => {
    // Re-render with updated data
    table.innerHTML = '';
    for (const row of newData) {
      const tr = document.createElement('tr');
      for (const cell of row) {
        const td = document.createElement('td');
        td.textContent = String(cell.computedValue ?? '');
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
  });
}
```

### 9.2 Dependency Auditing

```typescript
async function auditFormula(sheet: string, ref: string) {
  const client = new SheetLinkClient();
  await client.connect();

  const formula = await client.getFormula(sheet, ref);
  if (!formula) {
    console.log(`${ref} is a literal value`);
    return;
  }

  const deps = await client.getDependencies(sheet, ref);
  console.log(`${ref} = ${formula}`);
  console.log('Depends on:', deps.map(d =>
    `${d.sheetName ? d.sheetName + '!' : ''}${colToLetter(d.col)}${d.row + 1}`
  ).join(', '));
}
```

### 9.3 Export to JSON

```typescript
async function exportSheetToJson(sheetName: string) {
  const client = new SheetLinkClient();
  await client.connect();

  const usedRange = await client.getUsedRange(sheetName);
  if (!usedRange) return { sheetName, data: [] };

  const data = await client.getRangeValues(sheetName, usedRange);
  return {
    sheetName,
    range: usedRange,
    data: data.map(row =>
      row.map(cell => ({
        v: cell.computedValue,
        f: cell.isFormula ? cell.rawValue : undefined,
      }))
    ),
  };
}
```

### 9.4 Handling Provider Not Available

```typescript
const client = new SheetLinkClient();

try {
  await client.connect();
} catch (err) {
  if (err.code === 'NO_PROVIDER') {
    // Show a UI to open SimpleSheet
    const btn = document.createElement('button');
    btn.textContent = 'Open SimpleSheet';
    btn.onclick = () => window.open('/simplesheets', '_blank');
    document.body.appendChild(btn);
  }
}
```

### 9.5 Testing with Mock Transport

```typescript
import { SheetLinkClient } from '@simplesheets/sheetlink';
import type { SheetLinkTransport, SheetLinkMessage } from '@simplesheets/sheetlink';

// Create a mock transport for unit testing
class MockTransport implements SheetLinkTransport {
  sentMessages: SheetLinkMessage[] = [];
  onMessageHandler: ((msg: SheetLinkMessage) => void) | null = null;

  send(msg: SheetLinkMessage) {
    this.sentMessages.push(msg);
  }

  onMessage(handler: (msg: SheetLinkMessage) => void) {
    this.onMessageHandler = handler;
    return () => { this.onMessageHandler = null; };
  }

  simulateReceive(msg: SheetLinkMessage) {
    this.onMessageHandler?.(msg);
  }

  close() {}
}

const transport = new MockTransport();
const client = new SheetLinkClient({ transport, timeoutMs: 100 });

// Simulate provider handshake
transport.onMessageHandler!({ type: 'SSL_HELLO', protocolVersion: 1, tabId: 'test' });
transport.simulateReceive({ type: 'SSL_WELCOME', protocolVersion: 1, tabId: 'provider' });

await client.connect();
expect(client.isConnected()).toBe(true);
```

---

## Appendix A: Protocol Message Reference

| Direction | Type | Fields | Description |
|-----------|------|--------|-------------|
| C→P | `SSL_HELLO` | `protocolVersion`, `tabId` | Handshake initiation |
| P→C | `SSL_WELCOME` | `protocolVersion`, `tabId` | Handshake response |
| C→P | `SSL_REQUEST` | `corrId`, `operation`, `args` | Data request |
| P→C | `SSL_RESPONSE` | `corrId`, `ok`, `result`/`error` | Request response |
| C→P | `SSL_SUBSCRIBE` | `subscriptionId`, `sheetName`, `range` | Start live updates |
| C→P | `SSL_UNSUBSCRIBE` | `subscriptionId` | Stop live updates |
| P→C | `SSL_UPDATE` | `subscriptionId`, `data` | Pushed data update |
| C→P | `SSL_PICK_RANGE_REQUEST` | `corrId`, `prompt?` | Open range picker |
| P→C | `SSL_PICK_RANGE_RESULT` | `corrId`, `range` | User-selected range |
| P→C | `SSL_PICK_RANGE_CANCEL` | `corrId` | User cancelled picker |

*C = Client (Consumer), P = Provider (SimpleSheets)*

## Appendix B: A1 Notation Reference

| Pattern | Meaning | Example |
|---------|---------|---------|
| `A1` | Single cell | `B3` |
| `A1:B10` | Rectangular range | `A1:D10` |
| `Sheet1!A1` | Cross-sheet cell | `Data!C5` |
| `Sheet1!A1:B10` | Cross-sheet range | `Sales!A1:Z100` |
| `'My Sheet'!A1` | Quoted sheet name | `'Q1 Data'!B2` |

The range picker normalizes input: `B2:A1` → `A1:B2`.

## Appendix C: Package Structure

```
packages/sheetlink/
├── SPEC.md                              ← This document
├── package.json                         ← @simplesheets/sheetlink
├── tsconfig.json
├── vite.config.ts                       ← Library build config
└── src/
    ├── index.ts                         ← Public API exports
    ├── sheetLinkProtocol.ts             ← Message types, operations, errors
    ├── sheetLinkTransport.ts            ← BroadcastChannel transport
    ├── SheetLinkClient.ts               ← Consumer client class
    ├── SheetLinkError.ts                ← Typed error hierarchy
    └── __tests__/
        ├── SheetLinkClient.test.ts       ← Client unit tests
        ├── SheetLinkError.test.ts        ← Error tests
        ├── sheetLinkProtocol.test.ts     ← Protocol type tests
        └── sheetLinkTransport.test.ts    ← Transport tests
```
