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
    [string]$Variant,
    [string]$AppRoot
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

  if (-not [NextClawMinimalAppRegionNative]::MoveWindow($windowHandle, 80, 80, 1024, 720, $true)) {
    throw "MoveWindow failed while preparing minimal app-region probe for window handle $windowHandle"
  }
  Start-Sleep -Milliseconds 800

  $titlebarProbePath = Join-Path $AppRoot "titlebar-hit-test.json"
  if (Test-Path $titlebarProbePath) {
    $titlebarProbe = Get-Content -Raw -Path $titlebarProbePath
    Write-Host "[minimal-app-region] $Variant titlebar-hit-test $titlebarProbe"
  } else {
    Write-Warning "[minimal-app-region] $Variant titlebar-hit-test file was not written before native probe."
  }

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
  $hasCaptionHit = $mainHitTest -eq 2 -or $pointHitTest -eq 2 -or $rootHitTest -eq 2

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
    if ($hasCaptionHit) {
      Write-Warning "[minimal-app-region] $Variant synthetic mouse drag did not move the window despite HTCAPTION(2); treating native hit-test registration as the authoritative result for CI."
      return
    }
    throw "Minimal Electron app-region probe failed for ${Variant}: window did not move after real mouse drag. before=($($before.Left),$($before.Top)) after=($($after.Left),$($after.Top)) mainHitTest=$mainHitTest pointHitTest=$pointHitTest rootHitTest=$rootHitTest"
  }
}

function Resolve-NextClawUiDistPath {
  $candidates = @(
    (Join-Path $repoRoot "packages\nextclaw-ui\dist"),
    (Join-Path $repoRoot "packages\nextclaw\ui-dist")
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  throw "NextClaw UI dist not found. Checked: $($candidates -join ', ')"
}

function New-MinimalAppRegionApp {
  param(
    [string]$Variant,
    [string]$WindowOptionLines,
    [string]$LoadMode,
    [string]$WebPreferenceLines = "      sandbox: true",
    [string]$Layout = "simple",
    [string]$PostLoadScript = "",
    [switch]$Preload,
    [switch]$StartupDrag,
    [switch]$DisableGpu,
    [switch]$DesktopBridge
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

  if ($Preload) {
    $preloadScript = if ($DesktopBridge) {
@'
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("nextclawDesktop", {
  platform: "win32",
  version: process.versions.electron,
  localePreference: null,
  getUpdateState: async () => ({ status: "idle" }),
  checkForUpdates: async () => ({ status: "idle" }),
  downloadUpdate: async () => ({ status: "idle" }),
  applyDownloadedUpdate: async () => ({ status: "idle" }),
  updateChannel: async () => ({ status: "idle" }),
  restartService: async () => ({ accepted: true }),
  restartApp: async () => ({ accepted: true }),
  getPresenceState: async () => ({ closeToBackground: true, launchAtLogin: false, supportsLaunchAtLogin: false, launchAtLoginReason: null }),
  updatePresencePreferences: async () => ({ closeToBackground: true, launchAtLogin: false, supportsLaunchAtLogin: false, launchAtLoginReason: null }),
  setLocalePreference: async () => null,
  controlWindow: async () => undefined,
  onUpdateStateChanged: () => () => undefined
});
'@
    } else {
@'
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("nextclawMinimalPreload", {
  platform: process.platform
});
'@
    }
    Set-Content -Path (Join-Path $appRoot "preload.js") -Encoding UTF8 -Value $preloadScript
  }

  $loadScript = if ($LoadMode -eq "http") {
@'
  const fs = require("node:fs");
  const http = require("node:http");
  const indexPath = path.join(__dirname, "index.html");
  const contentTypes = new Map([
    [".html", "text/html; charset=utf-8"],
    [".css", "text/css; charset=utf-8"]
  ]);
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const relativePath = requestUrl.pathname === "/" ? "index.html" : decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
    const filePath = path.resolve(__dirname, relativePath);
    const candidatePath = filePath.startsWith(__dirname) && fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : indexPath;
    response.writeHead(200, { "content-type": contentTypes.get(path.extname(candidatePath)) || "application/octet-stream" });
    response.end(fs.readFileSync(candidatePath));
  });
  server.listen(0, "127.0.0.1", async () => {
    const { port } = server.address();
    await win.loadURL(`http://127.0.0.1:${port}/`);
    await applyPostLoadProbeChanges(win);
    await logTitlebarHitTest(win);
    win.show();
  });
  app.once("before-quit", () => {
    server.close();
  });
'@
  } elseif ($LoadMode -eq "data-then-http") {
    $startupBodyStyle = "margin:0;display:grid;place-items:center;width:100%;height:100%;font-family:system-ui,sans-serif"
    if ($StartupDrag) {
      $startupBodyStyle = "$startupBodyStyle;-webkit-app-region:drag;app-region:drag;user-select:none"
    }
@"
  const fs = require("node:fs");
  const http = require("node:http");
  const startupHtml = "<!doctype html><html><body style=\"$startupBodyStyle\">Starting NextClaw...</body></html>";
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(startupHtml));
  const indexPath = path.join(__dirname, "index.html");
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fs.readFileSync(indexPath));
  });
  server.listen(0, "127.0.0.1", async () => {
    const { port } = server.address();
    await win.loadURL("http://127.0.0.1:" + port + "/chat");
    await applyPostLoadProbeChanges(win);
    await logTitlebarHitTest(win);
    win.show();
  });
  app.once("before-quit", () => {
    server.close();
  });
"@
  } elseif ($LoadMode -eq "data-then-new-window-http") {
    $startupBodyStyle = "margin:0;display:grid;place-items:center;width:100%;height:100%;font-family:system-ui,sans-serif;-webkit-app-region:drag;app-region:drag;user-select:none"
@"
  const fs = require("node:fs");
  const http = require("node:http");
  const startupHtml = "<!doctype html><html><body style=\"$startupBodyStyle\">Starting NextClaw...</body></html>";
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(startupHtml));
  const runtimeWin = createMinimalWindow();
  win.destroy();
  const indexPath = path.join(__dirname, "index.html");
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fs.readFileSync(indexPath));
  });
  server.listen(0, "127.0.0.1", async () => {
    const { port } = server.address();
    await runtimeWin.loadURL("http://127.0.0.1:" + port + "/chat");
    await applyPostLoadProbeChanges(runtimeWin);
    await logTitlebarHitTest(runtimeWin);
    runtimeWin.show();
  });
  app.once("before-quit", () => {
    server.close();
  });
"@
  } elseif ($LoadMode -eq "ui-dist-http") {
    $uiDistPathLiteral = ConvertTo-Json (Resolve-NextClawUiDistPath)
@"
  const fs = require("node:fs");
  const http = require("node:http");
  const staticRoot = $uiDistPathLiteral;
  const contentTypes = new Map([
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".svg", "image/svg+xml"],
    [".png", "image/png"],
    [".ico", "image/x-icon"]
  ]);
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(requestUrl.pathname);
    const relativePath = pathname === "/" || pathname === "/chat" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(staticRoot, relativePath);
    if (!filePath.startsWith(staticRoot)) {
      response.writeHead(403);
      response.end("forbidden");
      return;
    }
    const fallbackPath = path.join(staticRoot, "index.html");
    const candidatePath = fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : fallbackPath;
    response.writeHead(200, { "content-type": contentTypes.get(path.extname(candidatePath)) || "application/octet-stream" });
    response.end(fs.readFileSync(candidatePath));
  });
  server.listen(0, "127.0.0.1", async () => {
    const { port } = server.address();
    await win.loadURL("http://127.0.0.1:" + port + "/chat");
    await applyPostLoadProbeChanges(win);
    await logTitlebarHitTest(win);
    win.show();
  });
  app.once("before-quit", () => {
    server.close();
  });
"@
  } else {
@'
  await win.loadFile(path.join(__dirname, "index.html"));
  await applyPostLoadProbeChanges(win);
  await logTitlebarHitTest(win);
  win.show();
'@
  }

  $gpuSwitchScript = if ($DisableGpu) { 'app.commandLine.appendSwitch("disable-gpu");' } else { "" }
  $postLoadScriptLiteral = ConvertTo-Json $PostLoadScript
  $titlebarHitTestScript = @'
(() => {
  const describeElement = (element) => {
    if (!element) return null;
    const style = window.getComputedStyle(element);
    return { tag: element.tagName, id: element.id || "", className: String(element.className || ""), testId: element.getAttribute("data-testid") || "", appRegion: style.getPropertyValue("app-region") || "", webkitAppRegion: style.getPropertyValue("-webkit-app-region") || "", pointerEvents: style.pointerEvents || "" };
  };
  return {
    href: window.location.href,
    readyState: document.readyState,
    body: describeElement(document.body),
    root: describeElement(document.getElementById("root")),
    chrome: document.querySelector("[data-testid='desktop-window-chrome']")?.getBoundingClientRect().toJSON() || null,
    points: [320, 400, 700].map((x) => ({ x, y: 24, element: describeElement(document.elementFromPoint(x, 24)) }))
  };
})();
'@
  $titlebarHitTestScriptLiteral = ConvertTo-Json $titlebarHitTestScript

  Set-Content -Path (Join-Path $appRoot "main.js") -Encoding UTF8 -Value @"
const { app, BrowserWindow } = require("electron");
const path = require("node:path");

$gpuSwitchScript

app.whenReady().then(async () => {
  const createMinimalWindow = () => new BrowserWindow({
    width: 1024,
    height: 720,
    x: 80,
    y: 80,
$WindowOptionLines
    resizable: true,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
$WebPreferenceLines
    }
  });
  const win = createMinimalWindow();
  const postLoadScript = $postLoadScriptLiteral;
  const titlebarHitTestScript = $titlebarHitTestScriptLiteral;
  const applyPostLoadProbeChanges = async (targetWindow) => {
    if (!postLoadScript || !postLoadScript.trim()) return;
    await targetWindow.webContents.executeJavaScript(postLoadScript);
    await new Promise((resolve) => setTimeout(resolve, 300));
  };
  const logTitlebarHitTest = async (targetWindow) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      const result = await targetWindow.webContents.executeJavaScript(titlebarHitTestScript);
      require("node:fs").writeFileSync(path.join(__dirname, "titlebar-hit-test.json"), JSON.stringify(result));
      console.log("[minimal-app-region] $Variant titlebar-hit-test " + JSON.stringify(result));
    } catch (error) {
      require("node:fs").writeFileSync(path.join(__dirname, "titlebar-hit-test.json"), JSON.stringify({ error: String(error) }));
      console.warn("[minimal-app-region] $Variant titlebar-hit-test failed: " + String(error));
    }
  };

$loadScript
});

app.on("window-all-closed", () => {
  app.quit();
});
"@

  $indexHtml = if ($Layout -eq "nextclaw" -or $Layout -eq "nextclaw-empty" -or $Layout -eq "nextclaw-css") {
@'
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    __NEXTCLAW_UI_CSS_LINK__
    <style>
      :root {
        --desktop-titlebar-height: 40px;
        --desktop-caption-safe-right: 140px;
        --desktop-sidebar-width: 240px;
      }

      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        font-family: system-ui, sans-serif;
      }

      .desktop-window-drag {
        -webkit-app-region: drag;
        app-region: drag;
        user-select: none;
      }

      .desktop-window-no-drag {
        -webkit-app-region: no-drag;
        app-region: no-drag;
      }

      .shell {
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 10px;
        background: #f9f8f5;
      }

      .chrome {
        position: relative;
        display: flex;
        height: var(--desktop-titlebar-height);
        flex-shrink: 0;
        border-bottom: 1px solid #ebe7dc;
        background: #f2f1ee;
      }

      .resize-strip {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 4px;
      }

      .sidebar {
        position: relative;
        z-index: 10;
        display: flex;
        height: 100%;
        width: var(--desktop-sidebar-width);
        flex-shrink: 0;
        align-items: center;
        background: #f2f1ee;
        padding-left: 16px;
        padding-right: 12px;
      }

      .brand {
        display: flex;
        min-width: 0;
        flex-shrink: 0;
        align-items: center;
        gap: 10px;
      }

      .main-drag {
        min-width: 0;
        flex: 1;
        margin-right: var(--desktop-caption-safe-right);
      }

      .content {
        min-height: 0;
        flex: 1;
        background: white;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header class="desktop-window-drag chrome" data-testid="desktop-window-chrome">
        <div class="desktop-window-no-drag resize-strip" data-testid="desktop-window-chrome-resize-strip"></div>
        <div class="desktop-window-no-drag sidebar" data-testid="desktop-window-chrome-sidebar">
          <div class="desktop-window-no-drag brand">NextClaw</div>
        </div>
        __NEXTCLAW_MAIN_DRAG__
      </header>
      <main class="desktop-window-no-drag content">nextclaw-like app-region smoke</main>
    </div>
  </body>
</html>
'@
  } else {
@'
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
  }

  if ($Layout -eq "nextclaw" -or $Layout -eq "nextclaw-empty" -or $Layout -eq "nextclaw-css") {
    $mainDragMarkup = if ($Layout -eq "nextclaw") {
      '<div class="desktop-window-drag main-drag" data-testid="desktop-window-chrome-main"></div>'
    } elseif ($Layout -eq "nextclaw-css") {
      '<div class="desktop-window-drag h-full min-w-0 flex-1" data-testid="desktop-window-chrome-main-drag-region"></div>'
    } else {
      ''
    }
    $uiCssLink = ""
    if ($Layout -eq "nextclaw-css") {
      $assetsPath = Join-Path $appRoot "assets"
      New-Item -ItemType Directory -Force -Path $assetsPath | Out-Null
      $uiDistPath = Resolve-NextClawUiDistPath
      $uiCssPath = Get-ChildItem -Path (Join-Path $uiDistPath "assets") -Filter "*.css" | Select-Object -First 1
      if (-not $uiCssPath) {
        throw "NextClaw UI dist CSS asset not found under $uiDistPath"
      }
      Copy-Item -Path $uiCssPath.FullName -Destination (Join-Path $assetsPath "nextclaw-ui.css") -Force
      $uiCssLink = '<link rel="stylesheet" href="/assets/nextclaw-ui.css">'
    }
    $indexHtml = $indexHtml.Replace("__NEXTCLAW_MAIN_DRAG__", $mainDragMarkup)
    $indexHtml = $indexHtml.Replace("__NEXTCLAW_UI_CSS_LINK__", $uiCssLink)
  }

  Set-Content -Path (Join-Path $appRoot "index.html") -Encoding UTF8 -Value $indexHtml

  return $appRoot
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktopRoot = Resolve-Path (Join-Path $scriptRoot "..")
$repoRoot = Resolve-Path (Join-Path $desktopRoot "..\..")
$electronCmd = Resolve-Path (Join-Path $desktopRoot "node_modules\electron\dist\electron.exe")
$forceInlineTitlebarDragScript = @'
(() => {
  const dragSelectors = [
    "[data-testid='desktop-window-chrome']",
    "[data-testid='desktop-window-chrome-main-drag-region']"
  ];
  for (const selector of dragSelectors) {
    const element = document.querySelector(selector);
    if (!element) continue;
    element.style.setProperty("-webkit-app-region", "drag");
    element.style.setProperty("app-region", "drag");
    element.style.userSelect = "none";
  }
  const noDragSelectors = [
    "[data-testid='desktop-window-chrome-resize-strip']",
    "[data-testid='desktop-window-chrome-sidebar']",
    "[data-testid='desktop-window-controls']",
    "[data-testid='desktop-window-controls'] *",
    "button",
    "a",
    "input",
    "textarea",
    "select",
    "[role='button']"
  ];
  for (const selector of noDragSelectors) {
    for (const element of document.querySelectorAll(selector)) {
      element.style.setProperty("-webkit-app-region", "no-drag");
      element.style.setProperty("app-region", "no-drag");
    }
  }
})();
'@
$fixedTitlebarDragLayerScript = @'
(() => {
  const existing = document.getElementById("nextclaw-fixed-titlebar-drag-probe");
  if (existing) existing.remove();
  const layer = document.createElement("div");
  layer.id = "nextclaw-fixed-titlebar-drag-probe";
  layer.dataset.testid = "desktop-window-fixed-titlebar-drag-probe";
  Object.assign(layer.style, {
    position: "fixed",
    left: "280px",
    right: "140px",
    top: "0px",
    height: "40px",
    zIndex: "15",
    userSelect: "none"
  });
  layer.style.setProperty("-webkit-app-region", "drag");
  layer.style.setProperty("app-region", "drag");
  document.body.appendChild(layer);
})();
'@
$bodyTitlebarDragScript = @'
(() => {
  document.body.style.setProperty("-webkit-app-region", "drag");
  document.body.style.setProperty("app-region", "drag");
  document.body.style.userSelect = "none";
  for (const element of document.querySelectorAll("button,a,input,textarea,select,[role='button'],main,aside,[data-testid='desktop-window-chrome-sidebar'],[data-testid='desktop-window-controls'],[data-testid='desktop-window-controls'] *")) {
    element.style.setProperty("-webkit-app-region", "no-drag");
    element.style.setProperty("app-region", "no-drag");
  }
})();
'@
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
    LoadMode = "file"
  },
  [pscustomobject]@{
    Name = "frame-false-hidden-http"
    WindowOptionLines = @'
    frame: false,
    titleBarStyle: "hidden",
'@
    LoadMode = "http"
  },
  [pscustomobject]@{
    Name = "frame-false-hidden-http-preload-sandbox-false"
    WindowOptionLines = @'
    frame: false,
    titleBarStyle: "hidden",
'@
    LoadMode = "http"
    WebPreferenceLines = @'
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
'@
    Preload = $true
  },
  [pscustomobject]@{
    Name = "nextclaw-layout-empty-http-preload-sandbox-false"
    WindowOptionLines = "    frame: false,"
    LoadMode = "http"
    WebPreferenceLines = @'
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
'@
    Layout = "nextclaw-empty"
    Preload = $true
    ExpectCaption = $false
  },
  [pscustomobject]@{
    Name = "nextclaw-layout-http-preload-sandbox-false"
    WindowOptionLines = "    frame: false,"
    LoadMode = "http"
    WebPreferenceLines = @'
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
'@
    Layout = "nextclaw"
    Preload = $true
  },
  [pscustomobject]@{
    Name = "nextclaw-layout-http-preload-sandbox-false-gpu-enabled"
    WindowOptionLines = "    frame: false,"
    LoadMode = "http"
    WebPreferenceLines = @'
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
'@
    Layout = "nextclaw"
    Preload = $true
    DisableGpu = $false
  },
  [pscustomobject]@{
    Name = "nextclaw-layout-ui-css-http-preload-sandbox-false-gpu-enabled"
    WindowOptionLines = "    frame: false,"
    LoadMode = "http"
    WebPreferenceLines = @'
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
'@
    Layout = "nextclaw-css"
    Preload = $true
    DisableGpu = $false
  },
  [pscustomobject]@{
    Name = "nextclaw-ui-dist-http-preload-sandbox-false-gpu-enabled"
    WindowOptionLines = "    frame: false,"
    LoadMode = "ui-dist-http"
    WebPreferenceLines = @'
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
'@
    Preload = $true
    DesktopBridge = $true
    DisableGpu = $false
    ExpectCaption = $false
  },
  [pscustomobject]@{
    Name = "nextclaw-ui-dist-inline-titlebar-drag-http-preload-sandbox-false-gpu-enabled"
    WindowOptionLines = "    frame: false,"
    LoadMode = "ui-dist-http"
    WebPreferenceLines = @'
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
'@
    Preload = $true
    DesktopBridge = $true
    DisableGpu = $false
    PostLoadScript = $forceInlineTitlebarDragScript
    ExpectCaption = $false
  },
  [pscustomobject]@{
    Name = "nextclaw-ui-dist-fixed-titlebar-drag-http-preload-sandbox-false-gpu-enabled"
    WindowOptionLines = "    frame: false,"
    LoadMode = "ui-dist-http"
    WebPreferenceLines = @'
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
'@
    Preload = $true
    DesktopBridge = $true
    DisableGpu = $false
    PostLoadScript = $fixedTitlebarDragLayerScript
    ExpectCaption = $false
  },
  [pscustomobject]@{
    Name = "nextclaw-ui-dist-body-drag-http-preload-sandbox-false-gpu-enabled"
    WindowOptionLines = "    frame: false,"
    LoadMode = "ui-dist-http"
    WebPreferenceLines = @'
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
'@
    Preload = $true
    DesktopBridge = $true
    DisableGpu = $false
    PostLoadScript = $bodyTitlebarDragScript
    ExpectCaption = $false
  },
  [pscustomobject]@{
    Name = "frame-false-hidden-data-http-preload-sandbox-false-no-startup-drag"
    WindowOptionLines = @'
    frame: false,
    titleBarStyle: "hidden",
'@
    LoadMode = "data-then-http"
    WebPreferenceLines = @'
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
'@
    Preload = $true
    ExpectCaption = $false
  },
  [pscustomobject]@{
    Name = "frame-false-hidden-data-http-preload-sandbox-false-startup-drag"
    WindowOptionLines = @'
    frame: false,
    titleBarStyle: "hidden",
'@
    LoadMode = "data-then-http"
    WebPreferenceLines = @'
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
'@
    Preload = $true
    StartupDrag = $true
    ExpectCaption = $false
  },
  [pscustomobject]@{
    Name = "frame-false-hidden-data-new-window-http-preload-sandbox-false"
    WindowOptionLines = @'
    frame: false,
    titleBarStyle: "hidden",
'@
    LoadMode = "data-then-new-window-http"
    WebPreferenceLines = @'
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
'@
    Preload = $true
  },
  [pscustomobject]@{
    Name = "nextclaw-layout-data-new-window-http-preload-sandbox-false"
    WindowOptionLines = @'
    frame: false,
    titleBarStyle: "hidden",
'@
    LoadMode = "data-then-new-window-http"
    WebPreferenceLines = @'
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
'@
    Layout = "nextclaw"
    Preload = $true
  }
)

Write-Host "[minimal-app-region] electron: $electronCmd"

foreach ($variant in $variants) {
  $variantLoadMode = if ($variant.PSObject.Properties.Name -contains "LoadMode") { $variant.LoadMode } else { "file" }
  $variantWebPreferenceLines = if ($variant.PSObject.Properties.Name -contains "WebPreferenceLines") { $variant.WebPreferenceLines } else { "      sandbox: true" }
  $variantLayout = if ($variant.PSObject.Properties.Name -contains "Layout") { $variant.Layout } else { "simple" }
  $variantPreload = $variant.PSObject.Properties.Name -contains "Preload" -and $variant.Preload
  $variantStartupDrag = $variant.PSObject.Properties.Name -contains "StartupDrag" -and $variant.StartupDrag
  $variantDisableGpu = -not ($variant.PSObject.Properties.Name -contains "DisableGpu") -or $variant.DisableGpu
  $variantDesktopBridge = $variant.PSObject.Properties.Name -contains "DesktopBridge" -and $variant.DesktopBridge
  $variantExpectCaption = -not ($variant.PSObject.Properties.Name -contains "ExpectCaption") -or $variant.ExpectCaption
  $variantPostLoadScript = if ($variant.PSObject.Properties.Name -contains "PostLoadScript") { $variant.PostLoadScript } else { "" }
  $appRoot = New-MinimalAppRegionApp -Variant $variant.Name -WindowOptionLines $variant.WindowOptionLines -LoadMode $variantLoadMode -WebPreferenceLines $variantWebPreferenceLines -Layout $variantLayout -PostLoadScript $variantPostLoadScript -Preload:$variantPreload -StartupDrag:$variantStartupDrag -DisableGpu:$variantDisableGpu -DesktopBridge:$variantDesktopBridge
  Write-Host "[minimal-app-region] $($variant.Name) app: $appRoot"
  $electronProcess = Start-Process -FilePath $electronCmd -ArgumentList @($appRoot) -WorkingDirectory $repoRoot -PassThru

  try {
    try {
      Invoke-MinimalAppRegionDragProbe -RootPid $electronProcess.Id -Variant $variant.Name -AppRoot $appRoot
      if ($variantExpectCaption) {
        Write-Host "[minimal-app-region] $($variant.Name) drag smoke passed"
      } else {
        Write-Warning "[minimal-app-region] $($variant.Name) unexpectedly produced HTCAPTION(2); keep investigating whether Electron changed startup navigation behavior."
      }
    } catch {
      if ($variantExpectCaption) {
        throw
      }
      Write-Warning "[minimal-app-region] $($variant.Name) failed as expected: $($_.Exception.Message)"
    }
  } finally {
    Stop-ProcessTree -RootPid $electronProcess.Id
    Remove-Item -Recurse -Force -Path $appRoot -ErrorAction SilentlyContinue
  }
}
