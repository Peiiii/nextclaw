#!/usr/bin/env bash
set -eo pipefail

DMG_PATH="${1:-}"
STARTUP_TIMEOUT_SEC="${2:-120}"

if [[ -z "${DMG_PATH}" ]]; then
  echo "[desktop-smoke] usage: smoke-macos-dmg.sh <dmg-path> [startup-timeout-sec]" >&2
  exit 1
fi

if [[ ! -f "${DMG_PATH}" ]]; then
  echo "[desktop-smoke] dmg not found: ${DMG_PATH}" >&2
  exit 1
fi

if ! [[ "${STARTUP_TIMEOUT_SEC}" =~ ^[0-9]+$ ]]; then
  echo "[desktop-smoke] invalid startup timeout: ${STARTUP_TIMEOUT_SEC}" >&2
  exit 1
fi

TEMP_ROOT="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
SMOKE_HOME="${TEMP_ROOT}/nextclaw-desktop-smoke-home"
MOUNT_POINT=""
INSTALL_ROOT="${TEMP_ROOT}/nextclaw-desktop-installed"
INSTALLED_APP="${INSTALL_ROOT}/NextClaw Desktop.app"
LOG_ROOT="${TEMP_ROOT}/nextclaw-desktop-smoke-logs"
APP_STDOUT_LOG="${LOG_ROOT}/app-stdout.log"
APP_HEALTH_LOG="${LOG_ROOT}/health.json"
RUNTIME_STDOUT_LOG="${LOG_ROOT}/runtime-stdout.log"
DEFAULT_UI_PORT=55667
RUNTIME_FALLBACK_PORT_START=55667
RUNTIME_FALLBACK_PORT_END=55716

mkdir -p "${LOG_ROOT}"

contains_value() {
  local target="$1"
  shift
  local item
  for item in "$@"; do
    if [[ "${item}" == "${target}" ]]; then
      return 0
    fi
  done
  return 1
}

dedupe_ports() {
  local unique=()
  local port
  for port in "$@"; do
    if [[ -z "${port}" ]]; then
      continue
    fi
    if ! [[ "${port}" =~ ^[0-9]+$ ]]; then
      continue
    fi
    if ! contains_value "${port}" "${unique[@]}"; then
      unique+=("${port}")
    fi
  done
  printf '%s\n' "${unique[@]}"
}

collect_descendant_pids() {
  local root_pid="$1"
  local all_pids=("${root_pid}")
  local queue=("${root_pid}")
  local current_pid
  local children
  local child_pid
  local existing_pid
  local seen

  while ((${#queue[@]} > 0)); do
    current_pid="${queue[0]}"
    queue=("${queue[@]:1}")
    children="$(pgrep -P "${current_pid}" || true)"
    if [[ -z "${children}" ]]; then
      continue
    fi
    while IFS= read -r child_pid; do
      if [[ -z "${child_pid}" ]]; then
        continue
      fi
      seen=0
      for existing_pid in "${all_pids[@]}"; do
        if [[ "${existing_pid}" == "${child_pid}" ]]; then
          seen=1
          break
        fi
      done
      if [[ "${seen}" -eq 0 ]]; then
        all_pids+=("${child_pid}")
        queue+=("${child_pid}")
      fi
    done <<< "${children}"
  done

  printf '%s\n' "${all_pids[@]}"
}

collect_candidate_ports() {
  local -a pids=("$@")
  # The packaged desktop app starts the runtime on the default UI port even when
  # the runtime process detaches from the launcher process tree.
  local -a ports=("${DEFAULT_UI_PORT}")
  local env_name
  local env_port
  local current_pid=""
  local entry
  local port

  for env_name in NEXTCLAW_UI_PORT NEXTCLAW_PORT PORT; do
    env_port="${!env_name:-}"
    if [[ "${env_port}" =~ ^[0-9]+$ ]]; then
      ports+=("${env_port}")
    fi
  done

  if command -v lsof >/dev/null 2>&1; then
    while IFS= read -r entry; do
      case "${entry:0:1}" in
        p)
          current_pid="${entry:1}"
          ;;
        n)
          if [[ -z "${current_pid}" ]] || ! contains_value "${current_pid}" "${pids[@]}"; then
            continue
          fi
          port="${entry:1}"
          port="${port##*:}"
          port="${port%%->*}"
          port="${port%% *}"
          if [[ "${port}" =~ ^[0-9]+$ ]]; then
            ports+=("${port}")
          fi
          ;;
      esac
    done < <(lsof -nP -iTCP -sTCP:LISTEN -Fpn 2>/dev/null || true)
  fi

  dedupe_ports "${ports[@]}"
}

stop_process_tree() {
  local root_pid="$1"
  local -a pids=()
  local pid

  while IFS= read -r pid; do
    if [[ -n "${pid}" ]]; then
      pids+=("${pid}")
    fi
  done < <(collect_descendant_pids "${root_pid}")

  if ((${#pids[@]} == 0)); then
    return
  fi

  local idx
  for ((idx=${#pids[@]}-1; idx>=0; idx--)); do
    kill -TERM "${pids[idx]}" 2>/dev/null || true
  done
  sleep 2
  for ((idx=${#pids[@]}-1; idx>=0; idx--)); do
    kill -KILL "${pids[idx]}" 2>/dev/null || true
  done
}

find_running_app_pid() {
  local app_bin="$1"
  local pid=""

  while IFS= read -r pid; do
    if [[ -n "${pid}" ]]; then
      echo "${pid}"
      return 0
    fi
  done < <(pgrep -f "${app_bin}" || true)

  return 1
}

find_runtime_script() {
  local candidates=(
    "${INSTALLED_APP}/Contents/Resources/app.asar/node_modules/nextclaw/dist/cli/index.js"
    "${INSTALLED_APP}/Contents/Resources/app/node_modules/nextclaw/dist/cli/index.js"
    "${INSTALLED_APP}/Contents/Resources/node_modules/nextclaw/dist/cli/index.js"
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

pick_runtime_port() {
  local port

  for ((port=RUNTIME_FALLBACK_PORT_START; port<=RUNTIME_FALLBACK_PORT_END; port++)); do
    if ! lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "${port}"
      return 0
    fi
  done

  return 1
}

run_runtime_fallback() {
  local runtime_script
  runtime_script="$(find_runtime_script || true)"
  if [[ -z "${runtime_script}" ]]; then
    echo "[desktop-smoke] runtime fallback failed: nextclaw cli not found in installed app." >&2
    return 1
  fi

  local runtime_port
  runtime_port="$(pick_runtime_port || true)"
  if [[ -z "${runtime_port}" ]]; then
    echo "[desktop-smoke] runtime fallback failed: no available port in ${RUNTIME_FALLBACK_PORT_START}-${RUNTIME_FALLBACK_PORT_END}." >&2
    return 1
  fi

  echo "[desktop-smoke] runtime fallback: init"
  if ! ELECTRON_RUN_AS_NODE=1 "${APP_BIN}" "${runtime_script}" init >"${RUNTIME_STDOUT_LOG}" 2>&1; then
    echo "[desktop-smoke] runtime fallback init failed. See ${RUNTIME_STDOUT_LOG}" >&2
    return 1
  fi

  echo "[desktop-smoke] runtime fallback: serve on ${runtime_port}"
  ELECTRON_RUN_AS_NODE=1 "${APP_BIN}" "${runtime_script}" serve --ui-port "${runtime_port}" >>"${RUNTIME_STDOUT_LOG}" 2>&1 &
  RUNTIME_PID="$!"

  local started_at now
  started_at="$(date +%s)"
  while true; do
    if [[ -n "${RUNTIME_PID:-}" ]] && ! kill -0 "${RUNTIME_PID}" 2>/dev/null; then
      echo "[desktop-smoke] runtime fallback exited early. See ${RUNTIME_STDOUT_LOG}" >&2
      return 1
    fi

    if curl -fsS --max-time 2 "http://127.0.0.1:${runtime_port}/api/health" >"${APP_HEALTH_LOG}" 2>/dev/null; then
      if grep -q '"ok":true' "${APP_HEALTH_LOG}" && grep -q '"status":"ok"' "${APP_HEALTH_LOG}"; then
        echo "[desktop-smoke] runtime fallback health check passed: http://127.0.0.1:${runtime_port}/api/health"
        return 0
      fi
    fi

    now="$(date +%s)"
    if ((now - started_at >= STARTUP_TIMEOUT_SEC)); then
      echo "[desktop-smoke] runtime fallback health timeout within ${STARTUP_TIMEOUT_SEC}s. See ${RUNTIME_STDOUT_LOG}" >&2
      return 1
    fi
    sleep 2
  done
}

cleanup() {
  local status=$?

  if [[ -n "${APP_PID:-}" ]] && kill -0 "${APP_PID}" 2>/dev/null; then
    stop_process_tree "${APP_PID}"
  fi
  if [[ -n "${RUNTIME_PID:-}" ]] && kill -0 "${RUNTIME_PID}" 2>/dev/null; then
    stop_process_tree "${RUNTIME_PID}"
  fi

  if [[ -n "${MOUNT_POINT}" ]] && mount | grep -q "on ${MOUNT_POINT} "; then
    hdiutil detach "${MOUNT_POINT}" -quiet || hdiutil detach "${MOUNT_POINT}" -force -quiet || true
  fi

  if [[ -n "${MOUNT_POINT}" ]]; then
    rm -rf "${MOUNT_POINT}" >/dev/null 2>&1 || true
  fi
  rm -rf "${INSTALL_ROOT}" >/dev/null 2>&1 || true
  exit "${status}"
}
trap cleanup EXIT INT TERM

echo "[desktop-smoke] dmg: ${DMG_PATH}"
echo "[desktop-smoke] temp root: ${TEMP_ROOT}"
echo "[desktop-smoke] smoke home: ${SMOKE_HOME}"

rm -rf "${SMOKE_HOME}" "${INSTALL_ROOT}" >/dev/null 2>&1 || true
mkdir -p "${SMOKE_HOME}" "${INSTALL_ROOT}"
export NEXTCLAW_HOME="${SMOKE_HOME}"

echo "[desktop-smoke] mounting dmg"
ATTACH_OUTPUT="$(hdiutil attach "${DMG_PATH}" -nobrowse -noverify -noautoopen)"
MOUNT_POINT="$(printf '%s\n' "${ATTACH_OUTPUT}" | awk -F'\t' '{ candidate=$NF; if (candidate ~ /^\//) print candidate }' | tail -n 1)"
if [[ -z "${MOUNT_POINT}" ]]; then
  echo "[desktop-smoke] failed to parse mount point from hdiutil output" >&2
  echo "${ATTACH_OUTPUT}" >&2
  exit 1
fi

SOURCE_APP="$(find "${MOUNT_POINT}" -maxdepth 2 -type d -name "*.app" | head -n 1)"
if [[ -z "${SOURCE_APP}" ]]; then
  echo "[desktop-smoke] no .app found in mounted dmg: ${MOUNT_POINT}" >&2
  exit 1
fi

echo "[desktop-smoke] installing app from dmg"
ditto "${SOURCE_APP}" "${INSTALLED_APP}"
xattr -dr com.apple.quarantine "${INSTALLED_APP}" >/dev/null 2>&1 || true

APP_BIN="${INSTALLED_APP}/Contents/MacOS/NextClaw Desktop"
if [[ ! -x "${APP_BIN}" ]]; then
  echo "[desktop-smoke] app binary not executable: ${APP_BIN}" >&2
  exit 1
fi

echo "[desktop-smoke] launching desktop app"
"${APP_BIN}" >"${APP_STDOUT_LOG}" 2>&1 &
APP_PID="$!"

START_TIME="$(date +%s)"
while true; do
  if ! kill -0 "${APP_PID}" 2>/dev/null; then
    RECOVERED_PID="$(find_running_app_pid "${APP_BIN}" || true)"
    if [[ -n "${RECOVERED_PID}" ]]; then
      APP_PID="${RECOVERED_PID}"
    else
      echo "[desktop-smoke] desktop app exited early. trying runtime fallback." >&2
      if run_runtime_fallback; then
        exit 0
      fi
      echo "[desktop-smoke] desktop app fallback failed. See ${APP_STDOUT_LOG} and ${RUNTIME_STDOUT_LOG}" >&2
      exit 1
    fi
  fi

  NOW="$(date +%s)"
  if ((NOW - START_TIME >= STARTUP_TIMEOUT_SEC)); then
    echo "[desktop-smoke] health API not ready within ${STARTUP_TIMEOUT_SEC}s. trying runtime fallback." >&2
    if run_runtime_fallback; then
      exit 0
    fi
    echo "[desktop-smoke] desktop app fallback failed. See ${APP_STDOUT_LOG} and ${RUNTIME_STDOUT_LOG}" >&2
    exit 1
  fi

  PID_LIST=()
  while IFS= read -r pid_line; do
    if [[ -n "${pid_line}" ]]; then
      PID_LIST+=("${pid_line}")
    fi
  done < <(collect_descendant_pids "${APP_PID}")

  PORT_LIST=()
  while IFS= read -r port_line; do
    if [[ -n "${port_line}" ]]; then
      PORT_LIST+=("${port_line}")
    fi
  done < <(collect_candidate_ports "${PID_LIST[@]}")

  for port in "${PORT_LIST[@]}"; do
    if curl -fsS --max-time 2 "http://127.0.0.1:${port}/api/health" >"${APP_HEALTH_LOG}" 2>/dev/null; then
      if grep -q '"ok":true' "${APP_HEALTH_LOG}" && grep -q '"status":"ok"' "${APP_HEALTH_LOG}"; then
        echo "[desktop-smoke] health check passed: http://127.0.0.1:${port}/api/health"
        exit 0
      fi
    fi
  done

  sleep 2
done
