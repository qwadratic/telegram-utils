---
id: TASK-22
title: 'Memory-only session mode: no auth key on disk for one-shot runs'
status: To Do
assignee: []
created_date: '2026-08-17 18:56'
labels:
  - session
  - security
dependencies: []
priority: low
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Salvaged from .planning/ROADMAP.md Phase 7 before that tree was deleted. An opt-in mode where the session lives only in process memory and is discarded on exit, for hosts where writing an auth key to disk is not acceptable.

Interacts with the per-folder workspace model: a workspace with no session db still needs a login per run, so this is only usable with TG_SESSION_STRING supplied via env.
<!-- SECTION:DESCRIPTION:END -->
