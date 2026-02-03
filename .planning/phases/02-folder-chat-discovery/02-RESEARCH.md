# Phase 2: Folder & Chat Discovery - Research

**Researched:** 2026-02-03
**Domain:** Telegram Folder API + CLI Selection UX
**Confidence:** HIGH

## Summary

This phase implements folder enumeration and chat discovery using mtcute's high-level APIs. The library provides `getFolders()` which returns raw Telegram DialogFilter objects, and `iterDialogs()` which can iterate all dialogs (optionally filtered by folder). The user has already decided to use JSON config at `data/config.json` with folder_id -> [chat_ids] mapping, so implementation focuses on these specific APIs.

The primary challenge is efficiently extracting chat IDs from folder structures. Telegram folders store `includePeers` as InputPeer objects with access hashes, but we need marked IDs for storage. mtcute provides `getMarkedPeerId()` utility for this conversion. For folder selection UX, @clack/prompts already in the project offers `multiselect` which is ideal for choosing multiple folders.

**Primary recommendation:** Use `getFolders()` to list folders, extract chat IDs from `includePeers`/`pinnedPeers` using `getMarkedPeerId()`, use `multiselect` for folder selection, and implement diff tracking by comparing stored vs current chat ID arrays.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mtcute/node | 0.27.8 | Telegram client | Already in project, provides getFolders/iterDialogs APIs |
| @clack/prompts | 1.0.0 | CLI prompts | Already in project, multiselect for folder selection |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @mtcute/core | (bundled) | Peer utilities | getMarkedPeerId() for ID conversion |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON config | SQLite table | SQLite already used for session; JSON simpler for human-readable config |
| multiselect | select loop | multiselect is cleaner UX, select requires multiple prompts |

**Installation:**
```bash
# No new packages needed - all dependencies already in project
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── folders/           # NEW: Folder discovery module
│   └── index.ts       # getFolders, selectFolders, enumerateChats
├── config/            # NEW: Config management
│   └── index.ts       # loadConfig, saveConfig, diffChats
├── auth.ts            # Existing
├── client.ts          # Existing
└── index.ts           # Add 'folders' command
data/
├── session.db         # Existing
└── config.json        # NEW: Folder/chat tracking config
```

### Pattern 1: Folder Enumeration
**What:** Get all user folders with their metadata
**When to use:** When listing folders for user selection
**Example:**
```typescript
// Source: @mtcute/core/highlevel/methods/dialogs/get-folders.d.ts
import { TelegramClient, tl } from '@mtcute/node'

async function listFolders(tg: TelegramClient) {
  const result = await tg.getFolders()
  // result is tl.messages.RawDialogFilters

  for (const filter of result.filters) {
    // Skip 'dialogFilterDefault' (All Chats pseudo-folder)
    if (filter._ === 'dialogFilterDefault') continue

    // Access folder properties
    const id = filter.id
    const title = filter.title.text  // TextWithEntities has .text property
    const chatCount = filter.includePeers.length + filter.pinnedPeers.length
  }
}
```

### Pattern 2: Extract Chat IDs from InputPeer
**What:** Convert InputPeer objects to marked IDs for storage
**When to use:** When persisting chat IDs to config
**Example:**
```typescript
// Source: @mtcute/core/utils/peer-utils.d.ts
import { getMarkedPeerId } from '@mtcute/core'
import { tl } from '@mtcute/tl'

function extractChatId(peer: tl.TypeInputPeer): number | null {
  // getMarkedPeerId handles all InputPeer types:
  // - inputPeerUser -> positive ID
  // - inputPeerChat -> negative ID
  // - inputPeerChannel -> negative ID with -1e12 offset

  // Skip empty/self peers
  if (peer._ === 'inputPeerEmpty' || peer._ === 'inputPeerSelf') {
    return null
  }

  return getMarkedPeerId(peer)
}

function getChatIdsFromFolder(folder: tl.RawDialogFilter | tl.RawDialogFilterChatlist): number[] {
  const peers = [...folder.pinnedPeers, ...folder.includePeers]
  return peers
    .map(extractChatId)
    .filter((id): id is number => id !== null)
}
```

### Pattern 3: Multiselect for Folder Selection
**What:** Let user choose which folders to track
**When to use:** Initial setup and folder configuration
**Example:**
```typescript
// Source: @clack/prompts
import { multiselect, isCancel } from '@clack/prompts'

async function selectFolders(folders: Array<{id: number, title: string}>) {
  const selected = await multiselect({
    message: 'Select folders to track:',
    options: folders.map(f => ({
      value: f.id,
      label: f.title
    })),
    required: true
  })

  if (isCancel(selected)) {
    process.exit(0)
  }

  return selected
}
```

### Pattern 4: Config Diff Detection
**What:** Compare stored vs current chat lists, log changes
**When to use:** On each run to detect folder membership changes
**Example:**
```typescript
function diffChatLists(
  stored: number[],
  current: number[],
  getChatName: (id: number) => string
): { added: number[], removed: number[] } {
  const storedSet = new Set(stored)
  const currentSet = new Set(current)

  const added = current.filter(id => !storedSet.has(id))
  const removed = stored.filter(id => !currentSet.has(id))

  // Log to console as per user decision
  for (const id of added) {
    console.log(`New chat: ${getChatName(id)}`)
  }
  for (const id of removed) {
    console.log(`Removed chat: ${getChatName(id)}`)
  }

  return { added, removed }
}
```

### Anti-Patterns to Avoid
- **Fetching all dialogs to filter by folder:** mtcute docs warn this is "orders of magnitudes slower" - use folder's `includePeers` directly instead
- **Storing access hashes in config:** Access hashes are session-specific; store marked IDs only
- **Assuming folder.title is a string:** It's `TextWithEntities`, access `.text` property

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Peer ID conversion | Manual type checking | `getMarkedPeerId()` | Handles all InputPeer variants, mark calculation is complex |
| Folder display | Manual formatting | Iterate `filter.title.text` | Title already contains formatted text |
| CLI selection | readline/inquirer | @clack/prompts `multiselect` | Already in project, consistent with auth UX |

**Key insight:** mtcute's peer utilities handle the complexity of Telegram's peer system - marked IDs (bot API compatible), bare IDs, access hashes all have specific uses. Use `getMarkedPeerId()` for storage-friendly IDs.

## Common Pitfalls

### Pitfall 1: dialogFilterDefault in Folders List
**What goes wrong:** The "All Chats" folder appears as `dialogFilterDefault` with no ID/peers
**Why it happens:** Telegram returns this pseudo-folder in `getFolders()` response
**How to avoid:** Filter by `filter._ !== 'dialogFilterDefault'` when listing
**Warning signs:** Crash on `.id` access, empty folder list despite having folders

### Pitfall 2: Empty pinnedPeers/includePeers Arrays
**What goes wrong:** Some folders may have zero explicitly included chats
**Why it happens:** Folders can be rule-based only (e.g., "all contacts" with no explicit chats)
**How to avoid:** Handle empty arrays gracefully, warn user if folder has no enumerable chats
**Warning signs:** Folder shows 0 chats despite UI showing many

### Pitfall 3: InputPeer Types Vary
**What goes wrong:** Accessing `.userId` on `inputPeerChannel` crashes
**Why it happens:** InputPeer is a union type with different fields per variant
**How to avoid:** Use `getMarkedPeerId()` which handles all variants
**Warning signs:** "property undefined" errors when processing peers

### Pitfall 4: Config File Race Conditions
**What goes wrong:** Concurrent writes corrupt config.json
**Why it happens:** Multiple runs or interrupted writes
**How to avoid:** Read-modify-write atomically, use sync operations for simplicity in CLI
**Warning signs:** Malformed JSON errors on load

## Code Examples

Verified patterns from official sources:

### Get All Folders
```typescript
// Source: @mtcute/core/highlevel/methods/dialogs/get-folders.d.ts
const result = await tg.getFolders()
// Returns tl.messages.RawDialogFilters:
// {
//   _: 'messages.dialogFilters',
//   tagsEnabled?: boolean,
//   filters: tl.TypeDialogFilter[]
// }
```

### Filter Folder Types
```typescript
// Three folder types exist:
// 1. dialogFilter - standard user folder
// 2. dialogFilterDefault - "All Chats" pseudo-folder
// 3. dialogFilterChatlist - shared/imported folder

for (const filter of result.filters) {
  if (filter._ === 'dialogFilter') {
    // Standard folder with full filtering options
    // Has: id, title, includePeers, pinnedPeers, excludePeers, flags
  } else if (filter._ === 'dialogFilterChatlist') {
    // Shared folder (imported via link)
    // Has: id, title, includePeers, pinnedPeers (no excludePeers)
  }
  // Skip dialogFilterDefault - no enumerable content
}
```

### Config JSON Structure
```typescript
// Per user decision: data/config.json
interface Config {
  trackedFolders: {
    [folderId: number]: number[]  // folder_id -> [chat_ids]
  }
}

// Example:
{
  "trackedFolders": {
    "2": [123456789, -987654321, -1001234567890],
    "5": [-1001111111111]
  }
}
```

### Read/Write Config
```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const CONFIG_PATH = 'data/config.json'

function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    return { trackedFolders: {} }
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
}

function saveConfig(config: Config): void {
  const dir = dirname(CONFIG_PATH)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getDialogs()` + filter | `getFolders()` + direct peer extraction | mtcute 0.20+ | Much faster, no full dialog fetch needed |
| Manual peer type switching | `getMarkedPeerId()` | Always available | Cleaner code, handles edge cases |

**Deprecated/outdated:**
- `iterDialogs({ folder })` for folder enumeration: While supported, it fetches ALL dialogs and filters - extremely slow. Only use if you need full Dialog objects with messages.

## Open Questions

Things that couldn't be fully resolved:

1. **Chat names for diff logging**
   - What we know: Folder's `includePeers` are InputPeer objects without names
   - What's unclear: How to get chat names without additional API calls
   - Recommendation: For diff logging, fetch chat info lazily only for changed items, or just log IDs initially. Can use `tg.getChat(markedId)` for name lookup.

2. **Rule-based folder chats**
   - What we know: Folders with `contacts: true` or `groups: true` flags include chats dynamically
   - What's unclear: Whether we should enumerate these via `iterDialogs()` or just warn user
   - Recommendation: For Phase 2, only enumerate explicit `includePeers`. Warn if folder has no explicit chats but has filter flags enabled.

## Sources

### Primary (HIGH confidence)
- @mtcute/core type definitions (v0.27.8) - getFolders, iterDialogs, peer-utils APIs
- @mtcute/tl type definitions - RawDialogFilter, TypeInputPeer, TypeTextWithEntities
- @clack/prompts type definitions (v1.0.0) - multiselect interface

### Secondary (MEDIUM confidence)
- https://core.telegram.org/api/folders - Telegram folder API documentation

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project dependencies with verified type definitions
- Architecture: HIGH - Simple JSON config, clear module boundaries
- Pitfalls: HIGH - Verified against mtcute type definitions

**Research date:** 2026-02-03
**Valid until:** 2026-03-05 (30 days - stable APIs)
