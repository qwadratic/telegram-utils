# Requirements: Symbiotic Chats

**Defined:** 2026-02-03
**Core Value:** Reliably export and incrementally sync Telegram chats to searchable Markdown without risking account bans or data loss.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can authenticate with phone number, SMS/call code, and optional 2FA password
- [x] **AUTH-02**: Session is stored in password-encrypted SQLite file, decrypted at runtime

### Folder Management

- [ ] **FOLD-01**: User can list all Telegram folders (DialogFilters) with names and IDs
- [ ] **FOLD-02**: User can select folders to track, tool enumerates all chats within selected folders
- [ ] **FOLD-03**: Selected folder IDs persist in config file between runs
- [ ] **FOLD-04**: On startup, tool detects and logs new folders or new chats in tracked folders

### Message Export

- [ ] **MESG-01**: Tool fetches message history with ID, timestamp, and text content
- [ ] **MESG-02**: Each message includes sender's first name, last name, and @username if available
- [ ] **MESG-03**: Messages include reply_to message ID when replying to another message
- [ ] **MESG-04**: Messages with attachments are marked with attachment type (no media download)
- [ ] **MESG-05**: Text formatting (bold, italic, links, code) is preserved as Markdown

### Output Format

- [ ] **OUTP-01**: Messages are written to monthly files: `archive/YYYY-MM/chat-name.md`
- [ ] **OUTP-02**: Each file has YAML frontmatter with chat_name, chat_id, first_message_id, last_message_id, exported_at
- [ ] **OUTP-03**: Filenames are sanitized; original chat name preserved in frontmatter; fallback to chat ID if all special chars

### Incremental Sync

- [ ] **SYNC-01**: Config tracks last exported message ID per chat
- [ ] **SYNC-02**: Subsequent runs fetch only messages newer than last exported (using minId)
- [ ] **SYNC-03**: New messages are appended to existing monthly files
- [ ] **SYNC-04**: Startup logs any new chats or folders detected in tracked folders

### Safety

- [x] **SAFE-01**: Tool respects FLOOD_WAIT errors, waiting the required duration before retrying
- [ ] **SAFE-02**: Requests are rate-limited with 1.5s delays and random jitter between batches

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

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Media downloading | Scope creep, storage costs, legal concerns — text-only for v1 |
| Real-time sync daemon | Beyond export scope, batch with incremental is sufficient |
| Bot API integration | Can't access user folders or full history |
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
| FOLD-01 | Phase 2 | Pending |
| FOLD-02 | Phase 2 | Pending |
| FOLD-03 | Phase 2 | Pending |
| FOLD-04 | Phase 4 | Pending |
| MESG-01 | Phase 3 | Pending |
| MESG-02 | Phase 3 | Pending |
| MESG-03 | Phase 3 | Pending |
| MESG-04 | Phase 3 | Pending |
| MESG-05 | Phase 3 | Pending |
| OUTP-01 | Phase 3 | Pending |
| OUTP-02 | Phase 3 | Pending |
| OUTP-03 | Phase 3 | Pending |
| SYNC-01 | Phase 4 | Pending |
| SYNC-02 | Phase 4 | Pending |
| SYNC-03 | Phase 4 | Pending |
| SYNC-04 | Phase 4 | Pending |
| SAFE-01 | Phase 1 | Complete |
| SAFE-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 after initial definition*
