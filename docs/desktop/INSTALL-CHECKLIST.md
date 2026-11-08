# SimpleSheets Desktop — Install & Association Manual Checklist

Status: **user-verified on 2026-11-07** for installer execution, per-user
install, upgrade, `.ssjson` association/Open With, uninstall/data preservation,
and portable launch. Keep this checklist for clean-machine/re-verification.

## Artifacts

Build with:

```bash
npm run electron:build
```

Expected in `release/`:

- `SimpleSheets-Setup-0.1.0.exe` — per-user NSIS installer.
- `SimpleSheets-Portable-0.1.0.exe` — portable executable.
- `SimpleSheets-Setup-0.1.0.exe.blockmap`.

Record SHA-256 and size for each artifact in the M5 evidence table.

## Configuration inspection (no install)

- [ ] `electron-builder.yml` has `appId: au.mouseclick.simplesheets`.
- [ ] `productName: SimpleSheets`, `win.icon: build/icon.ico`.
- [ ] `fileAssociations` contains only `ssjson` / `SimpleSheets Document`.
- [ ] NSIS is per-user (`perMachine: false`) and assisted
      (`oneClick: false`).
- [ ] `deleteAppDataOnUninstall: false`.
- [ ] The NSIS template writes `HKCU\Software\Classes\.ssjson` and a
      `SimpleSheets.ssjson` ProgID with an `open` verb and "Open with
      SimpleSheets" label.
- [ ] The portable target does not receive `fileAssociations`.
- [ ] `asar: true` and the packaged smoke test loads the renderer.

## Installer checks (requires approval)

- [ ] Run `SimpleSheets-Setup-0.1.0.exe`; no UAC elevation appears.
- [ ] Install under the per-user location; desktop and Start Menu shortcuts
      exist.
- [ ] `%APPDATA%\SimpleSheets` is created on first run.
- [ ] Right-click a `.ssjson` file → **Open with** lists SimpleSheets.
- [ ] Double-click a `.ssjson` file opens it in the installed app.
- [ ] If another handler was already the default, Windows keeps it until the
      user chooses SimpleSheets; the installer does not silently replace
      `UserChoice`.
- [ ] Launch the installer again over the existing install; it upgrades in
      place, keeps user data, and keeps the association.
- [ ] Launch a second instance with a file; the existing window focuses and
      opens the file.
- [ ] Uninstall removes the app, shortcuts, and the `.ssjson` association.
- [ ] Uninstall preserves `%APPDATA%\SimpleSheets` (recents/recovery remain).
- [ ] Reinstall after uninstall restores the association.

## Portable checks

- [ ] Run `SimpleSheets-Portable-0.1.0.exe` from a writable folder.
- [ ] About shows edition `portable` and the portable folder.
- [ ] No `.ssjson` registry association is created by the portable build.
- [ ] User data still goes to `%APPDATA%\SimpleSheets`.

## Environment checks (clean machine)

- [ ] Install on a machine without Node/Electron/NSIS installed.
- [ ] SmartScreen behavior is recorded (unsigned build).
- [ ] Antivirus does not quarantine the installer or payload.
- [ ] Windows 11 **Open with** presentation is recorded.
- [ ] Association behavior across uninstall/reinstall is recorded.

## Rollback

- Uninstall through **Settings → Apps**.
- Remove `%APPDATA%\SimpleSheets` only if a full data reset is intended.
