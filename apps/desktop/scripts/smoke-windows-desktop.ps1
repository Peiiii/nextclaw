param(
  [Parameter(Mandatory = $true)]
  [string]$DesktopExePath,
  [int]$StartupTimeoutSec = 90,
  [int]$MaxReadySec = 20
)

$ErrorActionPreference = "Stop"
function Stop-ProcessTree {
  param([int]$RootPid)

  $taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
  if (Test-Path $taskkill) {
    & $taskkill /PID $RootPid /T /F | Out-Null
    return
  }
  Stop-Process -Id $RootPid -Force -ErrorAction SilentlyContinue
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

function Get-DesktopRuntimeBaseUrlFromLog {
  $lines = @(Get-CurrentMainLogLines)
  $runtimeBaseUrl = $null
  foreach ($line in $lines) {
    if ($line -match "runtime\.process\.ready .*uiUrl=(http://127\.0\.0\.1:\d+)") {
      $runtimeBaseUrl = $Matches[1]
    }
    if ($line -match "Loading desktop window URL: (http://127\.0\.0\.1:\d+)") {
      $runtimeBaseUrl = $Matches[1]
    }
  }
  return $runtimeBaseUrl
}

function Test-DesktopRuntimeWindowLoaded {
  param([string]$RuntimeBaseUrl)

  if ([string]::IsNullOrWhiteSpace($RuntimeBaseUrl)) {
    return $false
  }

  $escapedBaseUrl = [regex]::Escape($RuntimeBaseUrl)
  $sawRuntimeLoad = $false
  foreach ($line in @(Get-CurrentMainLogLines)) {
    if ($line -match "did-finish-load url=data:") {
      continue
    }
    if ($line -match "did-finish-load url=$escapedBaseUrl(/|\s|$)") {
      $sawRuntimeLoad = $true
    }
    if ($line -match "renderer-debug-installed.*$escapedBaseUrl/") {
      $sawRuntimeLoad = $true
    }
  }
  return $sawRuntimeLoad
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
  Write-Host "[desktop-smoke] API probes: $apiProbeLog"
  if (Test-Path $apiProbeLog) {
    Get-Content -Path $apiProbeLog -Tail 120
  }
}

function Invoke-DesktopApiProbe {
  param([string]$RuntimeBaseUrl)

  if ([string]::IsNullOrWhiteSpace($RuntimeBaseUrl)) {
    return $false
  }

  $endpoints = @(
    "/api/health",
    "/api/auth/status",
    "/api/config",
    "/api/ncp/sessions"
  )
  $results = New-Object System.Collections.Generic.List[object]
  $allPassed = $true

  foreach ($endpoint in $endpoints) {
    $url = "$RuntimeBaseUrl$endpoint"
    try {
      $payload = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 3
      $passed = $true
      if ($endpoint -eq "/api/health") {
        $passed = ($payload.ok -eq $true -and $payload.data.status -eq "ok")
      }
      $results.Add([pscustomobject]@{
        endpoint = $endpoint
        ok = $passed
        response = $payload
      })
      if (-not $passed) {
        $allPassed = $false
      }
    } catch {
      $allPassed = $false
      $results.Add([pscustomobject]@{
        endpoint = $endpoint
        ok = $false
        error = $_.Exception.Message
      })
    }
  }

  $results | ConvertTo-Json -Depth 20 | Set-Content -Path $apiProbeLog
  return $allPassed
}

$resolvedExe = (Resolve-Path $DesktopExePath).Path
$tempRoot = Get-SmokeTempRoot
$smokeHome = Join-Path $tempRoot "nextclaw-desktop-smoke-home"
$logRoot = Join-Path $tempRoot "nextclaw-desktop-smoke-logs"
$appStdoutLog = Join-Path $logRoot "app-stdout.log"
$appStderrLog = Join-Path $logRoot "app-stderr.log"
$apiProbeLog = Join-Path $logRoot "api-probes.json"
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
  $runtimeBaseUrl = $null
  $apiReady = $false

  while ((Get-Date) -lt $deadline) {
    if ($appProc.HasExited) {
      throw "Desktop exited early. ExitCode=$($appProc.ExitCode)"
    }

    $blockerLine = Get-DesktopStartupBlocker
    if (-not [string]::IsNullOrWhiteSpace($blockerLine)) {
      throw "Desktop startup blocker detected: $blockerLine"
    }

    if (-not $runtimeBaseUrl) {
      $runtimeBaseUrl = Get-DesktopRuntimeBaseUrlFromLog
    }

    if ($runtimeBaseUrl -and -not $apiReady) {
      $apiReady = Invoke-DesktopApiProbe -RuntimeBaseUrl $runtimeBaseUrl
    }

    $windowReady = Test-DesktopRuntimeWindowLoaded -RuntimeBaseUrl $runtimeBaseUrl
    if ((-not $runtimeBaseUrl -or -not $apiReady -or -not $windowReady) -and (Get-Date) -gt $readyDeadline) {
      throw "Desktop real app not ready within ${MaxReadySec}s. runtimeBaseUrl=$runtimeBaseUrl apiReady=$apiReady windowReady=$windowReady"
    }

    if ($runtimeBaseUrl -and $apiReady -and $windowReady) {
      $elapsedMs = [int]((Get-Date) - $startedAt).TotalMilliseconds
      Write-Host "[desktop-smoke] GUI smoke passed in ${elapsedMs}ms"
      Write-Host "[desktop-smoke] API probes passed: $runtimeBaseUrl"
      Write-Host "[desktop-smoke] main log: $script:MainLog"
      if (Test-Path $script:MainLog) {
        Get-Content -Path $script:MainLog -Tail 80
      }
      break
    }

    Start-Sleep -Seconds 2
  }

  if (-not $runtimeBaseUrl -or -not $apiReady) {
    throw "Desktop runtime API did not become ready within ${StartupTimeoutSec}s. runtimeBaseUrl=$runtimeBaseUrl apiReady=$apiReady"
  }
} catch {
  Write-SmokeDiagnostics
  throw
} finally {
  if ($appProc -and -not $appProc.HasExited) {
    Stop-ProcessTree -RootPid $appProc.Id
  }
}
