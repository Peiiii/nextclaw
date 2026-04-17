# @nextclaw/desktop

Electron desktop shell for NextClaw.

## Scripts

- `pnpm -C apps/desktop dev`: build desktop main/preload and run Electron.
- `pnpm -C apps/desktop build`: build desktop runtime bundle (`dist/`).
- `pnpm -C apps/desktop dist`: build desktop artifacts with electron-builder.
- `pnpm -C apps/desktop smoke`: run non-GUI runtime smoke test.
- `pnpm -C apps/desktop bundle:public-key -- ...`: derive the bundled desktop update public key from the signing private key.
- `pnpm -C apps/desktop bundle:public-key:ensure`: guarantee `build/update-bundle-public.pem` exists before packaging. If no private key is present locally, it writes the currently published public key instead of leaving the packaged app without a verifier.
- `pnpm -C apps/desktop bundle:build -- ...`: build a launcher-compatible zipped product bundle.
- `pnpm -C apps/desktop bundle:manifest -- ...`: generate a signed desktop update manifest for a product bundle archive.

## Notes

- `build:main` uses `tsc` emit (no bundling). This avoids bundling Electron's runtime loader into `dist/src/main.js`.
- `dev` will auto-check `nextclaw/dist`. If missing, it auto-runs `pnpm -C packages/nextclaw build`, then injects `NEXTCLAW_DESKTOP_RUNTIME_SCRIPT=../../packages/nextclaw/dist/cli/index.js` explicitly.
- `pack` / `dist` will auto-ensure `nextclaw-ui` + `nextclaw` runtime artifacts before packaging.
- `pack` / `dist` now also auto-ensure `build/update-bundle-public.pem`. Do not bypass this by calling raw `electron-builder` unless you have already prepared the bundled update public key yourself.
- If you see `Electron failed to install correctly`, first run:
  - `PATH=/opt/homebrew/bin:$PATH pnpm install`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop build`
  - then retry `PATH=/opt/homebrew/bin:$PATH pnpm dev:desktop`

## Release Modes

### Product Bundle Update Manifest

Build a zipped product bundle from the current `nextclaw` package output:

```bash
pnpm -C apps/desktop bundle:build -- \
  --channel stable \
  --platform linux \
  --arch x64 \
  --version 0.18.0 \
  --output-dir apps/desktop/dist-bundles
```

Normal desktop releases must resolve the minimum launcher version from
[`desktop-launcher-compatibility.json`](./desktop-launcher-compatibility.json).
Do not derive it from the current launcher package version.

The builder currently:

- ensures `packages/nextclaw-ui` + `packages/nextclaw` outputs exist
- uses `pnpm --filter nextclaw --prod deploy` to create a self-contained runtime tree
- copies `ui-dist` into bundle `ui/`
- emits `bundle/manifest.json`
- writes `nextclaw-bundle-<platform>-<arch>-<version>.zip`

Generate a signed manifest for a zipped product bundle:

```bash
pnpm -C apps/desktop bundle:manifest -- \
  --bundle apps/desktop/dist-bundles/nextclaw-bundle-linux-x64-0.18.0.zip \
  --channel stable \
  --platform linux \
  --arch x64 \
  --version 0.18.0 \
  --bundle-url https://example.com/nextclaw-bundle-linux-x64-0.18.0.zip \
  --output apps/desktop/release-manifests/manifest-stable-linux-x64.json \
  --private-key-file /path/to/desktop-bundle-private.pem
```

Equivalent environment variables are also supported for signing:

- `NEXTCLAW_DESKTOP_BUNDLE_PRIVATE_KEY`
- `NEXTCLAW_DESKTOP_BUNDLE_PRIVATE_KEY_FILE`

The generated manifest now includes both:

- `bundleSignature`: signs the downloaded bundle archive
- `manifestSignature`: signs the manifest payload itself

Write the packaged launcher public key file from the same private key:

```bash
pnpm -C apps/desktop bundle:public-key -- \
  --private-key-file /path/to/desktop-bundle-private.pem \
  --output apps/desktop/build/update-bundle-public.pem
```

At runtime the launcher verifies bundle signatures with:

- `NEXTCLAW_DESKTOP_UPDATE_MANIFEST_URL` as an explicit override
- `NEXTCLAW_DESKTOP_BUNDLE_PUBLIC_KEY` as an explicit override
- packaged default manifest URL:
  - `https://github.com/Peiiii/nextclaw/releases/latest/download/manifest-stable-<platform>-<arch>.json`
- packaged default bundled public key:
  - `resources/update/update-bundle-public.pem`

The same public key is used to verify both the manifest signature and the bundle signature.

Desktop runtime sources are now intentionally reduced to only two:

- `bundle`: the packaged launcher runs the active product bundle
- `environment-override`: development or diagnostics can explicitly provide `NEXTCLAW_DESKTOP_RUNTIME_SCRIPT`

### 1) Validate before release

Run all checks from repo root:

- `PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
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

`pnpm desktop:package:verify` is the required guardrail for NextClaw desktop release candidates. It now blocks packages that are missing `resources/update/update-bundle-public.pem` or cannot verify a published manifest signature.

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
- `../dist-bundles/nextclaw-bundle-<platform>-<arch>-<version>.zip`
- `../release-manifests/manifest-stable-<platform>-<arch>.json`
- `../build/update-bundle-public.pem`

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
