---
phase: 03-core-message-export
plan: 02
subsystem: messages
tags: [markdown, formatting, yaml, mtcute, file-writer]

# Dependency graph
requires:
  - phase: 03-01
    provides: Message fetch with rate limiting, filename sanitization
provides:
  - Message-to-Markdown formatting with entity conversion
  - Monthly file writer with YAML frontmatter
  - Chronological message ordering (reversed from API order)
affects: [03-03, export-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PeerSender type narrowing for User/Chat/AnonymousSender"
    - "YAML frontmatter via template strings (no parsing library)"
    - "Group-and-reverse pattern for chronological output"

key-files:
  created:
    - src/messages/format.ts
    - src/messages/writer.ts
  modified: []

key-decisions:
  - "Use displayName property check for type narrowing - more robust than type string check alone"
  - "Replace newlines in reply quotes with spaces for clean blockquote rendering"
  - "Reverse messages per-month-group (not globally) for memory efficiency"

patterns-established:
  - "formatSender handles all PeerSender variants with consistent output"
  - "Monthly file structure: data/archive/YYYY-MM/{sanitized-name}.md"
  - "Frontmatter includes first/last message IDs for incremental sync support"

# Metrics
duration: 2min
completed: 2026-02-03
---

# Phase 3 Plan 2: Message Formatting & Writing Summary

**Message-to-Markdown conversion using md.unparse with monthly file output structure (data/archive/YYYY-MM/chat-name.md) and YAML frontmatter**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-03T04:59:08Z
- **Completed:** 2026-02-03T05:01:08Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- formatMessage converts Telegram messages to readable Markdown with timestamp, sender, ID, and preserved text formatting
- Forward attribution, reply quotes (truncated to 100 chars), and attachment type markers included
- Monthly file writer creates data/archive/YYYY-MM/chat-name.md with YAML frontmatter and chronological messages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create message formatting module** - `89381cc` (feat)
2. **Task 2: Create monthly file writer module** - `2b85ee2` (feat)

## Files Created/Modified
- `src/messages/format.ts` - formatSender and formatMessage functions for Markdown conversion
- `src/messages/writer.ts` - groupByMonth, createFrontmatter, and writeMonthlyFiles for archive structure

## Decisions Made
- Import PeerSender from @mtcute/node (re-exported from @mtcute/core) rather than deep path
- Use displayName property presence for type narrowing fallback
- Replace newlines with spaces in reply quote text to avoid broken blockquotes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial import of PeerSender from @mtcute/core/highlevel/types/peers/peer.js failed (module not directly importable) - resolved by importing from @mtcute/node which re-exports it

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Format and writer modules ready for integration
- Plan 03 (Export CLI command) can now combine fetch.ts, format.ts, and writer.ts
- Archive directory structure (data/archive/YYYY-MM/) will be created on first export

---
*Phase: 03-core-message-export*
*Completed: 2026-02-03*
