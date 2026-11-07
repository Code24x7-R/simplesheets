# SimpleSheets Desktop — Capability Matrix

Status reflects M5. Capabilities are enabled as milestones land; the adapter in
`src/platform/desktop/index.ts` is the source of truth.

| Capability | Web | Desktop dev | Installed | Portable |
| --- | --- | --- | --- | --- |
| Edit cells, formulas, styles, charts, extensions | ✅ | ✅ | ✅ | ✅ |
| Local autosave to `localStorage` | ✅ | ❌ (recovery.json) | ❌ (recovery.json) | ❌ (recovery.json) |
| Native Open dialog | ❌ | ✅ | ✅ | ✅ |
| Native Save / Save As dialogs | ❌ | ✅ | ✅ | ✅ |
| Real file paths on open | ❌ | ✅ | ✅ | ✅ |
| Save-in-place to a real path | ❌ | ✅ | ✅ | ✅ |
| Atomic writes with conflict prompts | ❌ | ✅ | ✅ | ✅ |
| Exports through a native Save dialog | ❌ | ✅ | ✅ | ✅ |
| Drag-and-drop files | ✅ (File API) | ✅ (preload path) | ✅ (preload path) | ✅ (preload path) |
| Recent files backed by real paths | ❌ | ✅ | ✅ | ✅ |
| Crash recovery | ❌ | ✅ | ✅ | ✅ |
| Native menu | ❌ | ✅ | ✅ | ✅ |
| Window position/size persistence | ❌ | ✅ | ✅ | ✅ |
| Single-instance focus | ❌ | ✅ | ✅ | ✅ |
| `.ssjson` file association / Open With | ❌ | ❌ (dev) | 🟡 configured (not installed) | ❌ |
| NSIS per-user installer | — | — | 🟡 built (not installed) | — |
| Portable executable | — | — | — | 🟡 built (not launched) |
| Open data folder | ❌ | ✅ | ✅ | ✅ |
| About: versions, edition, diagnostics | ❌ | ✅ | ✅ | ✅ |
| Auto-update | ❌ | ❌ | ❌ | ❌ |
| Telemetry / network at idle | ❌ | ❌ | ❌ | ❌ |
| URL protocol (`simplesheets://`) | ❌ | ❌ | ❌ | ❌ |

Legend: ✅ available · ⏳ planned milestone · 🟡 built but not verified · ❌ not available.
