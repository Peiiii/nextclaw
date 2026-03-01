!include "MUI2.nsh"

!ifdef DAPP_NAME
  !define APP_NAME "${DAPP_NAME}"
!endif

!ifndef APP_NAME
  !define APP_NAME "NextClaw"
!endif

!ifndef APP_VERSION
  !define APP_VERSION "0.0.0"
!endif

!ifndef APP_ARCH
  !define APP_ARCH "x64"
!endif

!ifndef APP_NODE_VERSION
  !define APP_NODE_VERSION "22.20.0"
!endif

!ifndef APP_SOURCE_DIR
  !error "APP_SOURCE_DIR is required"
!endif

!ifndef APP_OUT_FILE
  !error "APP_OUT_FILE is required"
!endif

Name "${APP_NAME} ${APP_VERSION} (${APP_ARCH})"
OutFile "${APP_OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
RequestExecutionLevel user
Unicode true

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${APP_SOURCE_DIR}\*"

  DetailPrint "Checking Node.js runtime..."
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference=''Stop''; if (Get-Command node -ErrorAction SilentlyContinue) { exit 0 }; $version=''${APP_NODE_VERSION}''; $arch=''${APP_ARCH}''; $runtimeRoot=Join-Path $env:LOCALAPPDATA ''NextClaw\runtime''; New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null; $zip=Join-Path $env:TEMP (''node-v'' + $version + ''-win-'' + $arch + ''.zip''); $mirrors=@(''https://npmmirror.com/mirrors/node'',''https://nodejs.org/dist''); if ($env:NEXTCLAW_NODE_DIST_BASES) { $custom=$env:NEXTCLAW_NODE_DIST_BASES.Split('','') | ForEach-Object { $_.Trim().TrimEnd(''/'') } | Where-Object { $_ }; if ($custom.Count -gt 0) { $mirrors=@($custom + $mirrors) } }; $ok=$false; foreach ($mirror in $mirrors) { $url=$mirror.TrimEnd(''/'') + ''/v'' + $version + ''/node-v'' + $version + ''-win-'' + $arch + ''.zip''; try { Invoke-WebRequest -Uri $url -OutFile $zip -TimeoutSec 20; $ok=$true; break } catch { } }; if (-not $ok) { throw ''Failed to download Node.js runtime from configured mirrors.'' }; Expand-Archive -Path $zip -DestinationPath $runtimeRoot -Force; Remove-Item $zip -Force; exit 0"'
  Pop $0
  StrCmp $0 "0" +2
  DetailPrint "Warning: Node.js auto-install failed. NextClaw will retry on first launch."

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Start ${APP_NAME}.lnk" "$INSTDIR\Start NextClaw.cmd"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\Start NextClaw.cmd"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "Publisher" "NextClaw"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Start ${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
  RMDir /r "$INSTDIR"
SectionEnd
