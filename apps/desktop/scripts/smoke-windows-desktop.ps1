param(
  [Parameter(Mandatory = $true)]
  [string]$DesktopExePath,
  [int]$StartupTimeoutSec = 90,
  [int]$MaxReadySec = 20,
  [switch]$SeedStaleSameVersionBundle
)

$ErrorActionPreference = "Stop"
function Stop-ProcessTree {
  param([int]$RootPid)

  try {
    $taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
    if (Test-Path $taskkill) {
      $killProc = Start-Process -FilePath $taskkill -ArgumentList "/PID", "$RootPid", "/T", "/F" -PassThru -Wait -WindowStyle Hidden
      if ($killProc.ExitCode -ne 0) {
        Write-Warning "[desktop-smoke] post-smoke process cleanup exited with code $($killProc.ExitCode)"
      }
      return
    }
    Stop-Process -Id $RootPid -Force -ErrorAction Stop
  } catch {
    Write-Warning "[desktop-smoke] post-smoke process cleanup failed: $($_.Exception.Message)"
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

  $servicePattern = "Extension nextclaw-channel-extension-(feishu|weixin) (failed|exited)"
  if (Test-Path $script:ServiceLog) {
    foreach ($line in @(Get-Content -Path $script:ServiceLog)) {
      if ($line -match $servicePattern) { return $line }
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

function Resolve-PackagedUpdateResourcesDir {
  param([string]$DesktopExePath)

  $resourcesDir = Join-Path (Split-Path -Parent $DesktopExePath) "resources\update"
  if (Test-Path $resourcesDir) {
    return $resourcesDir
  }
  return ""
}

function Resolve-SmokeRuntimeArch {
  if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
    return "arm64"
  }
  return "x64"
}

function Seed-StaleSameVersionBundleState {
  param(
    [string]$DesktopExePath,
    [string]$SmokeHome
  )

  $updateResourcesDir = Resolve-PackagedUpdateResourcesDir -DesktopExePath $DesktopExePath
  if ([string]::IsNullOrWhiteSpace($updateResourcesDir)) {
    throw "Packaged update resources not found next to desktop executable: $DesktopExePath"
  }
  $metadataPath = Join-Path $updateResourcesDir "update-release-metadata.json"
  if (-not (Test-Path $metadataPath)) {
    throw "Packaged update release metadata not found: $metadataPath"
  }
  $metadata = Get-Content -Raw -Path $metadataPath | ConvertFrom-Json
  $seedVersion = [string]$metadata.seedBundle.version
  if ([string]::IsNullOrWhiteSpace($seedVersion)) {
    throw "Packaged seed bundle version missing in $metadataPath"
  }

  $launcherDir = Join-Path $SmokeHome "launcher"
  $versionDir = Join-Path $SmokeHome "versions\$seedVersion"
  $runtimeDir = Join-Path $versionDir "runtime\dist\cli\app"
  $uiDir = Join-Path $versionDir "ui"
  $pluginsDir = Join-Path $versionDir "plugins"
  New-Item -ItemType Directory -Path $launcherDir, $runtimeDir, $uiDir, $pluginsDir -Force | Out-Null

  @"
console.error("stale smoke runtime should have been replaced before launch");
setTimeout(() => {}, 600000);
"@ | Set-Content -Path (Join-Path $runtimeDir "index.js") -Encoding utf8
  "<html></html>" | Set-Content -Path (Join-Path $uiDir "index.html") -Encoding utf8
  "" | Set-Content -Path (Join-Path $pluginsDir ".keep") -Encoding utf8

  $manifest = [ordered]@{
    bundleVersion = $seedVersion
    platform = "win32"
    arch = (Resolve-SmokeRuntimeArch)
    uiVersion = $seedVersion
    runtimeVersion = $seedVersion
    builtInPluginSetVersion = $seedVersion
    launcherCompatibility = [ordered]@{
      minVersion = "0.0.0"
    }
    entrypoints = [ordered]@{
      runtimeScript = "runtime/dist/cli/app/index.js"
    }
    migrationVersion = 1
  }
  $manifest | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $versionDir "manifest.json") -Encoding utf8
  @{ version = $seedVersion } | ConvertTo-Json | Set-Content -Path (Join-Path $SmokeHome "current.json") -Encoding utf8
  @{
    channel = "stable"
    currentVersion = $seedVersion
    previousVersion = $null
    candidateVersion = $null
    candidateLaunchCount = 0
    lastKnownGoodVersion = $seedVersion
    badVersions = @()
    lastAttemptedPackagedSeedVersion = $seedVersion
    lastAttemptedPackagedSeedSha256 = "stale-smoke-sha256"
    lastAttemptedPackagedSeedLauncherFingerprint = "stale-smoke-launcher"
    lastUpdateCheckAt = $null
    downloadedVersion = $null
    downloadedReleaseNotesUrl = $null
    updatePreferences = @{
      automaticChecks = $true
      autoDownload = $false
    }
    presencePreferences = @{
      closeToBackground = $true
      launchAtLogin = $false
    }
    languagePreference = $null
  } | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $launcherDir "state.json") -Encoding utf8
  Write-Host "[desktop-smoke] seeded stale same-version bundle: $seedVersion"
}

$resolvedExe = (Resolve-Path $DesktopExePath).Path
$tempRoot = Get-SmokeTempRoot
$smokeHome = Join-Path $tempRoot "nextclaw-desktop-smoke-home"
$logRoot = Join-Path $tempRoot "nextclaw-desktop-smoke-logs"
$appStdoutLog = Join-Path $logRoot "app-stdout.log"
$appStderrLog = Join-Path $logRoot "app-stderr.log"
$apiProbeLog = Join-Path $logRoot "api-probes.json"
$script:MainLog = Join-Path $smokeHome "launcher\\main.log"
$script:ServiceLog = Join-Path $smokeHome "service.log"
$script:MainLogStartLine = 1

Write-Host "[desktop-smoke] desktop exe: $resolvedExe"
Write-Host "[desktop-smoke] temp root: $tempRoot"
Write-Host "[desktop-smoke] smoke home: $smokeHome"
Write-Host "[desktop-smoke] startup timeout: ${StartupTimeoutSec}s"
Write-Host "[desktop-smoke] max GUI ready time: ${MaxReadySec}s"
Write-Host "[desktop-smoke] seed stale same-version bundle: $($SeedStaleSameVersionBundle.IsPresent)"

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $smokeHome
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $logRoot
New-Item -ItemType Directory -Path $smokeHome | Out-Null
New-Item -ItemType Directory -Path $logRoot | Out-Null
if ($SeedStaleSameVersionBundle.IsPresent) {
  Seed-StaleSameVersionBundleState -DesktopExePath $resolvedExe -SmokeHome $smokeHome
}
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
