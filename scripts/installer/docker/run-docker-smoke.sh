#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_TAG="nextclaw-installer-node-smoke:latest"

echo "[smoke] building test image..."
docker build -t "${IMAGE_TAG}" "${ROOT_DIR}"

echo "[smoke] case 1: default mirror order (npmmirror -> nodejs.org)"
docker run --rm "${IMAGE_TAG}"

echo "[smoke] case 2: fallback check (invalid mirror -> npmmirror -> nodejs.org)"
docker run --rm \
  -e NEXTCLAW_NODE_DIST_BASES="https://invalid-mirror.example.com,https://npmmirror.com/mirrors/node,https://nodejs.org/dist" \
  "${IMAGE_TAG}"

echo "[smoke] all docker smoke tests passed"
