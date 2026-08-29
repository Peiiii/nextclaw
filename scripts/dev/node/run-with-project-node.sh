#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
version_file="$repo_root/.nvmrc"

if [[ ! -f "$version_file" ]]; then
  echo "Project Node version is not declared: $version_file" >&2
  exit 1
fi

required_version="$(tr -d '[:space:]' < "$version_file")"
if [[ -z "$required_version" ]]; then
  echo "Project Node version is empty: $version_file" >&2
  exit 1
fi

if [[ $# -eq 0 ]]; then
  set -- node --version
fi

current_version="$(node --version 2>/dev/null | sed 's/^v//' || true)"
if [[ "$current_version" == "$required_version" ]]; then
  exec "$@"
fi

nvm_dir="${NVM_DIR:-$HOME/.nvm}"
node_bin="$nvm_dir/versions/node/v$required_version/bin"
if [[ ! -x "$node_bin/node" ]]; then
  if [[ ! -s "$nvm_dir/nvm.sh" ]]; then
    echo "Node $required_version is required but NVM is unavailable at $nvm_dir." >&2
    exit 1
  fi
  # nvm is the local version owner; install only the exact repository version.
  set +u
  source "$nvm_dir/nvm.sh"
  nvm install "$required_version" >/dev/null
  set -u
fi

actual_version="$("$node_bin/node" --version | sed 's/^v//')"
if [[ "$actual_version" != "$required_version" ]]; then
  echo "Resolved Node $actual_version, expected $required_version." >&2
  exit 1
fi

export PATH="$node_bin:$PATH"
exec "$@"
