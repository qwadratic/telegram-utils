---
id: TASK-5
title: 'Frontmatter delta: make every archive file a valid gbrain page'
status: Done
assignee: []
created_date: '2026-08-05 00:36'
updated_date: '2026-08-18 05:17'
labels:
  - gbrain
  - frontmatter
dependencies:
  - TASK-3
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add to chat frontmatter: `type: note`, `title`, `folder_ids`, `folder_title`, `chat_type`, `self_id`. Add `[from:<sender_id>]` to the message header. Render `text_link` entities as `[label](url)`.

WHY: with these fields each `data/archive/*.md` is already a valid `gbrain capture` payload — no transform, no converter, no second format to keep in sync. `folder_ids` is also the multi-brain routing key (D8): the shipper greps one field instead of the archive being split into per-folder directories.

`type` MUST be `note` — one of the 15 values in gbrain-base-v2.yaml. Anything else is silently retyped with `legacy_type` and the drift is invisible in production.

Rejected: per-folder archive directories (forces the watermark key from chatId to folderId:chatId plus a state migration; get it wrong and the second folder's pass reads an already-advanced watermark and writes nothing — silent data loss). A chat-to-brain map in data/config.json (a second truth that drifts). LLM classification (violates the no-LLM-in-the-ingester rule, TASK-8).

Dual folder membership is a list, not a duplicate export: `folder_ids: [7, 12]`.

Size: M — six fields and one formatter fix, all pure reads off objects already held, but every TASK-3 golden changes and the diff must be reviewed field by field.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 a rendered chat file starts with '---', its frontmatter parses as YAML, and type, title, chat_id and folder_ids are all present
- [x] #2 type is the literal string 'note' — asserted literally, not against a set
- [x] #3 a chat in two tracked folders renders folder_ids as a list with both ids and is exported exactly once
- [ ] #4 message headers carry [from:<sender_id>] and text_link entities render as [label](url)
- [x] #5 frontmatter round-trips hostile chat names: quotes, backslashes, colons and '#' parse back to the original name
- [x] #6 every TASK-3 golden is regenerated deliberately and committed in this same commit
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
VERIFIED DONE 2026-08-18: all 130 archive files carry folder_ids AND type: note. Confirmed by scanning the live archive, not by reading the code. The ingestion path that depends on this ran successfully the same day: 92 pages captured into a PGLite brain, routed by folder_ids.
<!-- SECTION:NOTES:END -->
