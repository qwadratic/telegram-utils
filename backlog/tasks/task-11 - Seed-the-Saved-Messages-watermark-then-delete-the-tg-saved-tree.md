---
id: TASK-11
title: 'Seed the Saved Messages watermark, then delete the tg-saved tree'
status: To Do
assignee: []
created_date: '2026-08-05 00:36'
updated_date: '2026-08-18 06:44'
labels:
  - cleanup
dependencies:
  - TASK-10
  - TASK-7
priority: medium
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Set `chats[<self id>].lastMessageId = 1730595` in data/archive/sync-state.json, verify one incremental export against it, and only then delete the tg-saved tree and `~/.config/gbrain/{tg-saved-checkpoint.json,tg-folder-html/}`.

WHY the ordering is the whole task: seed first or Saved Messages re-ingests its entire history from zero. Delete first and the checkpoint value that makes the seed possible is gone.

WHY delete at all: tg-saved is the worse codebase on every axis that matters here — no lock, no non-interactive mode, no rate limiting, no gapless watermarks, no tests, and a Keychain binding that cannot reach Linux. Two entrypoints on one account also means two clients sharing one FLOOD_WAIT budget and one credential blast radius, plus tg-saved's own daemon-vs-cron collision on a single auth key with no lock.

Size: M — the deletion is trivial; the ordering is not.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 data/archive/sync-state.json carries lastMessageId 1730595 for the self chat id BEFORE any deletion
- [ ] #2 one export run after seeding fetches only messages newer than 1730595 — verified by the run's own reported count, not by re-reading history
- [ ] #3 the tg-saved tree is deleted only after TASK-10 has landed its salvage document
- [ ] #4 ~/.config/gbrain/tg-saved-checkpoint.json and ~/.config/gbrain/tg-folder-html/ are gone
- [ ] #5 no other file under ~/.config/gbrain/ was touched
<!-- AC:END -->
