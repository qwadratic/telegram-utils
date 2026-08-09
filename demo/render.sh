#!/usr/bin/env bash
# Rebuild the fixture and render the export-journeys demo.
#
# Run from the repo root:  demo/render.sh
set -euo pipefail

REPO=$(cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO"

command -v vhs >/dev/null || { echo "vhs required: brew install vhs"; exit 1; }
command -v jq >/dev/null || { echo "jq required: brew install jq"; exit 1; }

node demo/make-fixture.mjs >/dev/null
mkdir -p demo/out

# The tape calls `tgu` by name; expose the source wrapper on PATH
# so the recording shows the command people actually type.
PATH="$REPO/bin:$PATH" vhs demo/journeys.tape

echo "rendered:"
ls -1 demo/out
