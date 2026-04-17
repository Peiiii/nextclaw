param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,
  [int]$StartupTimeoutSec = 90
)

$ErrorActionPreference = "Stop"

function Invoke-SilentUninstall {
  param([string]$InstallDir)

  $uninstallerPath = Join-Path $InstallDir "Uninstall NextClaw Desktop.exe"
  if (Test-Path $uninstallerPath) {
    Write-Host "[desktop-installer-smoke] uninstalling existing install: $uninstallerPath"
    $uninstallProc = Start-Process -FilePath $uninstallerPath -ArgumentList "/S" -PassThru -Wait
    if ($uninstallProc.ExitCode -ne 0) {
      throw "Uninstaller exited with code $($uninstallProc.ExitCode)"
    }
  }

  if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir
  }
}

$resolvedInstaller = (Resolve-Path $InstallerPath).Path
$installDir = Join-Path $env:LOCALAPPDATA "Programs\\NextClaw Desktop"
$installedExePath = Join-Path $installDir "NextClaw Desktop.exe"

Write-Host "[desktop-installer-smoke] installer: $resolvedInstaller"
Write-Host "[desktop-installer-smoke] install dir: $installDir"

Invoke-SilentUninstall -InstallDir $installDir

try {
  Write-Host "[desktop-installer-smoke] running silent install"
  $installProc = Start-Process -FilePath $resolvedInstaller -ArgumentList "/S" -PassThru -Wait
  if ($installProc.ExitCode -ne 0) {
    throw "Installer exited with code $($installProc.ExitCode)"
  }

  if (-not (Test-Path $installedExePath)) {
    throw "Installed desktop executable not found: $installedExePath"
  }

  & "apps/desktop/scripts/smoke-windows-desktop.ps1" -DesktopExePath $installedExePath -StartupTimeoutSec $StartupTimeoutSec
} finally {
  Invoke-SilentUninstall -InstallDir $installDir
}
