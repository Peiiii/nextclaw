param()

$ErrorActionPreference = "Stop"

if (-not $IsWindows) {
  throw "This smoke test must run on Windows."
}

function Initialize-MinimalAppRegionProbe {
  if ("NextClawMinimalAppRegionNative" -as [type]) {
    return
  }

  Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class NextClawMinimalAppRegionNative {
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

  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

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

function Stop-ProcessTree {
  param([int]$RootPid)

  $processIds = @(Get-DescendantProcessIds -RootPid $RootPid)
  [array]::Reverse($processIds)
  foreach ($processId in $processIds + @($RootPid)) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } catch {
      continue
    }
  }
}

function Get-MainWindowHandleForProcessTree {
  param([int]$RootPid)

  $candidatePids = @($RootPid) + @(Get-DescendantProcessIds -RootPid $RootPid)
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

  return [IntPtr]::Zero
}

function Read-WindowRect {
  param([IntPtr]$WindowHandle)

  Initialize-MinimalAppRegionProbe
  $rect = New-Object NextClawMinimalAppRegionNative+RECT
  if (-not [NextClawMinimalAppRegionNative]::GetWindowRect($WindowHandle, [ref]$rect)) {
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

function Convert-ClientPointToScreen {
  param(
    [IntPtr]$WindowHandle,
    [int]$X,
    [int]$Y
  )

  Initialize-MinimalAppRegionProbe
  $point = New-Object NextClawMinimalAppRegionNative+POINT
  $point.X = $X
  $point.Y = $Y
  if (-not [NextClawMinimalAppRegionNative]::ClientToScreen($WindowHandle, [ref]$point)) {
    throw "ClientToScreen failed for window handle $WindowHandle"
  }

  return [pscustomobject]@{
    X = $point.X
    Y = $point.Y
  }
}

function Invoke-MinimalAppRegionDragProbe {
  param(
    [int]$RootPid,
    [string]$Variant
  )

  Initialize-MinimalAppRegionProbe

  $windowHandle = [IntPtr]::Zero
  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    $windowHandle = Get-MainWindowHandleForProcessTree -RootPid $RootPid
    if ($windowHandle -ne [IntPtr]::Zero) {
      break
    }
    Start-Sleep -Milliseconds 500
  }

  if ($windowHandle -eq [IntPtr]::Zero) {
    throw "Could not find a window handle for minimal Electron process tree rooted at $RootPid"
  }

  [NextClawMinimalAppRegionNative]::ShowWindow($windowHandle, 9) | Out-Null
  [NextClawMinimalAppRegionNative]::SetForegroundWindow($windowHandle) | Out-Null
  Start-Sleep -Milliseconds 500

  if (-not [NextClawMinimalAppRegionNative]::MoveWindow($windowHandle, 80, 80, 760, 520, $true)) {
    throw "MoveWindow failed while preparing minimal app-region probe for window handle $windowHandle"
  }
  Start-Sleep -Milliseconds 800

  $before = Read-WindowRect -WindowHandle $windowHandle
  $clientStartX = 400
  $clientStartY = 24
  $startPoint = Convert-ClientPointToScreen -WindowHandle $windowHandle -X $clientStartX -Y $clientStartY
  $startX = $startPoint.X
  $startY = $startPoint.Y
  $endX = $startX + 140
  $endY = $startY + 80
  $mainHitTest = [NextClawMinimalAppRegionNative]::HitTest($windowHandle, $startX, $startY)
  $pointWindowHandle = [NextClawMinimalAppRegionNative]::WindowFromScreenPoint($startX, $startY)
  $pointClassName = [NextClawMinimalAppRegionNative]::ClassName($pointWindowHandle)
  $rootFromPointHandle = [NextClawMinimalAppRegionNative]::RootWindow($pointWindowHandle)
  $rootClassName = [NextClawMinimalAppRegionNative]::ClassName($rootFromPointHandle)
  $pointHitTest = [NextClawMinimalAppRegionNative]::HitTest($pointWindowHandle, $startX, $startY)
  $rootHitTest = [NextClawMinimalAppRegionNative]::HitTest($rootFromPointHandle, $startX, $startY)

  Write-Host "[minimal-app-region] $Variant probe: before=($($before.Left),$($before.Top)) clientStart=($clientStartX,$clientStartY) screenStart=($startX,$startY) mainHandle=$windowHandle mainHitTest=$mainHitTest pointHandle=$pointWindowHandle pointClass=$pointClassName pointHitTest=$pointHitTest rootHandle=$rootFromPointHandle rootClass=$rootClassName rootHitTest=$rootHitTest"

  $mouseLeftDown = 0x0002
  $mouseLeftUp = 0x0004
  [NextClawMinimalAppRegionNative]::SetCursorPos($startX, $startY) | Out-Null
  Start-Sleep -Milliseconds 200
  [NextClawMinimalAppRegionNative]::mouse_event($mouseLeftDown, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 200
  [NextClawMinimalAppRegionNative]::SetCursorPos($endX, $endY) | Out-Null
  Start-Sleep -Milliseconds 700
  [NextClawMinimalAppRegionNative]::mouse_event($mouseLeftUp, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 900

  $after = Read-WindowRect -WindowHandle $windowHandle
  $deltaX = $after.Left - $before.Left
  $deltaY = $after.Top - $before.Top
  Write-Host "[minimal-app-region] $Variant geometry: end=($endX,$endY) after=($($after.Left),$($after.Top)) delta=($deltaX,$deltaY)"

  if ([Math]::Abs($deltaX) -lt 40 -and [Math]::Abs($deltaY) -lt 40) {
    throw "Minimal Electron app-region probe failed for $Variant: window did not move after real mouse drag. before=($($before.Left),$($before.Top)) after=($($after.Left),$($after.Top)) mainHitTest=$mainHitTest pointHitTest=$pointHitTest rootHitTest=$rootHitTest"
  }
}

function New-MinimalAppRegionApp {
  param(
    [string]$Variant,
    [string]$WindowOptionLines
  )

  $appRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("nextclaw-minimal-app-region-$Variant-" + [System.Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $appRoot | Out-Null

  Set-Content -Path (Join-Path $appRoot "package.json") -Encoding UTF8 -Value @'
{
  "name": "nextclaw-minimal-app-region-smoke",
  "version": "0.0.0",
  "main": "main.js"
}
'@

  Set-Content -Path (Join-Path $appRoot "main.js") -Encoding UTF8 -Value @"
const { app, BrowserWindow } = require("electron");
const path = require("node:path");

app.commandLine.appendSwitch("disable-gpu");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 760,
    height: 520,
    x: 80,
    y: 80,
$WindowOptionLines
    resizable: true,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await win.loadFile(path.join(__dirname, "index.html"));
  win.show();
});

app.on("window-all-closed", () => {
  app.quit();
});
"@

  Set-Content -Path (Join-Path $appRoot "index.html") -Encoding UTF8 -Value @'
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        font-family: system-ui, sans-serif;
      }

      .titlebar {
        height: 48px;
        background: #dbeafe;
        user-select: none;
        -webkit-app-region: drag;
        app-region: drag;
      }

      .content {
        height: calc(100% - 48px);
        padding: 24px;
        background: #ffffff;
        color: #111827;
        -webkit-app-region: no-drag;
        app-region: no-drag;
      }
    </style>
  </head>
  <body>
    <div class="titlebar" data-testid="minimal-drag-region"></div>
    <main class="content">minimal Electron app-region smoke</main>
  </body>
</html>
'@

  return $appRoot
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktopRoot = Resolve-Path (Join-Path $scriptRoot "..")
$repoRoot = Resolve-Path (Join-Path $desktopRoot "..\..")
$electronCmd = Resolve-Path (Join-Path $desktopRoot "node_modules\.bin\electron.cmd")
$variants = @(
  [pscustomobject]@{
    Name = "frame-false"
    WindowOptionLines = "    frame: false,"
  },
  [pscustomobject]@{
    Name = "frame-false-hidden"
    WindowOptionLines = @'
    frame: false,
    titleBarStyle: "hidden",
'@
  }
)

Write-Host "[minimal-app-region] electron: $electronCmd"

foreach ($variant in $variants) {
  $appRoot = New-MinimalAppRegionApp -Variant $variant.Name -WindowOptionLines $variant.WindowOptionLines
  Write-Host "[minimal-app-region] $($variant.Name) app: $appRoot"
  $electronProcess = Start-Process -FilePath $electronCmd -ArgumentList @($appRoot) -WorkingDirectory $repoRoot -PassThru

  try {
    Invoke-MinimalAppRegionDragProbe -RootPid $electronProcess.Id -Variant $variant.Name
    Write-Host "[minimal-app-region] $($variant.Name) drag smoke passed"
  } finally {
    Stop-ProcessTree -RootPid $electronProcess.Id
    Remove-Item -Recurse -Force -Path $appRoot -ErrorAction SilentlyContinue
  }
}
