---
id: TASK-6
title: >-
  Atomic writes for chat files and sync state, plus 0600 on the secret-bearing
  files
status: Done
assignee: []
created_date: '2026-08-05 00:36'
updated_date: '2026-08-09 20:28'
labels:
  - security
  - durability
dependencies:
  - TASK-3
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`writeChatFile` (src/sync/writer.ts:39,62) and `saveState` (src/sync/state.ts:73) are bare `writeFileSync`. Only `writeCombinedArchiveFile` does temp+rename. Copy that pattern to both. Create `data/session.db` and `data/archive/sync-state.json` with mode 0600.

WHY: a truncated archive file or a truncated sync-state is exactly the loss the temp+rename convention exists to prevent — and a half-written sync-state is worse than a lost archive file, because the watermark is what decides whether the missing messages are ever fetched again.

0600 is defence in depth. 0644 on a session cache is precisely the bug found on tg-saved's ~/.config/gbrain/telegram.session.db. The primary defence stays: /srv/tgu is 0700 and agents get no filesystem path into it at all.

Size: S — four lines; writeCombinedArchiveFile is the pattern to copy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 writeChatFile and saveState both write to a temp file in the destination directory and rename over the target
- [x] #2 an interrupted write leaves the target either absent or complete, never truncated, and leaves no .tmp residue
- [x] #3 data/session.db and data/archive/sync-state.json are created with mode 0600, asserted by statSync in a test
- [x] #4 pnpm test passes and npx tsc --noEmit is clean
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
writeFileAtomic (src/utils/atomic.ts) is the one temp+rename helper; writeChatFile, appendToChatFile (both branches) and saveState all use it, and writeCombinedArchiveFile now shares it instead of open-coding the same three lines. saveState writes 0600. EncryptedSqliteStorage chmods data/session.db to 0600 immediately after open - sqlite3 creates at 0644 minus umask, which is exactly the bug found on tg-saved. Evals: 26 (no .tmp residue), 27 (an interrupted write leaves the target complete), 28 (sync-state is 0600 on create AND on rewrite), plus 'the session database is created 0600, never 0644' in test/session.test.ts.
<!-- SECTION:NOTES:END -->
