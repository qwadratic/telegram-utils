# /autoplan review report — telegram-utils search + gbrain ingestion

Voices: Claude CEO, Claude Eng, Claude DX (independent, no shared context).
Codex: UNAVAILABLE — "ERROR: Your workspace is out of credits". Tagged
[subagent-only] per the degradation matrix. Consensus columns below therefore
score Claude voices only; a dimension is CONFIRMED when two independent Claude
voices reached it separately.

## Cross-phase themes (raised independently by 2+ voices — highest confidence)

| Theme | Raised by | Verdict |
|---|---|---|
| `tg brain` duplicates `tg ship` | CEO (D8 reversal), DX (F1 critical), Eng (F10 vacuous watermark) | ACCEPTED — do not add `brain config`. Keep TG_BRAIN_MAP. |
| The index doubles the credential blast radius; "encrypted at rest" is theatre | CEO (F4), Eng (F8) | ACCEPTED — and the real bug was the ARCHIVE at 0644. Fixed in 0.3.7. |
| Trust evals do not cover new code | Eng (F1, F2 — verified red), DX (F6 exit codes) | ACCEPTED — eval-48 narrowed to real secret names + self-extending. |
| Sequencing is wrong; session doctor is P0 | CEO (F7), DX (F4 five ways to ask about auth) | ACCEPTED — doctor moves to P0. |

## Findings acted on immediately (shipped in 0.3.7)

| # | Severity | Finding | Status |
|---|---|---|---|
| Eng-8 | HIGH | data/archive 189MB at 0644, dir 0755 | FIXED + 130 files repaired |
| Eng-3 | CRITICAL | spawnSync inherits env; gbrain receives TG_SESSION_STRING | FIXED, eval-84 |
| Eng-1 | CRITICAL | eval-48 already red; TG_ prefix proxy broke | FIXED, gate now names secrets |
| CEO-6 | CRITICAL | env rename half-landed with no shim | FIXED, src/env.ts + eval-83 |

## Premises corrected

- **WRONG:** "gbrain already has hybrid query, so do not duplicate search."
  gbrain's hybrid `query` needs an embedding key that is NOT configured on this
  machine; only keyword `search` works today. The plan used a capability that
  does not currently exist to justify not building one. (CEO-2)
- **WRONG:** "3644 mentions across 32 days" as evidence for SEARCH. That count is
  gbrain-ingestion volume. The honest count for search demand is 5 mentions on 3
  days. Both are real; they justify different things. (CEO-9)
- **UNSTATED:** the whole gbrain half is blocked on `gbrain init`, which has been
  blocked on a human decision since 2026-08-05 (engine choice + embedding key
  cost). No amount of code moves that. (CEO-1)

## Verified technical findings that reshape the build

- **FTS5 tokenization fails for the operator's own contacts.** With
  `unicode61 remove_diacritics 2`, `MATCH 'budapest'` returns NOTHING for
  "Budapesten a rekruter írt" — Hungarian agglutination, no stemmer. Russian has
  no stemming either. A naive FTS5 index would have silently failed on exactly
  the people in this operator's chats. (Eng-7, empirically tested)
- **The archive cannot answer "the PDF from March".** `formatAttachmentBlock`
  emits only `[Attachment: photo]` — no filename, mime, size, duration. P2 as
  written was unbuildable from the archive; media metadata has to be captured on
  the credential side, at export time. (Eng-4)
- **`rg` over data/archive already works.** 130 flat Markdown files. The real
  delta of an index is ranking, media metadata and --from/--since, not the
  ability to grep. Ship the wrapper before the index. (CEO-3)
- **Deletes and edits are invisible forever.** `iterHistory({minId})` never
  revisits old ids, and `ship` has no un-capture. A chat leaving a folder stays
  in the archive and the brain permanently. (Eng-6)
- **An hourly cron will collide with the workspace lock.** First index of 131
  chats at 1.5s/100 messages is tens of minutes; every overlapping run exits
  non-zero and looks like breakage. Skip-if-locked must exit 0. (Eng-11)

## Revised sequencing (supersedes the original plan)

- **P0 — security, present-tense.** SHIPPED as 0.3.7.
- **P1 — `tg session doctor`.** The only item with four months of evidence.
- **P2 — `tg search` over the existing archive.** Ranked wrapper, no second copy
  of every message, no new key, works today. FTS5 only when measured need and
  only with a trigram companion table for Hungarian/Russian.
- **P3 — media metadata at export time**, so files and photos become findable.
- **P4 — brain: replace ship's mtime watermark with a per-file ledger**, which is
  what makes "no-op the second time" true and `brain status` answerable. Keep
  TG_BRAIN_MAP; no config file, no D8 reversal.

## Auto-decisions (carte blanche: both normally-human gates were auto-decided)

| # | Phase | Decision | Class | Principle | Rationale |
|---|---|---|---|---|---|
| 1 | CEO | Premise gate auto-accepted | GATE | P6 | Operator pre-authorised; premises corrected above rather than confirmed |
| 2 | CEO | Drop `brain config` file | User Challenge | P4 DRY | Reverses D8; all three voices object |
| 3 | CEO | Reorder: doctor to P0 | Taste | P1 | Four months of evidence beats a fresh idea |
| 4 | Eng | Archive wrapper before FTS5 | Taste | P3, P5 | Zero build cost answers the question today |
| 5 | Eng | Separate TG_INDEX_DB_KEY if an index lands | Mechanical | P1 | resetLocalCache must not destroy it |
| 6 | DX | Keep `ship`, do not rename to `brain push` | Taste | P6 | Renaming a just-published verb churns; revisit if brain lands |
| 7 | DX | Adopt exit-code taxonomy | Mechanical | P1 | Agents cannot act on 0/1 alone |
