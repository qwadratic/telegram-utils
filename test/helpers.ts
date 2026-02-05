import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Message, TelegramClient } from '@mtcute/node'

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
