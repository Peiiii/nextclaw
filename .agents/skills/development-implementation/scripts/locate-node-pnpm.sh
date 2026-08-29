#!/usr/bin/env bash
set -euo pipefail

bins=(node pnpm npx corepack)
missing=()
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
required_version=""
if [[ -f "$repo_root/.nvmrc" ]]; then
  required_version="$(tr -d '[:space:]' < "$repo_root/.nvmrc")"
fi

echo "Required Node: ${required_version:-not declared}"
for bin in "${bins[@]}"; do
  if command -v "$bin" >/dev/null 2>&1; then
    echo "$bin: $(command -v "$bin")"
  else
    echo "$bin: NOT FOUND"
    missing+=("$bin")
  fi
done

current_version="$(node --version 2>/dev/null | sed 's/^v//' || true)"
if [[ ${#missing[@]} -eq 0 && ( -z "$required_version" || "$current_version" == "$required_version" ) ]]; then
  echo "Node version: $current_version (matched)"
  exit 0
fi

if [[ -n "$required_version" && "$current_version" != "$required_version" ]]; then
  echo "Node version mismatch: current=${current_version:-missing} required=$required_version"
fi

echo ""

candidates=(
  "$HOME/.nvm/versions/node/v${required_version}/bin"
  "/opt/homebrew/bin"
  "/usr/local/bin"
)

# NVM locations (if present)
if [[ -d "$HOME/.nvm/versions/node" ]]; then
  while IFS= read -r -d '' dir; do
    candidates+=("$dir")
  done < <(find "$HOME/.nvm/versions/node" -maxdepth 2 -type d -name bin -print0)
fi

matched_dir=""
found=()
for dir in "${candidates[@]}"; do
  if [[ -d "$dir" ]]; then
    candidate_version="$("$dir/node" --version 2>/dev/null | sed 's/^v//' || true)"
    if [[ -n "$required_version" && "$candidate_version" == "$required_version" ]]; then
      matched_dir="$dir"
    fi
    for ((index = 0; index < ${#missing[@]}; index += 1)); do
      bin="${missing[$index]}"
      if [[ -x "$dir/$bin" ]]; then
        found+=("$dir/$bin")
      fi
    done
  fi
done

if [[ ${#missing[@]} -gt 0 && ${#found[@]} -eq 0 ]]; then
  echo "No binaries found in common locations."
  echo "Hint: check Homebrew or NVM installation and ensure PATH includes their bin directories."
  exit 1
fi

if [[ ${#found[@]} -gt 0 ]]; then
  echo "Found in common locations:"
  for item in "${found[@]}"; do
    echo "- $item"
  done
  echo ""
fi

if [[ -n "$matched_dir" ]]; then
  echo "Suggested repository-safe fix:"
  echo "PATH=$matched_dir:\$PATH <command>"
else
  echo "Required Node ${required_version:-version} was not found. Install that exact version before continuing."
  exit 1
fi
