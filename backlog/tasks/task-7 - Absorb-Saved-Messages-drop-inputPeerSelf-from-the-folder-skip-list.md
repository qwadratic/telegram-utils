---
id: TASK-7
title: 'Absorb Saved Messages: drop inputPeerSelf from the folder skip list'
status: To Do
assignee: []
created_date: '2026-08-05 00:36'
labels:
  - cleanup
  - sync
dependencies:
  - TASK-5
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`src/folders/index.ts:58` skips `inputPeerSelf`, so Saved Messages is never exported. Remove the condition and Saved Messages becomes an ordinary tracked chat with a gapless minId watermark like every other.

WHY: this is the whole functional surface telegram-utils has to absorb before tg-saved can be deleted (TASK-11). ~40 LOC of behaviour, of which this is one condition and the rest is the state seed.

Rejected outright: porting tg-saved's media.ts (MacWhisper is a sandboxed macOS GUI app that cannot exist on a headless Linux VM), process.ts (OpenRouter — violates the no-LLM-in-the-ingester rule), folder-listener.ts + html-render.ts (never produced a single file), extract-cvs.ts (contains a real person's name).

Size: S — one condition.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Saved Messages appears in the tracked chat set and exports to data/archive like any other chat
- [ ] #2 its watermark advances in data/archive/sync-state.json under the self chat id
- [ ] #3 a fixture-driven test covers the self peer being tracked rather than skipped
- [ ] #4 no other peer type's skip behaviour changed — the folder-selection goldens are unchanged apart from the self entry
<!-- AC:END -->
