param(
  [Parameter(Mandatory = $true)]
  [string]$DesktopExePath,
  [int]$StartupTimeoutSec = 90
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

function Get-RuntimeScriptPath {
  param([string]$DesktopExe)

  $desktopRoot = Split-Path -Parent $DesktopExe
  $resourcesRoot = Join-Path $desktopRoot "resources"
  $asarRoot = Join-Path $resourcesRoot "app.asar"
  if (Test-Path -LiteralPath $asarRoot) {
    return (Join-Path $asarRoot "node_modules\nextclaw\dist\cli\app\index.js")
  }

  $candidates = @(
    (Join-Path $resourcesRoot "app\node_modules\nextclaw\dist\cli\app\index.js"),
    (Join-Path $resourcesRoot "app\node_modules\nextclaw\dist\cli\index.js"),
    (Join-Path $resourcesRoot "node_modules\nextclaw\dist\cli\app\index.js"),
    (Join-Path $resourcesRoot "node_modules\nextclaw\dist\cli\index.js")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  return ""
}

function Get-FreeRuntimePort {
  for ($port = 55667; $port -le 55716; $port++) {
    $listener = $null
    try {
      $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
      $listener.Start()
      return $port
    } catch {
      # Try next port.
    } finally {
      if ($listener) {
        $listener.Stop()
      }
    }
  }

  return 0
}

function Invoke-RuntimeFallback {
  param(
    [string]$DesktopExe,
    [int]$TimeoutSec,
    [string]$HealthLog,
    [string]$RuntimeLog
  )

  $runtimeScript = Get-RuntimeScriptPath -DesktopExe $DesktopExe
  if ([string]::IsNullOrWhiteSpace($runtimeScript)) {
    Write-Host "[desktop-smoke] runtime fallback failed: nextclaw cli not found in package."
    return $false
  }

  $runtimePort = Get-FreeRuntimePort
  if ($runtimePort -le 0) {
    Write-Host "[desktop-smoke] runtime fallback failed: no available port in 55667-55716."
    return $false
  }

  $originalElectronRunAsNode = $env:ELECTRON_RUN_AS_NODE
  $runtimeProc = $null
  $env:ELECTRON_RUN_AS_NODE = "1"

  try {
    Write-Host "[desktop-smoke] runtime fallback: init"
    & $DesktopExe $runtimeScript init *>> $RuntimeLog
    if ($LASTEXITCODE -ne 0) {
      Write-Host "[desktop-smoke] runtime fallback init failed. See $RuntimeLog"
      return $false
    }

    Write-Host "[desktop-smoke] runtime fallback: serve on $runtimePort"
    $runtimeProc = Start-Process -FilePath $DesktopExe -ArgumentList @($runtimeScript, "serve", "--ui-port", "$runtimePort") -PassThru -RedirectStandardOutput $RuntimeLog -RedirectStandardError $RuntimeLog

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
      if ($runtimeProc.HasExited) {
        Write-Host "[desktop-smoke] runtime fallback exited early. See $RuntimeLog"
        return $false
      }

      try {
        $payload = Invoke-RestMethod -Uri "http://127.0.0.1:$runtimePort/api/health" -Method Get -TimeoutSec 2
        $payload | ConvertTo-Json -Depth 10 | Set-Content -Path $HealthLog
        if ($payload.ok -eq $true -and $payload.data.status -eq "ok") {
          Write-Host "[desktop-smoke] runtime fallback health check passed: http://127.0.0.1:$runtimePort/api/health"
          return $true
        }
      } catch {
        # Continue polling.
      }

      Start-Sleep -Seconds 2
    }

    Write-Host "[desktop-smoke] runtime fallback health timeout within ${TimeoutSec}s. See $RuntimeLog"
    return $false
  } finally {
    if ($runtimeProc -and -not $runtimeProc.HasExited) {
      Stop-ProcessTree -RootPid $runtimeProc.Id
    }

    if ($null -eq $originalElectronRunAsNode) {
      Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    } else {
      $env:ELECTRON_RUN_AS_NODE = $originalElectronRunAsNode
    }
  }
}

$resolvedExe = (Resolve-Path $DesktopExePath).Path
$tempRoot = Get-SmokeTempRoot
$smokeHome = Join-Path $tempRoot "nextclaw-desktop-smoke-home"
$logRoot = Join-Path $tempRoot "nextclaw-desktop-smoke-logs"
$appStdoutLog = Join-Path $logRoot "app-stdout.log"
$appStderrLog = Join-Path $logRoot "app-stderr.log"
$runtimeStdoutLog = Join-Path $logRoot "runtime-stdout.log"
$healthLog = Join-Path $logRoot "health.json"

Write-Host "[desktop-smoke] desktop exe: $resolvedExe"
Write-Host "[desktop-smoke] temp root: $tempRoot"
Write-Host "[desktop-smoke] smoke home: $smokeHome"

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
  $appProc = Start-Process -FilePath $resolvedExe -PassThru -RedirectStandardOutput $appStdoutLog -RedirectStandardError $appStderrLog
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
          $payload | ConvertTo-Json -Depth 10 | Set-Content -Path $healthLog
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
    Write-Host "[desktop-smoke] health API not ready within ${StartupTimeoutSec}s. trying runtime fallback."
    if (-not (Invoke-RuntimeFallback -DesktopExe $resolvedExe -TimeoutSec $StartupTimeoutSec -HealthLog $healthLog -RuntimeLog $runtimeStdoutLog)) {
      throw "Health API did not become ready within ${StartupTimeoutSec}s."
    }
    $healthUrl = "runtime-fallback"
  }

  Write-Host "[desktop-smoke] health check passed: $healthUrl"
} catch {
  Write-Host "[desktop-smoke] app stdout log: $appStdoutLog"
  if (Test-Path $appStdoutLog) {
    Get-Content -Path $appStdoutLog -Tail 120
  }
  Write-Host "[desktop-smoke] app stderr log: $appStderrLog"
  if (Test-Path $appStderrLog) {
    Get-Content -Path $appStderrLog -Tail 120
  }
  Write-Host "[desktop-smoke] runtime log: $runtimeStdoutLog"
  if (Test-Path $runtimeStdoutLog) {
    Get-Content -Path $runtimeStdoutLog -Tail 120
  }
  throw
} finally {
  if ($appProc -and -not $appProc.HasExited) {
    Stop-ProcessTree -RootPid $appProc.Id
  }
}
