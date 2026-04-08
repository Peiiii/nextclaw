#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <deb-path>" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for Linux deb smoke" >&2
  exit 1
fi

DEB_PATH="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
if [ ! -f "${DEB_PATH}" ]; then
  echo "deb artifact not found: ${DEB_PATH}" >&2
  exit 1
fi

DEB_DIR="$(dirname "${DEB_PATH}")"
DEB_NAME="$(basename "${DEB_PATH}")"

echo "[desktop-smoke] validating deb package ${DEB_NAME}"

docker run --rm \
  -v "${DEB_DIR}:/artifacts:ro" \
  ubuntu:24.04 \
  bash -lc "
    set -euo pipefail
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y /artifacts/${DEB_NAME}
    PACKAGE_NAME=\$(dpkg-deb -f /artifacts/${DEB_NAME} Package)
    PACKAGE_VERSION=\$(dpkg-deb -f /artifacts/${DEB_NAME} Version)
    if [ \"\${PACKAGE_NAME}\" != \"nextclaw-desktop\" ]; then
      echo \"unexpected deb package name: \${PACKAGE_NAME}\" >&2
      exit 1
    fi
    INSTALLED_VERSION=\$(dpkg-query -W -f='\${Version}' nextclaw-desktop)
    if [ \"\${INSTALLED_VERSION}\" != \"\${PACKAGE_VERSION}\" ]; then
      echo \"installed version \${INSTALLED_VERSION} does not match package version \${PACKAGE_VERSION}\" >&2
      exit 1
    fi
    dpkg -s nextclaw-desktop >/tmp/nextclaw-desktop.status
    apt-get remove -y nextclaw-desktop
  "

echo "[desktop-smoke] deb install/remove passed"
