# Roadmap: Symbiotic Chats

## Overview

This roadmap delivers a TypeScript CLI tool that exports Telegram chat history to Markdown, progressing from authenticated API access through folder discovery, core message export, and finally incremental sync capabilities. Each phase builds on the previous: authentication enables API calls, folder discovery populates the peer cache for safe message fetching, core export delivers the main value, and incremental sync makes the tool practical for ongoing use.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Authentication** - Authenticated mtcute client with session persistence and flood wait handling
- [x] **Phase 2: Folder & Chat Discovery** - Enumerate folders, list chats, select and persist tracking config
- [x] **Phase 3: Core Message Export** - Fetch messages, format to Markdown, write monthly files with rate limiting
- [ ] **Phase 4: Incremental Sync** - Track sync state, fetch only new messages, detect new chats/folders

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
**Goal**: User can view their Telegram folders and select which ones to track for export
**Depends on**: Phase 1
**Requirements**: FOLD-01, FOLD-02, FOLD-03
**Success Criteria** (what must be TRUE):
  1. User can list all Telegram folders with their names and chat counts
  2. User can select folders to track — tool enumerates all chats within selected folders
  3. Selected folder IDs persist in config file between runs
**Plans**: 2 plans in 2 waves

Plans:
- [x] 02-01-PLAN.md — Folders module and config management (listFolders, loadConfig/saveConfig)
- [x] 02-02-PLAN.md — Folder selection UX, diff tracking, CLI folders command

### Phase 3: Core Message Export
**Goal**: User can export complete message history from tracked folders to structured Markdown files
**Depends on**: Phase 2
**Requirements**: MESG-01, MESG-02, MESG-03, MESG-04, MESG-05, OUTP-01, OUTP-02, OUTP-03, SAFE-02
**Success Criteria** (what must be TRUE):
  1. Messages are written to monthly files at `archive/YYYY-MM/chat-name.md`
  2. Each file has YAML frontmatter with chat metadata (name, ID, message IDs, export timestamp)
  3. Messages include sender info, timestamps, reply references, and attachment markers
  4. Text formatting (bold, italic, links, code) is preserved as Markdown
  5. Requests are rate-limited with 1.5s delays and jitter — no FLOOD_WAIT errors in normal operation
**Plans**: 3 plans in 3 waves

Plans:
- [x] 03-01-PLAN.md — Message fetching with rate limiting, filename sanitization
- [x] 03-02-PLAN.md — Message formatting and monthly file writer
- [x] 03-03-PLAN.md — Export orchestration and CLI command

### Phase 4: Incremental Sync
**Goal**: User can run the tool repeatedly to sync only new messages since last export
**Depends on**: Phase 3
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, FOLD-04
**Success Criteria** (what must be TRUE):
  1. Config tracks last exported message ID per chat
  2. Subsequent runs fetch only messages newer than last exported
  3. New messages are appended to existing monthly files (not duplicated)
  4. Startup logs any new chats or folders detected in tracked folders
**Plans**: TBD

Plans:
- [ ] 04-01: Sync state tracking and incremental fetch
- [ ] 04-02: Change detection and logging

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Authentication | 2/2 | Complete | 2026-02-03 |
| 2. Folder & Chat Discovery | 2/2 | Complete | 2026-02-03 |
| 3. Core Message Export | 3/3 | Complete | 2026-02-03 |
| 4. Incremental Sync | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-03*
*Total requirements: 20 mapped across 4 phases*
