# Plan — an agent-friendly Telegram client: search across chats, files and photos, and a real gbrain ingestion pipeline

## The customer and the job

One customer: the operator. The job, in their words: "i want my telegram to be
automated, esp. reading and searching through it", and "use it with gbrain in
many possible ways that bring value".

## Evidence

From 802 pi sessions:
- `gbrain ingestion`: 3644 mentions across 32 distinct days. The dominant theme
  of the whole corpus, far ahead of anything else.
- The pattern is already proven on another source, 2026-08-03: "make the notion
  accessible ... importable in gbrain. once you verify it works - set up a cron
  job that visits notion every hour and syncronizes", then "cron job must sync
  notion->gbrain", then "make sure gbrain processed them including embedding +
  some eval test". Source -> brain, on a schedule, embedded, verified.
- Stated for Telegram specifically, 2026-06-05: "i will create special folder,
  and add some chats there - i want our mtcute worker to sync and 'listen' to all
  msgs from this folder, process all message types, store in some viewable
  format (html?), and capture to brain hourly."
- Retrieval, repeatedly: "try searching my dms its pretty recent and easily
  searchable" (08-10), "find a list of recruiters i've spoke before on telegram"
  (08-09), "read my chat history with this user" (08-17).

From the web: Telegram's own search is word-based with no fuzzy or wildcard
matching, does not index the contents of documents, and is unreliable in Saved
Messages. So "find the PDF someone sent me in March" is not answerable in the
Telegram client at all.

From gbrain 0.42 itself: it already has `search` (tsvector), `query` (hybrid RRF
+ expansion), `files upload` with size routing, `sync --install-cron`, and an
`integrations` recipe system. tg must NOT reimplement search or embeddings. tg's
job is to be the best possible ingester, and to offer the fast local lookup that
does not need a brain at all.

## What we build

### P1. Local search index — the fast path, no brain required
- `tg index [--since]` builds an incremental SQLite FTS5 index over tracked
  chats: message text, media captions, file names, sender, date, media kind,
  and the URLs pulled out of entities and link previews.
- Encrypted at rest with the same driver as the session cache, 0600, under the
  workspace data root. It contains real message content.
- `tg search <query> [--from] [--since] [--kind] [--json]` returns peer, date,
  message id, snippet, ranked. Instant, offline, no embedding cost.
- WHY local as well as gbrain: an agent asking "where did we discuss X" should
  not need a configured brain, a network round trip, or embedding spend. The
  local index answers in milliseconds and is the honest primitive.

### P2. Files and photos as first-class
- The index records media metadata for every message: file name, mime, size,
  duration, caption, and a stable content id.
- `tg files find <query>` answers "the PDF from March", "the APK I sent",
  "screenshots from that chat", across every tracked chat.
- `tg files pull <messageId>` fetches one by id, reusing the media path.

### P3. Brain ingestion, declarative and automatic — the headline
- `tg brain config` writes a declarative mapping in the workspace:
  which folders/chats go to which gbrain source, how often, whether to upload
  media files as well as pages.
- `tg brain sync` runs the whole pipeline idempotently: export -> capture pages
  -> upload files -> heartbeat.
- `tg brain status [--json]` shows what is ingested, what is pending, when it
  last ran, and whether the brain agrees with the archive.
- `tg brain install-cron` installs the schedule, mirroring gbrain's own
  `sync --install-cron` so the operator has one mental model.
- HARD CONSTRAINT, non-negotiable: decision D7's two one-way rules. Nothing
  holding a Telegram credential may call gbrain, and nothing talking to gbrain
  may hold a Telegram credential. `tg brain sync` is therefore an ORCHESTRATOR
  that spawns the existing two processes; it must never import both. eval-30 and
  eval-48 already fail the suite if that boundary breaks, and they must keep
  passing.

### P4. Agent ergonomics
- `tg session doctor` (TASK-23): the single most recurring pain in the corpus -
  auth failing mid-task, 15 mentions across 5 days spanning four months, always
  costing human attention. Answers "will unattended runs work?" with a
  machine-readable needs_human_login payload and a distinct exit code.
- `TG_*` env vars replacing `TGU_*`, with a fallback so existing automation in
  other repos does not silently start hanging on a prompt.

## Explicitly not building
- Our own embeddings or semantic search. gbrain has both; duplicating them
  would be a second truth that drifts.
- OCR or PDF text extraction inside tg. Files go to gbrain storage; extraction
  is the brain's job, and doing it here would put heavy dependencies next to a
  Telegram credential.
- A daemon. `watch` already covers the one live case, and a long-lived process
  holding the auth key is the risk the single-instance lock exists to bound.

## How we will know it worked
- `tg search` finds a known message across chats faster than opening Telegram.
- `tg brain sync` twice in a row is a no-op the second time.
- The trust evals still pass, proving the credential boundary held.
- A scratch PGLite brain proves ingestion end to end rather than by assertion.
