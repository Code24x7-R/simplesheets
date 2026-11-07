# M7 — Performance and Leak Evidence

Date: 2026-11-07  
Machine: Windows `10.0.26300` x64  
Node `23.11.0`, Electron `45.2.3`, Chromium bundled with Electron  
Method: Playwright `_electron` against the development shell unless noted;
fixtures from `tmp/desktop-fixtures`.

## Fixtures

| Fixture | Contents |
| --- | --- |
| `nav-5000.csv` | 5,000 data rows × 3 columns |
| `large.ssjson` | ~9 MB, 50,000 rows, 20 columns, 3 populated |
| `small.ssjson` | 20 rows, formulas, named range |

## Results

| Requirement | Budget | Measured | Result |
| --- | --- | --- | --- |
| PERF-01 cold start to usable grid | < 3 s | ~1.4–1.7 s window; grid ready under 3 s | pass |
| PERF-02 open `large.ssjson` | < 5 s, no >200 ms single task | ~3.0 s after fixes | pass |
| PERF-03 / SAVE-12 save `large.ssjson` | < 2 s | ~237 ms | pass |
| PERF-04 20 open cycles | ≤ 20% heap growth after GC | E2E asserts ≤ 20% | pass |
| PERF-05 recovery writes | ≤ 2/s, non-blocking | main coalesces at 500 ms | pass |
| PERF-06 listeners/timers/streams | no growth | useEffect cleanups; no object URLs in desktop paths | code-reviewed |
| PERF-07 installer / portable | ≤ 150 MB compressed | 109 MB / 99 MB | pass |
| PERF-07 unpacked | ≤ 350 MB | 312 MB | pass |
| PERF-08 peak memory, large workbook | ≤ 1.5 GB | ~570 MB working set | pass |
| PERF-09 method recorded | yes | this document + DECISIONS | pass |

## Root causes fixed

1. **`CloudStorageModal` compressed the whole workbook on every parent
   render**, including selecting a cell. `estimateShareSize` + lz-string ran
   before the modal's `if (!isOpen) return null`. On the 5,000-row CSV this
   caused ~425 ms per arrow key; on the 9 MB workbook it blocked large opens.
   The size estimate is now memoized and only runs while the modal is open.
   Result: 5,000-row navigation dropped to ~16 ms/key, and large-workbook saves
   are no longer delayed by an unrelated share-size calculation.
2. **`topologicalSort` used `order.includes(key)` inside a loop over every
   cell**, making it O(n²). A 150,000-cell workbook spent ~16.8 s in that
   function. The second pass now uses the existing `visited` set, making it
   O(n). Large open dropped from ~18.9 s to ~3.0 s.

## Commands

```bash
npm run verify
npm run verify:e2e
npm run electron:build
node scripts/desktop-packaged-smoke.mjs
```

## Notes

- Heap measurements use CDP `HeapProfiler.collectGarbage` followed by
  `Runtime.getHeapUsage`.
- The leak test performs 20 open/replace cycles in one renderer and compares
  first/last heap. Window-process RSS can vary with OS caches, so the 1.5 GB
  ceiling uses Electron `app.getAppMetrics().workingSetSize`.
- A true process-level 20-launch cycle and Windows share-lock remain manual;
  see `INSTALL-CHECKLIST.md`.
