import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import assert from 'node:assert'
import type { Message, TelegramClient } from '@mtcute/node'

const GOLDEN_DIR = fileURLToPath(new URL('./golden/', import.meta.url))

// The mkdtemp root differs per platform and per run, and on macOS /var is a
// symlink to /private/var, so both spellings can reach the rendered text.
const TMP_ROOTS = [...new Set([tmpdir(), realpathSync(tmpdir())])]
  .map((root) => root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')

/**
 * Erase the only three volatiles a golden is allowed to contain: the
 * `exported_at` stamp, the per-run temp directory, and the pid.
 *
 * Everything else in a golden is a frozen literal, and a frozen literal IS
 * the assertion. Normalization belongs here, in the render path - never in
 * the comparison, which stays a byte-for-byte string equality.
 */
export function normalizeVolatiles(text: string): string {
  return text
    .replace(/(exported_at: )"[^"]*"/g, '$1"<EXPORTED_AT>"')
    .replace(new RegExp(`(${TMP_ROOTS})[^\\s"']*`, 'g'), '<TMPDIR>')
    .replace(/\bpid \d+/g, 'pid <PID>')
}

/**
 * Compare rendered output against a frozen golden file.
 *
 * A missing golden is written once, announced loudly, and passes - that is a
 * bootstrap, not a verification, and the banner says so. A golden that exists
 * and differs FAILS and is never rewritten: an eval that repairs its own
 * expectation asserts nothing. Moving a golden is a deliberate, reviewed edit.
 */
export function assertGolden(name: string, actual: string): void {
  const path = join(GOLDEN_DIR, `${name}.txt`)
  const rendered = normalizeVolatiles(actual)

  if (!existsSync(path)) {
    mkdirSync(GOLDEN_DIR, { recursive: true })
    writeFileSync(path, rendered, 'utf-8')
    process.stderr.write(
      `\n${'!'.repeat(78)}\n` +
      `BOOTSTRAPPED GOLDEN: ${name}\n` +
      `  wrote ${path}\n` +
      `  NOTHING WAS VERIFIED. This run only froze current behaviour.\n` +
      `  Read the file by eye before committing it.\n` +
      `${'!'.repeat(78)}\n\n`
    )
    return
  }

  assert.equal(
    rendered,
    readFileSync(path, 'utf-8'),
    `golden ${name} differs. Goldens are never auto-updated: either the code ` +
    `regressed, or the change is intended and test/golden/${name}.txt must be ` +
    `moved by hand in the same commit.`
  )
}

type MockPeer = { displayName: string }

export function makeMessage(params: {
  id: number
  date: Date
  senderName?: string
  username?: string | null
  text?: string
  forwardName?: string
  replyToId?: number
  replyQuote?: string
}): Message {
  const sender = {
    firstName: params.senderName ?? 'Test',
    lastName: '',
    username: params.username ?? 'tester'
  }

  const forward = params.forwardName
    ? { sender: { displayName: params.forwardName } }
    : undefined

  const replyToMessage = params.replyToId !== undefined
    ? { id: params.replyToId, quoteText: params.replyQuote }
    : undefined

  return {
    id: params.id,
    date: params.date,
    sender,
    forward,
    replyToMessage,
    text: params.text ?? 'Hello'
  } as unknown as Message
}

export function makeMockClient(messagesByChatId: Record<number, Message[]>): TelegramClient {
  const client = {
    async *iterHistory(chatId: number, options?: { minId?: number }) {
      const messages = messagesByChatId[chatId] ?? []
      const minId = options?.minId ?? 0
      for (const msg of messages) {
        if (msg.id > minId) {
          yield msg
        }
      }
    },
    async getPeer(chatId: number): Promise<MockPeer> {
      return { displayName: `Chat ${chatId}` }
    }
  }

  return client as unknown as TelegramClient
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const originalCwd = process.cwd()
  const tempDir = mkdtempSync(join(tmpdir(), 'symbiotic-chats-'))
  process.chdir(tempDir)

  try {
    return await fn(tempDir)
  } finally {
    process.chdir(originalCwd)
    rmSync(tempDir, { recursive: true, force: true })
  }
}
