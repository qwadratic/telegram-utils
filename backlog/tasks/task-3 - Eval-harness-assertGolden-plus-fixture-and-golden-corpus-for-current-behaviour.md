---
id: TASK-3
title: >-
  Eval harness: assertGolden plus fixture and golden corpus for current
  behaviour
status: Done
assignee: []
created_date: '2026-08-05 00:35'
updated_date: '2026-08-09 20:06'
labels:
  - evals
  - tooling
dependencies:
  - TASK-2
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the existing `node:test` suite with a ~15-line `assertGolden()` helper, `test/fixtures/` and `test/golden/`. `pnpm test` exit code stays the single verdict; `npx tsc --noEmit` is the second gate.

WHY: every later work item changes rendered output (frontmatter fields, atomic writes, the rename). Without frozen goldens captured BEFORE those changes, no reviewer can tell an intended diff from a regression. Bootstrap the goldens against CURRENT behaviour first, then let TASK-5 move them deliberately.

Rules kept verbatim from the house harness: normalization lives in the render helper and never in the diff; a failing eval NEVER auto-updates a golden; first write prints a loud bootstrap banner and passes; frozen literals ARE the assertions.

Rejected: porting a second shell harness (lib.sh + run.sh + per-phase expected/) into a repo with 35 passing node:test cases — a second language, runner and gate for no gain.

Scope: evals 01-05 (frontmatter), 11-17 (watermarks, filenames), 22-25 (lock). Every eval runs with zero network access: message inputs are plain objects shaped like mtcute Message, history iteration is a generator over an array.

Size: M — the helper is trivial; the fixture corpus is the real work and every bootstrapped golden must be eyeballed before commit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 test/helpers.ts exports assertGolden(name, actual); normalization covers exported_at, tmpdir and pid only
- [ ] #2 a golden that does not exist is written once with a loud banner on stderr and the run passes; a golden that exists and differs FAILS and is never rewritten
- [ ] #3 goldens exist and are committed for evals 01-05, 11-17 and 22-25, each reviewed by eye
- [ ] #4 the whole suite runs with no Telegram network access: no data/session.db is created by any test
- [ ] #5 pnpm test exits 0 and npx tsc --noEmit is clean
<!-- AC:END -->
