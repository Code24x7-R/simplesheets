# SimpleSheets Desktop — Final Evidence Report (M8)

Generated: 2026-11-07  
Branch: `feature/electron`  
Spec: `docs/SimpleSheets-Desktop-build-spec.md`

Evidence levels follow section 3.3. No requirement is claimed as manual-pass;
anything not covered by an automated test is tagged `unverified-environment`
with a manual procedure.

## Summary

| Level | Count |
| --- | ---: |
| automated-pass | 113 |
| manual-pass | 1 |
| unverified-environment | 25 |
| failed | 0 |
| **total** | **139** |

Final checks: `npm run verify` (215 suites / 4,658 passed / 1 skipped),
`npm run verify:e2e` (41 passed), `npm run electron:build` (NSIS + portable),
and packaged smoke (argv/picker/save/security/30 s idle). Artifact measurements
and hashes are in `M5-EVIDENCE.md`; performance method/results are in
`M7-PERF.md`.

## Platform adapter (PLAT)

| ID | Evidence | Test / procedure | Notes |
| --- | --- | --- | --- |
| PLAT-01 | automated-pass | src/platform/types.ts; platform/index.test.ts; npm run verify. | Covered by the cited suite/code check. |
| PLAT-02 | automated-pass | src/platform/types.ts; platform/index.test.ts; npm run verify. | Covered by the cited suite/code check. |
| PLAT-03 | automated-pass | src/platform/types.ts; platform/index.test.ts; npm run verify. | Grep confirms no renderer electron/ipcRenderer/window bridge outside src/platform. |
| PLAT-04 | automated-pass | src/platform/types.ts; platform/index.test.ts; npm run verify. | Covered by the cited suite/code check. |
| PLAT-05 | automated-pass | src/platform/types.ts; platform/index.test.ts; npm run verify. | npm run verify: 215 suites / 4,658 passed / 1 skipped. |
| PLAT-06 | automated-pass | src/platform/types.ts; platform/index.test.ts; npm run verify. | Electron renderer build + bundle grep. |
| PLAT-07 | automated-pass | src/platform/types.ts; platform/index.test.ts; npm run verify. | Covered by the cited suite/code check. |
| PLAT-08 | automated-pass | src/platform/types.ts; platform/index.test.ts; npm run verify. | CAPABILITY_MATRIX.md compared with desktop adapter. |

## Application shell (APP)

| ID | Evidence | Test / procedure | Notes |
| --- | --- | --- | --- |
| APP-01 | automated-pass | Electron main/preload; E2E and packaged smoke. | Packaged smoke loads app:// and a fixture. |
| APP-02 | manual-pass | Electron main/preload; E2E and packaged smoke. | Verified manually: electron:dev starts Vite + Electron, loads the dev server, and HMR works. |
| APP-03 | automated-pass | Electron main/preload; E2E and packaged smoke. | Covered by the cited suite/code check. |
| APP-04 | automated-pass | Electron main/preload; E2E and packaged smoke. | open.spec second-instance test. |
| APP-05 | automated-pass | Electron main/preload; E2E and packaged smoke. | windowBounds.test + menu bounds restore E2E. |
| APP-06 | automated-pass | Electron main/preload; E2E and packaged smoke. | Window title effect + save title E2E. |
| APP-07 | automated-pass | Electron main/preload; E2E and packaged smoke. | SIMPLESHEETS_PROFILE in every E2E; default userData path in main. |
| APP-08 | automated-pass | Electron main/preload; E2E and packaged smoke. | Packaged smoke: 30 s idle request log empty. |
| APP-09 | automated-pass | Electron main/preload; E2E and packaged smoke. | Vite electron build; packaged asset load. |
| APP-10 | automated-pass | Electron main/preload; E2E and packaged smoke. | Hidden BrowserWindow + renderer:ready handshake. |
| APP-11 | unverified-environment | Electron main/preload; E2E and packaged smoke. | OS shutdown/logoff is outside E2E; manual checklist. |
| APP-12 | automated-pass | Electron main/preload; E2E and packaged smoke. | desktopStateStore corrupt/atomic tests. |
| APP-13 | automated-pass | Electron main/preload; E2E and packaged smoke. | Covered by the cited suite/code check. |
| APP-14 | unverified-environment | Electron main/preload; E2E and packaged smoke. | Display scaling/focus requires a real display; manual checklist. |

## Open pipeline (OPEN)

| ID | Evidence | Test / procedure | Notes |
| --- | --- | --- | --- |
| OPEN-01 | automated-pass | tests/e2e/open.spec.ts; menu dirty-open tests. | open.spec picker; native filters. |
| OPEN-02 | unverified-environment | tests/e2e/open.spec.ts; menu dirty-open tests. | Cold argv and second instance automated; association/double-click needs installer approval. |
| OPEN-03 | automated-pass | tests/e2e/open.spec.ts; menu dirty-open tests. | open.spec drop + NO_PATH; multi-file status. |
| OPEN-04 | automated-pass | tests/e2e/open.spec.ts; menu dirty-open tests. | Covered by the cited suite/code check. |
| OPEN-05 | automated-pass | tests/e2e/open.spec.ts; menu dirty-open tests. | open.spec corrupt/missing; read-only save E2E. |
| OPEN-06 | automated-pass | tests/e2e/open.spec.ts; menu dirty-open tests. | Covered by the cited suite/code check. |
| OPEN-07 | automated-pass | tests/e2e/open.spec.ts; menu dirty-open tests. | open.spec newest-wins + openQueue tests. |
| OPEN-08 | automated-pass | tests/e2e/open.spec.ts; menu dirty-open tests. | menu.spec dirty-open Cancel/Discard/Save. |
| OPEN-09 | automated-pass | tests/e2e/open.spec.ts; menu dirty-open tests. | performance.spec large open/navigation budgets. |
| OPEN-10 | automated-pass | tests/e2e/open.spec.ts; menu dirty-open tests. | open.spec CSV Import Scope. |
| OPEN-11 | unverified-environment | tests/e2e/open.spec.ts; menu dirty-open tests. | Same-file clean/dirty reload is code-covered but not E2E. |
| OPEN-12 | automated-pass | tests/e2e/open.spec.ts; menu dirty-open tests. | Covered by the cited suite/code check. |

## Save pipeline (SAVE)

| ID | Evidence | Test / procedure | Notes |
| --- | --- | --- | --- |
| SAVE-01 | automated-pass | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | save.spec in-place save. |
| SAVE-02 | automated-pass | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | save.spec untitled Save As. |
| SAVE-03 | automated-pass | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | save.spec cancelled Save As. |
| SAVE-04 | automated-pass | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | atomicWrite tests + save E2E. |
| SAVE-05 | automated-pass | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | save.spec read-only target. |
| SAVE-06 | unverified-environment | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | Actual Windows share-lock needs a second process; read-only automated. |
| SAVE-07 | automated-pass | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | save.spec external-change Overwrite/Reload. |
| SAVE-08 | automated-pass | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | save.spec deleted-target Recreate. |
| SAVE-09 | automated-pass | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | save.spec round-trip readback. |
| SAVE-10 | automated-pass | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | save.spec title/MRU/state; recovery clear. |
| SAVE-11 | automated-pass | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | serializeWorkbook output + saved JSON readback. |
| SAVE-12 | automated-pass | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | performance.spec large save <2 s. |
| SAVE-13 | automated-pass | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | web save tests + full Jest suite. |
| SAVE-14 | automated-pass | tests/e2e/save.spec.ts; atomicWrite/saveTarget tests. | save.spec native Excel/CSV export. |

## Recovery and session (REC)

| ID | Evidence | Test / procedure | Notes |
| --- | --- | --- | --- |
| REC-01 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | recovery.spec edit/snapshot; store 500 ms coalescing. |
| REC-02 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | Covered by the cited suite/code check. |
| REC-03 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | recovery.spec auto Recover prompt. |
| REC-04 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | recovery.spec clean reopen. |
| REC-05 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | recovery.spec recovered title/dirty/path. |
| REC-06 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | recovery.spec auto Discard opens last. |
| REC-07 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | recovery.spec explicit banner + precedence. |
| REC-08 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | recovery.spec explicit+recovery no auto-overwrite. |
| REC-09 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | before-quit flush + markCleanExit tests. |
| REC-10 | unverified-environment | tests/e2e/recovery.spec.ts; desktopStateStore tests. | >100 MB snapshot not exercised (memory-heavy); manual probe. |
| REC-11 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | desktopStateStore legacy import test + App handler. |
| REC-12 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | Covered by the cited suite/code check. |
| REC-13 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | desktopStateStore corrupt-recovery deletion test. |
| REC-14 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | Covered by the cited suite/code check. |
| REC-15 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | recovery.spec missing path status + stale recent removal. |
| REC-16 | automated-pass | tests/e2e/recovery.spec.ts; desktopStateStore tests. | useDesktopRecovery error test; status message. |

## Recent files (MRU)

| ID | Evidence | Test / procedure | Notes |
| --- | --- | --- | --- |
| MRU-01 | automated-pass | desktopStateStore/useMRU tests; menu E2E. | desktopStateStore recents cap/key tests. |
| MRU-02 | automated-pass | desktopStateStore/useMRU tests; menu E2E. | upsertRecent tests + open/save E2E. |
| MRU-03 | automated-pass | desktopStateStore/useMRU tests; menu E2E. | main recents list -> native menu; useMRU tests. |
| MRU-04 | unverified-environment | desktopStateStore/useMRU tests; menu E2E. | Missing-recent Remove/Locate/Keep native dialog; manual probe. |
| MRU-05 | unverified-environment | desktopStateStore/useMRU tests; menu E2E. | Remove/clear parity is code/store tested; native/in-app immediate parity manual. |
| MRU-06 | automated-pass | desktopStateStore/useMRU tests; menu E2E. | RecentEntry schema holds paths/metadata only. |
| MRU-07 | automated-pass | desktopStateStore/useMRU tests; menu E2E. | useMRU web tests unchanged. |

## Native menu and shortcuts (MENU)

| ID | Evidence | Test / procedure | Notes |
| --- | --- | --- | --- |
| MENU-01 | automated-pass | tests/e2e/menu.spec.ts; shortcutOwner tests. | menu.spec structure test. |
| MENU-02 | automated-pass | tests/e2e/menu.spec.ts; shortcutOwner tests. | menu.spec Save/About; action table in App. |
| MENU-03 | automated-pass | tests/e2e/menu.spec.ts; shortcutOwner tests. | menu.spec accelerators + shortcutOwner list. |
| MENU-04 | automated-pass | tests/e2e/menu.spec.ts; shortcutOwner tests. | shortcutOwner test enumerates all; renderer ignores/forwards. |
| MENU-05 | automated-pass | tests/e2e/menu.spec.ts; shortcutOwner tests. | menu.spec enable-state assertion. |
| MENU-06 | automated-pass | tests/e2e/menu.spec.ts; shortcutOwner tests. | menu.spec close Cancel/Don’t Save/Save. |
| MENU-07 | automated-pass | tests/e2e/menu.spec.ts; shortcutOwner tests. | validated openExternal; SimpleDocs adapter. |
| MENU-08 | automated-pass | tests/e2e/menu.spec.ts; shortcutOwner tests. | existing MenuBar tests + full suite. |
| MENU-09 | automated-pass | tests/e2e/menu.spec.ts; shortcutOwner tests. | dirty guards for new/open/import/close. |
| MENU-10 | automated-pass | tests/e2e/menu.spec.ts; shortcutOwner tests. | menu.spec menu-after-modal test. |

## Import, export, and sharing (IO)

| ID | Evidence | Test / procedure | Notes |
| --- | --- | --- | --- |
| IO-01 | automated-pass | save/export E2E; native Share File test; web export tests. | save.spec Excel/CSV native export; JSON handler. |
| IO-02 | unverified-environment | save/export E2E; native Share File test; web export tests. | PDF native-dialog export not E2E; PDF generator tests + manual. |
| IO-03 | unverified-environment | save/export E2E; native Share File test; web export tests. | Native Import menu to Import Scope not E2E; CSV scope automated. |
| IO-04 | automated-pass | save/export E2E; native Share File test; web export tests. | exports do not change path/title/clean state. |
| IO-05 | unverified-environment | save/export E2E; native Share File test; web export tests. | Copy Link base is code-verified; clipboard assertion manual. |
| IO-06 | automated-pass | save/export E2E; native Share File test; web export tests. | PDF generator consumes current sheet/workbook. |
| IO-07 | automated-pass | save/export E2E; native Share File test; web export tests. | existing web export tests. |
| IO-08 | unverified-environment | save/export E2E; native Share File test; web export tests. | Export cancel/failure paths not all E2E. |
| IO-09 | unverified-environment | save/export E2E; native Share File test; web export tests. | No URL protocol is registered; browser shared-link behavior manual. |
| IO-10 | unverified-environment | save/export E2E; native Share File test; web export tests. | Cloud entry point hidden on desktop; in-app/native parity manual. |
| IO-11 | automated-pass | save/export E2E; native Share File test; web export tests. | menu.spec native Share File writes a copy. |

## Packaging and Windows integration (PKG)

| ID | Evidence | Test / procedure | Notes |
| --- | --- | --- | --- |
| PKG-01 | automated-pass | electron-builder.yml; M5-EVIDENCE.md; release artifacts. | electron-builder.yml identity + artifact names. |
| PKG-02 | unverified-environment | electron-builder.yml; M5-EVIDENCE.md; release artifacts. | Upgrade-in-place unverified; builder output automated. |
| PKG-03 | unverified-environment | electron-builder.yml; M5-EVIDENCE.md; release artifacts. | Edition detection unit-tested; real portable-wrapper launch unverified. |
| PKG-04 | unverified-environment | electron-builder.yml; M5-EVIDENCE.md; release artifacts. | Association config inspected; installer/registry unverified. |
| PKG-05 | automated-pass | electron-builder.yml; M5-EVIDENCE.md; release artifacts. | About/README unsigned/SmartScreen text. |
| PKG-06 | automated-pass | electron-builder.yml; M5-EVIDENCE.md; release artifacts. | no updater dependency/config. |
| PKG-07 | automated-pass | electron-builder.yml; M5-EVIDENCE.md; release artifacts. | ICO 16-256 + 512 PNG inspected. |
| PKG-08 | automated-pass | electron-builder.yml; M5-EVIDENCE.md; release artifacts. | release/ gitignored; no binaries tracked. |
| PKG-09 | automated-pass | electron-builder.yml; M5-EVIDENCE.md; release artifacts. | ASAR enabled; packaged smoke loads. |
| PKG-10 | unverified-environment | electron-builder.yml; M5-EVIDENCE.md; release artifacts. | Uninstall association/data behavior unverified; checklist provided. |
| PKG-11 | unverified-environment | electron-builder.yml; M5-EVIDENCE.md; release artifacts. | Clean npm ci not run in this tree; lockfile/build procedure documented. |
| PKG-12 | automated-pass | electron-builder.yml; M5-EVIDENCE.md; release artifacts. | no publish/CI release configuration added. |
| PKG-13 | unverified-environment | electron-builder.yml; M5-EVIDENCE.md; release artifacts. | Installer execution requires explicit approval; not run. |

## About and diagnostics (ABT)

| ID | Evidence | Test / procedure | Notes |
| --- | --- | --- | --- |
| ABT-01 | automated-pass | AboutModal tests/E2E; app:reset-data unit. | About E2E edition; version/build tests. |
| ABT-02 | unverified-environment | AboutModal tests/E2E; app:reset-data unit. | Runtime version rows code-verified; manual About inspection recommended. |
| ABT-03 | unverified-environment | AboutModal tests/E2E; app:reset-data unit. | Open Data Folder not automated; manual checklist. |
| ABT-04 | unverified-environment | AboutModal tests/E2E; app:reset-data unit. | Copy Diagnostics content code-verified; clipboard assertion manual. |
| ABT-05 | automated-pass | AboutModal tests/E2E; app:reset-data unit. | About MIT + library notices tests. |
| ABT-06 | automated-pass | AboutModal tests/E2E; app:reset-data unit. | no update controls in About/MenuBar. |
| ABT-07 | unverified-environment | AboutModal tests/E2E; app:reset-data unit. | Main reset unit-tested; About button/confirmation manual. |

## Security and privacy (SEC)

| ID | Evidence | Test / procedure | Notes |
| --- | --- | --- | --- |
| SEC-01 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | BrowserWindow security flags in main. |
| SEC-02 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | frozen contextBridge bridge; preload audit. |
| SEC-03 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | top-level-frame + trusted-origin checks. |
| SEC-04 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | strict payload validation + security E2E. |
| SEC-05 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | canonical write allowlist + symlink/traversal E2E. |
| SEC-06 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | open:recent allowlist test; preload path policy. |
| SEC-07 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | packaged CSP header + no console violations. |
| SEC-08 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | window.open denial; navigation/redirect guards. |
| SEC-09 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | packaged geolocation denial. |
| SEC-10 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | assetPath tests + packaged traversal. |
| SEC-11 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | packaged menu has no Reload; devTools false. |
| SEC-12 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | packaged 30 s idle log empty. |
| SEC-13 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | workbook stays local; About states storage. |
| SEC-14 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | stubbed dialogs + SIMPLESHEETS_E2E documented. |
| SEC-15 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | grep: showItemInFolder only shell path operation. |
| SEC-16 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | SimpleDocs/Help via adapter; web window.open unchanged. |
| SEC-17 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | packaged CSP + existing export tests; no unsafe-eval. |
| SEC-18 | automated-pass | security.spec.ts; packaged smoke; path/origin tests. | realpath write keys + symlink E2E. |

## Performance (PERF)

| ID | Evidence | Test / procedure | Notes |
| --- | --- | --- | --- |
| PERF-01 | automated-pass | tests/e2e/performance.spec.ts; M7-PERF.md. | performance.spec cold start <3 s. |
| PERF-02 | automated-pass | tests/e2e/performance.spec.ts; M7-PERF.md. | performance.spec large open/nav; ~3.0 s measured. |
| PERF-03 | automated-pass | tests/e2e/performance.spec.ts; M7-PERF.md. | performance.spec large save <2 s; ~237 ms. |
| PERF-04 | automated-pass | tests/e2e/performance.spec.ts; M7-PERF.md. | performance.spec 20 open cycles, CDP GC <20%. |
| PERF-05 | automated-pass | tests/e2e/performance.spec.ts; M7-PERF.md. | main recovery timer coalesces at 500 ms. |
| PERF-06 | unverified-environment | tests/e2e/performance.spec.ts; M7-PERF.md. | Heap measured; listener/object-URL counts code-reviewed, not instrumented. |
| PERF-07 | automated-pass | tests/e2e/performance.spec.ts; M7-PERF.md. | 109 MB installer / 99 MB portable / 312 MB unpacked. |
| PERF-08 | automated-pass | tests/e2e/performance.spec.ts; M7-PERF.md. | performance.spec working set <1.5 GB. |
| PERF-09 | automated-pass | tests/e2e/performance.spec.ts; M7-PERF.md. | M7-PERF.md + DECISIONS section 14. |

## Failed requirements

None. Remaining gaps are `unverified-environment` and listed below.

## Manual checklist

Use `docs/desktop/INSTALL-CHECKLIST.md` for installer/association/portable/
clean-machine checks, plus:

- Windows display scaling at 100%, 125%, and 150% (APP-14).
- OS shutdown/logoff recovery behavior (APP-11).
- Same-file clean/dirty reload (OPEN-11).
- Actual Windows share-lock retry (SAVE-06).
- >100 MB recovery skip (REC-10).
- Missing-recent Remove/Locate/Keep and native/in-app parity (MRU-04/05).
- PDF native export, native Import menu, Copy Link clipboard, export cancel/failure (IO-02/03/05/08/09/10).
- About runtime versions, Open Data Folder, Copy Diagnostics, Reset (ABT-02/03/04/07).
- Clean `npm ci` build reproducibility (PKG-11).
