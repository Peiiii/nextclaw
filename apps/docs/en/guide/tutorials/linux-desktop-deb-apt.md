# Linux Desktop Install (.deb + APT)

This guide is for Debian, Ubuntu, and other Linux distributions that use `apt`.

The goal is simple: install NextClaw Desktop once, then upgrade and remove it through the system package manager.

Recommended one-line installer:

```bash
curl -fsSL https://peiiii.github.io/nextclaw/install-apt.sh | bash
```

If you prefer to inspect each step manually, follow the setup below.

## 1. Add the NextClaw APT repository manually

Import the NextClaw repository public key:

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://peiiii.github.io/nextclaw/apt/nextclaw-archive-keyring.gpg \
  | sudo tee /etc/apt/keyrings/nextclaw-archive-keyring.gpg >/dev/null
```

Then add the repository:

```bash
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/nextclaw-archive-keyring.gpg] https://peiiii.github.io/nextclaw/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/nextclaw.list >/dev/null
```

## 2. Install the desktop app

```bash
sudo apt update
sudo apt install nextclaw-desktop
```

After installation, launch `NextClaw Desktop` from your application menu.

## 3. How upgrades work

You do not need to manually re-download the `.deb` each time. Upgrades go through the system package manager:

```bash
sudo apt update
sudo apt upgrade
```

To inspect the installed version and the current repository candidate:

```bash
apt policy nextclaw-desktop
```

When `Candidate` is newer than `Installed`, `apt upgrade` will update it.

## 4. How to uninstall

Remove the app only:

```bash
sudo apt remove nextclaw-desktop
```

Remove the app and package-managed config:

```bash
sudo apt purge nextclaw-desktop
sudo apt autoremove
```

If you also want to stop receiving updates from the NextClaw repository, remove the source and key:

```bash
sudo rm -f /etc/apt/sources.list.d/nextclaw.list
sudo rm -f /etc/apt/keyrings/nextclaw-archive-keyring.gpg
sudo apt update
```

## 5. Optional: remove local user data

System package removal does not automatically delete your user-level app data. To remove everything:

```bash
rm -rf ~/.config/"NextClaw Desktop"
rm -rf ~/.cache/"NextClaw Desktop"
rm -rf ~/.local/share/"NextClaw Desktop"
```

## 6. Common questions

### I already installed a downloaded `.deb`. Can I still use `apt upgrade` later?

Yes, as long as you add the NextClaw APT repository to your system and the package name remains `nextclaw-desktop`.

### Why not use an in-app updater on Linux?

On Linux, NextClaw follows the native system path and lets the distribution package manager handle upgrades. It is more predictable and better aligned with Linux user expectations.
