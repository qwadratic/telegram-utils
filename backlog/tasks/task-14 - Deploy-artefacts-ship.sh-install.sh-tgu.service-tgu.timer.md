---
id: TASK-14
title: 'Deploy artefacts: ship.sh, install.sh, tgu.service, tgu.timer'
status: Done
assignee: []
created_date: '2026-08-05 00:37'
updated_date: '2026-08-18 05:17'
labels:
  - deploy
  - gbrain
  - security
  - reflector
dependencies:
  - TASK-5
  - TASK-6
  - TASK-8
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Four new files, ~70 lines total. One VM, one user, one timer, two oneshot processes in sequence.

- `deploy/ship.sh` (~15 lines): finds archive files newer than `data/archive/.last-ship`, pipes each into `gbrain capture --slug tg/chat/<name>_<id> --quiet --stdin`, one process per file, exit code checked, then touches the stamp and appends one heartbeat line to ~/.gbrain/integrations/telegram-utils/heartbeat.jsonl.
- `deploy/install.sh` (~30 lines, idempotent): create user tgu, install -d -m 0700 -o tgu /srv/tgu, clone, pnpm install --prod, symlink the bin, install both units, systemctl enable --now. It creates NO session and touches NO secret.
- `tgu.service`: Type=oneshot, User=tgu, WorkingDirectory=/srv/tgu, EnvironmentFile=-/etc/tgu.env, Environment=TGU_NON_INTERACTIVE=1, two ExecStart= lines (export, then ship) which run in order and abort on the first failure.
- `tgu.timer`: OnCalendar=*-*-* 04:17:00, Persistent=true. Odd minute per the house cron-stagger rule; Persistent catches a missed run after a reboot.

WHY ship.sh is OUTSIDE the ingester: the ingester never calls gbrain and never calls an LLM. A non-deterministic export makes 'synced up to id N' unverifiable — no diff, no repair, no trustworthy resume. Better extraction in two years must apply to five years of history without re-fetching Telegram. And the ingester holds a full account credential, so it must stay the smallest, most boring, least-edited code in the system.

The separation is enforced by file modes and process boundaries, not discipline: step 2 never sees a Telegram credential, step 1 never sees a gbrain credential, and ship.sh imports no repo source.

Secrets: readSecret() already resolves env first, then local vault, then global vault, so both the psst path and the EnvironmentFile fallback work with zero code change. Prefer psst on the VM; the EnvironmentFile (root:tgu 0640) exists because psst headless unlock on Linux is unverified.

Routing: ship.sh greps folder_ids / the brain field out of the frontmatter and picks the target brain. A file with no routable folder must FAIL LOUDLY, never default silently to some brain.

Chosen capture over import/sources+sync because import, sync and embed are localOnly and refused in thin-client mode, and cannot express per-file routing without splitting the archive directory. Choosing capture is also what makes a later move to a remote brain a one-line change in ship.sh.

Size: L — new artifact class, new host, security-relevant file modes; ship.sh is the only thing in the system that ever holds a gbrain credential.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 capturing the same archive file twice yields the same slug and the same content_hash — the loop is idempotent, verified against a fake gbrain on PATH that records argv and stdin
- [x] #2 slugs are byte-stable across ASCII, unicode, emoji-only, 300-char, empty and duplicate-name-different-id inputs, pinned by a golden file
- [x] #3 routing: folder_ids [7] goes to brain A, [12] to brain B, [7,12] to both, and a file with no routable folder fails loudly with a non-zero exit
- [x] #4 a non-zero exit from any gbrain capture aborts the run and does NOT touch the .last-ship stamp
- [x] #5 ship.sh imports no repo source and reads no Telegram secret — asserted by a grep gate alongside the TASK-8 gates
- [ ] #6 install.sh is idempotent: running it twice leaves the same state, creates no session and writes no secret
- [x] #7 the unit files set Type=oneshot, User=tgu, WorkingDirectory=/srv/tgu and TGU_NON_INTERACTIVE=1, and the timer uses Persistent=true
- [x] #8 one heartbeat line per run is appended as valid JSONL with ts, event, source_version, status and details
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CLOSED 2026-08-18, superseded in part. deploy/ now holds tg.service, tg.timer and README.md. ship.sh and install.sh were never built and are no longer wanted: the 2026-08-09 amendment turned deploy/ship.sh into the 'tg ship' subcommand, and the systemd unit runs the binary directly with two ExecStart lines. Remaining deployment work is TASK-16/17/18 (the VM itself), which are HUMAN/EXTERNAL.
<!-- SECTION:NOTES:END -->
