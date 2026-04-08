#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <new-repo-dir> [--old-repo-dir <path>] [--package-name <name>]" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for Linux APT repo smoke" >&2
  exit 1
fi

NEW_REPO_DIR="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
shift
OLD_REPO_DIR=""
PACKAGE_NAME="nextclaw-desktop"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --old-repo-dir)
      OLD_REPO_DIR="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
      shift 2
      ;;
    --package-name)
      PACKAGE_NAME="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ ! -d "${NEW_REPO_DIR}" ]; then
  echo "APT repo directory not found: ${NEW_REPO_DIR}" >&2
  exit 1
fi

MOUNTS=(-v "${NEW_REPO_DIR}:/new-repo:ro")
if [ -n "${OLD_REPO_DIR}" ]; then
  if [ ! -d "${OLD_REPO_DIR}" ]; then
    echo "Old APT repo directory not found: ${OLD_REPO_DIR}" >&2
    exit 1
  fi
  MOUNTS+=(-v "${OLD_REPO_DIR}:/old-repo:ro")
fi

CONTAINER_NAME="nextclaw-apt-smoke-$$"
cleanup() {
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "${CONTAINER_NAME}" "${MOUNTS[@]}" ubuntu:24.04 sleep infinity >/dev/null

docker exec "${CONTAINER_NAME}" bash -lc "
  set -euo pipefail
  export DEBIAN_FRONTEND=noninteractive
  mkdir -p /etc/apt/keyrings
"

if [ -n "${OLD_REPO_DIR}" ]; then
  echo "[desktop-smoke] validating apt upgrade path for ${PACKAGE_NAME}"

  docker exec "${CONTAINER_NAME}" bash -lc "
    set -euo pipefail
    cp /old-repo/nextclaw-archive-keyring.gpg /etc/apt/keyrings/nextclaw-archive-keyring.gpg
    cat >/etc/apt/sources.list.d/nextclaw.list <<'EOF'
deb [arch=amd64 signed-by=/etc/apt/keyrings/nextclaw-archive-keyring.gpg] file:/old-repo stable main
EOF
    apt-get update
    apt-get install -y ${PACKAGE_NAME}
    INSTALLED_BEFORE=\$(dpkg-query -W -f='\${Version}' ${PACKAGE_NAME})
    cp /new-repo/nextclaw-archive-keyring.gpg /etc/apt/keyrings/nextclaw-archive-keyring.gpg
    cat >/etc/apt/sources.list.d/nextclaw.list <<'EOF'
deb [arch=amd64 signed-by=/etc/apt/keyrings/nextclaw-archive-keyring.gpg] file:/new-repo stable main
EOF
    apt-get update
    CANDIDATE_AFTER=\$(apt-cache policy ${PACKAGE_NAME} | awk '/Candidate:/ { print \$2 }')
    if [ -z \"\${CANDIDATE_AFTER}\" ] || [ \"\${CANDIDATE_AFTER}\" = \"(none)\" ]; then
      echo 'missing candidate version after apt update' >&2
      exit 1
    fi
    if [ \"\${CANDIDATE_AFTER}\" = \"\${INSTALLED_BEFORE}\" ]; then
      echo \"candidate version did not advance: \${CANDIDATE_AFTER}\" >&2
      exit 1
    fi
    apt-get upgrade -y
    INSTALLED_AFTER=\$(dpkg-query -W -f='\${Version}' ${PACKAGE_NAME})
    if [ \"\${INSTALLED_AFTER}\" != \"\${CANDIDATE_AFTER}\" ]; then
      echo \"installed version \${INSTALLED_AFTER} does not match candidate \${CANDIDATE_AFTER}\" >&2
      exit 1
    fi
    apt-get purge -y ${PACKAGE_NAME}
  "
else
  echo "[desktop-smoke] validating apt fresh install path for ${PACKAGE_NAME}"

  docker exec "${CONTAINER_NAME}" bash -lc "
    set -euo pipefail
    cp /new-repo/nextclaw-archive-keyring.gpg /etc/apt/keyrings/nextclaw-archive-keyring.gpg
    cat >/etc/apt/sources.list.d/nextclaw.list <<'EOF'
deb [arch=amd64 signed-by=/etc/apt/keyrings/nextclaw-archive-keyring.gpg] file:/new-repo stable main
EOF
    apt-get update
    CANDIDATE=\$(apt-cache policy ${PACKAGE_NAME} | awk '/Candidate:/ { print \$2 }')
    if [ -z \"\${CANDIDATE}\" ] || [ \"\${CANDIDATE}\" = \"(none)\" ]; then
      echo 'missing candidate version after apt update' >&2
      exit 1
    fi
    apt-get install -y ${PACKAGE_NAME}
    INSTALLED=\$(dpkg-query -W -f='\${Version}' ${PACKAGE_NAME})
    if [ \"\${INSTALLED}\" != \"\${CANDIDATE}\" ]; then
      echo \"installed version \${INSTALLED} does not match candidate \${CANDIDATE}\" >&2
      exit 1
    fi
    apt-get remove -y ${PACKAGE_NAME}
    apt-get purge -y ${PACKAGE_NAME}
  "
fi

echo "[desktop-smoke] apt repo smoke passed"
