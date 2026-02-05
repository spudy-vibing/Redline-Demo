#!/bin/bash
set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

[[ -z "$CWD" ]] && exit 0
cd "$CWD" || exit 0
[[ -d .claude/mem ]] || exit 0

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

echo "MEMORY SYSTEM ACTIVE. Files in .claude/mem/ contain your project knowledge. After compaction, update .claude/mem/session if you learned anything new this session." > "$TMPFILE"
echo "" >> "$TMPFILE"

for f in .claude/mem/*; do
  if [[ -f "$f" ]]; then
    echo "=== $(basename "$f") ===" >> "$TMPFILE"
    cat "$f" >> "$TMPFILE"
    echo "" >> "$TMPFILE"
  fi
done

jq -n --rawfile ctx "$TMPFILE" '{
  "hookSpecificOutput": {
    "hookEventName": "PreCompact",
    "additionalContext": $ctx
  }
}'

exit 0
