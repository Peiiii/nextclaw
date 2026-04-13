#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker/compose.yml"

UI_PORT="${NEXTCLAW_DOCKER_UI_PORT:-55667}"
API_PORT="${NEXTCLAW_DOCKER_API_PORT:-18790}"
DATA_DIR="${NEXTCLAW_DOCKER_DATA_DIR:-${HOME}/.nextclaw-docker}"
CONTAINER_NAME="${NEXTCLAW_DOCKER_CONTAINER_NAME:-nextclaw}"
DRY_RUN=0
WAIT_TIMEOUT_SECONDS=60

usage() {
  cat <<'EOF'
Usage: scripts/dev/docker-start.sh [options]

Options:
  --ui-port <port>          Host/UI port (default: 55667)
  --api-port <port>         Host gateway API port (default: 18790)
  --data-dir <path>         Data directory mounted to /data (default: ~/.nextclaw-docker)
  --container-name <name>   Docker container name (default: nextclaw)
  --dry-run                 Print compose command and environment only
  -h, --help                Show help
EOF
}

is_valid_port() {
  local value="$1"
  [[ "${value}" =~ ^[0-9]+$ ]] && (( value >= 1 && value <= 65535 ))
}

resolve_abs_path() {
  local raw="$1"
  if [[ "${raw}" == "~/"* ]]; then
    raw="${HOME}/${raw#~/}"
  elif [[ "${raw}" == "~" ]]; then
    raw="${HOME}"
  fi
  if [[ "${raw}" != /* ]]; then
    raw="$(pwd)/${raw}"
  fi
  mkdir -p "${raw}"
  (
    cd "${raw}" >/dev/null 2>&1
    pwd
  )
}

wait_for_ui_health() {
  local health_url="http://127.0.0.1:${UI_PORT}/api/health"
  local started_at
  started_at="$(date +%s)"

  if ! command -v curl >/dev/null 2>&1; then
    echo "Warning: curl not found, skipped startup health wait (${health_url})."
    return 0
  fi

  while true; do
    if curl --fail --silent --show-error --max-time 2 "${health_url}" >/dev/null 2>&1; then
      return 0
    fi

    local now elapsed
    now="$(date +%s)"
    elapsed=$(( now - started_at ))
    if (( elapsed >= WAIT_TIMEOUT_SECONDS )); then
      echo "Warning: service is still starting after ${WAIT_TIMEOUT_SECONDS}s (${health_url})."
      return 0
    fi
    sleep 1
  done
}

while (( "$#" > 0 )); do
  case "$1" in
    --ui-port)
      UI_PORT="${2:-}"
      shift 2
      ;;
    --api-port)
      API_PORT="${2:-}"
      shift 2
      ;;
    --data-dir)
      DATA_DIR="${2:-}"
      shift 2
      ;;
    --container-name)
      CONTAINER_NAME="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --)
      shift
      continue
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Error: docker compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

if ! is_valid_port "${UI_PORT}"; then
  echo "Error: invalid --ui-port: ${UI_PORT}" >&2
  exit 1
fi
if ! is_valid_port "${API_PORT}"; then
  echo "Error: invalid --api-port: ${API_PORT}" >&2
  exit 1
fi
if [[ -z "${CONTAINER_NAME}" ]]; then
  echo "Error: --container-name cannot be empty" >&2
  exit 1
fi

DATA_DIR="$(resolve_abs_path "${DATA_DIR}")"

export NEXTCLAW_DOCKER_UI_PORT="${UI_PORT}"
export NEXTCLAW_DOCKER_API_PORT="${API_PORT}"
export NEXTCLAW_DOCKER_DATA_DIR="${DATA_DIR}"
export NEXTCLAW_DOCKER_CONTAINER_NAME="${CONTAINER_NAME}"

compose_cmd=(docker compose -f "${COMPOSE_FILE}")

if (( DRY_RUN == 1 )); then
  echo "Dry run enabled."
  echo "NEXTCLAW_DOCKER_UI_PORT=${NEXTCLAW_DOCKER_UI_PORT}"
  echo "NEXTCLAW_DOCKER_API_PORT=${NEXTCLAW_DOCKER_API_PORT}"
  echo "NEXTCLAW_DOCKER_DATA_DIR=${NEXTCLAW_DOCKER_DATA_DIR}"
  echo "NEXTCLAW_DOCKER_CONTAINER_NAME=${NEXTCLAW_DOCKER_CONTAINER_NAME}"
  echo
  echo "Command:"
  printf '  %q' "${compose_cmd[@]}"
  printf ' %q' up -d --build
  echo
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker not found in PATH." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: docker compose plugin not available." >&2
  exit 1
fi

"${compose_cmd[@]}" up -d --build
wait_for_ui_health

echo "✓ NextClaw docker service started."
echo "UI: http://127.0.0.1:${UI_PORT}"
echo "API: http://127.0.0.1:${UI_PORT}/api"
echo "Gateway (direct): http://127.0.0.1:${API_PORT}"
echo "Data dir: ${DATA_DIR}"
echo "Container: ${CONTAINER_NAME}"
echo
runtime_urls="$("${compose_cmd[@]}" logs --tail=80 nextclaw 2>/dev/null | grep -E 'UI: |API: |Public UI|Public API' || true)"
if [[ -n "${runtime_urls}" ]]; then
  echo "Runtime output snapshot:"
  echo "${runtime_urls}"
  echo
fi

echo "Useful commands:"
printf '  %q' "${compose_cmd[@]}"
printf ' %q' logs -f nextclaw
echo
printf '  %q' "${compose_cmd[@]}"
printf ' %q' down
echo
