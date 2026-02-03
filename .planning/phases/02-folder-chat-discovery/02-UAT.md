---
status: updated
phase: 02-folder-chat-discovery
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md
started: 2026-02-03T14:05:00Z
updated: 2026-02-03T21:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Setup Lists Telegram Folders
expected: Running `npm run dev -- setup` displays all Telegram folders with their names and chat counts
result: pass

### 2. First-Run Prompts Folder Selection
expected: On first run (no config exists), user is prompted with a multiselect to choose which folders to export
result: pass

### 3. Config Persists Selection and Chats
expected: After selection, data/config.json contains selected folder IDs and a deduplicated chat ID list
result: pass

### 4. Subsequent Run Refreshes Chats
expected: Running `setup` again (after initial selection) refreshes tracked chats and logs added/removed IDs
result: pass

### 5. Re-Select with --select Flag
expected: Running `npm run dev -- setup --select` allows changing which folders are exported (shows multiselect again)
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

None.
