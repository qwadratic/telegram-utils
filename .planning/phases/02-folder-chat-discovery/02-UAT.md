---
status: complete
phase: 02-folder-chat-discovery
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md
started: 2026-02-03T14:05:00Z
updated: 2026-02-03T14:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. List Folders Shows All Telegram Folders
expected: Running `npm run dev -- folders` displays all Telegram folders with their names and chat counts
result: pass

### 2. First-Run Prompts Folder Selection
expected: On first run (no config exists), user is prompted with a multiselect to choose which folders to track
result: pass

### 3. Config Persists Selected Folders
expected: After selection, data/config.json contains the selected folder IDs and their chat IDs
result: pass

### 4. Subsequent Run Shows Chat Diff
expected: Running `folders` again (after initial selection) shows any added or removed chats since last sync
result: pass

### 5. Re-Select with --select Flag
expected: Running `npm run dev -- folders --select` allows changing which folders are tracked (shows multiselect again)
result: issue
reported: "error: unknown option '--select'"
severity: major

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Running npm run dev -- folders --select allows changing tracked folders"
  status: failed
  reason: "User reported: error: unknown option '--select'"
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
