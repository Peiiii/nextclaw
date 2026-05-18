param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,
  [int]$StartupTimeoutSec = 90,
  [int]$MaxReadySec = 20
)

$ErrorActionPreference = "Stop"

function Invoke-SilentUninstall {
  param(
    [string]$InstallDir,
    [bool]$FailOnError = $true
  )

  $uninstallerPath = Join-Path $InstallDir "Uninstall NextClaw Desktop.exe"
  if (Test-Path $uninstallerPath) {
    Write-Host "[desktop-installer-smoke] uninstalling existing install: $uninstallerPath"
    $uninstallProc = Start-Process -FilePath $uninstallerPath -ArgumentList "/S" -PassThru -Wait
    if ($uninstallProc.ExitCode -ne 0) {
      $message = "Uninstaller exited with code $($uninstallProc.ExitCode)"
      if ($FailOnError) {
        throw $message
      }
      Write-Warning "[desktop-installer-smoke] $message"
    }
  }

  if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir
  }
}

function Stop-DesktopProcesses {
  $taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
  if (Test-Path $taskkill) {
    & $taskkill /IM "NextClaw Desktop.exe" /T /F 2>$null | Out-Null
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

  & "apps/desktop/scripts/smoke-windows-desktop.ps1" -DesktopExePath $installedExePath -StartupTimeoutSec $StartupTimeoutSec -MaxReadySec $MaxReadySec
} finally {
  Stop-DesktopProcesses
  Invoke-SilentUninstall -InstallDir $installDir -FailOnError $false
}
