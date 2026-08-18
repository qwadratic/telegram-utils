---
id: TASK-27
title: Capture media metadata at export time so files and photos are findable
status: To Do
assignee: []
created_date: '2026-08-18 03:58'
updated_date: '2026-08-18 06:53'
labels:
  - export
  - search
dependencies: []
priority: high
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the 2026-08-18 autoplan review, Eng finding 4. VERIFIED: formatAttachmentBlock emits only '[Attachment: photo]' - no filename, no mime, no size, no duration, and no entities or link previews. So 'the PDF from March' is unrecoverable from data/archive no matter how good the search is.

The metadata only exists on the live Message object, which means it has to be captured on the credential side during export, not derived later. Write it into the archive frontmatter or a sidecar so the read path stays credential-free.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 an archived attachment records filename, mime, size and duration where Telegram provides them
- [ ] #2 the read/search path still imports nothing from src/session (eval-31 stays green)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
UNBLOCKED from task-26 after review: capturing filename/mime/size at EXPORT time needs no search command to exist. It is also the only time-sensitive item in the backlog - metadata not captured now requires re-reading history at 1.5s/100 messages to recover, so every day it waits makes the backfill more expensive.
<!-- SECTION:NOTES:END -->
