#!/usr/bin/env bash
# Record the tour with asciinema and render a GIF with agg.
#
#   demo/record.sh
#
# Everything runs inside demo/workspace against synthetic fixture data.
set -euo pipefail
REPO=$(cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO"

command -v asciinema >/dev/null || { echo "asciinema required: brew install asciinema"; exit 1; }
command -v agg >/dev/null       || { echo "agg required: brew install agg"; exit 1; }
command -v jq >/dev/null        || { echo "jq required: brew install jq"; exit 1; }

node demo/make-fixture.mjs >/dev/null
mkdir -p demo/out

CAST=demo/out/tg-tour.cast
GIF=demo/out/tg-tour.gif
rm -f "$CAST" "$GIF"

# `tg` must be the real binary. Prefer a global install; fall back to the
# source wrapper so the recording works in a fresh clone.
if command -v tg >/dev/null 2>&1; then TGBIN=$(command -v tg); else TGBIN="$REPO/bin/tg.mjs"; fi

# asciinema needs a TTY or it records in headless mode, where the pacing sleeps
# are not reflected in the timeline and the result plays in a few seconds,
# unreadable. `script` allocates a pty so the recording keeps real wall time.
( cd demo/workspace && PATH="$REPO/demo/.binshim:$PATH" \
  TG_NON_INTERACTIVE=1 TG_NO_UPDATE=1 \
  python3 "$REPO/demo/pty-run.py" 96 30 \
    asciinema rec --cols 96 --rows 30 --overwrite \
      --command "bash $REPO/demo/tour.sh" "$REPO/$CAST" >/dev/null )

# --speed is a PLAYBACK rate, not a rewrite of the recording. asciinema without
# a controlling terminal does not carry wall-clock gaps, so the cast is ~4s even
# though the tour pauses deliberately throughout. Slowing playback restores a
# readable pace without inventing timestamps that were never recorded.
agg --font-size 16 --theme asciinema --speed 0.14 "$CAST" "$GIF"

echo "rendered:"
ls -lh "$CAST" "$GIF" | awk '{print "  " $NF, "(" $5 ")"}'
