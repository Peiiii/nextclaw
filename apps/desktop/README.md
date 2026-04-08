# @nextclaw/desktop

Electron desktop shell for NextClaw.

## Scripts

- `pnpm -C apps/desktop dev`: build desktop main/preload and run Electron.
- `pnpm -C apps/desktop build`: build desktop runtime bundle (`dist/`).
- `pnpm -C apps/desktop dist`: build desktop artifacts with electron-builder.
- `pnpm -C apps/desktop smoke`: run non-GUI runtime smoke test.

## Notes

- `build:main` uses `tsc` emit (no bundling). This avoids bundling Electron's runtime loader into `dist/main.js`.
- `dev` will auto-check `nextclaw/dist`. If missing, it auto-runs `pnpm -C packages/nextclaw build`.
- `pack` / `dist` will auto-ensure `nextclaw-ui` + `nextclaw` runtime artifacts before packaging.
- If you see `Electron failed to install correctly`, first run:
  - `PATH=/opt/homebrew/bin:$PATH pnpm install`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop build`
  - then retry `PATH=/opt/homebrew/bin:$PATH pnpm dev:desktop`

## Release Modes

### 1) Validate before release

Run all checks from repo root:

- `PATH=/opt/homebrew/bin:$PATH pnpm build`
- `PATH=/opt/homebrew/bin:$PATH pnpm lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop smoke`

Optional runtime smoke:

- `PATH=/opt/homebrew/bin:$PATH pnpm dev:desktop`

Expected startup logs include:

- `Channels enabled: ...`
- `UI API: http://0.0.0.0:<port>/api`
- `UI frontend: http://0.0.0.0:<port>`

### 2) Build desktop artifacts

macOS unsigned (current default in CI):

- `PATH=/opt/homebrew/bin:$PATH CSC_IDENTITY_AUTO_DISCOVERY=false pnpm -C apps/desktop dist -- --mac dmg zip --publish never`

macOS signed/notarized (optional):

- same command as above, but provide signing/notarization credentials in environment.

Windows (unpacked EXE directory, no publish):

- `PATH=/opt/homebrew/bin:$PATH CSC_IDENTITY_AUTO_DISCOVERY=false pnpm -C apps/desktop exec electron-builder --win dir --x64 --publish never`

Linux (`AppImage` + `.deb`, no publish):

- `PATH=/opt/homebrew/bin:$PATH CSC_IDENTITY_AUTO_DISCOVERY=false pnpm -C apps/desktop exec electron-builder --linux AppImage deb --x64 --publish never`

### 3) Artifacts to upload

All artifacts are under `apps/desktop/release`:

- `NextClaw Desktop-<version>-arm64.dmg`
- `NextClaw Desktop-<version>-arm64-mac.zip`
- `NextClaw Desktop-<version>-x64.dmg`
- `NextClaw Desktop-<version>-x64-mac.zip`
- `win-unpacked/NextClaw Desktop.exe`
- `NextClaw.Desktop-<version>-linux-x64.AppImage`
- `nextclaw-desktop_<version>_amd64.deb`

### 4) Linux package lifecycle

APT repository dry-run from repo root:

- `PATH=/opt/homebrew/bin:$PATH pnpm desktop:apt:build`
- `PATH=/opt/homebrew/bin:$PATH pnpm desktop:apt:verify`

Expected generated repository root:

- `dist/linux-apt-repo/apt`
- `dist/linux-apt-repo/apt/dists/stable/...`
- `dist/linux-apt-repo/apt/pool/main/n/nextclaw-desktop/...`

Recommended one-line installer:

```bash
curl -fsSL https://peiiii.github.io/nextclaw/install-apt.sh | bash
```

Manual install flow after GitHub Pages publish:

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://peiiii.github.io/nextclaw/apt/nextclaw-archive-keyring.gpg \
  | sudo tee /etc/apt/keyrings/nextclaw-archive-keyring.gpg >/dev/null

echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/nextclaw-archive-keyring.gpg] https://peiiii.github.io/nextclaw/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/nextclaw.list >/dev/null

sudo apt update
sudo apt install nextclaw-desktop
```

Expected upgrade / uninstall flow:

```bash
sudo apt update
sudo apt upgrade
sudo apt remove nextclaw-desktop
sudo apt purge nextclaw-desktop
```

### 5) Optional macOS signing credentials

- `CSC_LINK`, `CSC_KEY_PASSWORD` for Developer ID Application certificate.
- `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_API_KEY` for notarization.
- If missing, release can still proceed in unsigned mode.
