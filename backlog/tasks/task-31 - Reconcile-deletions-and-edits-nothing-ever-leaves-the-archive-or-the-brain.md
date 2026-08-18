---
id: TASK-31
title: 'Reconcile deletions and edits: nothing ever leaves the archive or the brain'
status: To Do
assignee: []
created_date: '2026-08-18 06:45'
labels:
  - sync
  - gbrain
dependencies: []
priority: medium
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
IDEA, from the 2026-08-18 eng review (finding 6), never filed until now. The whole pipeline is append-only in a way nobody chose:

- fetchMessages uses iterHistory({minId}), which NEVER revisits an id it has already passed. So a message edited after export keeps its original text forever, and a message deleted in Telegram stays in the archive and the brain permanently.
- ship has no un-capture. A chat that leaves a tracked folder keeps its gbrain page for good, and it keeps answering searches.
- There is no delete path anywhere: not in the archive, not in sync-state, not in the brain.

For a knowledge base this is worse than a missing feature. The operator asks it questions and it answers with text the other person retracted, or with a chat they deliberately stopped tracking. It quietly becomes a record of things that are no longer true.

BUILD: a bounded reconcile pass over a recent window (say the last N days) that re-reads ids it already has, updates changed text, tombstones ids that vanished, and un-captures pages for chats that left every tracked folder. Bounded because a full re-read of 197MB is not something to do on a timer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 an edited message updates in the archive on the next reconcile
- [ ] #2 a deleted message is tombstoned rather than silently retained
- [ ] #3 a chat removed from every tracked folder loses its gbrain page
<!-- AC:END -->
