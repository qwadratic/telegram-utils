---
id: TASK-16
title: 'HUMAN: provision the VM and seed the vault with API credentials'
status: To Do
assignee: []
created_date: '2026-08-05 00:37'
labels:
  - deploy
  - human
dependencies:
  - TASK-14
priority: medium
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run `deploy/install.sh` on the target host, then `psst init` in /srv/tgu and `psst set API_ID --stdin` / `psst set API_HASH --stdin` as the tgu user.

WHY --stdin and never argv: a value passed as an argument is visible to `ps` and lands in shell history. Piping keeps it out of both.

Never run `psst get` to 'check' a secret. `session status` prints a fingerprint; that is the check.

install.sh creates no session and sets no secret — those are separate, deliberate, human steps.

Size: S — one idempotent script and two piped writes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 /srv/tgu exists, owned tgu:tgu, mode 0700
- [ ] #2 the tgu.timer unit is enabled and the next scheduled run is visible in systemctl list-timers
- [ ] #3 API_ID and API_HASH are present in the /srv/tgu vault, verified by a presence check and never by printing a value
- [ ] #4 no secret value appears in shell history, in argv, or in any log
- [ ] #5 running install.sh a second time changes nothing
<!-- AC:END -->
