# Phase 2: Folder & Chat Discovery - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

User can view their Telegram folders and select which ones to track for export. Tool enumerates all chats within selected folders and persists the selection. New capabilities like exporting messages belong in later phases.

</domain>

<decisions>
## Implementation Decisions

### Chat enumeration
- Show minimal info per chat: name + ID only
- Type (DM/group/channel) and member count not needed in listing

### Config persistence
- JSON config file at `data/config.json`
- Structure: folder_id -> [chat_ids] mapping
- Store current state only (no history timestamps)

### Diff tracking
- On each run, compare current API chat list against stored config
- Log changes to console: "New chat: X" or "Removed chat: Y"
- Update config.json with new current state after detection
- No separate changelog file — changes logged to console and config stays current

### Claude's Discretion
- Folder display format (sorting, counts shown)
- Selection UX (how user picks folders)
- Exact JSON config structure details

</decisions>

<specifics>
## Specific Ideas

- Chat IDs per folder must be stored and persisted
- Diff between chat ID lists must be tracked and logged
- Console output for changes, config stores current state

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-folder-chat-discovery*
*Context gathered: 2026-02-03*
