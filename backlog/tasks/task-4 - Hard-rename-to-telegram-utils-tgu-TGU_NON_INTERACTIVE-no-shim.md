---
id: TASK-4
title: 'Hard rename to telegram-utils / tgu / TGU_NON_INTERACTIVE, no shim'
status: Done
assignee: []
created_date: '2026-08-05 00:36'
updated_date: '2026-08-09 20:10'
labels:
  - rename
dependencies:
  - TASK-1
  - TASK-3
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Package becomes `telegram-utils`; the `bin` map gets two keys (`telegram-utils`, `tgu`) pointing at one file. `SYMBIOTIC_NON_INTERACTIVE` becomes `TGU_NON_INTERACTIVE`. Version to 0.2.0. 18 files, 44 tokens, plus `git mv bin/`.

WHY: every non-CLI surface already says telegram-utils — the repo directory, the git remote, README.md:1, the demo artefacts. Only the CLI disagrees, so the cheapest way to make the four names agree is to move the one that is wrong.

Rejected: a fifth name (tgarc/chatvault) — multiplies the rename surface instead of shrinking it. TG_NON_INTERACTIVE — `TG_*` is the SHARED vault namespace; src/session/psst.ts:26-29 reads TG_API_ID/TG_API_HASH from the global vault on purpose. A compatibility shim — there are zero live consumers: no global link, no cron, no launchd, no shell rc, no VM.

The no-shim call fails LOUDLY if wrong (a run hangs on a prompt), never silently.

Size: M — mechanically low (four `perl -pi` rules, dry-run verified zero residue) but it touches the bin map, the demo tape and the published identity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 package.json name is telegram-utils, version 0.2.0, and bin maps both telegram-utils and tgu to the same file
- [ ] #2 rg -i 'symbiotic' returns zero hits outside backlog/ and git history
- [ ] #3 TGU_NON_INTERACTIVE=1 is honoured everywhere SYMBIOTIC_NON_INTERACTIVE was, with no fallback to the old name
- [ ] #4 AGENTS.md and README.md use the new binary name and the new env var in every example
- [ ] #5 pnpm test passes and npx tsc --noEmit is clean; the golden corpus from TASK-3 either is unchanged or its diff is reviewed token by token
<!-- AC:END -->
