#!/usr/bin/env bash
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22.20.0}"
if [[ -n "${NODE_ARCH:-}" ]]; then
  NODE_ARCH="${NODE_ARCH}"
else
  case "$(uname -m)" in
    x86_64|amd64) NODE_ARCH="x64" ;;
    aarch64|arm64) NODE_ARCH="arm64" ;;
    *)
      echo "[smoke] unsupported machine architecture: $(uname -m)"
      exit 1
      ;;
  esac
fi
DIST_BASES_RAW="${NEXTCLAW_NODE_DIST_BASES:-https://npmmirror.com/mirrors/node,https://nodejs.org/dist}"
RUNTIME_ROOT="/tmp/nextclaw-runtime"
NODE_DIR="${RUNTIME_ROOT}/node-v${NODE_VERSION}-linux-${NODE_ARCH}"
ARCHIVE="${RUNTIME_ROOT}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
FILENAME="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"

mkdir -p "${RUNTIME_ROOT}"
IFS=',' read -r -a DIST_BASES <<< "${DIST_BASES_RAW}"

download_ok=0
for base in "${DIST_BASES[@]}"; do
  clean_base="$(echo "${base}" | xargs)"
  if [[ -z "${clean_base}" ]]; then
    continue
  fi
  clean_base="${clean_base%/}"
  url="${clean_base}/v${NODE_VERSION}/${FILENAME}"
  echo "[smoke] trying ${url}"
  if curl -fL --connect-timeout 8 --max-time 180 "${url}" -o "${ARCHIVE}"; then
    download_ok=1
    echo "[smoke] downloaded from ${clean_base}"
    break
  fi
done

if [[ "${download_ok}" -ne 1 ]]; then
  echo "[smoke] failed to download Node runtime from all mirrors"
  exit 1
fi

tar -xJf "${ARCHIVE}" -C "${RUNTIME_ROOT}"
rm -f "${ARCHIVE}"

if [[ ! -x "${NODE_DIR}/bin/node" ]]; then
  echo "[smoke] node binary not found after extraction"
  exit 1
fi

export PATH="${NODE_DIR}/bin:${PATH}"
node_version="$(node -v)"
npm_version="$(npm -v)"
npx_version="$(npx -v)"
echo "[smoke] node: ${node_version}"
echo "[smoke] npm: ${npm_version}"
echo "[smoke] npx: ${npx_version}"
