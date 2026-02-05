#!/bin/bash
set -euo pipefail

# Load config (optional — defaults used if missing)
HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$HOOKS_DIR/config.sh" ]] && source "$HOOKS_DIR/config.sh"

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

[[ -z "$CWD" ]] && exit 0
cd "$CWD" || exit 0
[[ -d .claude/mem ]] || exit 0
[[ -z "$TRANSCRIPT" || ! -f "$TRANSCRIPT" ]] && exit 0

SESSION_FILE=".claude/mem/session"

if [[ -f "$SESSION_FILE" ]]; then
  if [[ "$(uname)" == "Darwin" ]]; then
    MOD_TIME=$(stat -f %m "$SESSION_FILE" 2>/dev/null || echo 0)
  else
    MOD_TIME=$(stat -c %Y "$SESSION_FILE" 2>/dev/null || echo 0)
  fi
  NOW=$(date +%s)
  DIFF=$((NOW - MOD_TIME))
  [[ "$DIFF" -lt "${CHECKPOINT_FRESHNESS:-600}" ]] && exit 0
fi

TURN_COUNT=$(wc -l < "$TRANSCRIPT" 2>/dev/null | tr -d ' ')

if [[ "$TURN_COUNT" -gt "${STOP_TURN_THRESHOLD:-25}" ]]; then
  jq -n '{
    "decision": "block",
    "reason": "You have unsaved session learnings. Update .claude/mem/session with what you learned this session before stopping. Include: decisions made, user preferences discovered, corrections to your understanding, and current task state."
  }'
  exit 0
fi

exit 0
