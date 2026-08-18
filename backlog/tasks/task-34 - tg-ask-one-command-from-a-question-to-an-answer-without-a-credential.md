---
id: TASK-34
title: 'tg ask: one command from a question to an answer, without a credential'
status: To Do
assignee: []
created_date: '2026-08-18 06:45'
labels:
  - search
  - agent-ux
dependencies:
  - TASK-26
priority: medium
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
IDEA, aimed squarely at the agent that will use this tool.

Right now answering 'where did we discuss X' takes two tools and knowledge of both: gbrain query for retrieval, tg for everything else. An agent has to know the brain exists, that it is configured, which source to use, and how to read its output.

BUILD: 'tg ask <question> [--json]' that shells out to gbrain query, formats the hits as chat + date + snippet + message id, and - this is the point - degrades honestly. If no brain is configured it says so and falls back to searching the archive (TASK-26). If nothing matches it says nothing matched, which is different from not being configured, which is different from being broken. Exit codes already distinguish those three (4 vs 0 vs 6).

Keeps the D7 boundary: like tg ship, it holds no Telegram credential and its import graph must stay clean of src/session.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 answers a question from the brain when one is configured, and from the archive when not
- [ ] #2 no-results, not-configured and broken are distinguishable by exit code and JSON
- [ ] #3 its import graph contains no session or mtcute module, asserted like eval-48
<!-- AC:END -->
