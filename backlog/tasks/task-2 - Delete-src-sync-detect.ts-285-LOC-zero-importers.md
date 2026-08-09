---
id: TASK-2
title: 'Delete src/sync/detect.ts (285 LOC, zero importers)'
status: Done
assignee: []
created_date: '2026-08-05 00:35'
updated_date: '2026-08-09 20:10'
labels:
  - cleanup
dependencies: []
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`src/sync/detect.ts` is 285 lines with no importer anywhere in the tree. Dead code in a repo that holds a full account credential is pure liability: it is read during audits, it drags along dependencies, and it makes the trust-model greps (TASK-8) noisier than they need to be.

Rejected: keeping it 'in case'. git history is the 'in case'.

Size: S — a pure deletion; `npx tsc --noEmit` proves nothing referenced it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 src/sync/detect.ts no longer exists
- [ ] #2 npx tsc --noEmit is clean after the deletion
- [ ] #3 pnpm test passes unchanged
- [ ] #4 rg 'sync/detect' src test returns zero hits
<!-- AC:END -->
