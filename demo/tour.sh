#!/usr/bin/env bash
# The tour asciinema records. Drives the REAL binary against demo/workspace,
# a synthetic archive built by make-fixture.mjs: every folder and chat name on
# screen is invented, and no Telegram account is contacted, so the recording is
# safe to publish.
#
# It deliberately shows the guardrails failing, because refusing correctly is
# most of what this tool does.
set -u

say()  { printf '\033[2m# %s\033[0m\n' "$*"; sleep 1.1; }
run()  { printf '\033[36m$\033[0m %s\n' "$*"; sleep 0.55; eval "$@"; echo; sleep 1.5; }

clear
say "tg — read, search and archive your own Telegram. Built for agents."
sleep 0.4

say "One command answers 'will an unattended run work right now?'"
run "tg doctor --offline"

say "It is honest about what is missing, and exits 3: only a human can log in."
run "tg doctor --offline >/dev/null 2>&1; echo \"exit=\$?\""

say "A chat can be named four ways: id, @username, t.me link, or 'me'."
say "Lookalike handles are refused before any network call."
run "tg dump '@durоv' 2>&1 | head -3"

say "Telegram usernames are ASCII, so that Cyrillic 'o' is not a near-miss."
say "It is not a valid username at all."
sleep 0.8

say "Bad arguments are exit 2 (usage), not 4 (misconfigured). Agents can tell."
run "tg dump 'has space' >/dev/null 2>&1; echo \"exit=\$?\""

say "With --json, failures come back as JSON on stdout too."
run "tg dump 'has space' --json 2>/dev/null | head -7"

say "Real state, read straight off disk. No network, no lock."
run "tg folders list"

say "Same view for a script or an agent."
run "tg folders list --json | jq -c '.[] | {title, chatCount, lastUpdated}'"

say "Only one client may hold a session: two corrupt Telegram's message state."
run "sleep 30 & echo \$! > data/session.lock; tg folders update --folder 2 2>&1 | head -3"
kill %1 2>/dev/null; rm -f data/session.lock

say "The full surface."
run "tg --help | sed -n '/Commands:/,\$p' | head -20"

say "Archive pages feed a gbrain knowledge base, then you ask in your own words."
printf '\033[36m$\033[0m %s\n' "tg ship --skip-unroutable && gbrain query \"who offered me a job\""
sleep 2.2
echo
say "npm install -g @qwadratic/tg"
sleep 2.5
