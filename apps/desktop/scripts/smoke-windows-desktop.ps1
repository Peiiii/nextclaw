param(
  [Parameter(Mandatory = $true)]
  [string]$DesktopExePath,
  [int]$StartupTimeoutSec = 90,
  [int]$MaxReadySec = 20
)

$ErrorActionPreference = "Stop"
$DefaultUiPort = 55667

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

function Get-CurrentMainLogLines {
  if ([string]::IsNullOrWhiteSpace($script:MainLog) -or -not (Test-Path $script:MainLog)) {
    return @()
  }

  return @(Get-Content -Path $script:MainLog | Select-Object -Skip ($script:MainLogStartLine - 1))
}

function Test-DesktopWindowReady {
  $lines = @(Get-CurrentMainLogLines)
  $readyToShow = $false
  $didFinishLoad = $false
  foreach ($line in $lines) {
    if ($line -match "ready-to-show") {
      $readyToShow = $true
    }
    if ($line -match "did-finish-load") {
      $didFinishLoad = $true
    }
  }
  return $readyToShow -and $didFinishLoad
}

function Get-DesktopStartupBlocker {
  $pattern = "ENAMETOOLONG|ENOTEMPTY|ERR_FAILED|render-process-gone|Failed to bootstrap runtime|Another desktop instance is already running"
  foreach ($line in @(Get-CurrentMainLogLines)) {
    if ($line -match $pattern) {
      return $line
    }
  }
  return ""
}

function Write-SmokeDiagnostics {
  Write-Host "[desktop-smoke] app stdout log: $appStdoutLog"
  if (Test-Path $appStdoutLog) {
    Get-Content -Path $appStdoutLog -Tail 120
  }
  Write-Host "[desktop-smoke] app stderr log: $appStderrLog"
  if (Test-Path $appStderrLog) {
    Get-Content -Path $appStderrLog -Tail 120
  }
  Write-Host "[desktop-smoke] main log: $script:MainLog"
  if (Test-Path $script:MainLog) {
    Get-Content -Path $script:MainLog -Tail 160
  }
  Write-Host "[desktop-smoke] runtime log: $runtimeStdoutLog"
  if (Test-Path $runtimeStdoutLog) {
    Get-Content -Path $runtimeStdoutLog -Tail 120
  }
}

function Get-CandidatePorts {
  param([int[]]$ProcessIds)

  # The packaged desktop app starts the runtime on the default UI port even when
  # the runtime process detaches from the launcher process tree.
  $ports = New-Object System.Collections.Generic.List[int]
  $ports.Add($DefaultUiPort)
  foreach ($name in @("NEXTCLAW_UI_PORT", "NEXTCLAW_PORT", "PORT")) {
    $raw = [Environment]::GetEnvironmentVariable($name)
    $parsed = 0
    if ([int]::TryParse($raw, [ref]$parsed) -and $parsed -gt 0 -and -not $ports.Contains($parsed)) {
      $ports.Add($parsed)
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
    Write-Host "[desktop-smoke] Get-NetTCPConnection unavailable, fallback to env ports only."
  }

  return @($ports)
}

$resolvedExe = (Resolve-Path $DesktopExePath).Path
$tempRoot = Get-SmokeTempRoot
$smokeHome = Join-Path $tempRoot "nextclaw-desktop-smoke-home"
$logRoot = Join-Path $tempRoot "nextclaw-desktop-smoke-logs"
$appStdoutLog = Join-Path $logRoot "app-stdout.log"
$appStderrLog = Join-Path $logRoot "app-stderr.log"
$runtimeStdoutLog = Join-Path $logRoot "runtime-stdout.log"
$healthLog = Join-Path $logRoot "health.json"
$script:MainLog = Join-Path $smokeHome "launcher\\main.log"
$script:MainLogStartLine = 1

Write-Host "[desktop-smoke] desktop exe: $resolvedExe"
Write-Host "[desktop-smoke] temp root: $tempRoot"
Write-Host "[desktop-smoke] smoke home: $smokeHome"
Write-Host "[desktop-smoke] startup timeout: ${StartupTimeoutSec}s"
Write-Host "[desktop-smoke] max GUI ready time: ${MaxReadySec}s"

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $smokeHome
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $logRoot
New-Item -ItemType Directory -Path $smokeHome | Out-Null
New-Item -ItemType Directory -Path $logRoot | Out-Null
$env:NEXTCLAW_HOME = $smokeHome
$env:NEXTCLAW_DESKTOP_RUNTIME_HOME_OVERRIDE = $smokeHome
$env:NEXTCLAW_DESKTOP_DATA_DIR_OVERRIDE = $smokeHome

$appProc = $null
try {
  Write-Host "[desktop-smoke] launching desktop app"
  if (Test-Path $script:MainLog) {
    $script:MainLogStartLine = ((Get-Content -Path $script:MainLog | Measure-Object -Line).Lines + 1)
  }
  $appProc = Start-Process -FilePath $resolvedExe -PassThru -RedirectStandardOutput $appStdoutLog -RedirectStandardError $appStderrLog
  $deadline = (Get-Date).AddSeconds($StartupTimeoutSec)
  $readyDeadline = (Get-Date).AddSeconds($MaxReadySec)
  $startedAt = Get-Date
  $healthUrl = $null

  while ((Get-Date) -lt $deadline) {
    if ($appProc.HasExited) {
      throw "Desktop exited early. ExitCode=$($appProc.ExitCode)"
    }

    $blockerLine = Get-DesktopStartupBlocker
    if (-not [string]::IsNullOrWhiteSpace($blockerLine)) {
      throw "Desktop startup blocker detected: $blockerLine"
    }

    $windowReady = Test-DesktopWindowReady
    if (-not $windowReady -and (Get-Date) -gt $readyDeadline) {
      throw "Desktop GUI not ready within ${MaxReadySec}s."
    }

    $candidatePids = @(Get-DescendantPids -RootPid $appProc.Id)
    $ports = @(Get-CandidatePorts -ProcessIds $candidatePids)

    if (-not $healthUrl) {
      foreach ($port in $ports) {
        $url = "http://127.0.0.1:$port/api/health"
        try {
          $payload = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 2
          if ($payload.ok -eq $true -and $payload.data.status -eq "ok") {
            $payload | ConvertTo-Json -Depth 10 | Set-Content -Path $healthLog
            $healthUrl = $url
            break
          }
        } catch {
          # Continue polling.
        }
      }
    }

    if ($healthUrl -and $windowReady) {
      $elapsedMs = [int]((Get-Date) - $startedAt).TotalMilliseconds
      Write-Host "[desktop-smoke] GUI smoke passed in ${elapsedMs}ms"
      Write-Host "[desktop-smoke] health check passed: $healthUrl"
      Write-Host "[desktop-smoke] main log: $script:MainLog"
      if (Test-Path $script:MainLog) {
        Get-Content -Path $script:MainLog -Tail 80
      }
      break
    }

    Start-Sleep -Seconds 2
  }

  if (-not $healthUrl) {
    throw "Health API did not become ready within ${StartupTimeoutSec}s."
  }
} catch {
  Write-SmokeDiagnostics
  throw
} finally {
  if ($appProc -and -not $appProc.HasExited) {
    Stop-ProcessTree -RootPid $appProc.Id
  }
}
