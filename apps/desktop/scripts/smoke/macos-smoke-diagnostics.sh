#!/usr/bin/env bash

now_ms() {
  node -e "process.stdout.write(String(Date.now()))"
}

print_file_tail() {
  local label="$1"
  local file_path="$2"
  if [[ ! -f "${file_path}" ]]; then
    echo "[desktop-smoke] ${label}: ${file_path} (missing)"
    return
  fi
  echo "[desktop-smoke] ${label}: ${file_path}"
  tail -n 120 "${file_path}" || true
}

print_macos_policy_diagnostics() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    return
  fi
  echo "[desktop-smoke] recent macOS AMFI / AppleSystemPolicy logs:"
  /usr/bin/log show --last 5m --style compact --predicate 'eventMessage CONTAINS "NextClaw Desktop" OR eventMessage CONTAINS "AppleSystemPolicy" OR eventMessage CONTAINS "AMFI"' 2>/dev/null | tail -n 160 || true
}

print_desktop_diagnostics() {
  print_file_tail "app stdout log" "${APP_STDOUT_LOG}"
  print_file_tail "main log" "${APP_MAIN_LOG}"
  print_macos_policy_diagnostics
}

main_log_has() {
  [[ -f "${APP_MAIN_LOG}" ]] && tail -n +"${MAIN_LOG_START_LINE}" "${APP_MAIN_LOG}" | grep -q "$1"
}

desktop_window_ready() {
  main_log_has "ready-to-show" && main_log_has "did-finish-load"
}

contains_value() {
  local target="$1"
  shift
  local item
  for item in "$@"; do
    [[ "${item}" == "${target}" ]] && return 0
  done
  return 1
}

dedupe_ports() {
  local unique=()
  local port
  for port in "$@"; do
    [[ -z "${port}" || ! "${port}" =~ ^[0-9]+$ ]] && continue
    contains_value "${port}" "${unique[@]}" || unique+=("${port}")
  done
  printf '%s\n' "${unique[@]}"
}
