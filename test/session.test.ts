import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { acquireLock, LockHeldError, LOCK_PATH } from '../src/session/lock.js'
import { folderStatuses, relativeTime } from '../src/folders/status.js'
import { readSecret } from '../src/session/psst.js'
import { updateChatState, updateFolderState, type SyncState } from '../src/sync/state.js'
import { withTempDir } from './helpers.js'

function emptyState(): SyncState {
  return {
    version: 1,
    chats: {},
    recency: { recent: { cutoff: null, chats: {} }, historical: { cutoff: null, chats: {} } },
    folders: {}
  }
}

test('single-instance lock admits one holder and survives release', async () => {
  await withTempDir(async () => {
    const release = acquireLock()
    assert.ok(existsSync(LOCK_PATH), 'lock file should exist while held')
    assert.equal(readFileSync(LOCK_PATH, 'utf-8').trim(), String(process.pid))

    // A second acquire from a *live* pid must be refused. The lock records our
    // own pid, so we simulate a different live process by rewriting the file
    // with a pid that is certainly running: pid 1.
    writeFileSync(LOCK_PATH, '1\n')
    assert.throws(() => acquireLock(), LockHeldError)

    release()
    assert.equal(existsSync(LOCK_PATH), false, 'release should remove the lock file')

    // Releasing twice is a no-op, not a crash.
    release()
  })
})

test('lock reclaims a stale file left by a dead process', async () => {
  await withTempDir(async () => {
    mkdirSync('data', { recursive: true })

    // A pid that has certainly exited: spawn a process and let it finish.
    const deadPid = Number(
      execFileSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf-8' }).trim()
    )
    writeFileSync(LOCK_PATH, `${deadPid}\n`)

    const release = acquireLock()
    assert.equal(readFileSync(LOCK_PATH, 'utf-8').trim(), String(process.pid))
    release()
  })
})

test('lock treats an empty or garbage file as stale', async () => {
  await withTempDir(async () => {
    mkdirSync('data', { recursive: true })
    writeFileSync(LOCK_PATH, '')

    const release = acquireLock()
    assert.equal(readFileSync(LOCK_PATH, 'utf-8').trim(), String(process.pid))
    release()
  })
})

test('folder statuses sort by last update, newest first, never-synced last', () => {
  const state = emptyState()
  updateFolderState(state, 1, [10, 11], 'Work')
  updateFolderState(state, 2, [20], 'Family')
  updateFolderState(state, 3, [30], 'Archive')

  updateChatState(state, 10, 500, 'Standup')
  state.chats[10].lastSyncedAt = '2026-02-01T10:00:00.000Z'
  updateChatState(state, 11, 900, 'Design')
  state.chats[11].lastSyncedAt = '2026-02-03T10:00:00.000Z'
  updateChatState(state, 20, 42, 'Mum')
  state.chats[20].lastSyncedAt = '2026-02-05T10:00:00.000Z'
  // Folder 3's chat was never exported.

  const statuses = folderStatuses(state)
  assert.deepEqual(statuses.map((f) => f.title), ['Family', 'Work', 'Archive'])

  const work = statuses.find((f) => f.title === 'Work')!
  assert.equal(work.chatCount, 2)
  assert.equal(work.syncedChatCount, 2)
  // Folder recency is the newest of its chats, not the oldest or an average.
  assert.equal(work.lastUpdated, '2026-02-03T10:00:00.000Z')
  assert.equal(work.lastMessageId, 900)

  const archive = statuses.find((f) => f.title === 'Archive')!
  assert.equal(archive.lastUpdated, null)
  assert.equal(archive.syncedChatCount, 0)
})

test('folder titles survive a state written before titles existed', () => {
  const state = emptyState()
  // Simulate an old on-disk state: membership but no title.
  state.folders[7] = { chatIds: [70], lastSyncedAt: '2026-01-01T00:00:00.000Z' }

  assert.equal(folderStatuses(state)[0].title, 'folder 7')

  updateFolderState(state, 7, [70], 'Reading')
  assert.equal(folderStatuses(state)[0].title, 'Reading')
  // A later refresh that omits the title must not erase it.
  updateFolderState(state, 7, [70, 71])
  assert.equal(folderStatuses(state)[0].title, 'Reading')
})

test('relativeTime renders coarse buckets and handles never', () => {
  const now = Date.parse('2026-02-05T12:00:00.000Z')
  assert.equal(relativeTime(null, now), 'never')
  assert.equal(relativeTime('2026-02-05T11:59:30.000Z', now), 'just now')
  assert.equal(relativeTime('2026-02-05T11:20:00.000Z', now), '40m ago')
  assert.equal(relativeTime('2026-02-05T07:00:00.000Z', now), '5h ago')
  assert.equal(relativeTime('2026-02-01T12:00:00.000Z', now), '4d ago')
  assert.equal(relativeTime('not-a-date', now), 'unknown')
})

test('readSecret prefers an injected env var and reports absence as null', () => {
  const name = 'SYMBIOTIC_TEST_SECRET_DO_NOT_STORE'
  process.env[name] = '  injected-value  '
  try {
    assert.equal(readSecret(name), 'injected-value', 'env injection should win and be trimmed')
  } finally {
    delete process.env[name]
  }

  // Absent everywhere: no vault entry, and possibly no psst at all. Either way
  // the contract is null rather than a throw, so callers can fall back.
  assert.equal(readSecret('SYMBIOTIC_TEST_SECRET_THAT_IS_NEVER_SET'), null)
})
