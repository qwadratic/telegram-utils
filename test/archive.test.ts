import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { formatMessage } from '../src/messages/format.js'
import { appendToChatFile } from '../src/sync/append.js'
import { syncChats } from '../src/sync/index.js'
import { makeMessage, makeMockClient, withTempDir } from './helpers.js'

test('archive behaviors with mock data', async () => {
  await withTempDir(async () => {
    // UTC formatting
    const message = makeMessage({
      id: 1,
      date: new Date(Date.UTC(2025, 0, 2, 3, 4, 5)),
      text: 'UTC test'
    })
    const formatted = formatMessage(message)
    assert.ok(formatted.includes('[2025-01-02 03:04:05 UTC]'))

    // append creates missing file and upserts frontmatter fields
    const chatId = 101
    const messages = [
      makeMessage({ id: 10, date: new Date(Date.UTC(2025, 0, 1, 0, 0, 0)) }),
      makeMessage({ id: 11, date: new Date(Date.UTC(2025, 0, 2, 0, 0, 0)) })
    ]
    const appendResult = appendToChatFile('Mock Chat', chatId, messages)
    assert.equal(appendResult.fileCreated, true)

    const archivePath = join('data', 'archive', 'Mock Chat.md')
    assert.ok(existsSync(archivePath))

    // frontmatter upsert on legacy file without message_count/min/max
    const legacyPath = join('data', 'archive', 'Legacy Chat.md')
    mkdirSync(join('data', 'archive'), { recursive: true })
    writeFileSync(
      legacyPath,
      `---
chat_name: "Legacy Chat"
chat_id: 202
first_message_id: 1
last_message_id: 2
exported_at: "2025-01-01T00:00:00.000Z"
---

Legacy body.\n`,
      'utf-8'
    )
    appendToChatFile('Legacy Chat', 202, [
      makeMessage({ id: 3, date: new Date(Date.UTC(2025, 0, 3, 0, 0, 0)) })
    ])
    const legacyContent = readFileSync(legacyPath, 'utf-8')
    assert.ok(/message_count:\s+/.test(legacyContent))
    assert.ok(/min_date:\s+/.test(legacyContent))
    assert.ok(/max_date:\s+/.test(legacyContent))

    // empty chat creates file on first sync
    const mockClient = makeMockClient({
      300: []
    })
    await syncChats(mockClient, {
      trackedFolderIds: [1],
      trackedChatIds: [300]
    })
    const emptyChatPath = join('data', 'archive', 'Chat 300.md')
    assert.ok(existsSync(emptyChatPath))
    const emptyContent = readFileSync(emptyChatPath, 'utf-8')
    assert.ok(emptyContent.includes('No messages.'))

    // non-empty chat writes full body content
    await syncChats(makeMockClient({
      400: [
        makeMessage({ id: 1, date: new Date(Date.UTC(2025, 0, 1, 0, 0, 0)), text: 'First' }),
        makeMessage({ id: 2, date: new Date(Date.UTC(2025, 0, 2, 0, 0, 0)), text: 'Second' })
      ]
    }), {
      trackedFolderIds: [1],
      trackedChatIds: [400]
    })
    const filledChatPath = join('data', 'archive', 'Chat 400.md')
    const filledContent = readFileSync(filledChatPath, 'utf-8')
    assert.ok(filledContent.includes('First'))
    assert.ok(filledContent.includes('Second'))
  })
})
