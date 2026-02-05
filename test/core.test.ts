import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { formatMessage } from '../src/messages/format.js'
import { exportRecencyChats } from '../src/messages/recency.js'
import { sanitizeFilename } from '../src/utils/filename.js'
import { loadConfig } from '../src/config/index.js'
import { makeMessage, makeMockClient, withTempDir } from './helpers.js'

test('formatMessage includes forward and reply context', () => {
  const message = makeMessage({
    id: 10,
    date: new Date(Date.UTC(2025, 0, 2, 3, 4, 5)),
    forwardName: 'Forward Source',
    replyToId: 9,
    replyQuote: 'Quoted reply',
    text: 'Body'
  })

  const formatted = formatMessage(message)
  assert.ok(formatted.includes('Forwarded from: Forward Source'))
  assert.ok(formatted.includes('In reply to [id:9]: "Quoted reply"'))
  assert.ok(formatted.includes('Body'))
})

test('sanitizeFilename removes invalid chars and falls back', () => {
  assert.equal(sanitizeFilename('A/B:C*D?'), 'ABCD')
  assert.equal(sanitizeFilename('   ', 123), 'chat-123')
})

test('exportRecencyChats writes combined archive with cutoff', async () => {
  await withTempDir(async () => {
    const client = makeMockClient({
      1: [
        makeMessage({ id: 1, date: new Date(Date.UTC(2025, 0, 1, 0, 0, 0)) }),
        makeMessage({ id: 2, date: new Date(Date.UTC(2025, 0, 3, 0, 0, 0)) }),
      ]
    })

    const result = await exportRecencyChats(
      client,
      { trackedFolderIds: [1], trackedChatIds: [1] },
      new Date(Date.UTC(2025, 0, 2, 0, 0, 0)),
      'recent',
      '2025-01-02'
    )

    const content = readFileSync(result.outputPath, 'utf-8')
    assert.ok(content.includes('export_kind: "recent"'))
    assert.ok(content.includes('cutoff_date: "2025-01-02"'))
    assert.ok(content.includes('Chat 1 (1)'))
    assert.ok(content.includes('[2025-01-03 00:00:00 UTC]'))
    assert.ok(!content.includes('[2025-01-01 00:00:00 UTC]'))
  })
})

test('exportRecencyChats writes historical archive with cutoff', async () => {
  await withTempDir(async () => {
    const client = makeMockClient({
      1: [
        makeMessage({ id: 1, date: new Date(Date.UTC(2025, 0, 1, 0, 0, 0)) }),
        makeMessage({ id: 2, date: new Date(Date.UTC(2025, 0, 3, 0, 0, 0)) }),
      ]
    })

    const result = await exportRecencyChats(
      client,
      { trackedFolderIds: [1], trackedChatIds: [1] },
      new Date(Date.UTC(2025, 0, 2, 0, 0, 0)),
      'historical',
      '2025-01-02'
    )

    const content = readFileSync(result.outputPath, 'utf-8')
    assert.ok(content.includes('export_kind: "historical"'))
    assert.ok(content.includes('cutoff_date: "2025-01-02"'))
    assert.ok(content.includes('Chat 1 (1)'))
    assert.ok(content.includes('[2025-01-01 00:00:00 UTC]'))
    assert.ok(!content.includes('[2025-01-03 00:00:00 UTC]'))
  })
})

test('loadConfig migrates legacy trackedFolders format', async () => {
  await withTempDir(async () => {
    const configDir = join('data')
    mkdirSync(configDir, { recursive: true })
    const configPath = join(configDir, 'config.json')
    writeFileSync(
      configPath,
      JSON.stringify({ trackedFolders: { 1: [10, 20], 2: [30] } }, null, 2)
    )
    const config = loadConfig()
    assert.deepEqual(config.trackedFolderIds.sort(), [1, 2])
    assert.deepEqual(config.trackedChatIds.sort(), [10, 20, 30])
  })
})
