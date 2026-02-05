#!/bin/bash
set -euo pipefail

# Load config (optional — defaults used if missing)
HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$HOOKS_DIR/config.sh" ]] && source "$HOOKS_DIR/config.sh"

cd "$(dirname "$0")/../.." || exit 1

MEM_DIR=".claude/mem"
[[ -d "$MEM_DIR" ]] || exit 0

MAX_CHARS="${MEM_MAX_CHARS:-8000}"
TOTAL_CHARS=0

for f in "$MEM_DIR"/*; do
  [[ -f "$f" ]] || continue
  FILE_CHARS=$(wc -c < "$f" | tr -d ' ')
  TOTAL_CHARS=$((TOTAL_CHARS + FILE_CHARS))
done

if [[ "$TOTAL_CHARS" -gt "$MAX_CHARS" ]]; then
  echo "!!! MEMORY EXCEEDS TOKEN BUDGET (${TOTAL_CHARS} chars > ${MAX_CHARS}). Compact your .claude/mem/ files. !!!"
fi

for f in "$MEM_DIR"/*; do
  if [[ -f "$f" ]]; then
    echo "=== $(basename "$f") ==="
    cat "$f"
    echo ""
  fi
done

echo "=== git_state ==="
echo "hash:$(git log -1 --format=%h 2>/dev/null || echo 'not-a-repo')"
echo "branch:$(git branch --show-current 2>/dev/null || echo 'unknown')"
