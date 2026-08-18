---
id: TASK-19
title: >-
  Re-render the demo under the new name, leak-check it, and file it in the demo
  library
status: To Do
assignee: []
created_date: '2026-08-05 00:38'
updated_date: '2026-08-18 05:17'
labels:
  - demo
  - rename
  - security
  - blocked-on-login
dependencies:
  - TASK-4
  - TASK-17
priority: low
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The committed demo GIF still types `symbiotic-chats`. Re-render it against the renamed binary, inspect every frame for leaks, then `cp -p` the result into ~/Desktop/demos/hobby/telegram-utils/{final,source}/ and add the row to the library README and MANIFEST.

WHY the leak inspection is mandatory and not a formality: screen recordings capture whatever was on screen — home screens, notification banners, chat lists, other apps, real names. A demo of a Telegram client is the highest-risk recording in this repo by construction: real chat titles and real contact names are the subject matter. A blur window verified by eyeballing one frame routinely starts below a label row or expires partway through a clip, so masks are verified by tiling frames, not by trusting the filter.

If a leaking demo ever reaches a public repo, deleting the file does NOT remove it: the blob stays fetchable from history and needs a rewrite plus a force push.

Copy into the library, never move — the in-repo path stays valid. `cp -p` so the library's dates are the real render dates.

Size: M — the render is one script; frame-by-frame leak inspection is the work, and the library index is hand-edited.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 the rendered demo shows the new binary name everywhere and no occurrence of the old one
- [ ] #2 every frame is inspected as a tiled contact sheet: no real chat title, contact name, phone number, address or notification banner is legible
- [ ] #3 audio is stripped from any screen recording used
- [ ] #4 no session string, token or vault value appears in any frame
- [ ] #5 the render is copied with cp -p into ~/Desktop/demos/hobby/telegram-utils/final/ and its sources into source/
- [ ] #6 ~/Desktop/demos/README.md has a row for it and MANIFEST.md records the original path and a Source rating of full, partial or none
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CONTEXT 2026-08-18: the demo assets are still named telegram-utils-export-journeys.gif/.mp4 and the recording shows the OLD command name. The package is now @qwadratic/tg and the binary is 'tg', so the demo is doubly stale: wrong name on screen, wrong name in the file.

The README currently points at the committed GIF by absolute raw.githubusercontent URL, so re-rendering must either keep the same filename or update that link in the same commit, otherwise the npm page shows a broken image.
<!-- SECTION:NOTES:END -->
