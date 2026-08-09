---
id: TASK-1
title: Land the pending session-cache milliseconds fix as its own commit
status: Done
assignee: []
created_date: '2026-08-05 00:35'
updated_date: '2026-08-09 20:01'
labels:
  - session
  - bugfix
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mtcute writes session `updated` in MILLISECONDS, not seconds. The old reader treated it as seconds, so `session status` reported a timestamp ~56000 years in the future. The fix is already written and tested in the working tree (`src/session/cache.ts` + `test/session.test.ts`) but uncommitted.

WHY FIRST: it must land before the rename (TASK-4) so the rename diff stays purely mechanical. A behaviour fix buried inside a 44-token rename is unreviewable.

Size: S — the code is already written; this is a commit, a typecheck and a test run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 session status reports a plausible last-updated timestamp, not a far-future one
- [ ] #2 test/session.test.ts covers the milliseconds interpretation and pnpm test passes
- [ ] #3 npx tsc --noEmit is clean
- [ ] #4 the commit touches only src/session/cache.ts and test/session.test.ts
<!-- AC:END -->
