# Domain Pitfalls: Telegram Userbot Chat Export

**Domain:** Telegram userbot / MTProto API client for chat history export
**Researched:** 2026-02-03
**Primary concern:** Account ban prevention for read-only operations

---

## Critical Pitfalls

Mistakes that cause account bans or permanent restrictions.

### Pitfall 1: Ignoring or Mishandling FLOOD_WAIT Errors

**What goes wrong:** Making requests during a flood wait period, or not respecting the wait duration, triggers progressively longer restrictions and can escalate to account bans.

**Why it happens:** Developers either:
- Don't implement flood wait handling at all
- Add artificial delays instead of respecting actual FLOOD_WAIT responses
- Continue making other requests while one is flood-waited (concurrent request issue)

**Consequences:**
- Temporary restrictions escalate to longer periods
- Transport error -429 indicates severe rate limiting
- Eventual account deactivation (`USER_DEACTIVATED_BAN`)

**Prevention:**
```typescript
// mtcute handles small flood waits automatically via floodWaitThreshold
// For manual handling:
try {
  await client.getHistory(peer, { limit: 100 });
} catch (e) {
  if (tl.RpcError.is(e, 'FLOOD_WAIT_%d')) {
    const waitSeconds = e.seconds;
    console.log(`Flood wait: ${waitSeconds}s`);
    await sleep(waitSeconds * 1000);
    // Retry after waiting
  }
}
```

**Detection:**
- Flood wait responses with increasing durations
- Transport error -429 (report to mtcute maintainers if encountered)

**Phase mapping:** Phase 1 (Core Infrastructure) - implement from day one

**Confidence:** HIGH - verified via [official Telegram error docs](https://core.telegram.org/api/errors), [mtcute error handling](https://mtcute.dev/guide/intro/errors)

---

### Pitfall 2: Aggressive Request Patterns on New Accounts/Sessions

**What goes wrong:** New accounts or new sessions are under heightened scrutiny. Rapid API calls immediately after authentication trigger automated ban systems.

**Why it happens:** Telegram's anti-spam systems treat new accounts as high-risk. Actions that are safe on established accounts trigger bans on new ones.

**Consequences:**
- Immediate temporary restriction
- Potential permanent ban for the phone number
- Session invalidation

**Prevention:**
1. **Warm-up period:** Don't start bulk operations immediately after login
2. **Gradual activity:** Start with low request rates, increase slowly
3. **Avoid VOIP numbers:** These are pre-flagged as suspicious
4. **Human-like patterns:** Vary delays slightly, don't use perfectly regular intervals

```typescript
// Add jitter to delays
const baseDelay = 1000; // 1 second
const jitter = Math.random() * 500; // 0-500ms random
await sleep(baseDelay + jitter);
```

**Detection:**
- `AUTH_KEY_DUPLICATED` errors (406) - session issues
- Rapid succession of FLOOD_WAIT errors with short operations

**Phase mapping:** Phase 1 (Authentication) - design conservative defaults

**Confidence:** HIGH - verified via [multiple sources](https://nexarhq.com/blog/why-telegram-accounts-get-banned-and-how-to-avoid-it/)

---

### Pitfall 3: Violating Telegram API Terms of Service

**What goes wrong:** Building features that explicitly violate ToS leads to API access revocation and account bans.

**Why it happens:** Developers don't read the [Telegram API Terms](https://core.telegram.org/api/terms) or assume "read-only" means safe.

**Consequences:**
- 10-day warning, then API access revoked
- App removed from stores if applicable
- Account deactivation

**Explicitly forbidden (even for read-only tools):**
- Making actions without user's knowledge/consent
- Using data for AI/ML training
- Disabling self-destructing message functionality
- Interfering with last seen/online status
- Using "Telegram" in app name without "Unofficial" prefix

**Prevention:**
1. **User consent:** Make the tool's purpose clear
2. **No hidden functionality:** Export exactly what user requests
3. **Respect ephemeral content:** Don't persist self-destructing messages
4. **Transparent branding:** If distributed, mark as "Unofficial"

**Detection:** N/A - ToS violations result in warnings from Telegram

**Phase mapping:** Phase 0 (Design) - architectural decisions

**Confidence:** HIGH - verified via [official ToS](https://core.telegram.org/api/terms)

---

### Pitfall 4: Opening Too Many Chats Simultaneously

**What goes wrong:** Using `openChat()` on many channels triggers server-side limits and transport errors.

**Why it happens:** For proper update delivery on channels you're not a member of, mtcute needs to "open" them. Developers open all target chats at once.

**Consequences:**
- Transport errors
- Potential account ban
- Connection instability

**Prevention:**
```typescript
// BAD: Opening many chats at once
for (const chat of chats) {
  await client.openChat(chat); // DON'T DO THIS
}

// GOOD: For chat export, you likely don't need openChat at all
// getHistory works without it. Only use openChat for real-time updates.

// If you must use openChat, limit to 5-10 max:
const MAX_OPEN_CHATS = 5;
```

**Detection:**
- Transport errors during multi-chat operations
- Inconsistent update delivery

**Phase mapping:** Phase 2 (Export Logic) - ensure openChat not misused for history export

**Confidence:** HIGH - verified via [mtcute docs](https://mtcute.dev/guide/intro/updates)

---

## Moderate Pitfalls

Mistakes that cause delays, degraded functionality, or technical debt.

### Pitfall 5: PEER_ID_INVALID / Access Hash Issues

**What goes wrong:** Attempting to access chats or users the session hasn't "met" results in `PEER_ID_INVALID` or `MtPeerNotFoundError`.

**Why it happens:** MTProto requires an "access hash" to interact with peers. This hash is only obtained when the client encounters the peer through normal means (dialogs, search, messages).

**Prevention:**
```typescript
// Before accessing a peer by ID, ensure it's resolved:

// Option 1: Use username if available
const chat = await client.resolvePeer('@username');

// Option 2: Iterate through dialogs first to populate cache
for await (const dialog of client.iterDialogs()) {
  // This populates the peer cache
}

// Option 3: Check if peer is available
if (await client.isPeerAvailable(peerId)) {
  // Safe to use
}
```

**Detection:**
- `MtPeerNotFoundError` exceptions
- `PEER_ID_INVALID` RPC errors

**Phase mapping:** Phase 2 (Chat Resolution) - implement proper peer discovery

**Confidence:** HIGH - verified via [mtcute FAQ](https://mtcute.dev/guide/intro/faq), [Telegram peer docs](https://core.telegram.org/api/peers)

---

### Pitfall 6: Misunderstanding getHistory Pagination Limits

**What goes wrong:** Expecting to fetch thousands of messages in one call. The API always returns max ~100 messages per request regardless of `limit` parameter.

**Why it happens:** Developers set `limit: 10000` and expect 10000 messages.

**Consequences:**
- Incomplete exports
- Confusion about "missing" messages
- Unnecessary flood wait risks from retry logic

**Prevention:**
```typescript
// Correct pagination pattern:
let messages: Message[] = [];
let offsetId = 0;

while (true) {
  const batch = await client.getHistory(chat, {
    limit: 100,  // Max effective limit
    offsetId: offsetId,
  });

  if (batch.length === 0) break;

  messages.push(...batch);
  offsetId = batch[batch.length - 1].id;

  await sleep(1000); // Rate limit protection
}
```

**Detection:**
- Export contains fewer messages than expected
- Same messages returned repeatedly

**Phase mapping:** Phase 2 (Export Logic) - implement proper pagination from start

**Confidence:** HIGH - verified via [Telegram pagination docs](https://core.telegram.org/api/offsets)

---

### Pitfall 7: Not Persisting Sessions (Project-Specific)

**What goes wrong:** Re-authenticating for every export triggers repeated login flows, which Telegram monitors as suspicious.

**Why it happens:** Project explicitly states "NOT persisting sessions" - but this has trade-offs.

**Consequences:**
- Repeated auth codes requested (annoying for user)
- New session each time = "new account behavior" scrutiny
- Potential rate limits on auth.sendCode

**Mitigation (since no persistence):**
1. **Single session per export run:** Don't create multiple sessions
2. **Complete export in one session:** Avoid partial exports requiring re-auth
3. **Consider temporary session persistence:** Store session in memory during run, clear on exit
4. **Inform user:** Explain why auth is needed each time

**Detection:**
- Users report frequent 2FA prompts
- `AUTH_KEY_DUPLICATED` errors

**Phase mapping:** Phase 1 (Authentication) - design session lifecycle carefully

**Confidence:** MEDIUM - inferred from session behavior patterns

---

### Pitfall 8: Ignoring DC Migration Requirements

**What goes wrong:** Users in different data centers (DCs) experience slow operations or failures when the client doesn't handle DC migration.

**Why it happens:** Telegram distributes users across 5 DCs. Some operations require redirecting to the user's DC.

**Consequences:**
- Slow file downloads
- Failed media exports
- 303 SEE_OTHER errors

**Prevention:**
```typescript
// mtcute handles DC migration automatically for most cases
// But be aware of potential latency when:
// - Downloading files from channels in different DCs
// - Accessing supergroups created by users in different DCs

// The library will return appropriate errors if migration fails
```

**Detection:**
- 303 errors (PHONE_MIGRATE_X, FILE_MIGRATE_X, etc.)
- Significantly slower operations for some chats

**Phase mapping:** Phase 3 (Media Export) - handle gracefully

**Confidence:** MEDIUM - verified via [Telegram error docs](https://core.telegram.org/api/errors)

---

## Minor Pitfalls

Mistakes that cause annoyance but are recoverable.

### Pitfall 9: Incorrect Message Grouping for Albums

**What goes wrong:** Album messages (multiple photos/videos sent together) arrive as separate messages. Without grouping, exports show them incorrectly.

**Why it happens:** Telegram sends albums as individual messages server-side. Grouping requires waiting for potential additional messages.

**Prevention:**
```typescript
// For export purposes, group by groupedId:
const messages = await client.getHistory(chat, { limit: 100 });

// Messages with same groupedId belong to same album
const albums = new Map<bigint, Message[]>();
for (const msg of messages) {
  if (msg.groupedId) {
    const group = albums.get(msg.groupedId) || [];
    group.push(msg);
    albums.set(msg.groupedId, group);
  }
}
```

**Detection:**
- Exports show albums as separate items
- Media seems duplicated or out of order

**Phase mapping:** Phase 2 (Export Logic) - handle in message processing

**Confidence:** HIGH - verified via [mtcute updates docs](https://mtcute.dev/guide/intro/updates)

---

### Pitfall 10: Memory Issues with Large Files

**What goes wrong:** Using `downloadAsBuffer` for large files causes memory exhaustion.

**Why it happens:** The method loads entire file into memory.

**Prevention:**
```typescript
// For large files, use streaming:
await client.downloadToFile(file, '/path/to/output.mp4');

// Or implement streaming manually for custom handling
// Avoid downloadAsBuffer for files > ~50MB
```

**Detection:**
- Node.js memory errors
- Process crashes during large media export

**Phase mapping:** Phase 3 (Media Export) - implement streaming from start

**Confidence:** HIGH - verified via [mtcute docs](https://mtcute.dev/guide/intro/faq)

---

### Pitfall 11: Verification Codes Expiring When Shared

**What goes wrong:** Sharing verification codes (even for debugging) immediately invalidates them.

**Why it happens:** Telegram monitors outgoing messages for verification codes and revokes them if detected.

**Prevention:**
- Don't share codes via any Telegram chat
- Don't log codes to files that might sync to cloud
- If debugging, scramble the code (e.g., "one two three four five" instead of "12345")

**Detection:**
- Auth fails despite correct code entry
- "Code expired" errors on fresh codes

**Phase mapping:** Phase 1 (Authentication) - document for users

**Confidence:** HIGH - verified via [mtcute FAQ](https://mtcute.dev/guide/intro/faq)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Authentication | Session warmup, code handling | Conservative delays, single session |
| Chat Resolution | PEER_ID_INVALID | Iterate dialogs first, use usernames |
| Message Export | Pagination limits, flood waits | 100 msg batches, respect waits, add delays |
| Media Export | Memory issues, DC migration | Stream large files, handle 303 errors |
| Error Handling | Ignoring flood waits | Implement from day one, use floodWaitThreshold |

---

## Rate Limiting Guidelines

Based on research, these are safe patterns for chat export:

| Operation | Safe Rate | Notes |
|-----------|-----------|-------|
| messages.getHistory | 1 request/second | With 100 message batches |
| File download | Built-in limits | ~2MB/s even for premium |
| resolvePeer | Cache results | Don't resolve same peer repeatedly |
| Overall | 30 requests/second max | Theoretical limit, stay well under |

**Recommended conservative pattern:**
```typescript
const DELAY_BETWEEN_BATCHES = 1500; // 1.5 seconds
const BATCH_SIZE = 100;
const JITTER_MAX = 500; // Random 0-500ms

async function safeDelay() {
  const jitter = Math.random() * JITTER_MAX;
  await sleep(DELAY_BETWEEN_BATCHES + jitter);
}
```

---

## mtcute-Specific Configuration

```typescript
const client = new TelegramClient({
  apiId: API_ID,
  apiHash: API_HASH,

  // Flood wait handling
  floodWaitThreshold: 60, // Auto-wait up to 60 seconds

  // Error reporting (optional, helps library)
  enableErrorReporting: true,

  // Logging for debugging
  logLevel: process.env.DEBUG ? 5 : 2,
});

// Handle errors globally
client.onError.add((error, connection) => {
  if (tl.RpcError.is(error, 'USER_DEACTIVATED_BAN')) {
    console.error('Account has been banned');
    process.exit(1);
  }
});
```

---

## Sources

### HIGH Confidence (Official Documentation)
- [Telegram API Terms of Service](https://core.telegram.org/api/terms)
- [Telegram Error Handling](https://core.telegram.org/api/errors)
- [Telegram Pagination](https://core.telegram.org/api/offsets)
- [Telegram Peer Database](https://core.telegram.org/api/peers)
- [mtcute FAQ](https://mtcute.dev/guide/intro/faq)
- [mtcute Error Handling](https://mtcute.dev/guide/intro/errors)
- [mtcute Updates/openChat](https://mtcute.dev/guide/intro/updates)

### MEDIUM Confidence (Verified Community Sources)
- [grammY Flood Limits](https://grammy.dev/advanced/flood)
- [MadelineProto Flood Wait Guide](https://docs.madelineproto.xyz/docs/FLOOD_WAIT.html)
- [python-telegram-bot Flood Limits Wiki](https://github.com/python-telegram-bot/python-telegram-bot/wiki/Avoiding-flood-limits)

### LOW Confidence (General Community)
- Various blog posts on Telegram bans (patterns consistent across sources)
- GitHub issues discussing rate limits (specific numbers may vary)
