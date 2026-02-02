# Project Research Summary

**Project:** Telegram Chat Exporter (symbiotic-chats)
**Domain:** CLI tool for exporting Telegram chat history via MTProto API
**Researched:** 2026-02-03
**Confidence:** HIGH

## Executive Summary

This is a TypeScript CLI tool that exports Telegram chat histories to Markdown using the MTProto API via mtcute. Expert practice centers on three critical areas: conservative rate limiting to avoid account bans, proper session persistence to maintain authentication, and incremental sync patterns to handle large histories. The domain is well-documented with mtcute providing modern TypeScript-first APIs and Telegram's official documentation covering pagination and error handling patterns.

The recommended approach uses mtcute's Node.js client with SQLite session storage, Commander.js for CLI parsing, and simple JSON files for tracking incremental sync state. The architecture follows a streaming pattern — fetch messages in batches, write to monthly markdown files progressively, and persist sync markers frequently to enable resumption after interruption. This avoids memory issues with large histories and provides natural checkpoints.

The primary risk is account bans from aggressive API usage. Telegram actively monitors userbot behavior and can permanently ban accounts that ignore FLOOD_WAIT errors, make rapid requests on new sessions, or exhibit non-human patterns. Mitigation requires implementing flood wait handling from day one, adding human-like delays with jitter between requests, and designing conservative defaults (1-1.5s between batches). The research shows this is a solved problem with clear guidelines: respect FLOOD_WAIT responses, batch messages at 100 per request, and maintain session persistence.

## Key Findings

### Recommended Stack

The stack centers on mtcute's active TypeScript-first client library, avoiding older alternatives (gramjs, telegram-mtproto) that are either ports with poor type safety or abandoned. mtcute version 0.27.8 (January 2026) provides direct MTProto access with built-in SQLite session storage, eliminating re-authentication overhead that triggers Telegram's ban systems.

**Core technologies:**
- **@mtcute/node ^0.27.8**: MTProto client — active maintenance, native TypeScript, cleaner API than Telethon ports
- **SqliteStorage (built-in)**: Session persistence — prevents re-auth every run which triggers ban risk
- **commander ^14.0.3**: CLI framework — proven, stable, sufficient for 3-5 commands
- **TypeScript ^5.9.3**: Type safety — mtcute requires TS 5.0+, strict mode recommended
- **Node.js >=20.x**: Runtime — LTS version, stable ecosystem

**Supporting libraries:**
- **@clack/prompts ^1.0.0**: Interactive auth prompts (phone, 2FA)
- **JSON files**: Incremental sync state (chatId → lastMessageId mapping)
- **chalk, ora**: Terminal UI for progress indication

**Explicitly avoid:**
- Bot API libraries (telegraf, grammY) — can't access user folders or full history
- gramjs — Telethon port with bolted-on types, more complex
- MemoryStorage — requires re-auth every run, triggers ban systems
- External databases — overkill for personal CLI tool

### Expected Features

Research shows a clear division between table stakes (what all export tools provide) and differentiators (what makes tools valuable). The mtcute API directly supports all core features with clean TypeScript interfaces.

**Must have (table stakes):**
- Message retrieval with metadata (ID, date, text) — mtcute's `iterHistory()` with async iteration
- Sender info (name, username) — `Message.sender` returns User/Chat with display properties
- Reply references — `Message.replyToMessage` for thread context
- Chat listing — `iterDialogs()` for navigation
- Folder support — `getFolders()` and folder-filtered iteration (note: slow due to API limitation)

**Should have (competitive):**
- Incremental sync — use `minId` parameter to fetch only new messages, track per-chat
- Folder persistence — remember selected folders in config
- Structured Markdown — YAML frontmatter + body for human readability and parseability
- Formatted text preservation — `Message.entities` to Markdown bold/italic/links
- Service message handling — captures joins/leaves/pins via `Message.isService`

**Defer (v2+):**
- Media downloading — scope creep, storage issues, legal concerns (mark attachments only)
- Reactions/forwards — nice-to-have metadata
- Thread/topic support — forum-specific, smaller audience
- Real-time sync daemon — beyond export scope, use batch with incremental instead

### Architecture Approach

The architecture follows a modular pipeline: CLI parses commands, Auth Manager handles session persistence, Telegram Client wraps mtcute lifecycle, then specialized components (Folder Discovery, Message Fetcher, Entity Resolver) feed into Markdown Formatter and File Writer. Each component has clear responsibility boundaries and communicates through well-defined interfaces.

**Major components:**
1. **Auth Manager** — handles Telegram authentication, manages SQLite session persistence, validates existing sessions before prompting
2. **Config Manager** — persists all state (sync markers, user preferences, cached entities) to single JSON file, provides single source of truth
3. **Message Fetcher** — paginates through history using `iterHistory()`, implements flood wait handling, saves sync markers after each batch
4. **Markdown Formatter** — converts Message objects to markdown, handles entity-to-markdown conversion (bold, italic, links), resolves user IDs to display names
5. **File Writer** — organizes exports by month (folder/chat/YYYY-MM.md), writes progressively during fetch, handles file conflicts

**Key patterns:**
- **Progressive output** — write files as messages arrive, don't buffer entire history
- **Incremental state** — save sync markers after each batch, enables resume on interruption
- **Streaming architecture** — async iterators throughout, avoid loading large datasets into memory
- **Folder caching** — fetch all dialogs once, filter locally (API limitation: folder filtering is slow)

### Critical Pitfalls

Research identified four critical account ban risks and several moderate/minor technical issues. The critical pitfalls must be handled from day one — they can result in permanent phone number bans.

1. **Ignoring FLOOD_WAIT errors** — not respecting wait durations escalates to transport -429 errors and eventual USER_DEACTIVATED_BAN. Prevention: implement flood wait handling with mtcute's `floodWaitThreshold: 60` and retry logic. This is non-negotiable.

2. **Aggressive requests on new sessions** — new accounts/sessions are heavily scrutinized. Starting bulk operations immediately after login triggers automated bans. Prevention: design conservative defaults (1.5s delays with jitter), avoid VOIP numbers, implement gradual warmup patterns.

3. **Violating Telegram ToS** — even read-only tools must respect Terms of Service (no AI training, no hidden functionality, respect self-destructing messages). Prevention: transparent purpose, user consent, proper branding if distributed.

4. **Opening too many chats simultaneously** — using `openChat()` on many channels triggers transport errors. Prevention: for history export, don't use `openChat` at all (not needed for `getHistory`), only for real-time updates.

5. **PEER_ID_INVALID errors** — accessing chats without proper access hash. Prevention: iterate dialogs first to populate cache, use usernames when available, check `isPeerAvailable()` before access.

## Implications for Roadmap

Based on research, suggested phase structure follows dependency order: authentication and config are foundational, folder discovery and chat enumeration come next, core export logic with rate limiting is the main value, and incremental sync is an optimization for repeat usage.

### Phase 1: Foundation & Authentication
**Rationale:** Cannot do anything without authenticated client and config persistence. Auth is where critical ban risks begin, so conservative design from day one is essential. Session persistence via SQLite prevents repeated logins that trigger new-account scrutiny.

**Delivers:**
- Authenticated TelegramClient with SQLite session storage
- Config Manager for state persistence
- Interactive auth flow with phone/code/2FA prompts
- CLI entry point with Commander.js structure

**Addresses (from FEATURES.md):**
- Authentication requirements for MTProto access
- Session persistence to avoid re-auth penalties

**Avoids (from PITFALLS.md):**
- Pitfall #2: Aggressive requests on new sessions (conservative defaults from start)
- Pitfall #7: Not persisting sessions (SQLite storage prevents this)
- Flood wait handling infrastructure (needed for all subsequent phases)

**Research needs:** Standard patterns, skip `/gsd:research-phase`

### Phase 2: Folder & Chat Discovery
**Rationale:** Must enumerate available folders and chats before knowing what to export. mtcute's folder API has performance limitations (client-side filtering) that need architectural consideration. Implements PEER_ID_INVALID prevention through proper dialog iteration.

**Delivers:**
- Folder enumeration via `getFolders()`
- Dialog iteration and local filtering (avoiding slow API-based folder filtering)
- Chat metadata resolution
- Folder-to-chat mapping cache in config

**Addresses (from FEATURES.md):**
- Folder support (table stakes)
- Chat listing (table stakes)
- Folder persistence (differentiator, cache in config)

**Implements (from ARCHITECTURE.md):**
- Folder Discovery component
- Entity Resolver with caching

**Avoids (from PITFALLS.md):**
- Pitfall #5: PEER_ID_INVALID errors (iterate dialogs first, populate cache)
- Pitfall #1: Folder iteration done conservatively with delays

**Research needs:** Standard patterns, skip `/gsd:research-phase`

### Phase 3: Core Message Export
**Rationale:** This is the main value delivery. Requires implementing pagination correctly (100 msg batches), flood wait handling, entity-to-markdown conversion, and progressive file writing. This phase has the most complexity and the highest ban risk if done incorrectly.

**Delivers:**
- Message fetching with `iterHistory()` pagination
- Flood wait handling and rate limiting (1.5s delays with jitter)
- Markdown formatting with entity conversion
- Monthly file organization (folder/chat/YYYY-MM.md)
- Progressive writing (stream to disk, not memory buffering)

**Addresses (from FEATURES.md):**
- Message retrieval with metadata (table stakes)
- Sender info, reply references (table stakes)
- Structured Markdown output (differentiator)
- Formatted text preservation (differentiator)
- Service message handling (differentiator)

**Uses (from STACK.md):**
- mtcute `iterHistory()` with pagination
- Entity conversion for Markdown
- File system operations for monthly splits

**Implements (from ARCHITECTURE.md):**
- Message Fetcher with pagination and rate limits
- Markdown Formatter with entity handling
- File Writer with monthly organization

**Avoids (from PITFALLS.md):**
- Pitfall #1: FLOOD_WAIT handling (critical, implement from start)
- Pitfall #6: Pagination limits (100 msg batches, proper offsetId)
- Pitfall #9: Album grouping (handle groupedId)

**Research needs:** Likely needs `/gsd:research-phase` for markdown entity conversion specifics (UTF-16 offset handling)

### Phase 4: Incremental Sync
**Rationale:** Optimization for repeat usage. Once core export works, incremental sync makes the tool practical for ongoing use. Requires sync state tracking and merge logic for existing files.

**Delivers:**
- Per-chat sync state tracking (lastMessageId)
- `minId` parameter usage in `iterHistory()`
- Append/merge logic for existing monthly files
- Progress reporting showing new vs existing messages

**Addresses (from FEATURES.md):**
- Incremental sync (key differentiator)
- Progress indication during long operations

**Implements (from ARCHITECTURE.md):**
- Config Manager sync state persistence
- Incremental sync flow patterns

**Avoids (from PITFALLS.md):**
- Unnecessary full re-exports (reduces rate limit exposure)

**Research needs:** Standard patterns, skip `/gsd:research-phase`

### Phase Ordering Rationale

- **Phase 1 before all others:** Authentication is prerequisite. Session persistence and flood wait infrastructure must exist before any API calls.
- **Phase 2 before 3:** Cannot export messages without knowing which chats to export. Folder discovery populates peer cache, preventing PEER_ID_INVALID errors in Phase 3.
- **Phase 3 delivers core value:** This is the main export functionality. Should be tested thoroughly before adding optimizations.
- **Phase 4 as optimization:** Incremental sync improves UX for repeat usage but isn't needed for initial export. Defer until core is solid.

**Dependency chain:**
```
Auth + Config (Phase 1)
    ↓
Folder Discovery (Phase 2)
    ↓
Message Export (Phase 3)
    ↓
Incremental Sync (Phase 4)
```

**Ban risk mitigation:**
- Flood wait handling in Phase 1 (before first API call)
- Conservative delays in Phase 3 (1.5s between batches)
- Session persistence in Phase 1 (avoid new-session scrutiny)

### Research Flags

**Needs deeper research during planning:**
- **Phase 3:** Markdown entity conversion — UTF-16 offset handling is subtle, needs careful implementation research
- **Phase 3:** Rate limiting tuning — may need community testing to find safe delay values
- **Phase 4:** File merge logic — appending to existing monthly files has edge cases

**Standard patterns (skip research):**
- **Phase 1:** Authentication flow — mtcute docs cover this thoroughly
- **Phase 2:** Dialog iteration — straightforward API usage
- **Phase 4:** Sync state tracking — simple JSON persistence

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | mtcute version verified via npm registry (Jan 2026), official docs comprehensive |
| Features | HIGH | mtcute API reference documents all properties, Telegram export schema official |
| Architecture | HIGH | Patterns validated across multiple export tools, mtcute docs cover lifecycle |
| Pitfalls | HIGH | Flood wait and ban risks verified via official Telegram error docs, multiple sources confirm patterns |

**Overall confidence:** HIGH

### Gaps to Address

Research identified a few areas needing validation during implementation:

- **Rate limit sweet spot:** Sources suggest 1-1.5s delays, but exact safe values vary by account age and history. Plan for tuning during Phase 3 testing with conservative starting point (1.5s).

- **UTF-16 offset handling:** Message entities use UTF-16 code units for offset/length. TypeScript strings are UTF-16, but emoji and special characters need careful handling. Validate during Phase 3 with test messages containing emoji.

- **Folder API performance:** mtcute docs warn folder iteration is "orders of magnitude slower" due to API limitations. Architecture accounts for this (fetch all dialogs, filter locally), but actual performance needs measurement in Phase 2.

- **Media attachment markers:** Research focused on text export. If attachment metadata is added later, verify which `MessageMedia` properties are safe to access without downloading.

## Sources

### Primary (HIGH confidence)
- [mtcute Official Documentation](https://mtcute.dev/) — client initialization, auth flow, storage patterns
- [mtcute API Reference](https://ref.mtcute.dev/) — TelegramClient methods, Message properties, pagination
- [npm @mtcute/node](https://www.npmjs.com/package/@mtcute/node) — version 0.27.8 (Jan 2026)
- [Telegram API Terms of Service](https://core.telegram.org/api/terms) — ToS compliance requirements
- [Telegram Error Handling](https://core.telegram.org/api/errors) — FLOOD_WAIT, rate limits, error codes
- [Telegram Pagination](https://core.telegram.org/api/offsets) — min_id, max_id, offsetId parameters
- [Telegram Export Schema](https://core.telegram.org/import-export) — official export format reference
- [Telegram Message Entities](https://core.telegram.org/api/entities) — entity types, offset handling

### Secondary (MEDIUM confidence)
- [grammY Flood Limits Guide](https://grammy.dev/advanced/flood) — community-verified rate limit patterns
- [tg-archive](https://github.com/knadh/tg-archive) — incremental sync implementation reference
- [telegram-download-chat](https://github.com/popstas/telegram-download-chat) — JSON export with resume capability
- [Commander.js Guide](https://generalistprogrammer.com/tutorials/commander-npm-package-guide) — CLI patterns

### Tertiary (LOW confidence)
- Various blog posts on Telegram bans — patterns consistent across sources, specific numbers may vary
- Community discussions on safe delay values — converge on 1-1.5s for userbot export operations

---
*Research completed: 2026-02-03*
*Ready for roadmap: yes*
