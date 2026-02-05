# Telegram Utils

TypeScript CLI tool that exports Telegram chats from selected folders into a searchable archive for AI-powered knowledge bases.

## Major Requirements (MVP)

- Authenticate with Telegram and persist encrypted session
- Discover folders, track chats, and refresh tracked chats before sync
- Export messages to a single file per chat with YAML frontmatter metadata
- Incrementally sync new messages with rate limiting and FLOOD_WAIT handling

## Roadmap Highlights

- Perplexity-friendly output research + additional export formats
- Google Drive upload command and live-sync archive research
- Live mode realtime sync with memory-only session option
- Cloud security research for safe deployment
- New chat filtering rules (participant allowlist, folder allowlist, title regex)

## Current State

- MVP complete: export + incremental sync working
- Archives stored at `data/archive` (single file per chat)
- Planning artifacts under `.planning/` reflect the expanded roadmap

## Commands (MVP)

- `symbiotic-chats export chats` - export chats into per-chat archives
- `symbiotic-chats export recent --cutoff YYYY-MM-DD` - combined recent export (cutoff required)
- `symbiotic-chats export historical [--cutoff YYYY-MM-DD]` - combined historical export (cutoff optional)

Notes:
- Recency exports are incremental and rely on `data/archive/sync-state.json` for per-chat watermarks.
- Cutoff dates must not move earlier than a previous run for the same mode.
