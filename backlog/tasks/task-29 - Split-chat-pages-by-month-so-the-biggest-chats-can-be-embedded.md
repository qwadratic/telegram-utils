---
id: TASK-29
title: Split chat pages by month so the biggest chats can be embedded
status: To Do
assignee: []
created_date: '2026-08-18 05:15'
labels:
  - gbrain
  - search
dependencies: []
priority: high
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MEASURED on the live brain, 2026-08-18, immediately after the first successful ingestion.

tg ship writes ONE gbrain page per chat. gbrain flags oversized pages and skips their embeddings: 'page lands, embedding skipped, agent warned'. On this archive that means:

  92 pages shipped, but only 64 embedded (1958 chunks)
  62 of 130 archive files are >100KB
  those files are 99% of all content by bytes
  the largest single chat is 34.5 MB

So keyword search covers everything, but SEMANTIC search covers a small minority of the corpus - and the excluded chats are the long, dense ones most worth searching. This is the single biggest limiter on 'search across my chats', which is the whole point of the ingestion.

BUILD: chunk each chat into one page per month (or per N messages), e.g. slug tg/chat/<name>_<id>/2026-08. Keep the slug stable so re-shipping stays idempotent. Preserve folder_ids routing on every chunk. The archive file on disk can stay one-per-chat; only the SHIP unit changes.

WATCH OUT: slug changes orphan previously captured pages, so ship needs a one-time reconcile that deletes the old whole-chat page when its per-month pages first land, or the brain keeps both and search returns duplicates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 no shipped page exceeds gbrain's oversize threshold on the current archive
- [ ] #2 embedded chunk count covers >90% of archive bytes, measured not assumed
- [ ] #3 re-shipping is still a no-op, and the pre-split whole-chat pages do not linger as duplicates
<!-- AC:END -->
