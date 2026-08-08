# @simplesheets/sheetlink

> Cross-tab data bridge for SimpleSheet

Read live spreadsheet data from any same-origin browser tab.

## Install

```bash
npm install @simplesheets/sheetlink
```

## Quick Start

```typescript
import { SheetLinkClient } from '@simplesheets/sheetlink';

const client = new SheetLinkClient();
await client.connect();

// Read a range
const data = await client.getRangeValues('Sheet1', 'A1:D10');

// Live updates
client.subscribe('Sheet1', 'A1:D10', newData => {
  renderTable(newData);
});
```

## Requirements

- Same origin as the SimpleSheet tab
- A SimpleSheet tab with `SheetLinkProvider` mounted must be open

## API

### Connection

| Method | Description |
|--------|-------------|
| `connect()` | Connect to a provider tab |
| `disconnect()` | Disconnect and release resources |
| `isConnected()` | Check connection state |
| `onConnectionChange(cb)` | Listen for connection changes |

### Data Access

| Method | Returns | Description |
|--------|---------|-------------|
| `getCellValue(sheet, ref)` | `CellData` | Single cell |
| `getRangeValues(sheet, range)` | `CellData[][]` | 2D range |
| `getFormula(sheet, ref)` | `string \| null` | Raw formula |
| `getFormulas(sheet, range)` | `(string\|null)[][]` | Formula grid |
| `listSheets()` | `string[]` | Sheet names |
| `getUsedRange(sheet)` | `string` | Used A1-range |
| `getDependencies(sheet, ref)` | `CellRef[]` | Formula deps |
| `pickRange(prompt?)` | `string` | Visual range picker |

### Subscriptions

```typescript
const unsubscribe = client.subscribe(sheet, range, callback);
// call unsubscribe() to stop
```

## Errors

All errors are `SheetLinkError` with a `code` field:

```typescript
import { SheetLinkError } from '@simplesheets/sheetlink';

try {
  await client.connect();
} catch (err) {
  if (err instanceof SheetLinkError) {
    console.log(err.code);     // 'NO_PROVIDER'
    console.log(err.recoverable); // true
  }
}
```

Error codes: `NO_PROVIDER`, `TIMEOUT`, `INVALID_RANGE`, `SHEET_NOT_FOUND`, `INVALID_REF`, `PROTOCOL_MISMATCH`, `PICK_CANCELLED`, `NOT_AUTHORIZED`.

## Full Specification

See [SPEC.md](./SPEC.md) for the complete protocol reference, architecture diagrams, and examples.

## License

MIT
