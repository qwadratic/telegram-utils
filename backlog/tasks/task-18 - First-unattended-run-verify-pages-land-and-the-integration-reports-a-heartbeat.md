---
id: TASK-18
title: >-
  First unattended run: verify pages land and the integration reports a
  heartbeat
status: To Do
assignee: []
created_date: '2026-08-05 00:38'
updated_date: '2026-08-18 06:43'
labels:
  - deploy
  - gbrain
  - reflector
  - blocked-on-login
dependencies:
  - TASK-17
  - TASK-15
priority: medium
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trigger `systemctl start tgu.service` once by hand, read the journal, confirm pages exist in the brain, and confirm `gbrain integrations doctor --json` no longer answers no_integrations.

WHY the doctor check is worth naming as an outcome: it currently returns an empty check list because ZERO of the seven existing integrations write a heartbeat. One appended JSONL line is the cheapest step any integration here can take to first-class status.

Inspection uses `session status --json` for the credential side — never `psst get`.

Size: S — one command and two checks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 systemctl start tgu.service exits 0 and the journal shows the export and the ship step running in order
- [ ] #2 the pages captured in the run are retrievable from the brain by their tg/chat/<name>_<id> slugs
- [ ] #3 a second run with no new messages captures nothing new and leaves the archive bytes unchanged apart from exported_at
- [ ] #4 gbrain integrations doctor --json reports the telegram-utils integration instead of no_integrations
- [ ] #5 the journal and the log file contain no secret value and no stack trace for any operator-level failure
<!-- AC:END -->
