---
id: TASK-20
title: 'Escape backslashes in frontmatter chat_name, not just quotes'
status: Done
assignee: []
created_date: '2026-08-09 20:06'
updated_date: '2026-08-09 20:31'
labels:
  - bugfix
dependencies: []
priority: medium
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
buildFrontmatter escapes only the double quote. A chat named 'back\slash' renders chat_name: "back\slash", and \s is not a valid escape in a YAML double-quoted scalar, so a strict parser rejects the file. Frozen as current behaviour by eval-03 in test/golden/eval-03-frontmatter-escaping.txt - that golden records the bug, it does not bless it. Fix alongside TASK-5, which is already editing frontmatter, and move the golden in the same commit. Size: S.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed as a side effect of TASK-5, not separately: a chat named back\\slash rendered as an unknown YAML escape, so the page did not parse at all - which made it a TASK-5 blocker rather than a nicety. yamlQuote() escapes the backslash BEFORE the quote, and getFrontmatterValue reverses both in one pass so \\\\\" does not unescape into a stray quote. eval-06 asserts the round trip for quotes, backslashes, colons, # and emoji; golden eval-03 records the new rendering.
<!-- SECTION:NOTES:END -->
