# Phase 4: Incremental Sync - Research

**Researched:** 2026-02-03
**Domain:** Incremental message fetching, state tracking, file appending, interactive terminal dialogs
**Confidence:** HIGH

## Summary

Phase 4 transforms the export command from full-export to incremental-aware. The core mechanism uses mtcute's `minId` parameter in `iterHistory`/`getHistory` to fetch only messages newer than the last exported ID. State is tracked per-chat and persisted in a separate state file (recommended over embedding in config.json for cleaner separation of concerns).

The project already has `@clack/prompts` installed (v1.0.0), which provides `multiselect`, `select`, and `confirm` prompts for the interactive chat/folder detection dialogs. For edited messages, a simple text-based diff record format is recommended over JSON Patch (RFC 6902) since the goal is human-readable archives, not programmatic reconstruction.

File appending requires reading existing frontmatter to preserve `first_message_id` while updating `last_message_id` and `exported_at`. The `gray-matter` npm package is the standard tool for parsing/writing YAML frontmatter, though for this project's simple needs (read frontmatter, append content, write new frontmatter), direct string manipulation may suffice.

**Primary recommendation:** Use `minId` parameter for incremental fetching, separate `data/sync-state.json` for state tracking, `@clack/prompts` for interactive dialogs, and simple inline diff markers for edited messages.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mtcute/node | 0.27.8 | Telegram client with `minId` support | Already in project, `iterHistory` supports incremental params |
| @clack/prompts | 1.0.0 | Interactive multiselect, select, confirm | Already in project, has all needed prompt types |
| chalk | 5.6.2 | Terminal colors | Already in project |

### Supporting (Recommended Addition)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gray-matter | 4.0.3 | YAML frontmatter parsing | For reading existing files before append |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gray-matter | String regex | gray-matter handles edge cases (multiline values, escaping) |
| Separate state file | Embed in config.json | Separation of concerns; state changes frequently, config rarely |
| RFC 6902 JSON Patch | Text diff markers | Overkill for human-readable archives; text markers are simpler |

**Installation:**
```bash
npm install gray-matter
```

Or skip gray-matter and use string manipulation for frontmatter (simpler, no new dependency).

## Architecture Patterns

### Recommended Project Structure
```
src/
├── sync/
│   ├── index.ts         # Main sync orchestration
│   ├── state.ts         # State file read/write
│   ├── detect.ts        # New chat/folder detection + prompts
│   └── append.ts        # File append with frontmatter update
├── messages/
│   └── fetch.ts         # Add minId support to existing fetcher
```

### Pattern 1: State File Structure

**What:** Separate JSON file for sync state, distinct from config
**When to use:** Always — keeps volatile state separate from stable config
**Example:**

```typescript
// data/sync-state.json
interface SyncState {
  version: 1
  chats: {
    [chatId: number]: {
      lastMessageId: number
      lastSyncedAt: string  // ISO timestamp
      chatName: string      // Cached for display
    }
  }
  folders: {
    [folderId: number]: {
      chatIds: number[]     // Snapshot at last sync
      lastSyncedAt: string
    }
  }
}

// Source: Project-specific design based on CONTEXT.md decisions
```

**Why separate file:**
- State changes every sync; config rarely changes
- State can be safely deleted to trigger re-export (per CONTEXT.md decision)
- Cleaner JSON structure without nesting state inside config

### Pattern 2: Incremental Fetch with minId

**What:** Pass `minId` to `iterHistory` to skip already-exported messages
**When to use:** On subsequent syncs when state exists
**Example:**

```typescript
// Source: @mtcute/core/highlevel/methods/messages/get-history.d.ts
import type { TelegramClient, Message } from '@mtcute/node'

async function* fetchMessagesSince(
  tg: TelegramClient,
  chatId: number,
  afterMessageId: number,
  onProgress?: (count: number) => void
): AsyncGenerator<Message> {
  const chunkSize = 100
  let count = 0

  // minId: Minimum message ID to return (exclusive)
  // Messages with ID > minId will be returned
  for await (const msg of tg.iterHistory(chatId, {
    chunkSize,
    minId: afterMessageId,  // Only fetch messages AFTER this ID
  })) {
    yield msg
    count++

    if (count % chunkSize === 0) {
      onProgress?.(count)
      const delay = 1500 + Math.random() * 500
      await new Promise(r => setTimeout(r, delay))
    }
  }
}
```

### Pattern 3: File Append with Frontmatter Update

**What:** Read existing file, update frontmatter fields, append new messages
**When to use:** When syncing to existing monthly files
**Example:**

```typescript
// Using string manipulation (no gray-matter dependency)
function updateFrontmatterAndAppend(
  existingContent: string,
  newMessages: string,
  newLastMsgId: number
): string {
  // Match frontmatter block
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/
  const match = existingContent.match(frontmatterRegex)

  if (!match) {
    throw new Error('Invalid file format: no frontmatter found')
  }

  const frontmatter = match[1]
  const body = existingContent.slice(match[0].length)

  // Update last_message_id and exported_at, keep others
  const updatedFrontmatter = frontmatter
    .replace(/^last_message_id: .+$/m, `last_message_id: ${newLastMsgId}`)
    .replace(/^exported_at: .+$/m, `exported_at: "${new Date().toISOString()}"`)

  return `---\n${updatedFrontmatter}\n---\n${body}${newMessages}`
}
```

### Pattern 4: Interactive Dialog for New Chats

**What:** Use @clack/prompts for "add all / select / skip" flow
**When to use:** When new chats detected in tracked folders
**Example:**

```typescript
// Source: @clack/prompts types (node_modules/@clack/prompts/dist/index.d.mts)
import { select, multiselect, isCancel } from '@clack/prompts'

interface NewChatChoice {
  action: 'add-all' | 'select' | 'skip'
  selectedIds?: number[]
}

async function promptNewChats(
  newChats: Array<{ id: number; name: string }>
): Promise<NewChatChoice> {
  // First: ask what to do
  const action = await select({
    message: `Found ${newChats.length} new chat(s). What would you like to do?`,
    options: [
      { value: 'add-all', label: 'Add all new chats', hint: 'recommended' },
      { value: 'select', label: 'Select which to add' },
      { value: 'skip', label: 'Skip for now' },
    ],
  })

  if (isCancel(action)) {
    process.exit(0)
  }

  if (action === 'select') {
    const selected = await multiselect({
      message: 'Select chats to add:',
      options: newChats.map(c => ({
        value: c.id,
        label: c.name,
      })),
      required: false,
    })

    if (isCancel(selected)) {
      process.exit(0)
    }

    return { action: 'select', selectedIds: selected as number[] }
  }

  return { action: action as 'add-all' | 'skip' }
}
```

### Pattern 5: Diff Records for Edited Messages

**What:** Inline text markers showing original content when message is edited
**When to use:** When message editDate differs from date
**Example:**

```markdown
**[2026-02-03 14:30:00]** **John Doe** [id:12345]

Hello world!

---

**[2026-02-03 14:30:00]** **John Doe** [id:12345] [EDITED at 2026-02-03 15:00:00]

> Original: Hello world!

Hello everyone!

---
```

**Format rationale:**
- Human-readable in archive
- Shows original content as blockquote
- Edit timestamp visible
- Original message ID preserved for reference

### Anti-Patterns to Avoid

- **Storing state in monthly files:** State should be centralized, not scattered across archive files
- **Re-scanning files for last message ID:** Trust the state file; if corrupted, full re-export is the fix
- **Using JSON Patch for diffs:** Overkill for text archives; simple inline markers are more readable
- **Modifying historical files:** Only append to current/recent month files per CONTEXT.md decision

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interactive prompts | Custom readline | `@clack/prompts` multiselect/select | Already installed, handles edge cases |
| YAML frontmatter parsing | Regex for all cases | `gray-matter` or simple regex for known format | gray-matter handles escaping, multiline values |
| Terminal progress | Console.log with \r | `@clack/prompts` spinner | Already in project, same as Phase 3 |
| Date formatting | Manual string concat | Existing `formatDate` function | Already implemented in format.ts |

**Key insight:** This phase is primarily orchestration logic. The heavy lifting (message fetching, formatting, file writing) is already built in Phase 3. Focus on state management and UI flows.

## Common Pitfalls

### Pitfall 1: minId Off-by-One

**What goes wrong:** Fetching with `minId: 500` includes message 500 (depends on exclusive/inclusive semantics)
**Why it happens:** Different APIs have different semantics for min/max boundaries
**How to avoid:** mtcute's `minId` is EXCLUSIVE — messages with ID > minId are returned
**Warning signs:** Duplicate messages at sync boundary

### Pitfall 2: Month Boundary Edge Case

**What goes wrong:** New messages span current month and previous month, only current month file exists
**Why it happens:** User didn't export for a month, new messages fill gap
**How to avoid:** Per CONTEXT.md decision: skip old months, only append to current/recent files
**Warning signs:** Historical files created unexpectedly

### Pitfall 3: State File Race Condition

**What goes wrong:** Interrupted sync leaves state partially updated
**Why it happens:** State saved mid-sync, then crash
**How to avoid:** Update state atomically after successful chat export (per-chat, not per-message)
**Warning signs:** Missing messages after interrupted sync

### Pitfall 4: Edited Message Detection Timing

**What goes wrong:** Message marked as edited but no diff record created
**Why it happens:** Only checking `editDate` on new messages, not detecting edits to already-exported messages
**How to avoid:** For MVP, only track edits visible in current sync (can't detect edits to old messages without re-fetching)
**Warning signs:** Edited messages show edit marker but no original content

### Pitfall 5: Chat Removed from Folder but Still Tracked

**What goes wrong:** Chat export continues after user removes it from Telegram folder
**Why it happens:** State tracks chat independently of folder membership
**How to avoid:** Per CONTEXT.md: prompt user "Chat X no longer in folder Y — keep tracking?"
**Warning signs:** Exports chats user expected to stop tracking

## Code Examples

### State File Read/Write

```typescript
// Source: Project-specific implementation
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const STATE_PATH = 'data/sync-state.json'

interface SyncState {
  version: 1
  chats: Record<number, {
    lastMessageId: number
    lastSyncedAt: string
    chatName: string
  }>
  folders: Record<number, {
    chatIds: number[]
    lastSyncedAt: string
  }>
}

function loadState(): SyncState {
  if (!existsSync(STATE_PATH)) {
    return { version: 1, chats: {}, folders: {} }
  }
  const content = readFileSync(STATE_PATH, 'utf-8')
  return JSON.parse(content)
}

function saveState(state: SyncState): void {
  const dir = dirname(STATE_PATH)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

function updateChatState(
  state: SyncState,
  chatId: number,
  lastMessageId: number,
  chatName: string
): void {
  state.chats[chatId] = {
    lastMessageId,
    lastSyncedAt: new Date().toISOString(),
    chatName,
  }
}
```

### Detect New Chats/Folders

```typescript
// Source: Project-specific implementation based on existing folders/index.ts
interface ChangeDetection {
  newChats: Array<{ id: number; folderId: number }>
  removedChats: Array<{ id: number; folderId: number }>
  newFolders: number[]
}

function detectChanges(
  state: SyncState,
  currentFolderChats: Record<number, number[]>,
  trackedFolderIds: number[]
): ChangeDetection {
  const newChats: ChangeDetection['newChats'] = []
  const removedChats: ChangeDetection['removedChats'] = []
  const newFolders: number[] = []

  for (const folderId of trackedFolderIds) {
    const currentChats = currentFolderChats[folderId] || []
    const previousChats = state.folders[folderId]?.chatIds || []

    // Detect new folders (not in state)
    if (!state.folders[folderId]) {
      newFolders.push(folderId)
    }

    // Detect new chats in folder
    const previousSet = new Set(previousChats)
    for (const chatId of currentChats) {
      if (!previousSet.has(chatId)) {
        newChats.push({ id: chatId, folderId })
      }
    }

    // Detect removed chats from folder
    const currentSet = new Set(currentChats)
    for (const chatId of previousChats) {
      if (!currentSet.has(chatId)) {
        removedChats.push({ id: chatId, folderId })
      }
    }
  }

  return { newChats, removedChats, newFolders }
}
```

### File Append Logic

```typescript
// Source: Project-specific implementation
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

async function appendToMonthlyFile(
  chatName: string,
  chatId: number,
  yearMonth: string,
  messages: Message[],
  safeFilename: string
): Promise<{ messagesAppended: number }> {
  const filePath = join('archive', yearMonth, `${safeFilename}.md`)

  if (!existsSync(filePath)) {
    // New file — use full writeMonthlyFiles from Phase 3
    // (shouldn't happen per CONTEXT.md "skip old months" decision)
    return { messagesAppended: 0 }
  }

  // Read existing file
  const existing = readFileSync(filePath, 'utf-8')

  // Format new messages
  const newContent = messages.map(formatMessage).join('')

  // Get new last message ID
  const newLastMsgId = messages[messages.length - 1].id

  // Update frontmatter and append
  const updated = updateFrontmatterAndAppend(existing, newContent, newLastMsgId)

  writeFileSync(filePath, updated, 'utf-8')

  return { messagesAppended: messages.length }
}
```

### Sync Summary Output

```typescript
// Source: @clack/prompts log (already available)
import { log } from '@clack/prompts'

interface SyncSummary {
  chatsProcessed: number
  messagesAppended: number
  filesUpdated: number
  newChatsAdded: number
  duration: number
}

function printSyncSummary(summary: SyncSummary): void {
  const lines = [
    `Chats processed: ${summary.chatsProcessed}`,
    `Messages synced: ${summary.messagesAppended}`,
    `Files updated: ${summary.filesUpdated}`,
    `New chats added: ${summary.newChatsAdded}`,
    `Duration: ${formatDuration(summary.duration)}`,
  ]

  log.success(lines.join('\n'))
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Embed state in config.json | Separate sync-state.json | This phase | Cleaner separation of concerns |
| Full re-export every run | Incremental via minId | This phase | Dramatic performance improvement |
| Silent chat detection | Interactive prompts | This phase | User control over what gets tracked |

**Deprecated/outdated:**
- None in current stack

## Open Questions

1. **Edit detection for already-exported messages**
   - What we know: mtcute provides `editDate` on messages fetched
   - What's unclear: How to detect edits to messages exported in previous syncs (would require re-fetching all messages)
   - Recommendation: For MVP, only track edits visible in current sync; document this limitation

2. **Deleted message detection**
   - What we know: mtcute has `DeleteMessageUpdate` for real-time updates; `iterHistory` simply won't return deleted messages
   - What's unclear: How to detect deletions without re-fetching entire history
   - Recommendation: For MVP, mark as [DELETED] only if we fetch a gap (missing IDs in sequence); document limitation

3. **Month boundary for appending**
   - What we know: CONTEXT.md says "skip old months — only append to current/recent month files"
   - What's unclear: What exactly counts as "recent"? Current month only? Current + previous?
   - Recommendation: Define "recent" as current month only; messages for older months are logged but not written

## Sources

### Primary (HIGH confidence)
- @mtcute/core types (node_modules) — `getHistory.d.ts` documents `minId`, `maxId`, `reverse` parameters
- @clack/prompts types (node_modules) — `multiselect`, `select`, `confirm`, `spinner`, `log` interfaces
- Project source code — existing config, writer, fetch implementations

### Secondary (MEDIUM confidence)
- [bomb.sh/docs/clack](https://bomb.sh/docs/clack/packages/prompts/) — Official clack prompts documentation
- [gray-matter npm](https://www.npmjs.com/package/gray-matter) — YAML frontmatter parsing library

### Tertiary (LOW confidence)
- [RFC 6902 JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902) — Referenced but not recommended for this use case

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from node_modules types
- Architecture: HIGH — builds on proven Phase 3 patterns
- Pitfalls: MEDIUM — some edge cases need runtime validation

**Research date:** 2026-02-03
**Valid until:** 30 days (patterns are stable)
