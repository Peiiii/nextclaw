#!/usr/bin/env bash
set -euo pipefail

APP_NAME="nextclaw"
CONTAINER_NAME="${NEXTCLAW_DOCKER_CONTAINER_NAME:-nextclaw}"
UI_PORT="${NEXTCLAW_DOCKER_UI_PORT:-18791}"
API_PORT="${NEXTCLAW_DOCKER_API_PORT:-18790}"
DATA_DIR="${NEXTCLAW_DOCKER_DATA_DIR:-${HOME}/.nextclaw-docker}"
DOCKER_IMAGE="${NEXTCLAW_DOCKER_IMAGE:-node:22-bookworm-slim}"
INSTALL_TARGET="${NEXTCLAW_DOCKER_INSTALL_TARGET:-nextclaw@latest}"
HEALTH_TIMEOUT_SEC="${NEXTCLAW_DOCKER_HEALTH_TIMEOUT_SEC:-180}"
DRY_RUN=0

log() {
  printf '[nextclaw-docker-install] %s\n' "$*"
}

warn() {
  printf '[nextclaw-docker-install] warning: %s\n' "$*" >&2
}

fail() {
  printf '[nextclaw-docker-install] error: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: install-docker.sh [options]

Options:
  --ui-port <port>          UI port (default: 18791)
  --api-port <port>         Gateway API port mapped to host (default: 18790)
  --data-dir <path>         Persistent data directory mounted to /data (default: ~/.nextclaw-docker)
  --container-name <name>   Docker container name (default: nextclaw)
  --image <image>           Docker image for runtime bootstrap (default: node:22-bookworm-slim)
  --target <pkg>            npm package target inside container (default: nextclaw@latest)
  --health-timeout <sec>    Max seconds waiting for service readiness (default: 180)
  --dry-run                 Print docker command only
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

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

container_exists() {
  docker ps -a --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"
}

wait_for_health() {
  local health_url="http://127.0.0.1:${UI_PORT}/api/health"
  local root_url="http://127.0.0.1:${UI_PORT}/"
  local status=""
  local started_at now elapsed
  started_at="$(date +%s)"

  if ! has_cmd curl; then
    warn "curl not found, skip health wait (${health_url})."
    return 0
  fi

  while true; do
    status="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 2 "${health_url}" 2>/dev/null || true)"
    if [[ "${status}" =~ ^[0-9]{3}$ ]] && (( status >= 200 && status < 500 )); then
      return 0
    fi

    status="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 2 "${root_url}" 2>/dev/null || true)"
    if [[ "${status}" =~ ^[0-9]{3}$ ]] && (( status >= 200 && status < 500 )); then
      return 0
    fi

    now="$(date +%s)"
    elapsed=$(( now - started_at ))
    if (( elapsed >= HEALTH_TIMEOUT_SEC )); then
      return 1
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
    --image)
      DOCKER_IMAGE="${2:-}"
      shift 2
      ;;
    --target)
      INSTALL_TARGET="${2:-}"
      shift 2
      ;;
    --health-timeout)
      HEALTH_TIMEOUT_SEC="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      continue
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

if ! is_valid_port "${UI_PORT}"; then
  fail "Invalid --ui-port: ${UI_PORT}"
fi
if ! is_valid_port "${API_PORT}"; then
  fail "Invalid --api-port: ${API_PORT}"
fi
if [[ ! "${HEALTH_TIMEOUT_SEC}" =~ ^[0-9]+$ ]] || (( HEALTH_TIMEOUT_SEC <= 0 )); then
  fail "Invalid --health-timeout: ${HEALTH_TIMEOUT_SEC}"
fi
if [[ -z "${CONTAINER_NAME}" ]]; then
  fail "--container-name cannot be empty"
fi
if [[ -z "${DOCKER_IMAGE}" ]]; then
  fail "--image cannot be empty"
fi
if [[ -z "${INSTALL_TARGET}" ]]; then
  fail "--target cannot be empty"
fi

DATA_DIR="$(resolve_abs_path "${DATA_DIR}")"

run_cmd=(
  docker run -d
  --name "${CONTAINER_NAME}"
  --restart unless-stopped
  -e NEXTCLAW_HOME=/data
  -e NEXTCLAW_UI_PORT="${UI_PORT}"
  -p "${UI_PORT}:${UI_PORT}"
  -p "${API_PORT}:18790"
  -v "${DATA_DIR}:/data"
  "${DOCKER_IMAGE}"
  sh -lc "npm i -g ${INSTALL_TARGET} && nextclaw serve --ui-port ${UI_PORT}"
)

if (( DRY_RUN == 1 )); then
  log "Dry run enabled."
  log "Container: ${CONTAINER_NAME}"
  log "Data dir: ${DATA_DIR}"
  log "Image: ${DOCKER_IMAGE}"
  log "Target: ${INSTALL_TARGET}"
  log "Command:"
  printf '  %q' "${run_cmd[@]}"
  echo
  exit 0
fi

if ! has_cmd docker; then
  fail "docker is required. Install Docker Desktop / docker engine first."
fi

if ! docker version >/dev/null 2>&1; then
  fail "docker daemon is not reachable. Start docker service first."
fi

if container_exists; then
  log "Container '${CONTAINER_NAME}' already exists. Recreating..."
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

log "Starting ${APP_NAME} docker container..."
"${run_cmd[@]}" >/dev/null

if ! wait_for_health; then
  warn "Health check timeout after ${HEALTH_TIMEOUT_SEC}s: tried http://127.0.0.1:${UI_PORT}/api/health and http://127.0.0.1:${UI_PORT}/"
  warn "Recent logs:"
  docker logs --tail 120 "${CONTAINER_NAME}" || true
  exit 1
fi

log "Health check passed: UI/API is reachable on port ${UI_PORT}"
echo "UI: http://127.0.0.1:${UI_PORT}"
echo "API: http://127.0.0.1:${UI_PORT}/api"
echo "Gateway (direct): http://127.0.0.1:${API_PORT}"
echo "Data dir: ${DATA_DIR}"
echo "Container: ${CONTAINER_NAME}"
echo
runtime_urls="$(docker logs --tail 80 "${CONTAINER_NAME}" 2>/dev/null | grep -E 'UI: |API: |Public UI|Public API' || true)"
if [[ -n "${runtime_urls}" ]]; then
  echo "Runtime output snapshot:"
  echo "${runtime_urls}"
  echo
fi
echo "Useful commands:"
echo "  docker logs -f ${CONTAINER_NAME}"
echo "  docker stop ${CONTAINER_NAME}"
echo "  docker rm -f ${CONTAINER_NAME}"
