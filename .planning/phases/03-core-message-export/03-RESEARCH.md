# Phase 3: Core Message Export - Research

**Researched:** 2026-02-03
**Domain:** Telegram message export, Markdown formatting, rate limiting, CLI progress UI
**Confidence:** HIGH

## Summary

Phase 3 implements the core message export functionality using mtcute's well-documented message iteration API. The project already has mtcute v0.27.8 installed with `@mtcute/markdown-parser` for entity conversion. The built-in `@clack/prompts` spinner provides the required progress feedback without adding new dependencies.

The implementation pattern is straightforward: iterate through messages per chat using `tg.iterHistory()`, convert entities to Markdown with `md.unparse()`, group by month, and write files with YAML frontmatter. Rate limiting is manual (1.5s + jitter between batches) since mtcute's built-in flood handling only covers short waits.

**Primary recommendation:** Use mtcute's `iterHistory` + `md.unparse` for message fetching and formatting, `@clack/prompts` spinner for progress UI, and Node.js built-in fs for file operations with YAML frontmatter as plain string templates.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mtcute/node | 0.27.8 | Telegram client | Already in project, TypeScript-first |
| @mtcute/markdown-parser | 0.27.8 | Entity-to-Markdown | Ships with mtcute, `md.unparse()` for conversion |
| @clack/prompts | 1.0.0 | Spinner + progress | Already in project, has `spinner()` and `message()` |
| chalk | 5.6.2 | Terminal colors | Already in project |

### Supporting (No New Dependencies)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs | built-in | File operations | Sync operations for config, async for bulk writes |
| node:path | built-in | Path manipulation | Monthly folder structure |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @clack/prompts spinner | ora | ora more popular but clack already installed, same functionality |
| sanitize-filename npm | Custom regex | npm package handles more edge cases but simple regex sufficient for chat names |
| gray-matter for YAML | String template | No parsing needed, just writing frontmatter |

**Installation:**
No additional packages needed - all dependencies already in project.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── messages/
│   ├── index.ts         # Main export function
│   ├── fetch.ts         # iterHistory wrapper with rate limiting
│   ├── format.ts        # Message-to-Markdown formatting
│   └── writer.ts        # Monthly file writer with frontmatter
├── utils/
│   └── filename.ts      # Chat name sanitization
```

### Pattern 1: Async Iterator with Manual Rate Limiting
**What:** Wrap `iterHistory` with delay between chunks
**When to use:** Always - Telegram API is rate-limited
**Example:**
```typescript
// Source: mtcute iter-history.d.ts + manual delay
async function* fetchMessages(
  tg: TelegramClient,
  chatId: number,
  onProgress: (count: number) => void
): AsyncGenerator<Message> {
  const chunkSize = 100
  let count = 0

  for await (const msg of tg.iterHistory(chatId, { chunkSize })) {
    yield msg
    count++

    // Rate limit every chunk
    if (count % chunkSize === 0) {
      const delay = 1500 + Math.random() * 500 // 1.5-2s jitter
      await sleep(delay)
      onProgress(count)
    }
  }
}
```

### Pattern 2: Monthly File Grouping
**What:** Group messages by YYYY-MM, write one file per month per chat
**When to use:** For the archive structure
**Example:**
```typescript
// Group messages by month
function groupByMonth(messages: Message[]): Map<string, Message[]> {
  const groups = new Map<string, Message[]>()

  for (const msg of messages) {
    const key = formatYearMonth(msg.date) // "2024-01"
    const group = groups.get(key) || []
    group.push(msg)
    groups.set(key, group)
  }

  return groups
}
```

### Pattern 3: Entity-to-Markdown Conversion
**What:** Use `md.unparse()` for faithful text formatting
**When to use:** All message text with entities
**Example:**
```typescript
// Source: @mtcute/markdown-parser index.d.ts
import { md } from '@mtcute/markdown-parser'

function formatMessageText(msg: Message): string {
  // textWithEntities returns { text, entities } object
  // md.unparse converts back to markdown string
  return md.unparse(msg.textWithEntities)
}
```

### Anti-Patterns to Avoid
- **Fetching all messages then grouping:** Memory issues for large chats. Stream and write per-month.
- **No delay between API calls:** Will trigger FLOOD_WAIT. Always add 1.5s+ jitter.
- **Trusting message order:** Messages come newest-first by default. Reverse when writing to file.
- **Custom entity parsing:** Use `md.unparse()` - handles all entity types correctly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Entity to Markdown | Custom switch on entity.kind | `md.unparse(msg.textWithEntities)` | Handles overlapping entities, escaping, all 15+ entity types |
| Spinner with text updates | Console.log with \r | `@clack/prompts` spinner | Handles terminal quirks, CI detection |
| Filename sanitization | Basic replace | Custom function with full char list | Windows reserved names, control chars, length limits |
| YAML generation | yaml npm package | Template string | Just key-value pairs, no parsing needed |

**Key insight:** mtcute's `md.unparse()` solves the hardest problem (entity conversion with proper nesting and escaping). Everything else is straightforward string/file operations.

## Common Pitfalls

### Pitfall 1: Message Order Reversal
**What goes wrong:** Messages come newest-first, written to file newest-first, reads backwards
**Why it happens:** `iterHistory` default is reverse chronological
**How to avoid:** Collect messages per month, reverse before writing: `messages.reverse()`
**Warning signs:** Archive reads bottom-to-top

### Pitfall 2: Sender Type Confusion
**What goes wrong:** `msg.sender` is `Peer` (User | Chat), not always User
**Why it happens:** Anonymous admins, channel posts have Chat as sender
**How to avoid:** Check `sender.type === 'user'` before accessing `firstName`/`lastName`
**Warning signs:** TypeError on firstName access

### Pitfall 3: Reply Quote Length
**What goes wrong:** Quoting full replied message bloats output
**Why it happens:** `replyToMessage.quoteText` can be entire message
**How to avoid:** Truncate to ~100 chars with ellipsis
**Warning signs:** Massive repeated content in replies

### Pitfall 4: Forward Info Access
**What goes wrong:** Accessing `forward.sender.displayName` when sender is AnonymousSender
**Why it happens:** Some forwards have hidden source (privacy settings)
**How to avoid:** Check for `type === 'anonymous'` on PeerSender
**Warning signs:** "Cannot read property 'displayName'"

### Pitfall 5: Empty Chat Handling
**What goes wrong:** Creating empty files for chats with no messages
**Why it happens:** Some chats may have been cleared or never had messages
**How to avoid:** Check message count before file creation (as specified in decisions)
**Warning signs:** Empty .md files in archive

### Pitfall 6: Rate Limit Not Preventing FLOOD_WAIT
**What goes wrong:** Still getting FLOOD_WAIT despite delays
**Why it happens:** 1.5s might not be enough during heavy export sessions
**How to avoid:** Add jitter (random 0-500ms), mtcute handles short waits up to 60s automatically
**Warning signs:** Console shows "Waiting X seconds" from mtcute

## Code Examples

### Message Iteration with Progress
```typescript
// Source: mtcute types, verified from node_modules
import { TelegramClient, Message } from '@mtcute/node'
import { spinner } from '@clack/prompts'

async function exportChat(tg: TelegramClient, chatId: number): Promise<void> {
  const s = spinner()
  s.start(`Exporting chat ${chatId}...`)

  let count = 0
  const messages: Message[] = []

  for await (const msg of tg.iterHistory(chatId, { chunkSize: 100 })) {
    messages.push(msg)
    count++

    if (count % 100 === 0) {
      s.message(`Fetched ${count} messages...`)
      await sleep(1500 + Math.random() * 500)
    }
  }

  s.stop(`Exported ${count} messages`)
}
```

### Message Formatting
```typescript
// Source: mtcute types, verified from node_modules
import { Message, User, Chat, AnonymousSender } from '@mtcute/node'
import { md } from '@mtcute/markdown-parser'

function formatSender(sender: User | Chat | AnonymousSender): string {
  if (sender.type === 'anonymous') {
    return sender.displayName
  }
  if (sender.type === 'user') {
    const name = sender.lastName
      ? `${sender.firstName} ${sender.lastName}`
      : sender.firstName
    return sender.username ? `${name} (@${sender.username})` : name
  }
  // Chat (channel post)
  return sender.title
}

function formatMessage(msg: Message): string {
  const timestamp = msg.date.toISOString()
  const sender = formatSender(msg.sender)
  const text = md.unparse(msg.textWithEntities)

  let output = `### ${sender}\n`
  output += `*${timestamp}*\n\n`

  // Handle forwards
  if (msg.forward) {
    const fwdSender = msg.forward.sender
    const fwdName = fwdSender.type === 'anonymous'
      ? fwdSender.displayName
      : fwdSender.displayName
    output += `> Forwarded from: ${fwdName}\n\n`
  }

  // Handle replies with quote
  if (msg.replyToMessage) {
    const quote = msg.replyToMessage.quoteText.slice(0, 100)
    const ellipsis = msg.replyToMessage.quoteText.length > 100 ? '...' : ''
    output += `> In reply to: "${quote}${ellipsis}"\n\n`
  }

  // Handle attachments
  if (msg.media) {
    output += `[Attachment: ${msg.media.type}]\n\n`
  }

  output += text + '\n\n---\n\n'
  return output
}
```

### YAML Frontmatter
```typescript
// No library needed - simple template
function createFrontmatter(
  chatName: string,
  chatId: number,
  firstMsgId: number,
  lastMsgId: number
): string {
  const now = new Date().toISOString()
  return `---
chat_name: "${chatName.replace(/"/g, '\\"')}"
chat_id: ${chatId}
first_message_id: ${firstMsgId}
last_message_id: ${lastMsgId}
exported_at: "${now}"
---

`
}
```

### Filename Sanitization
```typescript
// Custom implementation covering all cases
const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f\x80-\x9f]/g
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
const MAX_LENGTH = 200 // Leave room for path

function sanitizeFilename(name: string): string {
  let safe = name
    .replace(INVALID_CHARS, '')  // Remove invalid chars
    .replace(/\s+/g, ' ')        // Collapse whitespace
    .trim()
    .replace(/\.+$/, '')         // Remove trailing dots (Windows)

  // Handle Windows reserved names
  if (WINDOWS_RESERVED.test(safe)) {
    safe = `_${safe}`
  }

  // Truncate to max length
  if (safe.length > MAX_LENGTH) {
    safe = safe.slice(0, MAX_LENGTH)
  }

  // Fallback if empty
  return safe || 'unnamed'
}
```

### Clack Spinner with Message Updates
```typescript
// Source: @clack/prompts dist/index.d.mts
import { spinner } from '@clack/prompts'

const s = spinner()
s.start('Starting export...')

// Update message during operation
s.message('Processing chat 1 of 5...')
s.message('Rate limiting: waiting 1.5s...')

// Final states
s.stop('Export complete: 5 chats, 1234 messages')
// Or on error:
s.error('Export failed: connection timeout')
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual entity parsing | `md.unparse()` | mtcute 0.20+ | Reliable conversion for all entity types |
| ora spinner | @clack/prompts spinner | 2024 | Already in project, same features |
| yaml npm package | Template strings | Always | YAML writing doesn't need a parser |

**Deprecated/outdated:**
- None in current stack

## Open Questions

1. **Thread/topic messages in forums**
   - What we know: Forums have topic IDs, messages belong to topics
   - What's unclear: Whether to group by topic or just by chat
   - Recommendation: Export all messages flat for v1, forum topics are v2 scope

2. **Large chat memory handling**
   - What we know: iterHistory streams, but we collect all before grouping
   - What's unclear: Memory limits for chats with 100k+ messages
   - Recommendation: Process and write per-month batches instead of collecting all

## Sources

### Primary (HIGH confidence)
- mtcute node_modules types - Message, iterHistory, md.unparse, Peer, User, Chat (verified v0.27.8)
- @clack/prompts types - spinner, SpinnerResult interface (verified v1.0.0)

### Secondary (MEDIUM confidence)
- [mtcute documentation](https://mtcute.dev/guide/topics/parse-modes) - unparse method behavior
- [mtcute API reference](https://ref.mtcute.dev/) - iterHistory parameters

### Tertiary (LOW confidence)
- [sanitize-filename npm](https://github.com/parshap/node-sanitize-filename) - Character list reference (used as basis for custom implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Types verified in node_modules
- Architecture: HIGH - Patterns derived from mtcute documentation and types
- Pitfalls: MEDIUM - Based on type analysis and common Telegram API issues

**Research date:** 2026-02-03
**Valid until:** 30 days (mtcute is stable, no major changes expected)
