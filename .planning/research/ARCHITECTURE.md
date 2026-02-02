# Architecture Patterns

**Domain:** Telegram Chat Export CLI Tool (TypeScript/mtcute)
**Researched:** 2026-02-03
**Confidence:** HIGH (mtcute docs verified, patterns validated across multiple export tools)

## Recommended Architecture

```
                          +-----------------+
                          |   CLI Entry     |
                          |  (Commander.js) |
                          +--------+--------+
                                   |
                    +--------------+--------------+
                    |                             |
           +--------v--------+          +---------v--------+
           |   Auth Manager  |          |  Config Manager  |
           | (session/creds) |          |  (state/prefs)   |
           +--------+--------+          +---------+--------+
                    |                             |
                    +-------------+---------------+
                                  |
                          +-------v-------+
                          | Telegram      |
                          | Client        |
                          | (mtcute)      |
                          +-------+-------+
                                  |
              +-------------------+-------------------+
              |                   |                   |
     +--------v--------+ +-------v-------+ +---------v--------+
     | Folder/Chat     | | Message       | | Entity           |
     | Discovery       | | Fetcher       | | Resolver         |
     +--------+--------+ +-------+-------+ +---------+--------+
              |                   |                   |
              +-------------------+-------------------+
                                  |
                          +-------v-------+
                          | Markdown      |
                          | Formatter     |
                          +-------+-------+
                                  |
                          +-------v-------+
                          | File Writer   |
                          | (monthly)     |
                          +---------------+
```

## Component Boundaries

| Component | Responsibility | Inputs | Outputs | Communicates With |
|-----------|---------------|--------|---------|-------------------|
| **CLI Entry** | Parse commands, coordinate flow, handle user prompts | argv, stdin | User feedback, exit codes | Auth Manager, Config Manager, all downstream |
| **Auth Manager** | Handle Telegram auth, manage session persistence | Credentials, session file | Authenticated client | Telegram Client, Config Manager |
| **Config Manager** | Persist app state, track sync progress, user preferences | Config file path | State objects, last sync markers | All components |
| **Telegram Client** | Wrap mtcute, manage connection lifecycle | Auth session | API methods | Folder Discovery, Message Fetcher, Entity Resolver |
| **Folder Discovery** | List folders, enumerate chats per folder | Folder filter config | Chat list with metadata | Telegram Client |
| **Message Fetcher** | Paginate through history, handle rate limits | Chat ID, offset marker | Message batches | Telegram Client, Config Manager |
| **Entity Resolver** | Resolve user IDs to names, cache lookups | User/chat IDs | Display names | Telegram Client |
| **Markdown Formatter** | Convert messages to markdown, handle entities | Message objects | Markdown strings | Entity Resolver |
| **File Writer** | Organize by month, write files, handle conflicts | Markdown content, dates | Files on disk | Config Manager |

## Data Flow

### Initialization Flow

```
1. CLI parses arguments
2. Config Manager loads state (or creates default)
3. Auth Manager checks for existing session
   - If session exists: validate, connect
   - If no session: prompt for phone, code, 2FA
4. Telegram Client connects, returns user info
5. Ready for commands
```

### Export Flow

```
1. User selects folder(s) to export
2. Folder Discovery fetches folder list via getFolders()
3. For selected folder(s):
   a. iterDialogs(folder) returns chats
   b. For each chat:
      i.   Config Manager checks last exported message ID
      ii.  Message Fetcher iterates history from offset
      iii. Entity Resolver caches user lookups
      iv.  Markdown Formatter converts each message
      v.   File Writer appends to appropriate monthly file
      vi.  Config Manager updates sync marker
```

### Incremental Sync Flow

```
1. Config Manager provides last_message_id per chat
2. Message Fetcher uses min_id parameter
3. Only new messages fetched
4. Existing files appended (or merged if mid-month)
5. New sync marker saved
```

## mtcute Client Lifecycle

### Initialization Pattern

```typescript
import { TelegramClient } from '@mtcute/node'
import { SqliteStorage } from '@mtcute/node'

const client = new TelegramClient({
  apiId: config.apiId,
  apiHash: config.apiHash,
  storage: new SqliteStorage('session.db')  // Persists auth
})

// Auth flow (handles existing session automatically)
const self = await client.start({
  phone: () => promptPhone(),
  code: () => promptCode(),
  password: () => promptPassword()  // 2FA if enabled
})
```

**Key insight:** mtcute's `start()` method is idempotent. If session exists and is valid, it returns immediately. If expired or missing, it triggers auth flow.

### Connection Management

```typescript
// mtcute manages connection internally
// No explicit connect/disconnect needed for short-lived CLI

// For long-running operations, client stays connected
// Close explicitly when done:
await client.close()
```

### Session Storage Options

| Storage | Use Case | Persistence |
|---------|----------|-------------|
| `SqliteStorage` | Default for Node.js/Bun | File-based, survives restarts |
| `MemoryStorage` | Testing only | Lost on exit |
| Session string | Deployment/migration | Portable ~400 char string |

**Recommendation:** Use SqliteStorage for CLI tool. Store in `~/.config/symbiotic-chats/session.db` or project-local `.session/` directory.

## Key Architectural Decisions

### 1. Folder-Based Fetching Strategy

mtcute docs warn: "fetching dialogs in a folder is orders of magnitudes slower than normal because of Telegram API limitations - we have to fetch all dialogs and filter manually."

**Recommended approach:**
1. Fetch all dialogs once: `iterDialogs()` (fast)
2. Fetch folder definitions: `getFolders()`
3. Filter locally using folder membership data
4. Cache folder-to-chat mappings in config

### 2. Message Pagination Strategy

Use offset-based pagination with `min_id` for incremental sync:

```typescript
// Full export
for await (const msg of client.iterHistory(chatId)) {
  // Process message
}

// Incremental (only new messages)
for await (const msg of client.iterHistory(chatId, {
  minId: lastExportedMessageId
})) {
  // Process new messages only
}
```

**Critical:** Always store the highest message ID after each sync batch, not just at completion. Enables resume on interruption.

### 3. Rate Limit Handling

Telegram enforces undisclosed rate limits. FloodWaitError requires waiting.

**Pattern:**
```typescript
async function withFloodWait<T>(fn: () => Promise<T>): Promise<T> {
  while (true) {
    try {
      return await fn()
    } catch (e) {
      if (e instanceof FloodWaitError) {
        console.log(`Rate limited, waiting ${e.seconds}s`)
        await sleep(e.seconds * 1000)
        continue
      }
      throw e
    }
  }
}
```

**Best practice:** Do NOT pre-throttle. Make requests as fast as possible, respect FloodWaitError when it occurs. Pre-throttling is "useless and harmful" per Telegram docs.

### 4. Entity Resolution Caching

Messages contain user IDs, not names. Resolution requires API calls.

**Strategy:**
1. Maintain in-memory cache during export
2. Persist cache in config for subsequent runs
3. Batch resolve unknown IDs when possible
4. Gracefully handle unresolvable (deleted users): `[Unknown User 12345]`

### 5. Markdown Entity Conversion

Telegram messages have `entities` array with offset/length pairs in UTF-16 code units.

**Conversion approach:**
```typescript
interface MessageEntity {
  type: 'bold' | 'italic' | 'code' | 'pre' | 'link' | 'mention' | ...
  offset: number  // UTF-16 code units
  length: number  // UTF-16 code units
  url?: string    // For links
}

// Convert UTF-16 offsets to JS string indices
// Apply entities in reverse order (highest offset first) to preserve positions
```

### 6. File Organization

**Monthly splits recommended:**
```
output/
  folder-name/
    chat-name/
      2025-01.md
      2025-02.md
      ...
```

**File format:**
```markdown
# Chat Name

## 2025-01-15

### 14:32 - Username
Message content here with **formatting** preserved.

### 14:35 - Other User
Reply content.

---

## 2025-01-16
...
```

## Patterns to Follow

### Pattern 1: Config as Single Source of Truth

All state in one config object, persisted to disk.

```typescript
interface Config {
  // Auth
  apiId: number
  apiHash: string
  sessionPath: string

  // User preferences
  outputDir: string
  selectedFolders: string[]

  // Sync state (per chat)
  syncState: Record<string, {
    lastMessageId: number
    lastSyncAt: string
    totalMessages: number
  }>

  // Caches
  userCache: Record<number, string>  // userId -> displayName
  folderCache: Record<number, string[]>  // folderId -> chatIds
}
```

### Pattern 2: Progressive Output

Write files as messages are fetched, not after complete download.

```typescript
// BAD: Load everything into memory
const messages = await fetchAllMessages(chatId)
writeFile(messages)

// GOOD: Stream to disk
const writer = createMonthlyWriter(chatId)
for await (const msg of client.iterHistory(chatId)) {
  await writer.append(formatMessage(msg))
  config.updateSyncMarker(chatId, msg.id)
}
await writer.finalize()
```

### Pattern 3: Graceful Interruption

Handle Ctrl+C gracefully, preserving progress.

```typescript
let interrupted = false
process.on('SIGINT', () => {
  interrupted = true
  console.log('\nInterrupted, saving progress...')
})

for await (const msg of client.iterHistory(chatId)) {
  if (interrupted) break
  // Process message
}

await config.save()  // Always save on exit
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Eager Loading

**What:** Fetching all dialogs/messages before processing
**Why bad:** Memory explosion for large histories (100k+ messages common)
**Instead:** Use async iterators, process and write incrementally

### Anti-Pattern 2: Implicit State

**What:** Tracking sync progress in memory only
**Why bad:** Lost on crash, requires re-export
**Instead:** Persist sync markers after each batch

### Anti-Pattern 3: Sequential Folder Processing Without User Feedback

**What:** Processing folders silently in sequence
**Why bad:** User doesn't know progress, can't estimate time
**Instead:** Show progress per folder, per chat, estimated remaining

### Anti-Pattern 4: Hardcoded Paths

**What:** Using fixed paths like `./output/`
**Why bad:** Inflexible, conflicts between projects
**Instead:** Configurable output dir, sensible defaults with XDG compliance

### Anti-Pattern 5: Blocking Auth Prompts

**What:** Synchronous prompts that block event loop
**Why bad:** Timeouts, poor UX, can't cancel
**Instead:** Use async prompts (inquirer), show timeout countdown for code entry

## Build Order (Phase Dependencies)

Based on component dependencies, recommended build order:

```
Phase 1: Foundation
├── Config Manager (needed by everything)
├── CLI Entry (basic structure)
└── Auth Manager + Telegram Client wrapper

Phase 2: Discovery
├── Folder Discovery
└── Chat enumeration

Phase 3: Export Core
├── Message Fetcher (pagination, rate limits)
├── Entity Resolver
└── Markdown Formatter

Phase 4: Output
├── File Writer (monthly organization)
└── Progress reporting

Phase 5: Incremental
├── Sync state tracking
├── Resume capability
└── Merge logic for existing files
```

**Why this order:**
1. Can't do anything without auth and config
2. Discovery needed before knowing what to export
3. Core export logic is the main value
4. Output organization can evolve
5. Incremental sync is optimization, not MVP

## Error Handling Patterns

### Recoverable Errors

| Error | Handling |
|-------|----------|
| FloodWaitError | Wait specified seconds, retry |
| NetworkError | Exponential backoff, max 3 retries |
| AuthKeyError | Clear session, re-auth |
| ChatNotFoundError | Log warning, skip chat, continue |

### Fatal Errors

| Error | Handling |
|-------|----------|
| InvalidApiCredentials | Exit with clear message, link to my.telegram.org |
| SessionRevoked | Clear session, prompt for re-auth |
| AccountBanned | Exit with explanation |

### Error Recovery Pattern

```typescript
async function exportChat(chatId: string): Promise<ExportResult> {
  const startMarker = config.getSyncMarker(chatId)

  try {
    for await (const msg of fetchMessages(chatId, startMarker)) {
      await processMessage(msg)
      config.updateSyncMarker(chatId, msg.id)
    }
    return { success: true }
  } catch (e) {
    // Progress saved via sync marker updates
    // Can resume from last successful message
    return { success: false, error: e, resumable: true }
  }
}
```

## Scalability Considerations

| Concern | 10 chats | 100 chats | 1000+ chats |
|---------|----------|-----------|-------------|
| Memory | No concern | Monitor iterator usage | Must stream, no buffering |
| Time | Minutes | Hours | Days (rate limits dominate) |
| Storage | MB | GB | Plan disk space |
| Rate limits | Rare | Occasional | Frequent, plan for waits |

**Recommendation:** Build for the 100-chat case. Stream everything, persist progress frequently, show estimated time.

## Sources

- [mtcute Documentation](https://mtcute.dev/guide/)
- [mtcute API Reference](https://ref.mtcute.dev/)
- [mtcute Storage Guide](https://mtcute.dev/guide/topics/storage)
- [Telegram API Pagination](https://core.telegram.org/api/offsets)
- [Telegram Message Entities](https://core.telegram.org/api/entities)
- [Telegram-Chat-Exporter Architecture](https://github.com/seuyh/Telegram-Chat-Exporter)
- [tg-archive Incremental Sync](https://github.com/knadh/tg-archive)
- [FloodWaitError Handling](https://grammy.dev/advanced/flood)
- [Commander.js CLI Patterns](https://blog.logrocket.com/building-typescript-cli-node-js-commander/)
