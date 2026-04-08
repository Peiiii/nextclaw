#!/usr/bin/env bash
set -euo pipefail

RELEASE_DIR="${1:-apps/desktop/release}"
RELEASE_DIR="$(cd "${RELEASE_DIR}" && pwd)"

APPIMAGE_PATH="$(find "${RELEASE_DIR}" -maxdepth 1 -type f -name '*.AppImage' | head -n 1)"
if [ -z "${APPIMAGE_PATH}" ]; then
  echo "Linux AppImage not found in ${RELEASE_DIR}" >&2
  exit 1
fi

APPIMAGE_VERSION="$(basename "${APPIMAGE_PATH}" | sed -E 's/.*-([0-9]+\.[0-9]+\.[0-9]+).*/\1/')"
if ! echo "${APPIMAGE_VERSION}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Failed to parse version from Linux AppImage filename: ${APPIMAGE_PATH}" >&2
  exit 1
fi

TARGET_APPIMAGE="${RELEASE_DIR}/NextClaw.Desktop-${APPIMAGE_VERSION}-linux-x64.AppImage"
mv "${APPIMAGE_PATH}" "${TARGET_APPIMAGE}"
if [ -f "${APPIMAGE_PATH}.blockmap" ]; then
  mv "${APPIMAGE_PATH}.blockmap" "${TARGET_APPIMAGE}.blockmap"
fi

DEB_PATH="$(find "${RELEASE_DIR}" -maxdepth 1 -type f -name '*.deb' | head -n 1)"
if [ -z "${DEB_PATH}" ]; then
  echo "Linux deb not found in ${RELEASE_DIR}" >&2
  exit 1
fi

DEB_VERSION="$(dpkg-deb -f "${DEB_PATH}" Version)"
TARGET_DEB="${RELEASE_DIR}/nextclaw-desktop_${DEB_VERSION}_amd64.deb"
mv "${DEB_PATH}" "${TARGET_DEB}"

echo "[desktop-package] normalized Linux artifacts:"
echo "- ${TARGET_APPIMAGE}"
echo "- ${TARGET_DEB}"
