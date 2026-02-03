# Phase 4: Incremental Sync - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Track sync state per chat, fetch only new messages on subsequent runs, detect and handle new/removed chats and folders. The `export` command becomes incremental-aware — first run does full export, subsequent runs sync only changes.

</domain>

<decisions>
## Implementation Decisions

### Append behavior
- New messages appended to end of existing monthly files (not rewritten)
- Skip old months — only append to current/recent month files, don't create historical files for gaps
- Trust state tracking for overlap — if state says "last was ID 500", only fetch >500, don't scan file for duplicates
- Update frontmatter on append: `last_message_id` and `exported_at` refreshed, `first_message_id` unchanged

### Change detection
- **New chats in tracked folders:** Interactive prompt — user picks which to add, skip, or "add all new automatically"
  - Research best terminal widget/dialog for multi-select with these options
- **New folders in Telegram:** Interactive prompt — "Track these new folders?" with selection
- **Progress during sync:** Match full export style — same spinner/progress as initial export
- **Summary after sync:** Detailed breakdown — per-chat message counts, files updated, new chats added

### Data structure
- Config reflects Telegram's folder structure — a chat can appear in multiple folders
- Archive stores unique chat logs — each chat exported once regardless of folder membership
- Track folder list changes and chat list changes per folder separately

### Edge cases
- **Deleted messages:** Mark as [DELETED] in archive (not removed — data preservation with visibility)
- **Edited messages:** Keep original version, insert diff records so any message state can be restored
- **State lost/corrupted:** Re-export everything (full export, overwrites existing files)
- **Chat removed from folder:** Log and prompt user — "Chat X no longer in folder Y — keep tracking?"

### Claude's Discretion
- State file format (JSON in config vs separate file)
- Diff record format for edited messages
- Exact wording of prompts and logs

</decisions>

<specifics>
## Specific Ideas

- Interactive terminal dialogs for new chat/folder detection — research best library (@clack/prompts multiselect or similar)
- Diff records should enable reconstructing any version of a message
- Config structure should clearly separate "folder structure" from "sync state"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-incremental-sync*
*Context gathered: 2026-02-03*
