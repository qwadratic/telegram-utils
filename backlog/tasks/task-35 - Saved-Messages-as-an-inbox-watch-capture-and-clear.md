---
id: TASK-35
title: 'Saved Messages as an inbox: watch, capture, and clear'
status: To Do
assignee: []
created_date: '2026-08-18 06:45'
labels:
  - gbrain
  - workflow
dependencies:
  - TASK-7
priority: medium
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
IDEA, and the operator's longest-running unmet want. From 2026-06-03: 'i want no more than 5 latest saved messages to be processed (per manual run). i want to also have a variant where all processed records are deleted from saved messages chat + message back to chat (report of the previous run)'.

Saved Messages is where they park links, screenshots, voice notes and documents to deal with later. Everything else in the archive is conversation; this is curation, and it is the highest signal-per-byte content in the account.

BUILD: 'tg inbox' - list unprocessed Saved Messages, capture each into the brain with its attachment, and optionally acknowledge back into the chat so the operator can see what was understood. A bounded batch size, because the request was explicit that it must not run away.

DEPENDS ON TASK-7: inputPeerSelf is still on the folder skip list, so Saved Messages is invisible to export today. The write-back half must go through src/send/ and inherits its caps and confirmation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 processes a bounded batch of Saved Messages and captures each into the brain
- [ ] #2 the acknowledge-back path goes through src/send/ and respects its caps
- [ ] #3 re-running does not reprocess what it already captured
<!-- AC:END -->
