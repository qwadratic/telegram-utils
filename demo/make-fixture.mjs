#!/usr/bin/env node
// Build a throwaway workspace for the demo recording.
//
// The demo drives the REAL CLI, but never a real Telegram account: folder and
// chat names here are invented, so nothing recordable can leak. Timestamps are
// generated relative to now so the "last updated" column shows a realistic
// spread every time the demo is re-rendered.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const workspace = process.argv[2] ?? join(process.cwd(), 'demo', 'workspace')

rmSync(workspace, { recursive: true, force: true })
mkdirSync(join(workspace, 'data', 'archive'), { recursive: true })

const now = Date.now()
const agoISO = (minutes) => new Date(now - minutes * 60_000).toISOString()

// id -> [title, [chatId, chatName, lastMessageId, minutesAgo][]]
const folders = [
  [2, 'Engineering', [
    [-1001, 'Backend Guild', 48210, 12],
    [-1002, 'Release Train', 9155, 41],
    [-1003, 'Incident Room', 2204, 190]
  ]],
  [3, 'Design', [
    [-1004, 'Design Crit', 15877, 320],
    [-1005, 'Brand Refresh', 640, 1510]
  ]],
  [4, 'Reading List', [
    [-1006, 'Papers We Love', 3391, 5760]
  ]],
  // Tracked but never exported: the case the listing has to render as "never".
  [5, 'Archive 2025', [
    [-1007, 'Old Standups', 0, null]
  ]]
]

const state = {
  version: 1,
  chats: {},
  recency: {
    recent: { cutoff: null, chats: {} },
    historical: { cutoff: null, chats: {} }
  },
  folders: {}
}

const trackedChatIds = []

for (const [folderId, title, chats] of folders.map(([id, t, c]) => [id, t, c])) {
  state.folders[folderId] = {
    chatIds: chats.map(([chatId]) => chatId),
    lastSyncedAt: agoISO(5),
    title
  }

  for (const [chatId, chatName, lastMessageId, minutesAgo] of chats) {
    trackedChatIds.push(chatId)
    if (minutesAgo === null) continue

    state.chats[chatId] = {
      lastMessageId,
      lastSyncedAt: agoISO(minutesAgo),
      chatName
    }

    const slug = chatName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    writeFileSync(
      join(workspace, 'data', 'archive', `${slug}_${Math.abs(chatId)}.md`),
      [
        '---',
        `chat_name: "${chatName}"`,
        `chat_id: ${chatId}`,
        `message_count: ${lastMessageId}`,
        '---',
        '',
        `[${agoISO(minutesAgo).slice(0, 19).replace('T', ' ')} UTC] Sample Sender: placeholder demo message`,
        ''
      ].join('\n')
    )
  }
}

writeFileSync(join(workspace, 'data', 'archive', 'sync-state.json'), JSON.stringify(state, null, 2))
writeFileSync(
  join(workspace, 'data', 'config.json'),
  JSON.stringify({ trackedFolderIds: folders.map(([id]) => id), trackedChatIds }, null, 2)
)

// Fake credentials, so the demo resolves API config from .env and never reaches
// a real vault. dotenv loads this because the CLI runs with cwd = workspace.
// The demo passes TG_NON_INTERACTIVE per command rather than setting it
// here, so the recording can show both the interactive picker and the
// unattended guard.
writeFileSync(
  join(workspace, '.env'),
  ['API_ID=1234567', 'API_HASH=00000000000000000000000000000000', ''].join('\n')
)

console.log(workspace)
