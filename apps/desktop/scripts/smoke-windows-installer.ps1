param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,
  [int]$StartupTimeoutSec = 90,
  [int]$MaxReadySec = 20,
  [switch]$SeedStaleSameVersionBundle
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

function Stop-DesktopProcesses {
  try {
    $taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
    if (-not (Test-Path $taskkill)) {
      return
    }
    $killProc = Start-Process -FilePath $taskkill -ArgumentList "/IM", "NextClaw Desktop.exe", "/T", "/F" -PassThru -Wait -WindowStyle Hidden
    if ($killProc.ExitCode -ne 0) {
      Write-Warning "[desktop-installer-smoke] process cleanup exited with code $($killProc.ExitCode)"
    }
  } catch {
    Write-Warning "[desktop-installer-smoke] process cleanup failed: $($_.Exception.Message)"
  }
}

function Remove-InstallDirectoryBestEffort {
  param([string]$InstallDir)

  if (-not (Test-Path $InstallDir)) {
    return
  }

  try {
    Remove-Item -Recurse -Force $InstallDir
  } catch {
    Write-Warning "[desktop-installer-smoke] post-smoke cleanup remove failed: $($_.Exception.Message)"
  }
}

function Resolve-InstalledDesktopExecutable {
  param([string]$ExpectedExePath)

  if (Test-Path $ExpectedExePath) {
    return $ExpectedExePath
  }

  $programsDir = Join-Path $env:LOCALAPPDATA "Programs"
  if (-not (Test-Path $programsDir)) {
    return ""
  }

  $candidate = Get-ChildItem -Path $programsDir -Filter "NextClaw Desktop.exe" -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
  if ($null -eq $candidate) {
    return ""
  }

  return $candidate.FullName
}

$resolvedInstaller = (Resolve-Path $InstallerPath).Path
$installDir = Join-Path $env:LOCALAPPDATA "Programs\NextClaw Desktop"
$installedExePath = Join-Path $installDir "NextClaw Desktop.exe"

Write-Host "[desktop-installer-smoke] installer: $resolvedInstaller"
Write-Host "[desktop-installer-smoke] install dir: $installDir"

Stop-DesktopProcesses
Invoke-SilentUninstall -InstallDir $installDir

try {
  Write-Host "[desktop-installer-smoke] running silent install"
  $installArgs = "/S /currentuser /D=$installDir"
  $installProc = Start-Process -FilePath $resolvedInstaller -ArgumentList $installArgs -PassThru -Wait
  if ($installProc.ExitCode -ne 0) {
    throw "Installer exited with code $($installProc.ExitCode)"
  }

  $installedExePath = Resolve-InstalledDesktopExecutable -ExpectedExePath $installedExePath
  if ([string]::IsNullOrWhiteSpace($installedExePath)) {
    throw "Installed desktop executable not found under $installDir or $env:LOCALAPPDATA\Programs"
  }
  $installDir = Split-Path -Parent $installedExePath
  Write-Host "[desktop-installer-smoke] installed exe: $installedExePath"

  $desktopSmokeArgs = @(
    "-DesktopExePath",
    $installedExePath,
    "-StartupTimeoutSec",
    $StartupTimeoutSec,
    "-MaxReadySec",
    $MaxReadySec
  )
  if ($SeedStaleSameVersionBundle.IsPresent) {
    $desktopSmokeArgs += "-SeedStaleSameVersionBundle"
  }
  & "apps/desktop/scripts/smoke-windows-desktop.ps1" @desktopSmokeArgs
} finally {
  Stop-DesktopProcesses
  Remove-InstallDirectoryBestEffort -InstallDir $installDir
}
