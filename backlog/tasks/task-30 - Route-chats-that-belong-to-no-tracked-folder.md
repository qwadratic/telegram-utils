---
id: TASK-30
title: Route chats that belong to no tracked folder
status: To Do
assignee: []
created_date: '2026-08-18 05:15'
labels:
  - gbrain
  - sync
dependencies: []
priority: high
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MEASURED 2026-08-18: 38 of 130 archive files carry folder_ids: [] because their chat is in no tracked folder - exported directly with --chats, or the folder membership changed later. ship refuses to guess a brain for them (correct, D8 and eval-44), so they never reach the brain at all.

0.3.9 added --skip-unroutable so those 38 stop blocking the other 92, but skipping is not routing: those chats are still invisible to search, and several are 1:1 DMs, which is exactly the content the operator asks about most ('search my dms').

BUILD one of: an explicit unfoldered mapping (TG_BRAIN_MAP="0=default" where 0 means 'in no tracked folder'), or a tg setup pass that adds them to a folder. The first is less work and stays explicit rather than guessing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 the 38 currently-unroutable chats can reach a brain without ship guessing a destination
- [ ] #2 eval-44 still passes: an unmapped folder is still refused
<!-- AC:END -->
