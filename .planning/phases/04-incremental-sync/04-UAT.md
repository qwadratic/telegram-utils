---
status: diagnosed
phase: 04-incremental-sync
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md
started: 2026-02-03T13:55:00Z
updated: 2026-02-03T14:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. First Sync Creates Full Archive
expected: Running `npm run dev -- export` for the first time creates archive directory with monthly files containing all messages from tracked chats
result: pass

### 2. Incremental Sync Fetches Only New Messages
expected: Running export again (after first sync) only fetches messages newer than last sync. Progress shows "Incremental sync" not "Full export". Significantly faster than first run.
result: pass

### 3. New Messages Append to Current Month
expected: New messages received after first sync appear appended to the current month's file, not duplicated. Frontmatter updates with new message ID range.
result: issue
reported: "TimeoutNegativeWarning: -522509 is a negative number from mtcute library during sync"
severity: minor

### 4. Sync Summary Shows Statistics
expected: After sync completes, summary displays counts: chats processed, messages appended, files updated. Shows meaningful incremental stats (not full export counts on subsequent runs).
result: issue
reported: "deleted 2 last messages from one of the chats and ran export again -- messages did not updated. expected to sync. but in frontmatter i changed only last message, not export time"
severity: major

### 5. New Chat Detection Prompts User
expected: If a new chat appears in a tracked folder (chat added to folder in Telegram), user is prompted to include or skip it during sync.
result: skipped
reason: will test later

### 6. New Folder Detection Prompts User
expected: If user tracks a new folder (via `folders --select`), next sync detects it and prompts about its chats.
result: issue
reported: "when i run --select, already selected folders appear unselected (in suggested list)"
severity: major

## Summary

total: 6
passed: 2
issues: 3
pending: 0
skipped: 1

## Gaps

- truth: "New messages append without warnings"
  status: failed
  reason: "User reported: TimeoutNegativeWarning: -522509 is a negative number from mtcute library during sync"
  severity: minor
  test: 3
  root_cause: "mtcute ServerSaltManager bug: _scheduleReplace() calculates negative timeout for already-valid salts (validSince in the past)"
  artifacts:
    - path: "node_modules/@mtcute/core/network/server-salt.js"
      issue: "Line 31: salt.validSince * 1e3 - Date.now() yields negative when salt already valid"
  missing:
    - "Report upstream issue to https://github.com/mtcute/mtcute"
    - "Workaround: patch-package to add Math.max(0, ...) guard"
    - "Or: suppress Node.js TimeoutNegativeWarning (not recommended)"
  debug_session: ".planning/debug/mtcute-timeout-negative-warning.md"

- truth: "Deleted messages are detected and removed from archive during sync"
  status: failed
  reason: "User reported: deleted 2 last messages from one of the chats and ran export again -- messages did not updated. expected to sync"
  severity: major
  test: 4
  root_cause: "Incremental sync fetches only messages with ID > lastMessageId; previously-synced messages are never re-fetched, so deletions cannot be detected"
  artifacts:
    - path: "src/messages/fetch.ts"
      issue: "fetchMessages uses minId option - only fetches newer messages, never revisits old ones"
    - path: "src/sync/state.ts"
      issue: "SyncState.chats[].lastMessageId used as floor for incremental fetch"
    - path: "src/sync/append.ts"
      issue: "appendToMonthlyFile only adds content, has no removal/reconciliation logic"
  missing:
    - "Full re-fetch mode: option to fetch entire chat history for reconciliation"
    - "Deletion detection: compare fetched message IDs against archive"
    - "Archive reconciliation: logic to remove messages that no longer exist in Telegram"
  debug_session: ".planning/debug/deleted-messages-not-synced.md"

- truth: "Folder selection shows already-selected folders as pre-selected in the list"
  status: failed
  reason: "User reported: when i run --select, already selected folders appear unselected (in suggested list)"
  severity: major
  test: 6
  root_cause: "selectFolders() doesn't pass initialValues to multiselect() despite config data being available"
  artifacts:
    - path: "src/folders/index.ts"
      issue: "selectFolders() (lines 76-91) missing initialValues parameter"
  missing:
    - "Add currentSelection parameter to selectFolders() function signature"
    - "Pass initialValues to multiselect() options"
    - "In syncFolderConfig(), pass existing trackedFolderIds to selectFolders() when forceSelect=true"
  debug_session: ".planning/debug/folder-selection-preselect.md"
