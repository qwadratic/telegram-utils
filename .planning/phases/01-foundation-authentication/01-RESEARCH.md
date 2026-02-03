# Phase 1: Foundation & Authentication - Research

**Researched:** 2026-02-03
**Domain:** Telegram MTProto authentication, encrypted session storage, TypeScript CLI
**Confidence:** HIGH

## Summary

This phase establishes the foundational CLI tool with Telegram authentication and encrypted session persistence. The core challenge is implementing AUTH-02 (password-encrypted SQLite session) since mtcute's built-in `SqliteStorage` uses plain `better-sqlite3` without encryption. The solution is to use `better-sqlite3-multiple-ciphers`, a drop-in replacement that adds transparent encryption via SQLite3MultipleCiphers.

The authentication flow is well-documented in mtcute: `sendCode()` -> `signIn()` -> optionally `checkPassword()` for 2FA. Session validation uses `getMe()` with error checking for `AUTH_KEY_UNREGISTERED`. Commander.js remains the standard CLI framework for TypeScript projects of this scope.

**Primary recommendation:** Create a custom `EncryptedSqliteStorage` class extending mtcute's `BaseSqliteStorageDriver`, replacing `better-sqlite3` with `better-sqlite3-multiple-ciphers` and using the `key` PRAGMA for encryption.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@mtcute/node` | ^0.27.8 | MTProto client for Node.js | TypeScript-first, actively maintained (Jan 2026), cleaner API than gramjs |
| `better-sqlite3-multiple-ciphers` | ^12.6.2 | Encrypted SQLite | Drop-in replacement for better-sqlite3 with encryption support |
| `commander` | ^14.0.3 | CLI argument parsing | Most popular, stable, TypeScript support |
| `@clack/prompts` | ^1.0.0 | Interactive prompts | Beautiful accessible prompts, handles password masking |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `chalk` | ^5.6.2 | Terminal colors | Status output, error highlighting |
| `dotenv` | ^16.x | Environment variables | Loading API credentials from .env |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `better-sqlite3-multiple-ciphers` | `@journeyapps/sqlcipher` | Less documented, different cipher |
| `commander` | `optique` | Better type inference but newer/less proven |
| `@clack/prompts` | `inquirer` | Heavier, more features than needed |

**Installation:**
```bash
npm install @mtcute/node better-sqlite3-multiple-ciphers commander @clack/prompts chalk dotenv
npm install -D typescript tsx @types/node
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── index.ts          # CLI entry point with Commander.js
├── client.ts         # TelegramClient factory with encrypted storage
├── auth.ts           # Authentication flow (sendCode, signIn, checkPassword)
├── storage/
│   └── encrypted.ts  # EncryptedSqliteStorage implementation
└── utils/
    └── flood-wait.ts # FLOOD_WAIT error handling utilities
data/
├── session.db        # Encrypted SQLite session (gitignored)
└── .gitkeep
.env                  # API_ID, API_HASH (gitignored)
```

### Pattern 1: Custom Encrypted Storage Driver
**What:** Extend mtcute's `BaseSqliteStorageDriver` to use `better-sqlite3-multiple-ciphers` with password encryption
**When to use:** Required for AUTH-02 (encrypted session persistence)
**Example:**
```typescript
// Source: mtcute storage docs + better-sqlite3-multiple-ciphers docs
import { BaseSqliteStorageDriver } from '@mtcute/core'
import Database from 'better-sqlite3-multiple-ciphers'

export class EncryptedSqliteStorage extends BaseSqliteStorageDriver {
  private password: string
  private filename: string

  constructor(filename: string, password: string) {
    super()
    this.filename = filename
    this.password = password
  }

  protected _createDatabase() {
    const db = new Database(this.filename)
    db.pragma(`key='${this.password}'`)
    return db
  }
}
```

### Pattern 2: Authentication State Machine
**What:** Check existing session validity before prompting for credentials
**When to use:** Every CLI run
**Example:**
```typescript
// Source: mtcute sign-in guide
async function ensureAuthenticated(tg: TelegramClient, password: string): Promise<User> {
  // Check if already authenticated
  try {
    return await tg.getMe()
  } catch (e) {
    if (!tl.RpcError.is(e, 'AUTH_KEY_UNREGISTERED')) {
      throw e
    }
  }

  // Need to authenticate
  const phone = await text({ message: 'Phone number:' })
  if (isCancel(phone)) process.exit(0)

  const sentCode = await tg.sendCode({ phone })

  const code = await text({ message: 'Enter code:' })
  if (isCancel(code)) process.exit(0)

  try {
    return await tg.signIn({
      phone,
      phoneCodeHash: sentCode.phoneCodeHash,
      phoneCode: code
    })
  } catch (e) {
    if (tl.RpcError.is(e, 'SESSION_PASSWORD_NEEDED')) {
      const twoFaPassword = await password({ message: '2FA Password:' })
      if (isCancel(twoFaPassword)) process.exit(0)
      return await tg.checkPassword(twoFaPassword)
    }
    throw e
  }
}
```

### Pattern 3: Commander.js Subcommand Structure
**What:** Organize CLI with main command and future subcommands
**When to use:** CLI entry point setup
**Example:**
```typescript
// Source: Commander.js docs
import { Command } from 'commander'

const program = new Command()
  .name('symbiotic-chats')
  .description('Export Telegram chat history to Markdown')
  .version('0.1.0')

program
  .command('auth')
  .description('Authenticate with Telegram')
  .action(async () => {
    // Auth flow
  })

program
  .command('export')
  .description('Export chats from tracked folders')
  .action(async () => {
    // Export flow (Phase 3)
  })

program.parse()
```

### Anti-Patterns to Avoid
- **Storing password in code/config:** Always prompt for session password at runtime
- **Using MemoryStorage:** Requires re-auth every run, triggers Telegram security flags
- **Ignoring cancellation:** Always check `isCancel()` on prompts and exit gracefully
- **Hardcoding API credentials:** Use .env file, never commit

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session encryption | Custom encryption wrapper | `better-sqlite3-multiple-ciphers` | Battle-tested SQLite3MultipleCiphers, handles all edge cases |
| Password prompts | `readline` with masking | `@clack/prompts` password() | Handles terminal state, masking, cancellation |
| FLOOD_WAIT parsing | Regex on error message | `tl.RpcError.is(e, 'FLOOD_WAIT_%d')` + `.seconds` | mtcute parses this automatically |
| CLI parsing | Manual process.argv | `commander` | Handles help, validation, subcommands |
| Phone number normalization | Manual regex cleanup | mtcute `sendCode()` | Normalizes automatically |

**Key insight:** mtcute already handles most MTProto complexity (DC migration, retries, session management). The only custom code needed is the encrypted storage driver wrapper.

## Common Pitfalls

### Pitfall 1: Verification Codes Expiring When Shared
**What goes wrong:** Sharing verification codes via any Telegram chat immediately invalidates them
**Why it happens:** Telegram monitors outgoing messages for verification codes and revokes them if detected
**How to avoid:** Document for users: never share codes via Telegram, never log codes to cloud-synced files
**Warning signs:** Auth fails despite correct code entry, "code expired" on fresh codes

### Pitfall 2: Session Password Stored Insecurely
**What goes wrong:** Password stored in config file, env var, or command line argument
**Why it happens:** Developer convenience over security
**How to avoid:** Always prompt for password at runtime using `password()` prompt with masking
**Warning signs:** Password visible in shell history, config files, or logs

### Pitfall 3: Not Handling 2FA Flow
**What goes wrong:** App crashes when user has 2FA enabled
**Why it happens:** `signIn()` throws `SESSION_PASSWORD_NEEDED` which is not caught
**How to avoid:** Always catch `SESSION_PASSWORD_NEEDED` and prompt for 2FA password, then call `checkPassword()`
**Warning signs:** Crash during auth for accounts with 2FA

### Pitfall 4: Aggressive Requests After Fresh Auth
**What goes wrong:** New sessions are under heightened scrutiny; rapid API calls trigger bans
**Why it happens:** Telegram's anti-spam systems treat new sessions as high-risk
**How to avoid:** Don't start bulk operations immediately after login; add warm-up delay
**Warning signs:** FLOOD_WAIT errors with short durations immediately after auth

### Pitfall 5: FLOOD_WAIT Ignored or Miscalculated
**What goes wrong:** Making requests during flood wait period escalates restrictions
**Why it happens:** Using artificial delays instead of respecting actual FLOOD_WAIT duration
**How to avoid:** Configure `floodWaitThreshold` for auto-handling; manually handle larger waits with `e.seconds`
**Warning signs:** FLOOD_WAIT durations increasing, transport error -429

## Code Examples

Verified patterns from official sources:

### TelegramClient Initialization with Encrypted Storage
```typescript
// Source: mtcute docs + better-sqlite3-multiple-ciphers docs
import { TelegramClient } from '@mtcute/node'
import { EncryptedSqliteStorage } from './storage/encrypted'

export function createClient(sessionPassword: string): TelegramClient {
  return new TelegramClient({
    apiId: parseInt(process.env.API_ID!),
    apiHash: process.env.API_HASH!,
    storage: new EncryptedSqliteStorage('data/session.db', sessionPassword),

    // Auto-handle flood waits up to 60 seconds
    floodWaitThreshold: 60,
  })
}
```

### FLOOD_WAIT Error Handling (SAFE-01)
```typescript
// Source: mtcute error handling docs
import { tl } from '@mtcute/node'

async function withFloodWaitHandling<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if (tl.RpcError.is(e, 'FLOOD_WAIT_%d')) {
        const waitSeconds = e.seconds
        console.log(`Flood wait: waiting ${waitSeconds} seconds...`)
        await new Promise(r => setTimeout(r, (waitSeconds + 1) * 1000))
        continue
      }
      throw e
    }
  }
  throw new Error('Max retries exceeded')
}
```

### Session Validation Check
```typescript
// Source: mtcute sign-in guide
import { TelegramClient, tl, User } from '@mtcute/node'

async function checkSession(tg: TelegramClient): Promise<User | null> {
  try {
    return await tg.getMe()
  } catch (e) {
    if (tl.RpcError.is(e, 'AUTH_KEY_UNREGISTERED')) {
      return null // Not authenticated
    }
    throw e // Other error
  }
}
```

### Interactive Auth Prompts with Cancellation
```typescript
// Source: @clack/prompts docs
import { text, password, isCancel } from '@clack/prompts'

async function promptPhone(): Promise<string> {
  const phone = await text({
    message: 'Enter your phone number (with country code):',
    placeholder: '+1234567890'
  })

  if (isCancel(phone)) {
    console.log('Authentication cancelled')
    process.exit(0)
  }

  return phone
}

async function promptCode(): Promise<string> {
  const code = await text({
    message: 'Enter the verification code:'
  })

  if (isCancel(code)) {
    console.log('Authentication cancelled')
    process.exit(0)
  }

  return code
}

async function prompt2FA(): Promise<string> {
  const pass = await password({
    message: 'Enter your 2FA password:'
  })

  if (isCancel(pass)) {
    console.log('Authentication cancelled')
    process.exit(0)
  }

  return pass
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gramjs (Telethon port) | mtcute | 2023+ | TypeScript-first, cleaner API |
| `ts-node` for dev | `tsx` | 2024+ | Faster, simpler configuration |
| MemoryStorage for dev | SQLite always | Current | Avoids re-auth, reduces ban risk |
| Manual flood wait parsing | `tl.RpcError.is()` + `.seconds` | mtcute 0.20+ | Type-safe error handling |

**Deprecated/outdated:**
- `telegram-mtproto`: Abandoned since 2019
- `ts-node`: Use `tsx` instead (faster, less config)
- `inquirer@legacy`: Use `@clack/prompts` (modern, simpler)

## Open Questions

Things that couldn't be fully resolved:

1. **ISqliteDatabase Interface Exact Methods**
   - What we know: mtcute's `BaseSqliteStorageDriver` expects `ISqliteDatabase` interface
   - What's unclear: Exact method signatures required (prepare, exec, etc.)
   - Recommendation: Test with `better-sqlite3-multiple-ciphers` which is API-compatible with `better-sqlite3`; if issues arise, inspect mtcute source

2. **Password Derivation for Encryption**
   - What we know: `better-sqlite3-multiple-ciphers` accepts raw password via `key` pragma
   - What's unclear: Whether key derivation (PBKDF2) is automatic or manual
   - Recommendation: SQLite3MultipleCiphers handles key derivation internally; raw password is sufficient

3. **Session Migration on Password Change**
   - What we know: `rekey` pragma can change encryption password
   - What's unclear: How to handle user wanting to change session password
   - Recommendation: Defer to v2 (AUTV2-01); for v1, password is set once at creation

## Sources

### Primary (HIGH confidence)
- [mtcute Sign-in Guide](https://mtcute.dev/guide/intro/sign-in.html) - Authentication flow
- [mtcute Storage Guide](https://mtcute.dev/guide/topics/storage.html) - Storage patterns
- [mtcute Error Handling](https://mtcute.dev/guide/intro/errors.html) - FLOOD_WAIT handling
- [better-sqlite3-multiple-ciphers GitHub](https://github.com/m4heshd/better-sqlite3-multiple-ciphers) - Encryption API
- [Commander.js GitHub](https://github.com/tj/commander.js) - CLI framework
- [Clack Documentation](https://bomb.sh/docs/clack/basics/getting-started/) - Interactive prompts

### Secondary (MEDIUM confidence)
- [mtcute BaseSqliteStorageDriver API](https://ref.mtcute.dev/classes/_mtcute_core.index.BaseSqliteStorageDriver) - Custom storage implementation
- [Building TypeScript CLI in 2026](https://hackers.pub/@hongminhee/2026/typescript-cli-2026) - Current best practices

### Tertiary (LOW confidence)
- SQLite encryption ecosystem research via WebSearch - General patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified via npm registry and official docs
- Architecture: HIGH - mtcute patterns well-documented
- Pitfalls: HIGH - verified via mtcute FAQ and Telegram API docs
- Encryption integration: MEDIUM - `better-sqlite3-multiple-ciphers` is API-compatible but untested with mtcute

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable domain)
