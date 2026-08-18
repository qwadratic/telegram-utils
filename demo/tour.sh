#!/usr/bin/env bash
# The tour asciinema records. Drives the REAL binary against a throwaway
# workspace built by make-fixture.mjs under TMPDIR: every folder and chat name
# on screen is invented, no Telegram account is contacted, and the path shown
# belongs to nobody, so the recording is safe to publish.
#
# Structure follows the two audiences that share this binary. Part 1 is what a
# person sees; part 2 is what an agent parses. Same commands, same workspace -
# the difference is only ever --json and the exit code, and showing them back to
# back is the point.
#
# It deliberately shows the guardrails refusing, because refusing correctly is
# most of what this tool does.
set -u

dim='\033[2m'; cyan='\033[36m'; bold='\033[1m'; off='\033[0m'

say()  { printf "${dim}# %s${off}\n" "$*"; sleep 1.0; }
run()  { printf "${cyan}\$${off} %s\n" "$*"; sleep 0.5; eval "$@"; echo; sleep 1.3; }
act()  { echo; printf "${bold}%s${off}\n" "$*"; printf "${dim}%s${off}\n" \
         "$(printf '─%.0s' $(seq 1 ${#1}))"; sleep 1.2; }

clear
printf "${bold}tg${off} - your own Telegram, from the command line.\n"
sleep 1.0
say "One binary, two audiences: a person at a terminal, and a coding agent."
say "Everything below is real output against a synthetic workspace."
sleep 0.6

act "Part 1 - a person"

say "One command answers 'can I use this right now?'"
run "tg doctor"

say "It names the one thing it cannot do for you, and what to type."
sleep 0.8

say "Local state, read straight off disk. No network, no lock."
run "tg folders list"

say "A chat can be named four ways: id, @username, t.me link, or 'me'."
say "This one is a Cyrillic lookalike, refused before any network call."
run "tg dump '@durоv' 2>&1 | head -3"

say "Telegram usernames are ASCII, so that is not a near-miss handle."
say "It is not a valid handle at all."
sleep 0.9

act "Part 2 - a coding agent"

say "An agent reads one file and knows the whole contract."
run "head -14 SKILL.md"

say "Same question as before, machine-readable."
run "tg doctor --json | jq -c '{ok, status}'"

say "It branches on the exit code, never on the prose."
run "tg doctor >/dev/null 2>&1; echo \"exit=\$?  -> 3 = only a human can fix this\""

say "Every read verb has the same shape."
run "tg folders list --json | jq -c '.[] | {title, chatCount}'"

say "Failures come back as JSON on stdout, carrying the same code."
run "tg dump 'has space' --json 2>/dev/null | jq -c '.error | {code, exit}'"

say "A typo is exit 2, not exit 1. Exit 1 would mean a bug in tg."
run "tg peers frobnicate >/dev/null 2>&1; echo \"exit=\$?\""

say "And the line an agent does not cross:"
run "TG_NON_INTERACTIVE=1 tg send text 4820000 'ping' --json 2>/dev/null | jq -r '.error.detail'"

say "Exit 3 again: stop and ask the operator. Not a puzzle to route around."
say "It costs nothing either - refused before any session is opened."
run "ls data/session.lock 2>/dev/null || echo 'no lock was ever taken'"

act "The payoff"

say "Archive pages feed a gbrain knowledge base..."
say "...then you ask in your own words, not in grep."
printf "${cyan}\$${off} %s\n" "tg ship --skip-unroutable && gbrain query \"who offered me a job\""
sleep 2.4
echo
printf "${bold}npm install -g @qwadratic/tg${off}\n"
sleep 2.5
