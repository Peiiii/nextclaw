#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/../../.." && pwd)"
IMAGE_TAG="nextclaw-installer-node-smoke:latest"

export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:${PATH}"

echo "[smoke-nextclaw] ensure docker image exists..."
docker build -t "${IMAGE_TAG}" "${ROOT_DIR}" >/dev/null

echo "[smoke-nextclaw] build local nextclaw package..."
(
  cd "${REPO_ROOT}/packages/nextclaw"
  npm pack --silent >/tmp/nextclaw-pack-name.txt
)
TGZ_NAME="$(tail -n 1 /tmp/nextclaw-pack-name.txt | tr -d '\r\n')"
TGZ_PATH="${REPO_ROOT}/packages/nextclaw/${TGZ_NAME}"
if [[ ! -f "${TGZ_PATH}" ]]; then
  echo "[smoke-nextclaw] packed tgz not found: ${TGZ_PATH}"
  exit 1
fi

echo "[smoke-nextclaw] run container init/start/stop flow..."
docker run --rm \
  --entrypoint /bin/bash \
  -v "${TGZ_PATH}:/work/nextclaw.tgz" \
  "${IMAGE_TAG}" \
  -lc 'set -euo pipefail; source /work/smoke-node-bootstrap.sh; mkdir -p /tmp/app /tmp/home; cd /tmp/app; npm init -y >/dev/null 2>&1; npm install --omit=dev --no-audit --no-fund /work/nextclaw.tgz >/tmp/npm-install.log 2>&1; export HOME=/tmp/home; CLI=node_modules/nextclaw/dist/cli/index.js; node "$CLI" init --force >/tmp/init.log 2>&1; node "$CLI" start --ui-port 19091 >/tmp/start.log 2>&1; test -f /tmp/home/.nextclaw/run/service.json; node "$CLI" stop >/tmp/stop.log 2>&1; echo "[smoke-nextclaw] ok"'

echo "[smoke-nextclaw] done"
