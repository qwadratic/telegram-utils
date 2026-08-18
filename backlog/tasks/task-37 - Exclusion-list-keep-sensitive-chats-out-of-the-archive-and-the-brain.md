---
id: TASK-37
title: 'Exclusion list: keep sensitive chats out of the archive and the brain'
status: To Do
assignee: []
created_date: '2026-08-18 06:53'
labels:
  - security
  - sync
dependencies: []
priority: high
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MISSING WORK, surfaced by the 2026-08-18 CEO review, and it is a safety gap rather than a feature gap.

197MB of other people's plaintext currently flows into an archive and then into a knowledge base with NO exclusion policy. That includes whatever arrives in chats carrying 2FA codes, banking notifications, medical or legal conversations, and messages from people who have no idea any of this is being indexed. task-10 only salvages the old tg-saved SENSITIVE_PATTERNS as prose that nothing imports.

The blast radius grew today: before the gbrain ingestion those messages sat in one 0700 directory; now they are also chunked, embedded and queryable, and an agent with brain access can surface them without ever touching the archive.

BUILD: an exclusion list applied at BOTH boundaries - chat-level (never export this chat) and pattern-level (never ship a message matching these patterns). Chat-level is the one that matters; pattern-level is a second net. Applied at export so excluded content never lands on disk at all, which is stronger than filtering at ship time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 a named chat can be excluded and never appears in the archive or the brain
- [ ] #2 exclusions apply on the export path, so excluded content never reaches disk
- [ ] #3 an already-exported excluded chat can be purged from both archive and brain
<!-- AC:END -->
