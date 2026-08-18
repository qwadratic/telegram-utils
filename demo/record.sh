#!/usr/bin/env bash
# Record the tour with asciinema and render a GIF with agg.
#
#   demo/record.sh
#
# Everything runs in a throwaway workspace under /tmp, against synthetic data.
set -euo pipefail
REPO=$(cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO"

command -v asciinema >/dev/null || { echo "asciinema required: brew install asciinema"; exit 1; }
command -v agg >/dev/null       || { echo "agg required: brew install agg"; exit 1; }
command -v jq >/dev/null        || { echo "jq required: brew install jq"; exit 1; }

# Record from a neutral path. `tg doctor` prints the absolute data dir, so
# recording inside the checkout puts the operator's username and directory
# layout into a file meant for publication.
# /tmp, not TMPDIR: on macOS TMPDIR is a per-user path containing a hash that
# identifies the machine, which would end up on screen.
WORKDIR=/tmp/tg-demo
rm -rf "$WORKDIR"
node demo/make-fixture.mjs "$WORKDIR" >/dev/null
# The agent chapter reads the skill the package ships; put a copy where the
# tour can cite it without printing an absolute path.
cp skill/SKILL.md "$WORKDIR/SKILL.md"
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
( cd "$WORKDIR" && PATH="$REPO/demo/.binshim:$PATH" \
  TG_NON_INTERACTIVE=1 TG_NO_UPDATE=1 \
  python3 "$REPO/demo/pty-run.py" 96 30 \
    asciinema rec --cols 96 --rows 30 --overwrite \
      --command "bash $REPO/demo/tour.sh" "$REPO/$CAST" >/dev/null )

# Real time, no playback-rate correction.
#
# This previously rendered at --speed 0.14 on the belief that the cast carried
# no wall-clock gaps. It does: the v3 cast format stores the gap SINCE THE
# PREVIOUS EVENT, not an absolute offset, so reading the last line looks like a
# 3.6s recording when the real duration is the sum of every line. pty-run.py
# already makes the timing honest; slowing it 7x turned a 50s tour into a
# 5m39s GIF that nobody would sit through.
agg --font-size 16 --theme asciinema "$CAST" "$GIF"

# This recording gets published. Everything on screen came from a real terminal
# on someone's laptop, so scan the cast for the operator before trusting it -
# the first cut printed an absolute home directory in the very first command.
python3 - "$CAST" <<'PY'
import json, os, re, sys
text = ''.join(
    json.loads(l)[2] for l in open(sys.argv[1])
    if l.startswith('[') and json.loads(l)[1] == 'o'
)
text = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', text)
needles = {
    'home directory': os.path.expanduser('~'),
    'username': os.path.basename(os.path.expanduser('~')),
    'checkout path': os.getcwd(),
}
leaks = {what: n for what, n in needles.items() if n and n in text}
if leaks:
    for what, n in leaks.items():
        print(f"LEAK: {what} ({n}) appears in the recording")
    sys.exit(1)
print("leak scan: clean")
PY

# A demo whose length nobody checks is how the 5m39s GIF shipped. Print it.
python3 - "$CAST" <<'PY'
import json, sys
total = sum(json.loads(l)[0] for l in open(sys.argv[1]) if l.startswith('['))
print(f"cast duration: {total:.0f}s")
if total > 150:
    print("  WARNING: over 2m30s - tighten the tour rather than speeding playback")
PY

echo "rendered:"
ls -lh "$CAST" "$GIF" | awk '{print "  " $NF, "(" $5 ")"}'
