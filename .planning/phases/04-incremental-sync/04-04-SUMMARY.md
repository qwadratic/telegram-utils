---
phase: 04-incremental-sync
plan: 04
completed: 2026-02-03
duration: 38s

subsystem: folder-management
tags: [ux, multiselect, clack-prompts]

dependency_graph:
  requires: [02-01]
  provides: [selectFolders-initialValues]
  affects: []

tech_stack:
  added: []
  patterns: [optional-parameter-extension]

key_files:
  created: []
  modified: [src/folders/index.ts]

decisions:
  - id: "04-04-01"
    area: api
    choice: "Optional currentSelection parameter to selectFolders"
    reason: "Backward compatible - existing callers continue to work"

metrics:
  tasks_completed: 1
  tasks_total: 1
  deviations: 0
  auth_gates: 0
---

# Phase 04 Plan 04: Folder Selection Pre-selection Fix Summary

**One-liner:** selectFolders() now accepts initialValues for pre-selecting already-selected folders in the multiselect prompt.

## What Was Done

Gap closure plan to fix UX issue where `setup --select` showed all folders unchecked even when some were already selected.

### Task 1: Add initialValues support to selectFolders

**Changes to `src/folders/index.ts`:**

1. Extended `selectFolders()` signature with optional `currentSelection` parameter
2. Added `initialValues: currentSelection` to multiselect options
3. Updated `syncFolderConfig()` to pass existing tracked folder IDs when calling selectFolders

**Code changes:**

```typescript
// Before
export async function selectFolders(folders: FolderInfo[]): Promise<number[]>

// After
export async function selectFolders(folders: FolderInfo[], currentSelection?: number[]): Promise<number[]>
```

```typescript
// multiselect now receives initialValues
const selected = await multiselect({
  message: 'Select folders to export:',
  options: folders.map(f => ({
    value: f.id,
    label: `${f.title} (${f.chatCount} chats)`
  })),
  required: true,
  initialValues: currentSelection  // NEW
})
```

```typescript
// syncFolderConfig passes existing tracked folders
trackedFolderIds = await selectFolders(folders, config.trackedFolderIds)
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| f336f5d | feat | Add initialValues support to selectFolders |

## Verification

- TypeScript compiles without errors: `npx tsc --noEmit` passes
- First run (no config): Shows all folders unchecked (empty array as initialValues)
- Subsequent run with --select: Shows previously tracked folders pre-checked

## Deviations from Plan

None - plan executed exactly as written.

## Key Artifacts

| File | Purpose |
|------|---------|
| src/folders/index.ts | selectFolders with initialValues support |

## Decisions Made

| ID | Area | Decision | Rationale |
|----|------|----------|-----------|
| 04-04-01 | API | Optional currentSelection parameter | Backward compatible extension |

## Gap Status

**Gap addressed:** Folder selection now pre-selects already-tracked folders when using --select flag.

**Behavior:**
- First run: All folders unchecked (config.trackedFolderIds is empty)
- `--select` flag: Previously selected folders appear checked
- User can toggle selection and save new configuration
