# SimpleSheets Desktop — Capability Matrix

Status reflects M0. Capabilities are enabled as milestones land; the adapter in
`src/platform/desktop/index.ts` is the source of truth.

| Capability | Web | Desktop dev | Installed | Portable |
| --- | --- | --- | --- | --- |
| Edit cells, formulas, styles, charts, extensions | ✅ | ✅ | ✅ | ✅ |
| Local autosave to `localStorage` | ✅ | ✅ | ✅ | ✅ |
| Native Open / Save dialogs | ❌ | ⏳ M1 | ⏳ M1 | ⏳ M1 |
| Real file paths and save-in-place | ❌ | ⏳ M1/M2 | ⏳ M1/M2 | ⏳ M1/M2 |
| Drag-and-drop files | ✅ (File API) | ⏳ M1 | ⏳ M1 | ⏳ M1 |
| Recent files backed by real paths | ❌ | ⏳ M3 | ⏳ M3 | ⏳ M3 |
| Crash recovery | ❌ | ⏳ M3 | ⏳ M3 | ⏳ M3 |
| Native menu | ❌ | ⏳ M4 | ⏳ M4 | ⏳ M4 |
| Window position/size persistence | ❌ | ⏳ M4 | ⏳ M4 | ⏳ M4 |
| Single-instance focus | ❌ | ✅ | ✅ | ✅ |
| `.ssjson` file association / Open With | ❌ | ❌ (dev) | ⏳ M5 | ❌ |
| NSIS per-user installer | — | — | 🟡 built (not installed) | — |
| Portable executable | — | — | — | 🟡 built (not launched) |
| Open data folder | ❌ | ✅ | ✅ | ✅ |
| About: versions, edition, diagnostics | ⏳ M4 | ⏳ M4 | ⏳ M4 | ⏳ M4 |
| Auto-update | ❌ | ❌ | ❌ | ❌ |
| Telemetry / network at idle | ❌ | ❌ | ❌ | ❌ |
| URL protocol (`simplesheets://`) | ❌ | ❌ | ❌ | ❌ |

Legend: ✅ available · ⏳ planned milestone · 🟡 built but not verified · ❌ not available.
