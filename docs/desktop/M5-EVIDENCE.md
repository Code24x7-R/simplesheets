# M5 — Packaging and Windows Integration Evidence

Date: 2026-11-07  
Host: Windows `10.0.26300` x64  
Electron: `45.2.3`  
electron-builder: `26.18.0`

## Build command

```bash
npm run electron:build
```

The full build ran successfully:

- NSIS: `building target=nsis ... oneClick=false perMachine=false`
- Portable: `building target=portable ... archs=x64`
- Signing: skipped — no certificate configured.
- ASAR enabled by `electron-builder.yml`.

## Artifacts

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `release/SimpleSheets-Setup-0.1.0.exe` | ~109 MB | `450748488b7d174ad67b16ff7b442be4e523f456731ba67686477bcad6302e4b` |
| `release/SimpleSheets-Portable-0.1.0.exe` | ~99 MB | `1f1d2b2af8128fba4d0df572940e1d1d528352f75d07952ef7c94e4a8173de95` |
| `release/SimpleSheets-Setup-0.1.0.exe.blockmap` | 117 KB | generated |

Artifacts are under the git-ignored `release/` directory. No binaries are
committed.

## Association configuration

`electron-builder.yml`:

```yaml
fileAssociations:
  - ext: ssjson
    name: SimpleSheets Document
    description: SimpleSheets spreadsheet document
    role: Editor
    icon: build/icon.ico
```

Generated NSIS installer script (from `builder-debug.yml`) contains exactly one
association:

```nsis
!insertmacro APP_ASSOCIATE "ssjson" "SimpleSheets Document" "SimpleSheets spreadsheet document" \
  "$INSTDIR\resources\icon.ico" "Open with SimpleSheets" "$appExe $\"%1$\""
```

The macro writes `HKCU\Software\Classes\.ssjson` and the
`SimpleSheets Document` ProgID under the per-user shell context. It never writes
Windows' `UserChoice` hash, so Windows remains in control of the default
handler.

## Portable build

Generated portable NSIS script contains:

```nsis
System::Call 'Kernel32::SetEnvironmentVariable(t, t)i ("PORTABLE_EXECUTABLE_DIR", "$EXEDIR").r0'
```

and contains **no** `APP_ASSOCIATE` macro. `resolveEdition()` maps
`PORTABLE_EXECUTABLE_DIR` to `portable`; About displays the portable folder.

## Icons

- `build/icon.ico`: 16, 24, 32, 48, 64, 128, 256 px.
- `build/icon.png`: 512×512.

## Installer settings

- `perMachine: false` — per-user install, no elevation.
- `oneClick: false`, `allowToChangeInstallationDirectory: true` — assisted.
- `deleteAppDataOnUninstall: false` — preserves `%APPDATA%\SimpleSheets`.
- Desktop and Start Menu shortcuts enabled.
- Portable target has no association registration.

## Unverified-environment

No installer was run and no registry/file association was changed on this
machine. The following remain manual, per `INSTALL-CHECKLIST.md`:

- install/uninstall and upgrade in place;
- `.ssjson` double-click / "Open with" behavior;
- association removal and reinstall;
- portable launch and edition detection in the real portable wrapper;
- SmartScreen and antivirus behavior on a clean machine;
- Windows 11 "Open with" presentation.

## Checks run

| Check | Result |
| --- | --- |
| `npm run electron:build` | pass; NSIS + portable produced |
| NSIS script association inspection | one `APP_ASSOCIATE` for `ssjson` |
| Portable script inspection | `PORTABLE_EXECUTABLE_DIR` present; no association |
| Icon inspection | 16–256 ICO + 512 PNG |
| `npm run electron:build:dir` + packaged smoke | pass |
| `npm run verify` | 214 suites / 4,653 passed / 1 skipped |
| `npm run verify:e2e` | 34 tests passed |
