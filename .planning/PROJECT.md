# Symbiotic Chats

## What This Is

A TypeScript CLI tool that exports Telegram chat history from selected folders to structured Markdown files. Built with mtcute library, it creates an incrementally-updated archive suitable for use as a Perplexity knowledge base.

## Core Value

Reliably export and incrementally sync Telegram chats to searchable Markdown without risking account bans or data loss.

## Requirements

### Validated

- [x] MVP export + incremental sync complete (single file per chat)
- [x] Frontmatter includes chat metadata, message_count, min_date, max_date
- [x] Rate limiting and FLOOD_WAIT handling
- [x] Recency exports (recent/historical) to combined archives
- [x] Contact import phone check CLI with CSV output
- [x] Export sync is a dedicated subcommand for per-chat archives

### Active

- [ ] Research best approach for the archive to be Perplexity-friendly + additional export formats
- [ ] Google Drive upload command + live-sync archive research
- [ ] Live mode with realtime updates, pre-loop chat selection
- [ ] Memory-only session option for live mode (no disk persistence)
- [ ] Cloud security research for safe deployment
- [ ] New chat filtering rules (participant allowlist, folder allowlist, title regex)

### Out of Scope

- Media/attachment download — text-only export
- Archive deletion — only additive updates
- Multiple account support — single account per run

## Context

**Purpose:** Create a knowledge base from Telegram conversations for Perplexity and other AI search tools, with Drive-backed sync for better perplexity indexing

**Library:** mtcute — modern TypeScript Telegram client library. Research needed on:
- Userbot best practices to avoid account bans
- DialogFilter API for folder management
- messages.getDialogs for fetching chats in folders
- Rate limiting and safety patterns

**Archive location:** `data/archive` under the current working directory (single file per chat, plus optional combined recency exports). Config stored in `data/config.json`.

## Constraints

- **Language**: TypeScript with modern best practices
- **Library**: mtcute (no alternatives)
- **Safety**: Read-only operations only, follow Telegram ToS, implement rate limiting
- **Auth**: Encrypted session storage (password-protected SQLite)
- **Storage**: Config in `data/config.json`, archive in filesystem. No external databases

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Encrypted session storage | Balance security (password protection) with session persistence | Done |
| Single file per archive | Simpler directory layout, easier AI indexing | Done |
| Sanitized filenames | Filesystem compatibility, original name preserved in frontmatter | Done |
| Additive-only updates | Prevent accidental data loss, archives are add-only | Done |
| Frontmatter message counts/dates | Faster indexing, better metadata for AI search | Done |
| Recency exports (combined) | Support temporal slices for AI search and triage | Done |

---
