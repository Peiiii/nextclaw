#!/usr/bin/env bash
set -euo pipefail

APPIMAGE_PATH="${1:-}"
STARTUP_TIMEOUT_SEC="${2:-120}"

if [[ -z "${APPIMAGE_PATH}" ]]; then
  echo "[desktop-smoke] usage: smoke-linux-appimage.sh <appimage-path> [startup-timeout-sec]" >&2
  exit 1
fi

if [[ ! -f "${APPIMAGE_PATH}" ]]; then
  echo "[desktop-smoke] appimage not found: ${APPIMAGE_PATH}" >&2
  exit 1
fi

# Resolve AppImage path before changing directory during extraction.
APPIMAGE_DIR="$(cd "$(dirname "${APPIMAGE_PATH}")" && pwd)"
APPIMAGE_NAME="$(basename "${APPIMAGE_PATH}")"
APPIMAGE_PATH="${APPIMAGE_DIR}/${APPIMAGE_NAME}"

if ! [[ "${STARTUP_TIMEOUT_SEC}" =~ ^[0-9]+$ ]]; then
  echo "[desktop-smoke] invalid startup timeout: ${STARTUP_TIMEOUT_SEC}" >&2
  exit 1
fi

TEMP_ROOT="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
SMOKE_HOME="${TEMP_ROOT}/nextclaw-desktop-smoke-home"
LOG_ROOT="${TEMP_ROOT}/nextclaw-desktop-smoke-logs"
EXTRACT_ROOT="${TEMP_ROOT}/nextclaw-desktop-appimage-extract"
APP_HEALTH_LOG="${LOG_ROOT}/health.json"
RUNTIME_STDOUT_LOG="${LOG_ROOT}/runtime-stdout.log"
APPIMAGE_LOG="${LOG_ROOT}/appimage-extract.log"

RUNTIME_PID=""

cleanup() {
  if [[ -n "${RUNTIME_PID}" ]] && kill -0 "${RUNTIME_PID}" 2>/dev/null; then
    kill -TERM "${RUNTIME_PID}" 2>/dev/null || true
    sleep 1
    kill -KILL "${RUNTIME_PID}" 2>/dev/null || true
  fi
  rm -rf "${EXTRACT_ROOT}" >/dev/null 2>&1 || true
}

trap cleanup EXIT

find_runtime_script() {
  local extract_dir="$1"
  local candidates=(
    "${extract_dir}/resources/app.asar/node_modules/nextclaw/dist/cli/app/index.js"
    "${extract_dir}/resources/app.asar/node_modules/nextclaw/dist/cli/index.js"
    "${extract_dir}/resources/app/node_modules/nextclaw/dist/cli/app/index.js"
    "${extract_dir}/resources/app/node_modules/nextclaw/dist/cli/index.js"
    "${extract_dir}/resources/node_modules/nextclaw/dist/cli/app/index.js"
    "${extract_dir}/resources/node_modules/nextclaw/dist/cli/index.js"
    "${extract_dir}/usr/lib/nextclaw-desktop/resources/app.asar/node_modules/nextclaw/dist/cli/app/index.js"
    "${extract_dir}/usr/lib/nextclaw-desktop/resources/app.asar/node_modules/nextclaw/dist/cli/index.js"
    "${extract_dir}/usr/lib/nextclaw-desktop/resources/app/node_modules/nextclaw/dist/cli/app/index.js"
    "${extract_dir}/usr/lib/nextclaw-desktop/resources/app/node_modules/nextclaw/dist/cli/index.js"
  )

  local candidate
  local asar_base
  for candidate in "${candidates[@]}"; do
    if [[ "${candidate}" == *"/app.asar/"* ]]; then
      asar_base="${candidate%%/node_modules/*}"
      if [[ -f "${asar_base}" ]]; then
        echo "${candidate}"
        return 0
      fi
    fi

    if [[ -f "${candidate}" ]]; then
      echo "${candidate}"
      return 0
    fi
  done

  return 1
}

find_app_bin() {
  local extract_dir="$1"
  local candidates=(
    "${extract_dir}/@nextclawdesktop"
    "${extract_dir}/nextclaw-desktop"
    "${extract_dir}/NextClaw Desktop"
    "${extract_dir}/usr/bin/@nextclawdesktop"
    "${extract_dir}/usr/bin/nextclaw-desktop"
    "${extract_dir}/usr/bin/NextClaw Desktop"
    "${extract_dir}/AppRun"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -x "${candidate}" ]]; then
      echo "${candidate}"
      return 0
    fi
  done

  return 1
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :${port} )" 2>/dev/null | awk 'NR>1 {print $1}' | grep -q LISTEN && return 0
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  fi
  return 1
}

pick_runtime_port() {
  local port
  for ((port=55667; port<=55716; port++)); do
    if ! port_in_use "${port}"; then
      echo "${port}"
      return 0
    fi
  done
  return 1
}

mkdir -p "${LOG_ROOT}"
rm -rf "${SMOKE_HOME}" "${EXTRACT_ROOT}"
mkdir -p "${SMOKE_HOME}" "${EXTRACT_ROOT}"

echo "[desktop-smoke] appimage: ${APPIMAGE_PATH}"
echo "[desktop-smoke] temp root: ${TEMP_ROOT}"
echo "[desktop-smoke] smoke home: ${SMOKE_HOME}"

chmod +x "${APPIMAGE_PATH}"

echo "[desktop-smoke] extracting AppImage"
(
  cd "${EXTRACT_ROOT}"
  "${APPIMAGE_PATH}" --appimage-extract >"${APPIMAGE_LOG}" 2>&1
)

EXTRACT_DIR="${EXTRACT_ROOT}/squashfs-root"
if [[ ! -d "${EXTRACT_DIR}" ]]; then
  echo "[desktop-smoke] extract failed: ${EXTRACT_DIR} not found. See ${APPIMAGE_LOG}" >&2
  exit 1
fi

APP_BIN="$(find_app_bin "${EXTRACT_DIR}" || true)"
if [[ -z "${APP_BIN}" ]]; then
  echo "[desktop-smoke] no executable app binary found under ${EXTRACT_DIR}" >&2
  exit 1
fi

RUNTIME_SCRIPT="$(find_runtime_script "${EXTRACT_DIR}" || true)"
if [[ -z "${RUNTIME_SCRIPT}" ]]; then
  echo "[desktop-smoke] runtime script not found in extracted AppImage" >&2
  exit 1
fi

RUNTIME_PORT="$(pick_runtime_port || true)"
if [[ -z "${RUNTIME_PORT}" ]]; then
  echo "[desktop-smoke] no available port in 55667-55716" >&2
  exit 1
fi

echo "[desktop-smoke] runtime fallback: init"
if ! NEXTCLAW_HOME="${SMOKE_HOME}" ELECTRON_RUN_AS_NODE=1 "${APP_BIN}" "${RUNTIME_SCRIPT}" init >"${RUNTIME_STDOUT_LOG}" 2>&1; then
  echo "[desktop-smoke] runtime init failed. See ${RUNTIME_STDOUT_LOG}" >&2
  exit 1
fi

echo "[desktop-smoke] runtime fallback: serve on ${RUNTIME_PORT}"
NEXTCLAW_HOME="${SMOKE_HOME}" ELECTRON_RUN_AS_NODE=1 "${APP_BIN}" "${RUNTIME_SCRIPT}" serve --ui-port "${RUNTIME_PORT}" >>"${RUNTIME_STDOUT_LOG}" 2>&1 &
RUNTIME_PID="$!"

STARTED_AT="$(date +%s)"
while true; do
  if ! kill -0 "${RUNTIME_PID}" 2>/dev/null; then
    echo "[desktop-smoke] runtime exited early. See ${RUNTIME_STDOUT_LOG}" >&2
    exit 1
  fi

  if curl -fsS --max-time 2 "http://127.0.0.1:${RUNTIME_PORT}/api/health" >"${APP_HEALTH_LOG}" 2>/dev/null; then
    if grep -q '"ok":true' "${APP_HEALTH_LOG}" && grep -q '"status":"ok"' "${APP_HEALTH_LOG}"; then
      echo "[desktop-smoke] runtime fallback health check passed: http://127.0.0.1:${RUNTIME_PORT}/api/health"
      exit 0
    fi
  fi

  NOW="$(date +%s)"
  if (( NOW - STARTED_AT >= STARTUP_TIMEOUT_SEC )); then
    echo "[desktop-smoke] runtime health timeout within ${STARTUP_TIMEOUT_SEC}s. See ${RUNTIME_STDOUT_LOG}" >&2
    exit 1
  fi

  sleep 1
done
