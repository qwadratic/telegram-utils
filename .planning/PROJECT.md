# Symbiotic Chats

## What This Is

A TypeScript CLI tool that exports Telegram chat history from selected folders to structured Markdown files. Built with mtcute library, it creates an incrementally-updated archive suitable for use as a Perplexity knowledge base.

## Core Value

Reliably export and incrementally sync Telegram chats to searchable Markdown without risking account bans or data loss.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Telegram authentication with code + password
- [ ] Encrypted session storage (password-protected SQLite)
- [ ] List user's Telegram folders (DialogFilters)
- [ ] Folder selection persists; store folder IDs and tracked chat IDs in config
- [ ] Export all chats from tracked folders
- [ ] Output structure: `data/archive/YYYY-MM/sanitized-chat-name.md`
- [ ] Frontmatter with chat_name, chat_id, first/last message IDs, exported_at
- [ ] Messages in chronological order (oldest to newest)
- [ ] Message format: `[timestamp] [id:X] [reply:Y] [attachment:type] **Name (@username)**: text`
- [ ] Track last exported message ID per chat in sync state
- [ ] Incremental sync: only fetch messages newer than last exported
- [ ] Default start date 2025-01-01 if no existing archive
- [ ] Refresh tracked chats from selected folders before export
- [ ] Keep archives for removed chats/folders (never delete)
- [ ] Sanitize chat names for filenames (fallback to chat ID if all special chars)
- [ ] Preserve original chat name in frontmatter even if filename differs
- [ ] Handle private chats: display name + user ID
- [ ] Handle chat renames: keep old filename, update frontmatter
- [ ] Mark messages with attachments (no media download)
- [ ] Include reply_to message IDs for reference

### Out of Scope

- Media/attachment download — text-only export
- Archive deletion — only additive updates
- Real-time sync/daemon mode — manual CLI runs only
- Multiple account support — single account per run

## Context

**Purpose:** Create a knowledge base from Telegram conversations for use in Perplexity. The structured Markdown format with frontmatter enables easy indexing and search.

**Library:** mtcute — modern TypeScript Telegram client library. Research needed on:
- Userbot best practices to avoid account bans
- DialogFilter API for folder management
- messages.getDialogs for fetching chats in folders
- Rate limiting and safety patterns

**Archive location:** `data/archive` under the current working directory. Config stored in `data/config.json`.

## Constraints

- **Language**: TypeScript with modern best practices
- **Library**: mtcute (no alternatives)
- **Safety**: Read-only operations only, follow Telegram ToS, implement rate limiting
- **Auth**: Encrypted session storage (password-protected SQLite)
- **Storage**: Config in `data/config.json`, no external databases

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Encrypted session storage | Balance security (password protection) with ban prevention (session persistence) | — Pending |
| Monthly file splits | Manageable file sizes, natural organization for knowledge base | — Pending |
| Sanitized filenames | Filesystem compatibility, original name preserved in frontmatter | — Pending |
| Additive-only updates | Prevent accidental data loss, archives are append-only | — Pending |

---
*Last updated: 2026-02-03 after folder refresh on export update*
