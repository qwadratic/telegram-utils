# Roadmap: Symbiotic Chats

## Overview

This roadmap delivers a TypeScript CLI tool that exports Telegram chat history to Markdown, progressing from authenticated API access through folder discovery, core message export, and finally incremental sync capabilities. Each phase builds on the previous: authentication enables API calls, folder discovery populates the peer cache for safe message fetching, core export delivers the main value, and incremental sync makes the tool practical for ongoing use. The endgame is realtime sync of selected folders into a Drive-backed archive that stays Perplexity-friendly for broader knowledge base use.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Authentication** - Authenticated mtcute client with session persistence and flood wait handling
- [x] **Phase 2: Folder & Chat Discovery** - Enumerate folders, select for export, persist tracked folder/chat config
- [x] **Phase 3: Core Message Export** - Fetch messages, format to Markdown, write single chat files with rate limiting
- [x] **Phase 4: Incremental Sync** - Track sync state, fetch only new messages, detect new chats/folders
- [x] **Phase 4.1: Utility Exports & Diagnostics** - Recency exports, contact checks, config migration
- [ ] **Phase 5: Perplexity-Friendly Export** - Research output structure and add additional export formats
- [ ] **Phase 6: Google Drive Upload** - CLI upload command + research on live-sync archive structure
- [ ] **Phase 7: Live Mode** - Background realtime sync with in-memory session option
- [ ] **Phase 8: Cloud Security** - Research safe usage patterns for cloud deployments
- [ ] **Phase 9: New Chat Filtering** - Configurable rules for auto-adding chats

## Phase Details

### Phase 1: Foundation & Authentication
**Goal**: User can authenticate with Telegram and maintain a persistent session for subsequent runs
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, SAFE-01
**Success Criteria** (what must be TRUE):
  1. User can authenticate with phone number, SMS code, and optional 2FA password
  2. Session persists in encrypted SQLite file — subsequent runs skip auth if session valid
  3. FLOOD_WAIT errors are caught and respected — tool waits required duration before retry
  4. CLI entry point exists with Commander.js structure
**Plans**: 2 plans in 2 waves

Plans:
- [x] 01-01-PLAN.md — Project scaffolding, CLI structure, encrypted storage driver
- [x] 01-02-PLAN.md — Authentication flow with session persistence

### Phase 2: Folder & Chat Discovery
**Goal**: User can view their Telegram folders and select which ones to export
**Depends on**: Phase 1
**Requirements**: FOLD-01, FOLD-02, FOLD-03
**Success Criteria** (what must be TRUE):
  1. User can list all Telegram folders with their names and chat counts
  2. User can select folders to export — tool enumerates all chats within selected folders
  3. Selected folder IDs persist in config file between runs
**Plans**: 2 plans in 2 waves

Plans:
- [x] 02-01-PLAN.md — Folders module and config management (listFolders, loadConfig/saveConfig)
- [x] 02-02-PLAN.md — Folder selection UX, diff tracking, CLI setup command

### Phase 3: Core Message Export
**Goal**: User can export complete message history from tracked folders to structured Markdown files
**Depends on**: Phase 2
**Requirements**: MESG-01, MESG-02, MESG-03, MESG-04, MESG-05, MESG-06, OUTP-01, OUTP-02, OUTP-03, OUTP-04, SAFE-02
**Success Criteria** (what must be TRUE):
  1. Messages are written to a single file per chat at `data/archive/chat-name.md`
  2. Each file has YAML frontmatter with chat metadata (name, ID, message IDs, message_count, min_date, max_date, export timestamp)
  3. Messages include sender info, timestamps, reply references, and attachment markers
  4. Forwarded messages include forwarded-from context
  5. Text formatting (bold, italic, links, code) is preserved as Markdown
  6. Requests are rate-limited with 1.5s delays and jitter — no FLOOD_WAIT errors in normal operation
**Plans**: 3 plans in 3 waves

Plans:
- [x] 03-01-PLAN.md — Message fetching with rate limiting, filename sanitization
- [x] 03-02-PLAN.md — Message formatting and monthly file writer
- [x] 03-03-PLAN.md — Export orchestration and CLI command

### Phase 4: Incremental Sync
**Goal**: User can run the tool repeatedly to sync only new messages since last export
**Depends on**: Phase 3
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, FOLD-04
**Success Criteria** (what must be TRUE):
  1. Config tracks last exported message ID per chat
  2. Subsequent runs fetch only messages newer than last exported
  3. New messages are appended to their corresponding chat files (not duplicated)
  4. Export refreshes tracked chats from selected folders before syncing
  5. Sync state is persisted with change detection for new/removed chats
**Plans**: 4 plans in 3 waves

Plans:
- [x] 04-01-PLAN.md — Sync state module and incremental fetch (minId support)
- [x] 04-02-PLAN.md — File append logic and change detection with prompts
- [x] 04-03-PLAN.md — Sync orchestration and CLI integration
- [x] 04-04-PLAN.md — Gap closure: folder selection pre-selection fix

### Phase 4.1: Utility Exports & Diagnostics (INSERTED)
**Goal**: Provide auxiliary exports and diagnostics for power users
**Depends on**: Phase 4
**Requirements**: UTIL-01, UTIL-02, OUTP-05, SAFE-03
**Success Criteria** (what must be TRUE):
  1. CLI can export recent/historical messages across all chats by cutoff date
  2. CLI can check phone numbers via contacts import and output CSV
  3. Combined archive files can be written to `data/archive`
  4. RPC errors are logged via middleware for debugging

### Phase 5: Perplexity-Friendly Export
**Goal**: Archive outputs are optimized for AI-powered search and can be exported in multiple formats
**Depends on**: Phase 4
**Requirements**: PX-01, PX-02
**Success Criteria** (what must be TRUE):
  1. Research doc describes best structure for AI indexing (metadata, chunking, filenames)
  2. At least one additional export strategy is implemented
  3. CLI supports selecting export strategy instead of using subcommands

### Phase 6: Google Drive Upload
**Goal**: Users can upload archives to Google Drive and prep for live-sync workflows
**Depends on**: Phase 4
**Requirements**: DRIVE-01, DRIVE-02
**Success Criteria** (what must be TRUE):
  1. CLI command uploads archives to a Drive target folder
  2. Research doc covers live-sync-friendly archive structures and Drive behavior

### Phase 7: Live Mode
**Goal**: Run the client in background for realtime sync with safe session handling
**Depends on**: Phase 4
**Requirements**: LIVE-01, LIVE-02, LIVE-03
**Success Criteria** (what must be TRUE):
  1. Live mode runs with `disableUpdates: false` and an update handler loop
  2. User selects chats before starting live updates
  3. Optional memory-only session mode exists with no disk persistence on shutdown

### Phase 8: Cloud Security
**Goal**: Establish safe operating practices for cloud environments
**Depends on**: Phase 4
**Requirements**: SEC-01
**Success Criteria** (what must be TRUE):
  1. Research doc covers threat model, secret handling, and safe deployment patterns

### Phase 9: New Chat Filtering
**Goal**: Control which new chats are automatically added to sync
**Depends on**: Phase 4
**Requirements**: FILT-01, FILT-02, FILT-03
**Success Criteria** (what must be TRUE):
  1. Config supports participant allowlists, folder allowlists, and title regex rules
  2. Sync flow applies filters before adding newly discovered chats

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Authentication | 2/2 | Complete | 2026-02-03 |
| 2. Folder & Chat Discovery | 2/2 | Complete | 2026-02-03 |
| 3. Core Message Export | 3/3 | Complete | 2026-02-03 |
| 4. Incremental Sync | 4/4 | Complete | 2026-02-03 |
| 4.1 Utility Exports & Diagnostics | 0/0 | Complete | 2026-02-03 |
| 5. Perplexity-Friendly Export | 0/0 | Planned | — |
| 6. Google Drive Upload | 0/0 | Planned | — |
| 7. Live Mode | 0/0 | Planned | — |
| 8. Cloud Security | 0/0 | Planned | — |
| 9. New Chat Filtering | 0/0 | Planned | — |

---
*Roadmap created: 2026-02-03*
*Total requirements: 27 mapped across 9 phases*
