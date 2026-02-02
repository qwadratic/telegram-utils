# Technology Stack

**Project:** Telegram Chat Exporter (mtcute-based)
**Researched:** 2026-02-03
**Overall Confidence:** HIGH (verified via npm registry + official docs)

## Executive Summary

For a TypeScript CLI tool that exports Telegram chat history using mtcute, the stack centers on mtcute's Node.js package with SQLite storage for session persistence, Commander.js for CLI parsing (proven, stable), and simple JSON for incremental sync state. The stack prioritizes reliability over novelty given this is a personal utility tool.

---

## Recommended Stack

### Core: Telegram MTProto Client

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `@mtcute/node` | ^0.27.8 | MTProto client for Node.js | HIGH |
| `@mtcute/dispatcher` | ^0.27.8 | Event handling (optional, for updates) | HIGH |

**Why mtcute over alternatives:**

1. **Native TypeScript** - Written in TypeScript from scratch, not a port. Type-safe API throughout.
2. **Active maintenance** - Latest release: Jan 25, 2026. Regular updates tracking Telegram schema changes.
3. **Simpler than GramJS** - GramJS is a Telethon port with bolted-on types; mtcute has cleaner modern API.
4. **Direct MTProto** - No Bot API limitations. Full access to user features like folders (DialogFilter).

**What NOT to use:**
- `gramjs` - Telethon port, less type-safe, more complex API
- `telegram-mtproto` - Abandoned, last update 2019
- `@mtproto/core` - Extremely low-level, requires manual session handling
- Bot API libraries (telegraf, grammY) - Cannot access user folders or full chat history

**Source:** [mtcute.dev](https://mtcute.dev/), [npm @mtcute/node](https://www.npmjs.com/package/@mtcute/node)

---

### Storage: Session Persistence

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `SqliteStorage` (built into @mtcute/node) | - | MTProto session persistence | HIGH |
| JSON file | - | Incremental sync state tracking | HIGH |

**Session Storage Strategy:**

mtcute's SQLite storage is the correct choice for a CLI tool:

```typescript
import { TelegramClient } from '@mtcute/node'

const tg = new TelegramClient({
  apiId: API_ID,
  apiHash: 'API_HASH',
  storage: 'my-account.session' // SQLite file, persists auth
})
```

**Why SQLite over alternatives:**
- **Persistence** - Avoids re-auth every run (critical for avoiding Telegram's rate limits)
- **No memory overhead** - Doesn't load entire session into RAM
- **Built-in** - @mtcute/node includes `better-sqlite3` dependency already
- **Session strings work** - Can export/import for deployment flexibility

**For incremental sync state** (tracking last exported message IDs):
- Use simple JSON file (`sync-state.json`)
- No need for a database - just a map of `{ chatId: lastMessageId }`
- Load at start, save after each chat export

**What NOT to use:**
- `MemoryStorage` - Requires re-auth every run, triggers Telegram security flags
- External databases (PostgreSQL, etc.) - Overkill for personal CLI tool

**Source:** [mtcute Storage Guide](https://mtcute.dev/guide/topics/storage)

---

### CLI Framework

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `commander` | ^14.0.3 | CLI argument parsing | HIGH |
| `@clack/prompts` | ^1.0.0 | Interactive prompts (auth flow) | MEDIUM |

**Why Commander.js:**
- **Proven** - Most popular Node CLI framework, stable API
- **Simple** - Good enough for a utility with 3-5 commands
- **TypeScript support** - Works with types, though not type-inferred
- **Zero config** - Just works

**For interactive prompts** (phone number, 2FA code):
- `@clack/prompts` provides beautiful, accessible prompts
- Alternative: `inquirer` (heavier) or mtcute's built-in `tg.input()` wrapper

**What NOT to use:**
- `oclif` - Enterprise framework, overkill for personal tool
- `yargs` - More dependencies, type inference issues
- `optique` - Newer, less proven (though type-safe)
- `citty` - UnJS ecosystem lock-in

**Source:** [Commander.js Guide](https://generalistprogrammer.com/tutorials/commander-npm-package-guide), npm registry

---

### Runtime & Build

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Node.js | >=20.x | Runtime (LTS) | HIGH |
| TypeScript | ^5.9.3 | Type safety | HIGH |
| `tsx` | ^4.21.0 | Development runner | HIGH |

**TypeScript Configuration:**

mtcute requires TypeScript 5.0+. Use strict mode.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  }
}
```

**Development workflow:**
- Use `tsx` for development (fast, no build step)
- Compile with `tsc` for distribution if needed
- No bundling required - this is a CLI tool, not a web app

**What NOT to use:**
- `ts-node` - Slower than tsx, more configuration
- `esbuild` direct - tsx wraps it better for CLI dev
- Webpack/Rollup - Overkill, adds complexity

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.3.6 | Config validation | Config file parsing |
| `chalk` | ^5.6.2 | Terminal colors | Status output |
| `ora` | ^9.1.0 | Spinners | Long operations |
| `consola` | ^3.4.2 | Structured logging | Debug/verbose mode |
| `date-fns` | latest | Date formatting | Message timestamps |

**Conditional:**
- `zod` - Only if you need config file validation; skip if using env vars only
- `ora` - Nice for progress indication during large exports
- `consola` - Use if you want log levels; `console.log` is fine for simple tool

---

### Development Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.9.3 | Compiler |
| `tsx` | ^4.21.0 | Dev runner |
| `vitest` | ^4.0.18 | Testing (if needed) |
| `@types/node` | latest | Node.js types |
| `@types/better-sqlite3` | latest | SQLite types (transitive) |

---

## mtcute-Specific Setup Requirements

### 1. API Credentials

Obtain from [my.telegram.org/apps](https://my.telegram.org/apps):
- `API_ID` (number)
- `API_HASH` (string, 32 chars)

**Security:** Store in `.env`, never commit. Cannot be revoked once created.

### 2. Authentication Flow

mtcute supports multiple auth methods:

```typescript
// Interactive (for first run)
const self = await tg.start({
  phone: () => prompts.text({ message: 'Phone number:' }),
  code: () => prompts.text({ message: 'Code:' }),
  password: () => prompts.password({ message: '2FA Password:' })
})

// Session string (for headless/CI)
await tg.start({ session: process.env.TELEGRAM_SESSION })

// Check existing session (skip auth if valid)
try {
  await tg.getMe()
  // Already authenticated
} catch (e) {
  if (e.message === 'AUTH_KEY_UNREGISTERED') {
    // Need to authenticate
  }
}
```

### 3. Session Persistence Patterns

**Option A: SQLite file (recommended)**
```typescript
const tg = new TelegramClient({
  storage: 'telegram.session' // Creates telegram.session SQLite file
})
```

**Option B: Session string (for env-based deployment)**
```typescript
// Export after first auth
const sessionString = await tg.exportSession()
// Save to .env: TELEGRAM_SESSION=<string>

// Import on subsequent runs
await tg.start({ session: process.env.TELEGRAM_SESSION })
```

### 4. Rate Limiting Considerations

**Critical warning:** Telegram actively bans accounts that behave suspiciously.

```typescript
// Add delays between operations
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

for (const chat of chats) {
  await exportChat(chat)
  await sleep(1000) // 1 second between chats
}

// Handle flood waits
try {
  await tg.call({ _: 'messages.getHistory', ... })
} catch (e) {
  if (e.message?.includes('FLOOD_WAIT')) {
    const waitTime = parseInt(e.message.match(/\d+/)?.[0] || '60')
    await sleep(waitTime * 1000)
    // Retry
  }
}
```

**Best practices:**
- Session persistence (avoids repeated logins)
- Delays between API calls (1-2 seconds)
- Respect FLOOD_WAIT errors (wait the specified time + jitter)
- Don't export everything at once (incremental sync)

**Source:** [mtcute FAQ](https://mtcute.dev/guide/intro/faq), [grammY Flood Guide](https://grammy.dev/advanced/flood)

---

## Raw API Access (for DialogFilter)

mtcute wraps most common operations, but folder/filter APIs require raw calls:

```typescript
// Get all folders
const filters = await tg.call({ _: 'messages.getDialogFilters' })

// Get dialogs in a specific folder
const dialogs = await tg.call({
  _: 'messages.getDialogs',
  folder_id: folderId,
  offset_date: 0,
  offset_id: 0,
  offset_peer: { _: 'inputPeerEmpty' },
  limit: 100,
  hash: 0n
})
```

**Source:** [mtcute Raw API Guide](https://mtcute.dev/guide/topics/raw-api), [Telegram API: messages.getDialogs](https://core.telegram.org/method/messages.getDialogs)

---

## Installation

```bash
# Create project
mkdir telegram-exporter && cd telegram-exporter
npm init -y

# Core dependencies
npm install @mtcute/node commander @clack/prompts chalk ora

# Dev dependencies
npm install -D typescript tsx @types/node

# Initialize TypeScript
npx tsc --init
```

**package.json scripts:**
```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

---

## Project Structure (Recommended)

```
telegram-exporter/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── client.ts         # TelegramClient setup
│   ├── auth.ts           # Authentication flow
│   ├── folders.ts        # Folder/DialogFilter operations
│   ├── export.ts         # Message export logic
│   ├── sync-state.ts     # Incremental sync tracking
│   └── markdown.ts       # Markdown formatting
├── data/
│   ├── telegram.session  # SQLite session (gitignored)
│   └── sync-state.json   # Last exported message IDs
├── output/               # Exported markdown files
├── .env                  # API credentials (gitignored)
├── package.json
└── tsconfig.json
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| MTProto client | @mtcute/node | gramjs | Less type-safe, Telethon port |
| MTProto client | @mtcute/node | telegram-mtproto | Abandoned since 2019 |
| CLI framework | commander | oclif | Overkill for simple CLI |
| CLI framework | commander | yargs | More deps, type issues |
| Session storage | SQLite (built-in) | MemoryStorage | Re-auth every run = ban risk |
| Runtime | Node.js | Bun | Bun support exists but Node is more stable |
| Runtime | Node.js | Deno | Possible but Node ecosystem is richer |

---

## Confidence Assessment

| Component | Confidence | Verification Source |
|-----------|------------|---------------------|
| @mtcute/node version | HIGH | npm registry (Jan 2026) |
| TypeScript version | HIGH | npm registry |
| commander version | HIGH | npm registry |
| Storage patterns | HIGH | mtcute official docs |
| Auth flow | HIGH | mtcute official docs |
| Rate limiting | MEDIUM | Community knowledge + mtcute FAQ |
| DialogFilter API | MEDIUM | Telegram core docs (verified exists) |

---

## Sources

### Primary (HIGH confidence)
- [mtcute Official Documentation](https://mtcute.dev/)
- [mtcute Storage Guide](https://mtcute.dev/guide/topics/storage)
- [mtcute Sign-in Guide](https://mtcute.dev/guide/intro/sign-in)
- [mtcute FAQ](https://mtcute.dev/guide/intro/faq)
- [npm @mtcute/node](https://www.npmjs.com/package/@mtcute/node) - version 0.27.8

### Secondary (MEDIUM confidence)
- [Telegram API: messages.getDialogs](https://core.telegram.org/method/messages.getDialogs)
- [Telegram API: dialogFilter](https://core.telegram.org/constructor/dialogFilter)
- [grammY Flood Limits Guide](https://grammy.dev/advanced/flood)

### Ecosystem context
- [TypeScript CLI 2026](https://hackers.pub/@hongminhee/2026/typescript-cli-2026)
- [Commander.js Guide](https://generalistprogrammer.com/tutorials/commander-npm-package-guide)
