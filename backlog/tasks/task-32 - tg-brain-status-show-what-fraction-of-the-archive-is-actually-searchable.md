---
id: TASK-32
title: 'tg brain status: show what fraction of the archive is actually searchable'
status: To Do
assignee: []
created_date: '2026-08-18 06:45'
labels:
  - gbrain
  - observability
dependencies: []
priority: high
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
IDEA, and the metric that would have caught today's biggest problem in one command instead of after a full ingest.

After the first successful ingestion the numbers were: 92 pages shipped, 64 embedded, 1958 chunks - and 62 of 130 archive files are oversized, holding 99% of all content by bytes. So keyword search covered everything and semantic search covered a sliver, and nothing surfaced that until the embed run printed 'page lands, embedding skipped'.

BUILD: 'tg brain status [--json]' answering, from local state plus one gbrain query:
  - archive: N files, M bytes
  - shipped: N pages, when
  - embedded: N pages / N chunks, and the PERCENTAGE OF ARCHIVE BYTES those cover
  - unroutable: N chats and why
  - oversized: N pages that will never embed at their current size
The percentage is the headline. 'Is my Telegram searchable?' should be one number, not an inference.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 reports embedded coverage as a share of archive bytes, not just page counts
- [ ] #2 names unroutable and oversized pages with the specific reason for each
- [ ] #3 runs without a Telegram credential (gbrain side only), so eval-48 stays green
<!-- AC:END -->
