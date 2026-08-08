#!/usr/bin/env bash
set -euo pipefail

bins=(node pnpm npx corepack)
missing=()

echo "Current PATH: $PATH"
for bin in "${bins[@]}"; do
  if command -v "$bin" >/dev/null 2>&1; then
    echo "$bin: $(command -v "$bin")"
  else
    echo "$bin: NOT FOUND"
    missing+=("$bin")
  fi
done

if [[ ${#missing[@]} -eq 0 ]]; then
  exit 0
fi

echo ""

candidates=(
  "/opt/homebrew/bin"
  "/usr/local/bin"
)

# NVM locations (if present)
if [[ -d "$HOME/.nvm/versions/node" ]]; then
  while IFS= read -r -d '' dir; do
    candidates+=("$dir")
  done < <(find "$HOME/.nvm/versions/node" -maxdepth 2 -type d -name bin -print0)
fi

found=()
for dir in "${candidates[@]}"; do
  if [[ -d "$dir" ]]; then
    for bin in "${missing[@]}"; do
      if [[ -x "$dir/$bin" ]]; then
        found+=("$dir/$bin")
      fi
    done
  fi
done

if [[ ${#found[@]} -eq 0 ]]; then
  echo "No binaries found in common locations."
  echo "Hint: check Homebrew or NVM installation and ensure PATH includes their bin directories."
  exit 1
fi

echo "Found in common locations:"
for item in "${found[@]}"; do
  echo "- $item"
done

echo ""

if [[ -d "/opt/homebrew/bin" ]]; then
  echo "Suggested one-off fix:"
  echo 'PATH=/opt/homebrew/bin:$PATH <command>'
else
  echo "Suggested one-off fix (replace with the correct bin path above):"
  echo 'PATH=/path/to/bin:$PATH <command>'
fi
