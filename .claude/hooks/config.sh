#!/bin/bash
# Memory system configuration
# Edit these values to tune hook behavior.
# All hooks fall back to defaults if this file is missing.

MEM_MAX_CHARS=8000           # Token budget (~2000 tokens). load-memory.sh warns above this.
CHECKPOINT_FRESHNESS=600     # Seconds. Stop hook skips if session saved within this window.
STOP_TURN_THRESHOLD=25       # Transcript lines. Stop hook only blocks after this many turns.
SAVE_TURN_THRESHOLD=4        # Transcript lines. SessionEnd hook skips trivial sessions below this.
TOOLS_CAP=20                 # Max tool entries logged in session metadata.
