---
id: TASK-17
title: Create the VM's own Telegram session and pick the tracked folders
status: To Do
assignee: []
created_date: '2026-08-05 00:38'
labels:
  - deploy
  - blocked-on-login
dependencies:
  - TASK-16
priority: medium
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run `telegram-utils session login` on the VM as the tgu user, at a terminal, then `telegram-utils setup` to choose which folders are tracked.

WHY a human: only a person receives the login code. There is no way to automate this and no way around it, and trying to work around it is what produces a copied session string.

WHY the VM gets its OWN login rather than a copy of an existing session: one auth key per machine. A session is an auth key is one row in Active Sessions. Two clients on one auth key desynchronise Telegram's message-box state and can get the session revoked, and the cwd-relative lock cannot see across hosts.

Size: S — one interactive run plus one selection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 the VM holds its own session, distinct from any other machine's — a new, separate row appears in Telegram Active Sessions
- [ ] #2 no session string was copied from another host at any point
- [ ] #3 TGU_NON_INTERACTIVE=1 session status --json on the VM prints a fingerprint and a plausible last-updated timestamp
- [ ] #4 data/config.json lists the intended folder ids and data/session.db is mode 0600
- [ ] #5 the session string never appears in a log, a command line, a commit or a recording
<!-- AC:END -->
