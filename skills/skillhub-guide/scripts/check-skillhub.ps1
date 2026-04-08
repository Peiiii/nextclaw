$ErrorActionPreference = "Stop"

$installUrl = "https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/install.sh"

Write-Host "检查 Skillhub 安装状态..."
Write-Host "=========================="

$command = Get-Command skillhub -ErrorAction SilentlyContinue

if ($null -ne $command) {
    Write-Host "已检测到 Skillhub CLI"
    Write-Host ("路径: {0}" -f $command.Source)

    try {
        $versionOutput = & skillhub --version 2>$null
        if ($versionOutput) {
            Write-Host ("版本: {0}" -f $versionOutput)
        } else {
            Write-Host "版本: 无法获取"
        }
    } catch {
        Write-Host "版本: 无法获取"
    }

    try {
        & skillhub --help *> $null
        Write-Host "就绪检查: skillhub --help 可执行"
    } catch {
        Write-Host "就绪检查: skillhub --help 执行失败"
    }
} else {
    Write-Host "未检测到 Skillhub CLI"
    Write-Host ""
    Write-Host "默认推荐: 仅安装 CLI"
    Write-Host ("curl -fsSL {0} | bash -s -- --cli-only" -f $installUrl)
    Write-Host ""
    Write-Host "注意: 当前官方安装器是 Bash 脚本。Windows 下请使用 Git Bash、WSL 或等待上游提供原生安装器。"
    Write-Host ""
    Write-Host "如需上游默认完整安装:"
    Write-Host ("curl -fsSL {0} | bash" -f $installUrl)
}

Write-Host ""
Write-Host "使用提示:"
Write-Host "- 以 'skillhub --help' 与实际 search/install 命令作为可用性的真相源"
Write-Host "- 使用 'skillhub search <关键词>' 搜索技能"
Write-Host "- 使用 'skillhub install <技能名>' 安装到当前 workspace"
