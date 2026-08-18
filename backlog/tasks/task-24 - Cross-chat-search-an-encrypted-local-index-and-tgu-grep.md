---
id: TASK-24
title: 'Cross-chat search: an encrypted local index and tgu grep'
status: Done
assignee: []
created_date: '2026-08-17 19:31'
updated_date: '2026-08-18 05:17'
labels:
  - search
  - agent-ux
dependencies: []
priority: high
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PAIN, from transcripts: the recurring request is retrieval ACROSS chats, but the tool only reads one chat at a time by an id you must already know. 5 clean mentions on 3 days, 2026-08-05 to 2026-08-17:
- 2026-08-10: 're/ dynatrace - try searching my dms its pretty recent and easily searchable, use mtcute session that already exist'
- 2026-08-09: 'find a list of recruiters i've spoke before on telegram, and build unique message for all of them'
- 2026-08-17: 'read my chat history with this user. it has some bug reports and we discuss some updates'
- 2026-08-17: 'read my linkedin, gmail and telegram and reconcile the tracker'

Corroborated by the filesystem: three near-duplicate thread dumpers were written by hand (dump-bohdan, dump-flug, dump-peer) because the answer to 'where did we discuss X' was 'dump a thread and read it'.

BUILD:
- 'tgu index [--since]' building an incremental SQLite FTS5 full-text index over tracked chats, in the workspace, using the existing encrypted-sqlite driver so it is encrypted at rest like the session cache.
- 'tgu grep <query> [--from <peerId>] [--type user] [--since] [--json]' returning peer, date, message id and a snippet, ranked.
- Deterministic and LLM-free BY DESIGN: this returns evidence, the agent does the reasoning. That keeps decision D7 intact (nothing holding a Telegram credential calls an LLM) and makes the output golden-testable.

WHY: this is the primitive being improvised by hand. It also makes 'dump' cheap to aim, because today you need the id before you can read anything.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 index is incremental, encrypted at rest, 0600, and lives under the workspace data root
- [ ] #2 grep returns peer/date/messageId/snippet and supports --json with payload-only stdout
- [ ] #3 no module reachable from the index or grep path imports an LLM or gbrain (extends eval-32)
- [ ] #4 a golden pins the ranked output for a fixture corpus
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
SUPERSEDED by TASK-26 on 2026-08-18, not built as written. This task specified 'an encrypted local index and tgu grep'. The autoplan review killed both halves with evidence:

- The encrypted FTS5 index would have been a second full copy of every message sitting next to a live account credential, which the 2026-08-05 log names as THE hazard, and its 'encrypted at rest' claim was hollow because the key lives beside the ciphertext.
- VERIFIED: FTS5 with unicode61 remove_diacritics 2 returns NOTHING for MATCH 'budapest' against 'Budapesten a rekruter irt'. It would have silently failed on Hungarian and Russian, which is a large share of this operator's chats.
- rg over data/archive already answers the question today across 130 flat markdown files, at zero build cost.

TASK-26 carries the surviving intent: ranked search over the existing archive first, FTS5 only when measured and only with a trigram companion table. The name also changed: 'tgu grep' is now 'tg search'.
<!-- SECTION:NOTES:END -->
