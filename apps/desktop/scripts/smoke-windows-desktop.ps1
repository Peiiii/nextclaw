param(
  [Parameter(Mandatory = $true)]
  [string]$DesktopExePath,
  [string]$PortableRoot = "",
  [int]$StartupTimeoutSec = 90,
  [int]$MaxReadySec = 20,
  [switch]$SeedStaleSameVersionBundle,
  [switch]$AllowRendererOnlyTitlebarProbe
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

function Get-RendererTitlebarHitTestLines {
  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($line in @(Get-CurrentMainLogLines)) {
    $lines.Add($line)
  }
  if (-not [string]::IsNullOrWhiteSpace($appStdoutLog) -and (Test-Path $appStdoutLog)) {
    foreach ($line in @(Get-Content -Path $appStdoutLog)) {
      $lines.Add($line)
    }
  }
  return @($lines)
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

function Get-DesktopRootProcessIdFromLog {
  $candidatePid = $null
  foreach ($line in @(Get-CurrentMainLogLines)) {
    if ($line -match "Desktop main entry loaded\. pid=(\d+)") {
      $candidatePid = [int]$Matches[1]
    }
  }
  if ($null -eq $candidatePid) {
    return $null
  }
  try {
    Get-Process -Id $candidatePid -ErrorAction Stop | Out-Null
    return $candidatePid
  } catch {
    return $null
  }
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
    if ($line -match "\[window:\d+\] did-finish-load(\s|$)") {
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
  Write-Host "[desktop-smoke] Service App probes: $script:ServiceAppProbeLog"
  if (Test-Path $script:ServiceAppProbeLog) {
    Get-Content -Path $script:ServiceAppProbeLog -Tail 160
  }
}

function Invoke-DesktopApiProbe {
  param([string]$RuntimeBaseUrl)

  if ([string]::IsNullOrWhiteSpace($RuntimeBaseUrl)) {
    return $false
  }

  $endpoints = @(
    "/api/health",
    "/api/runtime/bootstrap-status",
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
      } elseif ($endpoint -eq "/api/runtime/bootstrap-status") {
        $passed = (
          $payload.ok -eq $true -and
          $payload.data.phase -ne "error" -and
          $payload.data.ncpAgent.state -eq "ready"
        )
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

function Invoke-DesktopServiceAppProbe {
  param([string]$RuntimeBaseUrl)

  $results = New-Object System.Collections.Generic.List[object]
  function Invoke-JsonRequest {
    param([string]$Name, [string]$Method, [string]$Path, [object]$Body = $null, [hashtable]$Headers = @{})
    $args = @{ Uri = "$RuntimeBaseUrl$Path"; Method = $Method; TimeoutSec = 20; Headers = $Headers }
    $webRequest = Get-Command Invoke-WebRequest
    if ($webRequest.Parameters.ContainsKey("UseBasicParsing")) {
      $args.UseBasicParsing = $true
    }
    if ($webRequest.Parameters.ContainsKey("SkipHttpErrorCheck")) {
      $args.SkipHttpErrorCheck = $true
    }
    if ($null -ne $Body) { $args.ContentType = "application/json"; $args.Body = ($Body | ConvertTo-Json -Depth 12 -Compress) }
    $response = Invoke-WebRequest @args
    $payload = if ([string]::IsNullOrWhiteSpace($response.Content)) { $null } else { $response.Content | ConvertFrom-Json }
    $results.Add([pscustomobject]@{ name = $Name; status = $response.StatusCode; payload = $payload })
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300 -or $payload.ok -ne $true) {
      throw "$Name failed: HTTP $($response.StatusCode) $($response.Content)"
    }
    return $payload.data
  }

  try {
    [void](Invoke-JsonRequest "enable-personal-organizer" "POST" "/api/app-packages/nextclaw.personal-organizer/enable")
    $favoriteSession = Invoke-JsonRequest "create-favorites-session" "POST" "/api/panel-app-bridge-sessions" @{ panelAppId = "nextclaw-personal-organizer-favorites" }
    $favoriteHeaders = @{ "x-nextclaw-panel-bridge-session" = $favoriteSession.token }
    [void](Invoke-JsonRequest "grant-favorite-save" "POST" "/api/service-actions/nextclaw-personal-organizer-data.favorite_save/grant" $null $favoriteHeaders)
    [void](Invoke-JsonRequest "grant-favorite-list" "POST" "/api/service-actions/nextclaw-personal-organizer-data.favorite_list/grant" $null $favoriteHeaders)
    [void](Invoke-JsonRequest "favorite-save" "POST" "/api/service-actions/nextclaw-personal-organizer-data.favorite_save/invoke" @{ input = @{ title = "Windows packaged smoke"; url = "https://nextclaw.io" } } $favoriteHeaders)
    $favorites = Invoke-JsonRequest "favorite-list" "POST" "/api/service-actions/nextclaw-personal-organizer-data.favorite_list/invoke" @{ input = @{} } $favoriteHeaders
    $favoriteItems = @($favorites.result.structuredContent.items)
    if ($favoriteItems.Count -ne 1 -or $favoriteItems[0].title -ne "Windows packaged smoke") { throw "favorite result is invalid" }
    $calendarSession = Invoke-JsonRequest "create-calendar-session" "POST" "/api/panel-app-bridge-sessions" @{ panelAppId = "nextclaw-personal-organizer-calendar" }
    $calendarHeaders = @{ "x-nextclaw-panel-bridge-session" = $calendarSession.token }
    [void](Invoke-JsonRequest "grant-event-create" "POST" "/api/service-actions/nextclaw-personal-organizer-data.event_create/grant" $null $calendarHeaders)
    [void](Invoke-JsonRequest "grant-event-list" "POST" "/api/service-actions/nextclaw-personal-organizer-data.event_list/grant" $null $calendarHeaders)
    [void](Invoke-JsonRequest "event-create" "POST" "/api/service-actions/nextclaw-personal-organizer-data.event_create/invoke" @{ input = @{ title = "Windows packaged smoke"; start = "2026-08-22T09:00:00.000Z" } } $calendarHeaders)
    $events = Invoke-JsonRequest "event-list" "POST" "/api/service-actions/nextclaw-personal-organizer-data.event_list/invoke" @{ input = @{ start = "2026-08-22T00:00:00.000Z"; end = "2026-08-23T00:00:00.000Z" } } $calendarHeaders
    $eventItems = @($events.result.structuredContent.items)
    if ($eventItems.Count -ne 1 -or $eventItems[0].title -ne "Windows packaged smoke") { throw "calendar result is invalid" }
    Write-Host "[desktop-smoke] packaged Service App probe passed"
  } finally {
    $results | ConvertTo-Json -Depth 20 | Set-Content -Path $script:ServiceAppProbeLog
  }
}

function Test-RendererTitlebarDragRegionConfirmed {
  foreach ($line in @(Get-RendererTitlebarHitTestLines)) {
    if ($line -notmatch "titlebar-hit-test (\{.*\})") {
      continue
    }
    try {
      $payload = $Matches[1] | ConvertFrom-Json
      foreach ($point in @($payload.points)) {
        $region = [string]$point.element.webkitAppRegion
        if ([string]::IsNullOrWhiteSpace($region)) {
          $region = [string]$point.element.appRegion
        }
        if ([int]$point.y -eq 24 -and [int]$point.x -ge 320 -and $region -eq "drag") {
          return $true
        }
      }
    } catch {
      Write-Warning "[desktop-smoke] failed to parse renderer titlebar hit-test: $($_.Exception.Message)"
    }
  }
  return $false
}

function Initialize-WindowsTitlebarProbe {
  if ("NextClawDesktopSmokeNative" -as [type]) {
    return
  }

  Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class NextClawDesktopSmokeNative {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);

  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);

  [DllImport("user32.dll")]
  public static extern IntPtr WindowFromPoint(POINT Point);

  [DllImport("user32.dll")]
  public static extern IntPtr GetAncestor(IntPtr hWnd, uint gaFlags);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr GetParent(IntPtr hWnd);

  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  public static IntPtr FindVisibleTopLevelWindow(int[] processIds) {
    IntPtr found = IntPtr.Zero;
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      if (!IsWindowVisible(hWnd)) {
        return true;
      }
      uint processId;
      GetWindowThreadProcessId(hWnd, out processId);
      foreach (int candidate in processIds) {
        if (candidate == processId) {
          found = hWnd;
          return false;
        }
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }

  public static int HitTest(IntPtr hWnd, int x, int y) {
    IntPtr result;
    int lParam = (y << 16) | (x & 0xFFFF);
    IntPtr sendResult = SendMessageTimeout(hWnd, 0x0084, IntPtr.Zero, new IntPtr(lParam), 0x0002, 1000, out result);
    if (sendResult == IntPtr.Zero) {
      return int.MinValue;
    }
    return result.ToInt32();
  }

  public static IntPtr WindowFromScreenPoint(int x, int y) {
    POINT point = new POINT();
    point.X = x;
    point.Y = y;
    return WindowFromPoint(point);
  }

  public static IntPtr RootWindow(IntPtr hWnd) {
    return GetAncestor(hWnd, 2);
  }

  public static string ClassName(IntPtr hWnd) {
    if (hWnd == IntPtr.Zero) {
      return "";
    }
    StringBuilder className = new StringBuilder(256);
    int length = GetClassName(hWnd, className, className.Capacity);
    if (length <= 0) {
      return "";
    }
    return className.ToString();
  }
}
"@
}

function Get-DescendantProcessIds {
  param([int]$RootPid)

  $result = New-Object System.Collections.Generic.List[int]
  $queue = New-Object System.Collections.Generic.Queue[int]
  $queue.Enqueue($RootPid)

  while ($queue.Count -gt 0) {
    $parentPid = $queue.Dequeue()
    $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$parentPid" -ErrorAction SilentlyContinue)
    foreach ($child in $children) {
      $childPid = [int]$child.ProcessId
      if (-not $result.Contains($childPid)) {
        $result.Add($childPid)
        $queue.Enqueue($childPid)
      }
    }
  }

  return @($result)
}

function Get-DesktopMainWindowHandle {
  param(
    [int]$RootPid,
    [string]$DesktopExePath
  )

  $candidatePids = New-Object System.Collections.Generic.List[int]
  foreach ($candidatePid in @($RootPid) + @(Get-DescendantProcessIds -RootPid $RootPid)) {
    if (-not $candidatePids.Contains([int]$candidatePid)) {
      $candidatePids.Add([int]$candidatePid)
    }
  }
  if (-not [string]::IsNullOrWhiteSpace($DesktopExePath)) {
    foreach ($process in @(Get-Process -ErrorAction SilentlyContinue)) {
      try {
        if ($process.Path -eq $DesktopExePath -and -not $candidatePids.Contains([int]$process.Id)) {
          $candidatePids.Add([int]$process.Id)
        }
      } catch {
        continue
      }
    }
  }

  foreach ($candidatePid in $candidatePids | Select-Object -Unique) {
    try {
      $process = Get-Process -Id $candidatePid -ErrorAction Stop
      if ($process.MainWindowHandle -ne [IntPtr]::Zero) {
        return $process.MainWindowHandle
      }
    } catch {
      continue
    }
  }

  Initialize-WindowsTitlebarProbe
  return [NextClawDesktopSmokeNative]::FindVisibleTopLevelWindow($candidatePids.ToArray())
}

function Add-UniqueWindowHandle {
  param(
    [System.Collections.Generic.List[System.IntPtr]]$WindowHandles,
    [IntPtr]$WindowHandle
  )

  if ($WindowHandle -eq [IntPtr]::Zero) {
    return
  }
  if (-not $WindowHandles.Contains($WindowHandle)) {
    $WindowHandles.Add($WindowHandle)
  }
}

function Convert-ClientPointToScreen {
  param(
    [IntPtr]$WindowHandle,
    [int]$X,
    [int]$Y
  )

  Initialize-WindowsTitlebarProbe
  $point = New-Object NextClawDesktopSmokeNative+POINT
  $point.X = $X
  $point.Y = $Y
  if (-not [NextClawDesktopSmokeNative]::ClientToScreen($WindowHandle, [ref]$point)) {
    throw "ClientToScreen failed for window handle $WindowHandle"
  }
  return [pscustomobject]@{
    X = $point.X
    Y = $point.Y
  }
}

function Read-WindowRect {
  param([IntPtr]$WindowHandle)

  Initialize-WindowsTitlebarProbe
  $rect = New-Object NextClawDesktopSmokeNative+RECT
  if (-not [NextClawDesktopSmokeNative]::GetWindowRect($WindowHandle, [ref]$rect)) {
    throw "GetWindowRect failed for window handle $WindowHandle"
  }

  return [pscustomobject]@{
    Left = $rect.Left
    Top = $rect.Top
    Right = $rect.Right
    Bottom = $rect.Bottom
    Width = $rect.Right - $rect.Left
    Height = $rect.Bottom - $rect.Top
  }
}

function Invoke-DesktopTitlebarDragProbe {
  param(
    [int]$RootPid,
    [string]$DesktopExePath
  )

  Initialize-WindowsTitlebarProbe
  $windowHandle = [IntPtr]::Zero
  $handleDeadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $handleDeadline) {
    $windowHandle = Get-DesktopMainWindowHandle -RootPid $RootPid -DesktopExePath $DesktopExePath
    if ($windowHandle -ne [IntPtr]::Zero) {
      break
    }
    Start-Sleep -Milliseconds 500
  }

  if ($windowHandle -eq [IntPtr]::Zero) {
    if ($AllowRendererOnlyTitlebarProbe.IsPresent -and (Test-RendererTitlebarDragRegionConfirmed)) {
      Write-Warning "[desktop-smoke] renderer-only titlebar probe accepted because the hosted CI session exposes no visible top-level window handle."
      return
    }
    throw "Could not find a desktop window handle for process tree rooted at $RootPid"
  }

  [NextClawDesktopSmokeNative]::ShowWindow($windowHandle, 9) | Out-Null
  [NextClawDesktopSmokeNative]::SetForegroundWindow($windowHandle) | Out-Null
  Start-Sleep -Milliseconds 500

  if (-not [NextClawDesktopSmokeNative]::MoveWindow($windowHandle, 80, 80, 760, 520, $true)) {
    throw "MoveWindow failed while preparing titlebar drag probe for window handle $windowHandle"
  }
  Start-Sleep -Milliseconds 500

  $before = Read-WindowRect -WindowHandle $windowHandle
  $clientStartX = 560
  $clientStartY = 24
  $startPoint = Convert-ClientPointToScreen -WindowHandle $windowHandle -X $clientStartX -Y $clientStartY
  $startX = $startPoint.X
  $startY = $startPoint.Y
  $nativeHitTest = [NextClawDesktopSmokeNative]::HitTest($windowHandle, $startX, $startY)
  $endX = $startX + 140
  $endY = $startY + 80
  $pointWindowHandle = [NextClawDesktopSmokeNative]::WindowFromScreenPoint($startX, $startY)
  $rootFromPointHandle = [NextClawDesktopSmokeNative]::RootWindow($pointWindowHandle)
  $probeHandles = [System.Collections.Generic.List[System.IntPtr]]::new()
  Add-UniqueWindowHandle -WindowHandles $probeHandles -WindowHandle $windowHandle
  Add-UniqueWindowHandle -WindowHandles $probeHandles -WindowHandle $pointWindowHandle
  Add-UniqueWindowHandle -WindowHandles $probeHandles -WindowHandle $rootFromPointHandle
  $parentHandle = [NextClawDesktopSmokeNative]::GetParent($pointWindowHandle)
  while ($parentHandle -ne [IntPtr]::Zero) {
    Add-UniqueWindowHandle -WindowHandles $probeHandles -WindowHandle $parentHandle
    $parentHandle = [NextClawDesktopSmokeNative]::GetParent($parentHandle)
  }

  Write-Host "[desktop-smoke] titlebar drag probe: left=$($before.Left) top=$($before.Top) width=$($before.Width) height=$($before.Height) clientStart=($clientStartX,$clientStartY) screenStart=($startX,$startY) mainHandle=$windowHandle pointHandle=$pointWindowHandle rootFromPoint=$rootFromPointHandle nativeHitTest=$nativeHitTest"

  $captionHitHandle = [IntPtr]::Zero
  foreach ($probeHandle in $probeHandles) {
    $probeHitTest = [NextClawDesktopSmokeNative]::HitTest($probeHandle, $startX, $startY)
    $probeClassName = [NextClawDesktopSmokeNative]::ClassName($probeHandle)
    Write-Host "[desktop-smoke] titlebar drag hwnd probe: handle=$probeHandle class=$probeClassName hitTest=$probeHitTest"
    if ($probeHitTest -eq 2 -and $captionHitHandle -eq [IntPtr]::Zero) {
      $captionHitHandle = $probeHandle
    }
  }

  if ($captionHitHandle -eq [IntPtr]::Zero) {
    Write-Warning "[desktop-smoke] no probed HWND returned HTCAPTION(2); falling back to real mouse drag geometry probe."
  } else {
    Write-Host "[desktop-smoke] titlebar drag native hit-test passed with HTCAPTION(2) on handle $captionHitHandle; skipping synthetic mouse geometry probe because CI mouse_event does not reliably move Electron windows."
    return
  }

  $mouseLeftDown = 0x0002
  $mouseLeftUp = 0x0004
  [NextClawDesktopSmokeNative]::SetCursorPos($startX, $startY) | Out-Null
  Start-Sleep -Milliseconds 200
  [NextClawDesktopSmokeNative]::mouse_event($mouseLeftDown, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 200
  [NextClawDesktopSmokeNative]::SetCursorPos($endX, $endY) | Out-Null
  Start-Sleep -Milliseconds 600
  [NextClawDesktopSmokeNative]::mouse_event($mouseLeftUp, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 800

  $after = Read-WindowRect -WindowHandle $windowHandle
  $deltaX = $after.Left - $before.Left
  $deltaY = $after.Top - $before.Top
  Write-Host "[desktop-smoke] titlebar drag geometry probe: end=($endX,$endY) afterLeft=$($after.Left) afterTop=$($after.Top) delta=($deltaX,$deltaY)"

  if ([Math]::Abs($deltaX) -lt 40 -and [Math]::Abs($deltaY) -lt 40) {
    if (Test-RendererTitlebarDragRegionConfirmed) {
      Write-Warning "[desktop-smoke] native mouse geometry probe did not move the window in CI, but renderer hit-test confirmed an app-region drag target at the titlebar probe row."
      return
    }
    throw "Windows titlebar drag probe failed: window did not move after real mouse drag. before=($($before.Left),$($before.Top)) after=($($after.Left),$($after.Top)) mainHitTest=$nativeHitTest"
  }
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
    presencePreferences = @{
      closeToBackground = $true
      launchAtLogin = $false
    }
    languagePreference = $null
  } | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $launcherDir "state.json") -Encoding utf8
  Write-Host "[desktop-smoke] seeded stale same-version bundle: $seedVersion"
}

$resolvedExe = (Resolve-Path $DesktopExePath).Path
$isPortableSmoke = -not [string]::IsNullOrWhiteSpace($PortableRoot)
$resolvedPortableRoot = ""
if ($isPortableSmoke) {
  $resolvedPortableRoot = (Resolve-Path $PortableRoot).Path
}
$tempRoot = Get-SmokeTempRoot
$smokeHome = if ($isPortableSmoke) {
  Join-Path $resolvedPortableRoot "data\desktop"
} else {
  Join-Path $tempRoot "nextclaw-desktop-smoke-home"
}
$portableRuntimeHome = if ($isPortableSmoke) {
  Join-Path $resolvedPortableRoot "data\runtime-home"
} else {
  $smokeHome
}
$logRoot = Join-Path $tempRoot "nextclaw-desktop-smoke-logs"
$appStdoutLog = Join-Path $logRoot "app-stdout.log"
$appStderrLog = Join-Path $logRoot "app-stderr.log"
$apiProbeLog = Join-Path $logRoot "api-probes.json"
$script:ServiceAppProbeLog = Join-Path $logRoot "service-app-probes.json"
$script:MainLog = Join-Path $smokeHome "launcher\\main.log"
$script:ServiceLog = Join-Path $portableRuntimeHome "service.log"
$script:MainLogStartLine = 1

Write-Host "[desktop-smoke] desktop exe: $resolvedExe"
Write-Host "[desktop-smoke] temp root: $tempRoot"
Write-Host "[desktop-smoke] smoke home: $smokeHome"
Write-Host "[desktop-smoke] portable smoke: $isPortableSmoke"
if ($isPortableSmoke) {
  Write-Host "[desktop-smoke] portable root: $resolvedPortableRoot"
}
Write-Host "[desktop-smoke] startup timeout: ${StartupTimeoutSec}s"
Write-Host "[desktop-smoke] max GUI ready time: ${MaxReadySec}s"
Write-Host "[desktop-smoke] seed stale same-version bundle: $($SeedStaleSameVersionBundle.IsPresent)"

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $smokeHome
if ($isPortableSmoke) {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $resolvedPortableRoot "data")
}
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $logRoot
if (-not $isPortableSmoke) {
  New-Item -ItemType Directory -Path $smokeHome -Force | Out-Null
}
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
if ($SeedStaleSameVersionBundle.IsPresent) {
  Seed-StaleSameVersionBundleState -DesktopExePath $resolvedExe -SmokeHome $smokeHome
}
if ($isPortableSmoke) {
  Remove-Item Env:\NEXTCLAW_HOME -ErrorAction SilentlyContinue
  Remove-Item Env:\NEXTCLAW_DESKTOP_RUNTIME_HOME_OVERRIDE -ErrorAction SilentlyContinue
  Remove-Item Env:\NEXTCLAW_DESKTOP_DATA_DIR_OVERRIDE -ErrorAction SilentlyContinue
} else {
  $env:NEXTCLAW_HOME = $smokeHome
  $env:NEXTCLAW_DESKTOP_RUNTIME_HOME_OVERRIDE = $smokeHome
  $env:NEXTCLAW_DESKTOP_DATA_DIR_OVERRIDE = $smokeHome
  $env:NEXTCLAW_DESKTOP_SMOKE_TITLEBAR_HIT_TEST = "1"
}

$appProc = $null
$desktopRootPid = $null
try {
  Write-Host "[desktop-smoke] launching desktop app"
  if (Test-Path $script:MainLog) {
    $script:MainLogStartLine = ((Get-Content -Path $script:MainLog | Measure-Object -Line).Lines + 1)
  }
  $appProc = Start-Process -FilePath $resolvedExe -PassThru -RedirectStandardOutput $appStdoutLog -RedirectStandardError $appStderrLog
  $desktopRootPid = $appProc.Id
  $deadline = (Get-Date).AddSeconds($StartupTimeoutSec)
  $readyDeadline = (Get-Date).AddSeconds($MaxReadySec)
  $startedAt = Get-Date
  $runtimeBaseUrl = $null
  $apiReady = $false

  while ((Get-Date) -lt $deadline) {
    if ($appProc.HasExited) {
      if ($appProc.ExitCode -ne 0) {
        throw "Desktop exited early. ExitCode=$($appProc.ExitCode)"
      }
      $handoffPid = Get-DesktopRootProcessIdFromLog
      if ($null -ne $handoffPid -and $desktopRootPid -ne $handoffPid) {
        $desktopRootPid = $handoffPid
        Write-Host "[desktop-smoke] guardian handoff observed: rootPid=$desktopRootPid"
      }
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
      Invoke-DesktopServiceAppProbe -RuntimeBaseUrl $runtimeBaseUrl
      Invoke-DesktopTitlebarDragProbe -RootPid $desktopRootPid -DesktopExePath $resolvedExe
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
  if ($isPortableSmoke) {
    $expectedDesktopData = Join-Path $resolvedPortableRoot "data\desktop"
    $expectedRuntimeHome = Join-Path $resolvedPortableRoot "data\runtime-home"
    $expectedLogsDir = Join-Path $resolvedPortableRoot "data\logs"
    foreach ($expectedPath in @($expectedDesktopData, $expectedRuntimeHome, $expectedLogsDir)) {
      if (-not (Test-Path $expectedPath)) {
        throw "Portable smoke expected path missing: $expectedPath"
      }
    }
    $logText = ""
    if (Test-Path $script:MainLog) {
      $logText = Get-Content -Raw -Path $script:MainLog
    }
    if ($logText -notmatch "installationKind=portable") {
      throw "Portable smoke did not observe installationKind=portable in $script:MainLog"
    }
    if ($logText -notmatch [regex]::Escape("desktopDataDir=$expectedDesktopData")) {
      throw "Portable smoke did not observe expected desktop data dir in $script:MainLog"
    }
    if ($logText -notmatch [regex]::Escape("runtimeHome=$expectedRuntimeHome")) {
      throw "Portable smoke did not observe expected runtime home in $script:MainLog"
    }
  }
} catch {
  Write-SmokeDiagnostics
  throw
} finally {
  if ($null -ne $desktopRootPid) {
    $desktopRootProcess = Get-Process -Id $desktopRootPid -ErrorAction SilentlyContinue
    if ($null -ne $desktopRootProcess) {
      Stop-ProcessTree -RootPid $desktopRootPid
    }
  }
}
