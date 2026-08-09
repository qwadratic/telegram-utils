---
id: TASK-5
title: 'Frontmatter delta: make every archive file a valid gbrain page'
status: In Progress
assignee: []
created_date: '2026-08-05 00:36'
updated_date: '2026-08-09 20:29'
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
Frontmatter half landed; the formatter half (AC#4) is deliberately NOT in this change.

Landed: every archive file now opens with type: note, title, folder_ids and folder_title. folder_ids is derived from state.folders by foldersForChat() rather than stored per chat, so it cannot drift, and it is sorted by id so the rendered field is stable run to run - an unstable field would rewrite every file and re-ship the entire archive on every pass. folder_title is the FIRST folder's title and is display only; routing reads folder_ids, which carries every membership. A chat in no tracked folder renders folder_ids: [] and folder_title: null, which ship then refuses to route.

Backslashes are now escaped (this also closes what TASK-20 describes). It was not cosmetic: inside a YAML double-quoted scalar \\s is an unknown escape, so a chat named back\\slash made the whole page unparseable - an invalid gbrain page, which is exactly what this task exists to prevent. eval-06 asserts the round trip for quotes, backslashes, colons, # and emoji.

updateFrontmatter backfills the four fields onto files written before this change (eval-09), otherwise every existing archive file would stay permanently unshippable.

Goldens 01, 02, 03 and 05 were regenerated and reviewed line by line: the only diffs are the four added fields and the backslash escape. New goldens 08 (dual membership) and 09 (legacy upgrade) were read by eye before committing.

NOT DONE - AC#4: [from:<sender_id>] in message headers and text_link entities as [label](url). That is src/messages/format.ts, not frontmatter, and it moves every body golden as well. Descoped by the caller for this pass; the file is already a valid gbrain page without it.
<!-- SECTION:NOTES:END -->
