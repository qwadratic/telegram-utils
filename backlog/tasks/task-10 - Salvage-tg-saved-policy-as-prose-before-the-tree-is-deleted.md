---
id: TASK-10
title: Salvage tg-saved policy as prose before the tree is deleted
status: To Do
assignee: []
created_date: '2026-08-05 00:36'
labels:
  - cleanup
  - docs
dependencies: []
priority: medium
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Copy the policy content worth keeping out of tg-saved into `docs/salvage/tg-saved.md`: the SENSITIVE_PATTERNS list, SAFE_PDF_PATTERNS, the PDF default-deny posture, and the M4A faststart note.

WHY prose and not code: preserving 282 LOC of unreachable code to protect 20 lines of policy is the wrong trade. The patterns are judgement, not implementation — they belong in a document a human reads before writing the next filter, not in a module nothing imports.

WHY BEFORE TASK-11: `self/` is not a git repo and the tree is not in the backup zip, so deleting it is irreversible. Anything not copied out first is gone.

Size: S — copy text into one document.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/salvage/tg-saved.md exists and contains SENSITIVE_PATTERNS, SAFE_PDF_PATTERNS, the PDF default-deny rule and the M4A faststart note
- [ ] #2 the document states it is reference prose, not an import target, and names the tg-saved files each item came from
- [ ] #3 the document contains no real person's name, phone number, address or other personal data carried over from extract-cvs.ts
- [ ] #4 the pre-commit hook (psst + gitleaks) passes on it without being bypassed
<!-- AC:END -->
