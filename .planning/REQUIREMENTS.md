# Requirements: Telegram Utils

**Defined:** 2026-02-03
**Core Value:** Reliably export and incrementally sync Telegram chats to searchable Markdown without risking account bans or data loss.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can authenticate with phone number, SMS/call code, and optional 2FA password
- [x] **AUTH-02**: Session is stored in password-encrypted SQLite file, decrypted at runtime

### Folder Management

- [x] **FOLD-01**: User can list all Telegram folders (DialogFilters) with names and IDs
- [x] **FOLD-02**: User can select folders to track, tool enumerates all chats within selected folders
- [x] **FOLD-03**: Selected folder IDs persist in config file between runs
- [x] **FOLD-04**: On startup, tool refreshes tracked chats from selected folders and updates config when changed

### Message Export

- [x] **MESG-01**: Tool fetches message history with ID, timestamp, and text content
- [x] **MESG-02**: Each message includes sender's first name, last name, and @username if available
- [x] **MESG-03**: Messages include reply_to message ID when replying to another message
- [x] **MESG-04**: Messages with attachments are marked with attachment type (no media download)
- [x] **MESG-05**: Text formatting (bold, italic, links, code) is preserved as Markdown
- [x] **MESG-06**: Forwarded messages include forwarded-from context

### Output Format

- [x] **OUTP-01**: Messages are written to a single file per chat: `data/archive/chat-name.md`
- [x] **OUTP-02**: Each file has YAML frontmatter with chat_name, chat_id, first_message_id, last_message_id, message_count, min_date, max_date, exported_at
- [x] **OUTP-03**: Filenames are sanitized; original chat name preserved in frontmatter; fallback to chat ID if all special chars
- [x] **OUTP-04**: Empty chats create a file with null IDs and a "No messages." body
- [x] **OUTP-05**: Combined archive files can be written to `data/archive` (used by recency exports)

### Incremental Sync

- [x] **SYNC-01**: Config tracks last exported message ID per chat
- [x] **SYNC-02**: Subsequent runs fetch only messages newer than last exported (using minId)
- [x] **SYNC-03**: New messages are appended to existing chat files
- [x] **SYNC-04**: Export refreshes tracked chats from selected folders before syncing
- [x] **SYNC-05**: Sync state is persisted with change detection for new/removed chats

### Safety

- [x] **SAFE-01**: Tool respects FLOOD_WAIT errors, waiting the required duration before retrying
- [x] **SAFE-02**: Requests are rate-limited with 1.5s delays and random jitter between batches
- [x] **SAFE-03**: RPC errors are logged via client middleware for debugging

### Utility Commands

- [x] **UTIL-01**: CLI can check phone numbers via contacts import and log CSV
- [x] **UTIL-02**: CLI can export recent/historical messages across all chats by cutoff date

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Export

- **EXPV2-01**: Export service messages (user joined, left, pinned message)
- **EXPV2-02**: Export reactions and forwards metadata
- **EXPV2-03**: Support forum topics/threads

### Media

- **MEDV2-01**: Optional media download with size limits
- **MEDV2-02**: Media stored in parallel folder structure

### Advanced Auth

- **AUTV2-01**: Session string export/import for password manager storage
- **AUTV2-02**: Multiple account support

### Perplexity-Friendly Export

- **PX-01**: Research output structure for AI-powered search indexing
- **PX-02**: Support additional export formats alongside Markdown

### Google Drive Upload

- **DRIVE-01**: Provide CLI command to upload archives to Google Drive
- **DRIVE-02**: Research live-sync friendly archive structure for Drive

### Live Mode

- **LIVE-01**: Background sync mode with `disableUpdates: false`
- **LIVE-02**: Select chats before starting the update handler loop
- **LIVE-03**: Option to keep session in memory only, no disk persistence

### Security (Cloud)

- **SEC-01**: Research safe usage patterns for running in cloud environments

### New Chat Filtering

- **FILT-01**: Allowlist by participant usernames
- **FILT-02**: Allowlist by folder IDs
- **FILT-03**: Include/exclude by chat title regex

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Media downloading | Scope creep, storage costs, legal concerns — text-only for v1 |
| Real-time sync daemon | Superseded by live mode roadmap item |
| Bot API integration | Can't access full history |
| GUI/web interface | CLI tool, keep it simple |
| Database storage | Overkill for personal tool, JSON config + Markdown files sufficient |
| Archive deletion | Safety — only additive updates, never remove data |
| Multi-account | Single account per run, keep auth simple |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| FOLD-01 | Phase 2 | Complete |
| FOLD-02 | Phase 2 | Complete |
| FOLD-03 | Phase 2 | Complete |
| FOLD-04 | Phase 4 | Complete |
| MESG-01 | Phase 3 | Complete |
| MESG-02 | Phase 3 | Complete |
| MESG-03 | Phase 3 | Complete |
| MESG-04 | Phase 3 | Complete |
| MESG-05 | Phase 3 | Complete |
| MESG-06 | Phase 3 | Complete |
| OUTP-01 | Phase 3 | Complete |
| OUTP-02 | Phase 3 | Complete |
| OUTP-03 | Phase 3 | Complete |
| OUTP-04 | Phase 3 | Complete |
| OUTP-05 | Phase 4.1 | Complete |
| SYNC-01 | Phase 4 | Complete |
| SYNC-02 | Phase 4 | Complete |
| SYNC-03 | Phase 4 | Complete |
| SYNC-04 | Phase 4 | Complete |
| SYNC-05 | Phase 4 | Complete |
| SAFE-01 | Phase 1 | Complete |
| SAFE-02 | Phase 3 | Complete |
| SAFE-03 | Phase 1 | Complete |
| UTIL-01 | Phase 4.1 | Complete |
| UTIL-02 | Phase 4.1 | Complete |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-04 after single-file archive update and roadmap expansion*
