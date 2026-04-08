# Linux 桌面安装（.deb + APT）

本教程适用于 Debian / Ubuntu 及兼容 `apt` 的 Linux 发行版。

目标是让你安装一次 NextClaw Desktop，之后通过系统包管理器完成升级与卸载。

推荐的一键安装方式：

```bash
curl -fsSL https://peiiii.github.io/nextclaw/install-apt.sh | bash
```

如果你希望逐步检查每个动作，也可以继续使用下面的手动配置方式。

## 1. 手动添加 NextClaw APT 软件源

先导入 NextClaw 的仓库公钥：

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://peiiii.github.io/nextclaw/apt/nextclaw-archive-keyring.gpg \
  | sudo tee /etc/apt/keyrings/nextclaw-archive-keyring.gpg >/dev/null
```

然后添加软件源：

```bash
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/nextclaw-archive-keyring.gpg] https://peiiii.github.io/nextclaw/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/nextclaw.list >/dev/null
```

## 2. 安装桌面版

```bash
sudo apt update
sudo apt install nextclaw-desktop
```

安装完成后，可以从应用菜单里搜索 `NextClaw Desktop` 启动。

## 3. 以后怎么升级

升级方式不是重新下载 `.deb`，而是直接走系统包管理器：

```bash
sudo apt update
sudo apt upgrade
```

如果你只想看当前安装版本和仓库候选版本：

```bash
apt policy nextclaw-desktop
```

当 `Candidate` 高于 `Installed` 时，执行 `apt upgrade` 就会升级。

## 4. 怎么卸载

只删除程序：

```bash
sudo apt remove nextclaw-desktop
```

连包管理器配置一起删：

```bash
sudo apt purge nextclaw-desktop
sudo apt autoremove
```

如果你不想再接收 NextClaw 的仓库更新，也把 source 和 key 删除：

```bash
sudo rm -f /etc/apt/sources.list.d/nextclaw.list
sudo rm -f /etc/apt/keyrings/nextclaw-archive-keyring.gpg
sudo apt update
```

## 5. 可选：清理本地用户数据

系统卸载不会自动删除你的用户目录数据。如果你想完全清理：

```bash
rm -rf ~/.config/"NextClaw Desktop"
rm -rf ~/.cache/"NextClaw Desktop"
rm -rf ~/.local/share/"NextClaw Desktop"
```

## 6. 常见问题

### 我已经手动下载过 `.deb`，以后还能用 `apt upgrade` 吗？

可以，但前提是你要按本教程把 NextClaw APT 软件源加进系统里，而且包名仍然是 `nextclaw-desktop`。

### 为什么 Linux 不走应用内自动更新？

NextClaw 在 Linux 上优先遵循系统习惯，使用发行版包管理器升级。这比每个应用自己维护一套升级器更稳定，也更符合 Linux 用户预期。
