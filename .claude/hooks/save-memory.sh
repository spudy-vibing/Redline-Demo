#!/bin/bash
set -euo pipefail

# Load config (optional — defaults used if missing)
HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$HOOKS_DIR/config.sh" ]] && source "$HOOKS_DIR/config.sh"

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

[[ -z "$CWD" ]] && exit 0
cd "$CWD" || exit 0
[[ -d .claude/mem ]] || exit 0
[[ -z "$TRANSCRIPT" || ! -f "$TRANSCRIPT" ]] && exit 0

SESSION_FILE=".claude/mem/session"
TIMESTAMP=$(date +%Y-%m-%d)

TURN_COUNT=$(wc -l < "$TRANSCRIPT" 2>/dev/null | tr -d ' ')
[[ "$TURN_COUNT" -lt "${SAVE_TURN_THRESHOLD:-4}" ]] && exit 0

TOOLS_USED=$(jq -r '
  select(.type == "tool_use") |
  .name + ":" + (.input.file_path // .input.command // .input.pattern // "" | split("\n")[0])
' "$TRANSCRIPT" 2>/dev/null | sort -u | head -"${TOOLS_CAP:-20}")

GIT_HASH=$(git log -1 --format=%h 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

if [[ -f "$SESSION_FILE" ]]; then
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' '/^=last_session$/,/^=[a-z]/{ /^=[a-z]/!d; /^=last_session/d; }' "$SESSION_FILE" 2>/dev/null || true
    sed -i '' '/^=tools_used$/,/^=[a-z]/{ /^=[a-z]/!d; /^=tools_used/d; }' "$SESSION_FILE" 2>/dev/null || true
  else
    sed -i '/^=last_session$/,/^=[a-z]/{ /^=[a-z]/!d; /^=last_session/d; }' "$SESSION_FILE" 2>/dev/null || true
    sed -i '/^=tools_used$/,/^=[a-z]/{ /^=[a-z]/!d; /^=tools_used/d; }' "$SESSION_FILE" 2>/dev/null || true
  fi
fi

cat >> "$SESSION_FILE" <<FOOTER

=last_session
_t:$TIMESTAMP
_sid:${SESSION_ID:0:8}
_h:$GIT_HASH
_b:$GIT_BRANCH
_turns:$TURN_COUNT
FOOTER

if [[ -n "$TOOLS_USED" ]]; then
  echo "=tools_used" >> "$SESSION_FILE"
  echo "$TOOLS_USED" | while read -r line; do
    [[ -n "$line" ]] && echo "+$line" >> "$SESSION_FILE"
  done
fi

exit 0
