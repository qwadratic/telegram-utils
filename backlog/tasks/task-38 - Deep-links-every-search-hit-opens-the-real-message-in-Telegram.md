---
id: TASK-38
title: 'Deep links: every search hit opens the real message in Telegram'
status: To Do
assignee: []
created_date: '2026-08-18 06:53'
labels:
  - search
  - agent-ux
dependencies: []
priority: medium
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
IDEA from the 2026-08-18 DX review. Small, daily, and currently impossible.

A search result today gives chat name, date and a snippet. To act on it the operator opens Telegram and scrolls. Telegram accepts t.me/c/<internal_id>/<message_id> for private chats and t.me/<username>/<message_id> for public ones, and the archive already records chat_id and message ids in frontmatter - so the link is derivable from data already on disk.

Emit it from dump, search and any brain-backed answer, so a result is one click from the source. Note the id transform: t.me/c/ wants the channel id WITHOUT the -100 prefix that the marked id carries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 a search or dump result carries a working t.me link for both private and public chats
- [ ] #2 the -100 prefix transform is handled and covered by a test
<!-- AC:END -->
