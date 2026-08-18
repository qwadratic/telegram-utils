---
id: TASK-36
title: 'Backfill: re-ship what is already in the brain after the pipeline improves'
status: To Do
assignee: []
created_date: '2026-08-18 06:53'
labels:
  - gbrain
  - sync
dependencies:
  - TASK-27
  - TASK-29
  - TASK-30
priority: high
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MISSING WORK, surfaced by the 2026-08-18 CEO review. Tasks 27, 29 and 30 all fix the pipeline FORWARD. Nothing re-processes what is already there:

  - 62 oversized pages are in the brain unembedded and will stay that way after task-29 lands, because ship only looks at files newer than the .last-ship watermark.
  - 38 unrouted chats stay absent after task-30 lands, for the same reason.
  - 189MB of archive says '[Attachment: photo]' with no filename, mime or size, and task-27 only fixes files written AFTER it ships.

So without this, 'the PDF from March' stays unanswerable forever no matter how good the pipeline becomes, and the brain permanently reflects the pipeline as it was on 2026-08-18.

BUILD: 'tg ship --all' already ignores the watermark, so the brain half may need only a documented re-run plus a de-duplication story for the pre-split slugs. The ARCHIVE half is the hard part: recovering media metadata means re-reading history from Telegram at 1.5s/100 messages, which for 197MB is hours and a flood-wait risk. Decide deliberately whether to backfill metadata for everything, for a recent window, or only for chats the operator names.

DEPENDS ON 27, 29 and 30: backfilling before the forward path is fixed just re-creates the same wrong data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 after a backfill, embedded coverage of archive bytes is >90%, measured
- [ ] #2 the 38 previously-unroutable chats are searchable
- [ ] #3 pre-split whole-chat pages do not linger beside their per-month replacements
<!-- AC:END -->
