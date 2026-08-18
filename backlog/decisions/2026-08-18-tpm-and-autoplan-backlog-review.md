# TPM + autoplan pass over the backlog — 2026-08-18

Voices: Claude CEO, Claude DX (independent, no shared context). Codex: UNAVAILABLE
("Your workspace is out of credits"), so this is tagged [subagent-only].

## Findings acted on immediately

| Finding | Verified how | Action |
|---|---|---|
| A live auth key was gated behind writing a prose doc | task-12 blocked by task-11 <- 10; checkpoint value 1730595 already inlined in task-11's text | task-12 unblocked, HIGH |
| Two documented exit codes emitted by nothing | `git grep EXIT.usage/EXIT.upstream` -> 0 uses | Wired, shipped 0.3.10, eval-93 |
| "No results" reported as "not configured" | `peers find --id-only` threw a bare OperatorError -> exit 4 | Now exit 2, eval-94 |
| `--json` printed nothing on failure | empty stdout + bare status code | JSON envelope on stdout, eval-95 |
| task-27 blocked by task-26 for no reason | capturing metadata at export needs no search command | Unblocked; it is the only time-sensitive task |
| task-8 has unsatisfiable acceptance criteria | AC demands "zero sendText in src/" and "zero gbrain in src/", both deliberately overturned by D13 | Flagged in notes; must be rewritten before work starts |
| A dependency cycle | task-11 <-> task-12 deadlocked both | Broken; graph is acyclic |

## Missing work both reviews implied, now filed

- **task-36 backfill.** 27/29/30 all fix the pipeline FORWARD. Nothing re-processes
  the 62 oversized pages, the 38 unrouted chats, or 189MB of `[Attachment: photo]`
  already written. Without it the brain permanently reflects the pipeline as it
  was today, and "the PDF from March" stays unanswerable no matter what lands next.
- **task-37 exclusion list.** 197MB of other people's plaintext flows into an
  archive and now into an embedded, queryable brain with no exclusion policy at
  either boundary. The blast radius grew today: before the ingestion this content
  sat in one 0700 directory; now an agent with brain access can surface it without
  touching the archive.
- **task-38 deep links.** A search hit gives a snippet and no way back to the
  message. chat_id and message ids are already in frontmatter, so `t.me/c/<id>/<msg>`
  is derivable from data on disk.

## Recommendations recorded but NOT applied

The CEO voice argued for cutting tasks 19, 21, 22, 34 and 10, and for demoting the
VM chain (15-18) to LOW. The DX voice proposed a full command-tree rename
(`setup` -> `folders track`, `watch` -> `media watch`, `check-phones` ->
`peers check-phones`, `ask` merged into `search`) and folding `brain status` into
`ship status`.

Both are defensible and neither was applied, for one reason: they are product
taste, on a tool with exactly one user, and that user was explicit that the
backlog should be aligned rather than pruned. Deleting someone's ideas is not a
decision an agent should make from a review it commissioned itself. They are
recorded here so the argument is not lost.

One DX claim was checked and rejected: `check-phones` calling `importContacts` is
described as "a hole eval-29 never mentions". It is not a hole - it is an
explicitly fenced exception, on the allowlist, recorded in the 2026-08-05 log and
pinned by eval-29 itself.
