---
id: TASK-28
title: Replace ship's mtime watermark with a per-file ledger
status: To Do
assignee: []
created_date: '2026-08-18 03:58'
updated_date: '2026-08-18 06:43'
labels:
  - gbrain
  - sync
dependencies:
  - TASK-29
priority: medium
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the 2026-08-18 autoplan review, Eng finding 10. 'Running this twice is a no-op' is currently vacuous: ship keys off one .last-ship mtime, while appendToChatFile REWRITES whole files (one chat here is 3.7MB), bumping mtime and re-shipping everything. And 'what is ingested?' is unanswerable because there is no per-file state.

A {slug, source, sha256, shippedAt} ledger fixes both at once: it makes the no-op real and makes brain status answerable. Also: an hourly cron will collide with the workspace lock during a long export, so a locked run must exit 0 with a 'skipped' heartbeat rather than looking like breakage.

NOTE: do NOT add a brain config file. D8 rejected a persisted folder-to-brain map as 'a second truth that drifts' and the 2026-08-09 amendment reaffirmed env-not-file. TG_BRAIN_MAP stays.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 shipping twice re-sends nothing even after an append rewrites the file
- [ ] #2 a run that cannot take the lock exits 0 and records a skipped heartbeat
<!-- AC:END -->
