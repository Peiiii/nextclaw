# NextClaw Linux DEB And APT Repo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the NextClaw Linux desktop as a signed `.deb` published through a GitHub Pages APT repository so Debian/Ubuntu users can install once, then upgrade through `apt update && apt upgrade`.

**Architecture:** Reuse the existing Electron desktop release pipeline as the single source of desktop artifacts. Extend Linux packaging from `AppImage`-only to `AppImage + deb`, then generate a static APT repository (`pool/` + `dists/stable/...`) from the release `.deb`, sign the repository metadata with a dedicated GPG key stored in GitHub Actions secrets, and publish the resulting static files to GitHub Pages. Human-facing release downloads stay on GitHub Releases; machine-facing package metadata stays on GitHub Pages.

**Tech Stack:** Electron Builder, GitHub Actions, GitHub Releases, GitHub Pages, `dpkg-scanpackages`, `apt-ftparchive`, GPG, Ubuntu/Debian smoke tests, Docker

---

## Scope Lock

- Only Linux desktop distribution is in scope.
- `brew install` and all macOS packaging work are out of scope.
- Keep the current Linux `AppImage`; add `.deb`, do not replace `AppImage`.
- The package manager target is Debian/Ubuntu first: `apt install`, `apt upgrade`, `apt remove/purge`.
- Linux in-app self-updater is out of scope. System package management is the upgrade path.

## Decision Summary

### Phase 1

- Extend CI and release packaging so Linux builds produce:
  - `NextClaw.Desktop-<version>-linux-x64.AppImage`
  - `nextclaw-desktop_<version>_amd64.deb`

### Phase 2

- Publish the Linux `.deb` into a signed APT repository hosted on GitHub Pages.
- Keep GitHub Releases as the human-facing download surface.
- Users add the NextClaw APT source once, then future upgrades happen through:

```bash
sudo apt update
sudo apt upgrade
```

## Long-Term Alignment / Maintainability

- This plan moves NextClaw closer to the product vision of being a natural default entry point by letting Linux users install and upgrade it through native system mechanisms instead of a custom updater path.
- The plan deliberately avoids building a Linux-specific self-update subsystem inside the app. That keeps the product surface smaller and reuses the operating system's package lifecycle rather than competing with it.
- Code growth stays constrained by reusing the existing `electron-builder` release flow, adding only the minimum new pieces required for APT publishing:
  - one Linux packaging expansion
  - one APT repository build/sign script
  - one release publishing path
  - one Debian/Ubuntu smoke path
- The main simplification choice is to keep release artifacts and APT metadata separate instead of inventing a hybrid distribution path. GitHub Releases remain for people; GitHub Pages remains for `apt`.

## User-Facing Lifecycle

### Install

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://peiiii.github.io/nextbot/apt/nextclaw-archive-keyring.gpg \
  | sudo tee /etc/apt/keyrings/nextclaw-archive-keyring.gpg >/dev/null

echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/nextclaw-archive-keyring.gpg] https://peiiii.github.io/nextbot/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/nextclaw.list >/dev/null

sudo apt update
sudo apt install nextclaw-desktop
```

### Upgrade

```bash
sudo apt update
sudo apt upgrade
```

### Uninstall

```bash
sudo apt remove nextclaw-desktop
```

Full removal:

```bash
sudo apt purge nextclaw-desktop
sudo rm -f /etc/apt/sources.list.d/nextclaw.list
sudo rm -f /etc/apt/keyrings/nextclaw-archive-keyring.gpg
sudo apt update
```

Optional user-data cleanup:

```bash
rm -rf ~/.config/"NextClaw Desktop"
rm -rf ~/.cache/"NextClaw Desktop"
rm -rf ~/.local/share/"NextClaw Desktop"
```

## How `apt upgrade` Actually Updates NextClaw

This is the mechanism we are implementing and validating:

1. The user installs `nextclaw-desktop` from the NextClaw APT source.
2. APT records the installed package name and version locally, for example:
   - package: `nextclaw-desktop`
   - installed version: `0.0.130`
3. We publish a newer `.deb` with the same package name and a higher Debian-comparable version, for example `0.0.131`.
4. We regenerate and republish the APT repository metadata:
   - `Packages`
   - `Packages.gz`
   - `Release`
   - `InRelease`
   - `Release.gpg`
5. The user runs `sudo apt update`.
6. APT downloads the updated repository metadata and computes the new candidate version for `nextclaw-desktop`.
7. The user runs `sudo apt upgrade`.
8. APT sees that:
   - `Installed < Candidate`
   - package dependencies can be satisfied
9. APT downloads the new `.deb`, verifies repository signatures and checksums, then calls `dpkg` to install the newer package over the old one.

Operationally, the critical requirements are:

- the package name must stay stable: `nextclaw-desktop`
- the version must monotonically increase
- the package must be listed in the signed APT metadata
- the user must have the NextClaw source configured in `sources.list.d`

The best local inspection command for debugging the upgrade path is:

```bash
apt policy nextclaw-desktop
```

If `Candidate` is newer than `Installed`, `apt upgrade` can upgrade it.

## Repository Shape

The published GitHub Pages directory should look like this:

```text
apt/
  nextclaw-archive-keyring.gpg
  dists/
    stable/
      InRelease
      Release
      Release.gpg
      main/
        binary-amd64/
          Packages
          Packages.gz
  pool/
    main/
      n/
        nextclaw-desktop/
          nextclaw-desktop_0.0.130_amd64.deb
          nextclaw-desktop_0.0.131_amd64.deb
```

The repository may retain historical `.deb` files in `pool/`, but only the latest package version needs to be installable through the default `stable` channel.

## GitHub Secrets And Trust Model

Add release-time secrets:

- `NEXTCLAW_APT_GPG_PRIVATE_KEY`
  - ASCII-armored private key for signing repository metadata
- `NEXTCLAW_APT_GPG_PASSPHRASE`
  - passphrase for the signing key
- `NEXTCLAW_APT_GPG_KEY_ID`
  - fingerprint or key id used by the signing step

Public artifact to publish with the repo:

- `nextclaw-archive-keyring.gpg`
  - dearmored public key file downloaded by users into `/etc/apt/keyrings`

Do not use a developer personal desktop signing key. Use a dedicated repository-signing key with a clear name and rotation procedure.

## Implementation Tasks

### Task 1: Lock the Linux package contract

**Files:**
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/README.md`
- Modify: `docs/plans/2026-04-08-linux-deb-and-apt-repo-implementation-plan.md`

**Step 1: Freeze package naming**

- Debian package name: `nextclaw-desktop`
- Distribution channel: `stable`
- Component: `main`
- Architecture: `amd64`

**Step 2: Freeze versioning expectations**

- Stable releases use normal semver-like Debian-safe versions such as `0.0.130`
- Pre-release channels, if added later, must use Debian ordering-safe versions such as `0.0.131~beta.1`
- Do not rely on ad-hoc GitHub tag parsing for Debian version semantics

**Step 3: Freeze install/upgrade/uninstall docs**

- document the first-install commands
- document `apt update && apt upgrade`
- document `apt remove`, `apt purge`, and user-data cleanup

### Task 2: Make desktop Linux packaging emit `.deb`

**Files:**
- Modify: `apps/desktop/package.json`
- Modify: `scripts/desktop-package-build.mjs`
- Modify: `.github/workflows/desktop-validate.yml`
- Modify: `.github/workflows/desktop-release.yml`

**Step 1: Extend electron-builder Linux target**

- change Linux target from `AppImage`-only to `AppImage + deb`
- set explicit Debian package metadata under the Linux build config
- keep the existing `AppImage` output unchanged

**Step 2: Normalize Linux artifact naming**

- normalize `.deb` to a predictable name such as `nextclaw-desktop_<version>_amd64.deb`
- keep the existing normalized AppImage naming
- ensure release upload globs include the `.deb`

**Step 3: Expand local packaging helper**

- make `scripts/desktop-package-build.mjs` build both Linux outputs
- print both `.deb` and `AppImage` artifacts on Linux runs

**Step 4: Extend validation workflow**

- Linux validation must build both outputs
- artifact upload must include `.deb`
- Linux validation must fail if the `.deb` is missing

### Task 3: Add Debian package smoke coverage

**Files:**
- Create: `apps/desktop/scripts/smoke-linux-deb.sh`
- Modify: `.github/workflows/desktop-validate.yml`
- Modify: `.github/workflows/desktop-release.yml`

**Step 1: Add local `.deb` install smoke**

- use an Ubuntu container instead of mutating the GitHub runner host
- mount the generated `.deb` into the container
- run:

```bash
apt-get update
apt-get install -y ./nextclaw-desktop_<version>_amd64.deb
dpkg -s nextclaw-desktop
apt-get remove -y nextclaw-desktop
```

**Step 2: Verify package metadata**

- assert package name is `nextclaw-desktop`
- assert package version matches the release version
- assert the package registers cleanly in `dpkg`

**Step 3: Keep smoke scope minimal**

- do not try to launch a full GUI session in the Debian smoke step
- validate package install/remove semantics, not desktop rendering

### Task 4: Build a static APT repository generator

**Files:**
- Create: `scripts/build-linux-apt-repo.mjs`
- Create: `scripts/export-linux-apt-public-key.mjs`
- Modify: `package.json`

**Step 1: Build the repository from one or more `.deb` files**

- input: one or more Linux `.deb` artifacts
- output root: temporary `dist/linux-apt-repo/apt`
- place packages under:
  - `apt/pool/main/n/nextclaw-desktop/`
- generate:
  - `Packages`
  - `Packages.gz`
  - `Release`

**Step 2: Sign the repository**

- import the armored private key from GitHub Actions secrets into a temporary GPG home
- generate:
  - `InRelease`
  - `Release.gpg`
- export a dearmored public key as:
  - `apt/nextclaw-archive-keyring.gpg`

**Step 3: Keep the script predictable**

- fail fast if required system tools are missing:
  - `dpkg-scanpackages`
  - `apt-ftparchive`
  - `gpg`
- do not fall back to alternate tooling silently
- print the final repository tree and package versions included

**Step 4: Add root-level scripts**

- add `desktop:apt:build` for local dry-run generation
- add `desktop:apt:verify` for local metadata verification

### Task 5: Publish the APT repository to GitHub Pages

**Files:**
- Modify: `.github/workflows/desktop-release.yml`
- Create: `.github/workflows/desktop-apt-pages-smoke.yml` only if the release workflow becomes too crowded

**Step 1: Reuse the existing desktop release workflow by default**

- prefer extending `.github/workflows/desktop-release.yml` instead of creating a parallel release workflow
- keep one Linux release path that:
  - builds Linux artifacts
  - uploads release assets
  - updates the APT repository

**Step 2: Preserve prior pool contents**

- fetch the existing `gh-pages` branch contents into a temp workspace
- copy forward any existing `apt/pool/...` packages that should remain
- add the new `.deb`
- regenerate the repository metadata from the full package set that should remain published

**Step 3: Deploy to GitHub Pages**

- publish the complete `apt/` tree to the `gh-pages` branch
- do not publish only deltas; regenerate the full current repository tree every time

**Step 4: Keep human and machine distribution separate**

- GitHub Release assets keep:
  - `.deb`
  - `AppImage`
  - related checksums/blockmaps where applicable
- GitHub Pages keeps:
  - APT metadata
  - public keyring
  - `.deb` files under `pool/`

### Task 6: Add APT install and upgrade smoke validation

**Files:**
- Create: `apps/desktop/scripts/smoke-linux-apt-repo.sh`
- Modify: `.github/workflows/desktop-release.yml`

**Step 1: Validate fresh install from the generated APT repo**

- spin up an Ubuntu container
- serve the generated `apt/` directory through a local HTTP server or use a mounted `file:` source
- add the NextClaw source inside the container
- run:

```bash
apt-get update
apt-cache policy nextclaw-desktop
apt-get install -y nextclaw-desktop
dpkg -s nextclaw-desktop
```

**Step 2: Validate uninstall semantics**

- run:

```bash
apt-get remove -y nextclaw-desktop
apt-get purge -y nextclaw-desktop
```

**Step 3: Validate upgrade semantics with two package versions**

- keep a dedicated release-smoke path that stages:
  - an older package version in the temp APT repo
  - then a newer package version
- in the container:

```bash
apt-get update
apt-get install -y nextclaw-desktop=<older-version>
apt-get update
apt-cache policy nextclaw-desktop
apt-get upgrade -y
dpkg -s nextclaw-desktop
```

- assert the installed version after upgrade matches the newer candidate version

**Step 4: Scope the upgrade smoke correctly**

- it is acceptable for the first version of this smoke to run only on release-tag workflows
- PR validation may stop at:
  - build `.deb`
  - install local `.deb`
  - install from a generated unsigned temp repo

### Task 7: Document the Linux package lifecycle

**Files:**
- Modify: `apps/desktop/README.md`
- Modify: `apps/docs/zh/guide/desktop.md` if this guide exists; otherwise create the closest Linux installation guide
- Modify: `apps/docs/en/guide/desktop.md` if this guide exists; otherwise create the closest Linux installation guide

**Step 1: Add first-install instructions**

- add the keyring command
- add the `sources.list.d` command
- add `apt install nextclaw-desktop`

**Step 2: Add upgrade instructions**

- explain that Linux upgrades happen through `apt update && apt upgrade`
- explain how to inspect versions with `apt policy nextclaw-desktop`

**Step 3: Add uninstall instructions**

- `apt remove`
- `apt purge`
- optional removal of the APT source and keyring
- optional user-data cleanup

### Task 8: Run release-grade verification

**Files:**
- Modify: `apps/desktop/README.md` if commands or artifact names differ from expectation
- Modify: `docs/logs/<latest-related-iteration>/README.md` if this work becomes implementation, not planning-only

**Step 1: Validate affected code paths**

- `pnpm -C apps/desktop lint`
- `pnpm -C apps/desktop tsc`
- `pnpm build:desktop` if packaging config changes require full rebuild confidence
- `pnpm lint:maintainability:guard`

**Step 2: Validate packaging outputs**

- local or CI check that Linux build emits:
  - one `.deb`
  - one `AppImage`

**Step 3: Validate repository metadata**

- verify that `Packages.gz`, `Release`, `InRelease`, and `Release.gpg` exist
- verify that `apt-cache policy nextclaw-desktop` sees the expected candidate version in smoke

**Step 4: Validate the install/upgrade/remove lifecycle**

- fresh install from the generated APT repo
- upgrade from an older package to a newer one
- remove and purge paths

## Risks And Mitigations

### 1. Debian version ordering mistakes

- Risk: a human-friendly release tag might not compare correctly in APT
- Mitigation: keep Debian package versions explicit and ordering-safe; add upgrade smoke with two versions

### 2. GitHub Pages deployment replaces prior repo contents

- Risk: publishing only the new package could accidentally delete the existing `pool/`
- Mitigation: the publish job must first fetch the current `gh-pages` contents, merge, then regenerate and redeploy the full repository tree

### 3. GPG secrets complexity

- Risk: signing fails or the public key export drifts from the actual signing key
- Mitigation: use one dedicated repository-signing key, export the public key from the same imported key material during the publish job, and smoke-test `apt update`

### 4. Overbuilding the release system

- Risk: we add a full package repository platform when we only need one package
- Mitigation: use static APT files plus GitHub Pages, not a heavier repository service

## Acceptance Checklist

- Linux desktop CI emits `.deb` and `AppImage`
- GitHub Release uploads the `.deb`
- GitHub Pages serves a signed APT repo under `/apt`
- Fresh Ubuntu/Debian install works through `apt install nextclaw-desktop`
- `apt policy nextclaw-desktop` shows the expected candidate version
- `apt upgrade` upgrades from an older published version to a newer one
- `apt remove` and `apt purge` behave as documented
- Linux docs explain install, upgrade, and uninstall clearly

## Out Of Scope Follow-Ups

- CLI `brew install`
- Linux RPM repository support
- Linux in-app self-updater
- custom domain/CDN for the APT repository
- unattended background upgrades configuration guidance

