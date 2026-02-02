# Feature Landscape: Telegram Chat Export Tools

**Domain:** CLI tools for exporting Telegram chat history to structured files
**Researched:** 2026-02-03
**Confidence:** HIGH (mtcute API verified via official docs, ecosystem verified via multiple sources)

## Table Stakes

Features users expect from any Telegram export tool. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | mtcute API | Notes |
|---------|--------------|------------|------------|-------|
| **Message retrieval** | Core purpose | Low | `iterHistory()`, `getHistory()` | Async iterator with pagination built-in |
| **Basic metadata** (ID, date, text) | Standard export data | Low | `Message.id`, `Message.date`, `Message.text` | All directly exposed as properties |
| **Sender info** | Attribution requirement | Low | `Message.sender` returns `Peer` (User or Chat) | User has `username`, `firstName`, `lastName` |
| **Reply references** | Thread context | Low | `Message.replyToMessage` returns `RepliedMessageInfo` | Contains message ID and optionally quoted text |
| **Chat listing** | Navigation | Low | `iterDialogs()`, `getChat()`, `getFullChat()` | Dialog includes chat metadata |
| **Folder support** | Organization | Medium | `getFolders()`, `findFolder()`, `iterDialogs({folder})` | Note: folder filtering is slow (all dialogs fetched then filtered) |
| **Output to file** | Persistence | Low | N/A (app logic) | JSON or Markdown output |
| **Progress indication** | UX for long operations | Low | N/A (app logic) | Console progress bars/counts |

## Differentiators

Features that set the tool apart. Not expected, but valued when present.

| Feature | Value Proposition | Complexity | mtcute API | Notes |
|---------|-------------------|------------|------------|-------|
| **Incremental sync** | Only fetch new messages | Medium | Use `min_id` param in `iterHistory()` | Track last exported message ID per chat |
| **Folder persistence** | Remember selected folders | Low | N/A (app config) | Store folder IDs in local config file |
| **Structured Markdown** | Human-readable + parseable | Medium | N/A (app logic) | YAML frontmatter + body format |
| **Attachment markers** | Know what media exists without downloading | Low | `Message.media` property | Returns `MessageMedia` with type info |
| **Formatted text preservation** | Keep bold/italic/links | Medium | `Message.entities`, `Message.textWithEntities` | Convert to Markdown syntax |
| **Edit tracking** | Know if message was modified | Low | `Message.editDate` | Timestamp of last edit |
| **Thread/topic support** | Forum topic organization | Medium | `Message.isTopicMessage`, `iterForumTopics()` | Forums have topics as sub-threads |
| **Service message handling** | Capture joins/leaves/pins | Low | `Message.isService`, `Message.action` | `MessageAction` has type info |
| **Reactions export** | Social context | Low | `Message.reactions` | `MessageReactions` with emoji/count |
| **Forward info** | Source attribution | Low | `Message.forward` | `MessageForwardInfo` with origin |
| **Channel post metadata** | Views, signatures | Low | `Message.views`, `Message.signature`, `Message.forwards` | Channel-specific stats |
| **Grouped messages** (albums) | Media album handling | Medium | `Message.groupedId`, `getMessageGroup()` | Same `groupedId` = same album |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Media downloading** | Scope creep, storage issues, rate limits, legal concerns | Mark attachments with type/size; let users fetch manually if needed |
| **GUI/web interface** | Complexity explosion, maintenance burden | CLI-first; if UI needed later, separate project |
| **Database storage** (SQLite) | Over-engineering for file export use case | Plain files (JSON/Markdown) are simpler, portable, git-friendly |
| **Real-time sync daemon** | Beyond export scope, reliability complexity | Batch export with incremental support is sufficient |
| **Message editing/sending** | Read-only tool; mixing concerns | Export-only; modifications via Telegram client |
| **Secret chat export** | Not possible (E2E encryption), creates false expectations | Document limitation clearly |
| **Bot mode operation** | Bots can't access user's private chats | Use user auth (MTProto) not Bot API |
| **Full re-export by default** | Wasteful for large histories, rate limit risk | Default to incremental; full export as explicit flag |
| **Storing auth tokens in export files** | Security risk | Config file separate from export output |

## mtcute API Mapping

### Core Export Flow

```
1. getFolders() -> list available folders
2. iterDialogs({folder}) -> list chats in selected folder
3. iterHistory(chatId, {minId}) -> fetch messages (incremental)
4. Message properties -> extract metadata
5. Write to Markdown files
```

### Key Methods for This Project

| Method | Purpose | Key Parameters |
|--------|---------|----------------|
| `getFolders()` | List all chat folders | None |
| `findFolder(params)` | Find folder by ID, title, or emoji | `{id}`, `{title}`, `{emoji}` |
| `iterDialogs(params)` | Iterate chats | `folder`, `archived`, `pinned`, `limit` |
| `getChat(chatId)` | Get chat info | Chat ID or username |
| `getFullChat(chatId)` | Get detailed chat info | Chat ID |
| `iterHistory(chatId, params)` | Iterate messages | `limit`, `offsetId`, `minId`, `maxId`, `offsetDate` |
| `getMessages(chatId, ids)` | Get specific messages | Array of message IDs |

### Message Properties for Export

| Property | Type | Export Use |
|----------|------|------------|
| `id` | `number` | Unique identifier, incremental sync anchor |
| `date` | `Date` | Timestamp for sorting, filename |
| `text` | `string` | Message content |
| `entities` | `MessageEntity[]` | Text formatting (bold, italic, links) |
| `sender` | `Peer` | Author info (name, username) |
| `replyToMessage` | `RepliedMessageInfo \| null` | Reply thread reference |
| `media` | `MessageMedia` | Attachment type marker |
| `editDate` | `Date \| null` | Edit timestamp |
| `isService` | `boolean` | Service vs regular message |
| `action` | `MessageAction` | Service message type |
| `forward` | `MessageForwardInfo \| null` | Forward source |
| `groupedId` | `Long \| null` | Album grouping |
| `views` | `number \| null` | Channel view count |
| `reactions` | `MessageReactions \| null` | Emoji reactions |

### Pagination Strategy

Telegram API returns messages in reverse chronological order (newest first). For incremental sync:

```typescript
// Initial export: get all messages
for await (const msg of client.iterHistory(chatId)) {
  // Process oldest to newest by collecting then reversing, or use reverse param
}

// Incremental export: only messages after lastExportedId
for await (const msg of client.iterHistory(chatId, { minId: lastExportedId })) {
  // Only new messages
}
```

**Important:** `iterDialogs({folder})` is "orders of magnitude slower" than regular iteration because mtcute must fetch ALL dialogs and filter client-side due to Telegram API limitations.

## Feature Dependencies

```
Authentication
    |
    v
getFolders() -----> Folder Selection (config persistence)
    |
    v
iterDialogs({folder}) -----> Chat Listing
    |
    v
iterHistory(chatId) -----> Message Retrieval
    |
    +---> Message.sender -----> Author Resolution (User/Chat lookup)
    |
    +---> Message.replyToMessage -----> Reply Threading
    |
    +---> Message.media -----> Attachment Markers
    |
    +---> Message.entities -----> Text Formatting
    |
    v
Write to Markdown -----> Incremental Sync (track lastMessageId)
```

## MVP Recommendation

For MVP, prioritize these table stakes + one differentiator:

**Must Have (Table Stakes):**
1. Message retrieval with basic metadata (ID, date, text)
2. Sender info (name, username)
3. Reply references (message ID)
4. Chat listing within folders
5. Folder selection

**First Differentiator:**
6. Incremental sync (track last message ID per chat)

**Defer to Post-MVP:**
- Attachment markers: Low complexity but not core to text export
- Formatted text: Medium complexity, can add later
- Reactions/forwards: Nice-to-have metadata
- Thread/topic support: Forum-specific, smaller audience
- Folder persistence: Can manually specify folder initially

## Complexity Estimates

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| Basic message export | Low | Direct mtcute API mapping |
| Incremental sync | Medium | Need state file, ID tracking per chat |
| Folder filtering | Medium | API limitation makes it slow |
| Text formatting | Medium | Entity-to-Markdown conversion logic |
| Service messages | Low | Simple type check and formatting |
| Grouped messages | Medium | Need to collect by groupedId |

## Sources

**HIGH Confidence (Official Documentation):**
- [mtcute TelegramClient API Reference](https://ref.mtcute.dev/classes/_mtcute_deno.index.TelegramClient) - Method signatures and parameters
- [mtcute Message Class](https://ref.mtcute.dev/classes/_mtcute_core.index.Message) - All message properties
- [mtcute iterDialogs](https://ref.mtcute.dev/funcs/_mtcute_web.methods.iterDialogs) - Dialog iteration with folder support
- [Telegram API Pagination](https://core.telegram.org/api/offsets) - min_id, max_id, offset parameters
- [Telegram Message Constructor](https://core.telegram.org/constructor/message) - Raw message fields
- [Telegram Export Schema](https://core.telegram.org/import-export) - Official export format reference

**MEDIUM Confidence (Verified Community Tools):**
- [tg-archive](https://github.com/knadh/tg-archive) - Static site generator, SQLite approach
- [telegram-download-chat](https://github.com/popstas/telegram-download-chat) - JSON/TXT export with resume
- [TelegramBackup](https://github.com/N4rr34n6/TelegramBackup) - HTML export with incremental updates
- [telegram-messages-dump](https://github.com/Kosat/telegram-messages-dump) - CLI with --continue flag for incremental

**LOW Confidence (WebSearch only):**
- Telegram Desktop "incremental JSON" feature reportedly coming Q2 2026 - not yet released
