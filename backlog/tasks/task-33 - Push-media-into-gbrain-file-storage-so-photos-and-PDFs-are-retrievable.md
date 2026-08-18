---
id: TASK-33
title: Push media into gbrain file storage so photos and PDFs are retrievable
status: To Do
assignee: []
created_date: '2026-08-18 06:45'
labels:
  - gbrain
  - media
dependencies:
  - TASK-27
priority: medium
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
IDEA. gbrain 0.46 already has 'files upload-raw' with size routing and signed URLs; tg already knows how to download media ('tg media pull'). Nothing connects them, so the brain holds the CAPTION of a PDF and not the PDF.

The operator's own request from 2026-06-05 was explicit: 'process all message types, store in some viewable format'. Today an attachment reaches the archive as the string '[Attachment: photo]' and nothing else - see TASK-27, which fixes the metadata half. This is the payload half.

BUILD: an opt-in pass that uploads attachments for tracked chats to gbrain file storage, links each file to its chat page, and records the storage path in the archive so a re-run is idempotent. Opt-in because it moves real bytes off the machine and that must be a deliberate choice, and because it multiplies storage.

DEPENDS ON TASK-27: without filename/mime/size in the archive there is no way to decide what is worth uploading.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 an attachment in a tracked chat is retrievable from the brain, not just its caption
- [ ] #2 re-running uploads nothing twice
- [ ] #3 it is opt-in and says plainly that bytes leave the machine
<!-- AC:END -->
