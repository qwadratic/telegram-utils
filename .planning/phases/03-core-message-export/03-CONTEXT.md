# Phase 3: Core Message Export - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Export complete message history from tracked folders to structured Markdown files. Messages are organized into monthly files with YAML frontmatter. This phase handles fetching, formatting, and writing — incremental sync is Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Progress & feedback
- Detailed output by default — show message counts, file writes, rate limit waits
- Spinner + counts UI — animated spinner with updating message/chat counts
- Show rate limit waits explicitly — display "Rate limiting: waiting 1.5s..." when pausing
- Completion summary includes counts + timing — "X chats, Y messages exported in 2m 34s"

### Edge cases
- Empty chats: Log and skip — print "Skipping empty chat: Name" but don't create file
- Forwards: Mark as forwarded — show "Forwarded from: [source]" before content
- Replies: Quote original — show quoted snippet of the message being replied to
- Filenames: Sanitize aggressively — strip special chars, truncate long names

### Claude's Discretion
- Exact spinner library choice (@clack/prompts or ora)
- Message formatting layout (timestamp position, author styling)
- How much of original message to quote in replies
- Exact filename sanitization rules (which chars, max length)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Markdown formatting.

The success criteria from ROADMAP.md are quite specific:
- Monthly files at `archive/YYYY-MM/chat-name.md`
- YAML frontmatter with chat metadata
- Sender info, timestamps, reply references, attachment markers
- Text formatting preserved as Markdown
- 1.5s delays with jitter for rate limiting

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-core-message-export*
*Context gathered: 2026-02-03*
