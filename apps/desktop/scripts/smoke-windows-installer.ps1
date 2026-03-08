param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,
  [int]$StartupTimeoutSec = 90
)

$ErrorActionPreference = "Stop"

function Get-DescendantPids {
  param([int]$RootPid)

  $allPids = New-Object System.Collections.Generic.List[int]
  $queue = New-Object System.Collections.Generic.Queue[int]
  $allPids.Add($RootPid)
  $queue.Enqueue($RootPid)

  while ($queue.Count -gt 0) {
    $currentPid = $queue.Dequeue()
    $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $currentPid" | Select-Object -ExpandProperty ProcessId)
    foreach ($childPid in $children) {
      if (-not $allPids.Contains($childPid)) {
        $allPids.Add($childPid)
        $queue.Enqueue($childPid)
      }
    }
  }

  return @($allPids)
}

function Stop-ProcessTree {
  param([int]$RootPid)

  $pids = @(Get-DescendantPids -RootPid $RootPid | Sort-Object -Descending)
  foreach ($targetPid in $pids) {
    try {
      Stop-Process -Id $targetPid -Force -ErrorAction Stop
    } catch {
      # Ignore already-exited processes.
    }
  }
}

function Get-SmokeTempRoot {
  if ($env:RUNNER_TEMP) { return $env:RUNNER_TEMP }
  if ($env:TEMP) { return $env:TEMP }
  if ($env:TMP) { return $env:TMP }
  return [System.IO.Path]::GetTempPath()
}

function Get-CandidatePorts {
  param([int[]]$ProcessIds)

  $ports = New-Object System.Collections.Generic.List[int]
  $seedPorts = New-Object System.Collections.Generic.List[int]
  foreach ($name in @("NEXTCLAW_UI_PORT", "NEXTCLAW_PORT", "PORT")) {
    $raw = [Environment]::GetEnvironmentVariable($name)
    $parsed = 0
    if ([int]::TryParse($raw, [ref]$parsed) -and $parsed -gt 0) {
      $seedPorts.Add($parsed)
    }
  }
  $seedPorts.Add(18791)

  foreach ($port in $seedPorts) {
    if (-not $ports.Contains($port)) {
      $ports.Add($port)
    }
  }

  try {
    $runtimePorts = @(Get-NetTCPConnection -State Listen -ErrorAction Stop |
      Where-Object { $ProcessIds -contains $_.OwningProcess } |
      Select-Object -ExpandProperty LocalPort -Unique)
    foreach ($port in $runtimePorts) {
      if (-not $ports.Contains($port)) {
        $ports.Add($port)
      }
    }
  } catch {
    Write-Host "[desktop-smoke] Get-NetTCPConnection unavailable, fallback to default ports."
  }

  return @($ports)
}

$resolvedInstaller = (Resolve-Path $InstallerPath).Path
$installedDir = Join-Path $env:LOCALAPPDATA "Programs\NextClaw Desktop"
$installedExe = Join-Path $installedDir "NextClaw Desktop.exe"
$tempRoot = Get-SmokeTempRoot
$smokeHome = Join-Path $tempRoot "nextclaw-desktop-smoke-home"

Write-Host "[desktop-smoke] installer: $resolvedInstaller"
Write-Host "[desktop-smoke] temp root: $tempRoot"
Write-Host "[desktop-smoke] smoke home: $smokeHome"

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $smokeHome
New-Item -ItemType Directory -Path $smokeHome | Out-Null
$env:NEXTCLAW_HOME = $smokeHome

if (Test-Path $installedDir) {
  Write-Host "[desktop-smoke] removing existing install dir: $installedDir"
  Remove-Item -Recurse -Force $installedDir
}

Write-Host "[desktop-smoke] running silent install"
$installProc = Start-Process -FilePath $resolvedInstaller -ArgumentList "/S" -PassThru -Wait
if ($installProc.ExitCode -ne 0) {
  throw "Installer exited with code $($installProc.ExitCode)"
}

if (-not (Test-Path $installedExe)) {
  throw "Installed exe not found: $installedExe"
}

$appProc = $null
try {
  Write-Host "[desktop-smoke] launching desktop app"
  $appProc = Start-Process -FilePath $installedExe -PassThru
  $deadline = (Get-Date).AddSeconds($StartupTimeoutSec)
  $healthUrl = $null

  while ((Get-Date) -lt $deadline -and -not $healthUrl) {
    if ($appProc.HasExited) {
      throw "Desktop exited early. ExitCode=$($appProc.ExitCode)"
    }

    $candidatePids = @(Get-DescendantPids -RootPid $appProc.Id)
    $ports = @(Get-CandidatePorts -ProcessIds $candidatePids)

    foreach ($port in $ports) {
      $url = "http://127.0.0.1:$port/api/health"
      try {
        $payload = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 2
        if ($payload.ok -eq $true -and $payload.data.status -eq "ok") {
          $healthUrl = $url
          break
        }
      } catch {
        # Continue polling.
      }
    }

    if (-not $healthUrl) {
      Start-Sleep -Seconds 2
    }
  }

  if (-not $healthUrl) {
    throw "Health API did not become ready within ${StartupTimeoutSec}s."
  }

  Write-Host "[desktop-smoke] health check passed: $healthUrl"
} finally {
  if ($appProc -and -not $appProc.HasExited) {
    Stop-ProcessTree -RootPid $appProc.Id
  }
}
