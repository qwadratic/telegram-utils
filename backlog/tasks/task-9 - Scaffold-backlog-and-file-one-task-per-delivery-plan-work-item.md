---
id: TASK-9
title: Scaffold backlog/ and file one task per delivery-plan work item
status: Done
assignee: []
created_date: '2026-08-05 00:36'
updated_date: '2026-08-05 00:40'
labels:
  - process
dependencies: []
references:
  - backlog/decisions/2026-08-05-consolidate-on-telegram-utils.md
priority: low
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Adopt the house backlog conventions as-is: the standard eight directories, the shared config.yml shape (project_name telegram-utils, three statuses, auto_commit false, bypass_git_hooks false, auto_open_browser false, remote_operations false), flat topical labels, and hand-written decision records per the house decisions README template.

WHY flat labels rather than the 'prio:N' label axis used elsewhere: this repo uses the real `priority` field, so a priority label would be a second truth that drifts.

HARD RULE inherited with the convention: never edit backlog/**/*.md directly — backlog CLI only, --plain on every scripted call.

Size: S — backlog init plus ~19 task create calls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog/config.yml matches the house shape with project_name telegram-utils
- [x] #2 the eight standard directories exist: tasks, drafts, completed, archive, decisions, docs, milestones, config
- [x] #3 one task exists per delivery-plan work item, each with description, testable acceptance criteria, labels and the dependencies the plan states
- [x] #4 the consolidation decision record is written under backlog/decisions/ following the house filename and template
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
backlog init ran non-interactively with --defaults plus explicit flags; --agent-instructions none so the existing AGENTS.md was left untouched (verified byte-identical afterwards). config.yml matches the house shape with auto_open_browser false, remote_operations false, check_active_branches false. .locks/ is CLI-managed and absent at rest, as elsewhere. 19 tasks created (TASK-1..TASK-19), one per delivery-plan work item W0..W18, dependencies wired to match the plan's dependency graph. Decision record hand-written, not via backlog decision create, per the house convention; decisions/README.md carries the template forward.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
backlog/ scaffolded and populated: 19 tasks with descriptions, testable acceptance criteria, labels and dependencies, plus backlog/decisions/2026-08-05-consolidate-on-telegram-utils.md and decisions/README.md. Nothing under data/, .psst/ or ~/.config/gbrain/ was read or written. Changes left unstaged for human review.
<!-- SECTION:FINAL_SUMMARY:END -->
