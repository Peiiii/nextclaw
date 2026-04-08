#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${NEXTCLAW_APT_REPO_URL:-https://peiiii.github.io/nextclaw/apt}"
KEYRING_PATH="/etc/apt/keyrings/nextclaw-archive-keyring.gpg"
SOURCE_LIST_PATH="/etc/apt/sources.list.d/nextclaw.list"
PACKAGE_NAME="nextclaw-desktop"
SUPPORTED_ARCH="amd64"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to install ${PACKAGE_NAME}." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "apt-get is required to install ${PACKAGE_NAME}." >&2
  exit 1
fi

ARCH="$(dpkg --print-architecture)"
if [ "${ARCH}" != "${SUPPORTED_ARCH}" ]; then
  echo "Unsupported architecture: ${ARCH}. ${PACKAGE_NAME} is currently published for ${SUPPORTED_ARCH} only." >&2
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  if ! command -v sudo >/dev/null 2>&1; then
    echo "sudo is required when running as a non-root user." >&2
    exit 1
  fi
  SUDO="sudo"
fi

TEMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

echo "[nextclaw] configuring APT source at ${REPO_URL}"
${SUDO} mkdir -p /etc/apt/keyrings

curl -fsSL "${REPO_URL}/nextclaw-archive-keyring.gpg" -o "${TEMP_DIR}/nextclaw-archive-keyring.gpg"
${SUDO} install -m 0644 "${TEMP_DIR}/nextclaw-archive-keyring.gpg" "${KEYRING_PATH}"

printf 'deb [arch=%s signed-by=%s] %s stable main\n' "${SUPPORTED_ARCH}" "${KEYRING_PATH}" "${REPO_URL}" \
  | ${SUDO} tee "${SOURCE_LIST_PATH}" >/dev/null

echo "[nextclaw] updating package index"
${SUDO} apt-get update

echo "[nextclaw] installing ${PACKAGE_NAME}"
${SUDO} apt-get install -y "${PACKAGE_NAME}"

echo "[nextclaw] installation complete"
