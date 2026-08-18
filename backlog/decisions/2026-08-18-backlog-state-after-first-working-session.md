# Plan — the @qwadratic/tg backlog after one working session

The tool shipped 0.3.0 through 0.3.9 today, gained `tg doctor`, a search-free
gbrain ingestion path that works end to end, and three security fixes. This is
the remaining work, ordered, with dependencies resolved and no cycles.

## State

- 35 tasks, 23 open, 12 done
- ready now (no open blockers): 14

## HIGH priority

### task-8: Trust-model static gates plus a --dry-run flag on export

Add the five mechanical gates that pin the trust model to the test suite, and give `export` a `--dry-run` flag.

The two one-way rules the gates enforce: nothing holding a Telegram credential may call an LLM or gbrain; nothing talking to gbrain may hold a Tele

### task-12: Revoke tg-saved''s Telegram authorization, then delete its session artefacts  (blocked by task-11)

In Telegram: Settings > Privacy and Security > Active Sessions, revoke the authorization tg-saved created. THEN delete `~/.config/gbrain/telegram.session.db` and the `gbrain-telegram` Keychain items.

WHY the order: deleting the file first leaves a LIVE auth k

### task-26: tg search over the archive, before any FTS5 index

From the 2026-08-18 autoplan review. The original plan led with an encrypted FTS5 index; all three voices pushed back and two findings killed it as a first step.

1. rg over data/archive already answers 'where did we discuss X' today, at zero build cost, acros

### task-27: Capture media metadata at export time so files and photos are findable  (blocked by task-26)

From the 2026-08-18 autoplan review, Eng finding 4. VERIFIED: formatAttachmentBlock emits only '[Attachment: photo]' - no filename, no mime, no size, no duration, and no entities or link previews. So 'the PDF from March' is unrecoverable from data/archive no m

### task-29: Split chat pages by month so the biggest chats can be embedded

MEASURED on the live brain, 2026-08-18, immediately after the first successful ingestion.

tg ship writes ONE gbrain page per chat. gbrain flags oversized pages and skips their embeddings: 'page lands, embedding skipped, agent warned'. On this archive that mea

### task-30: Route chats that belong to no tracked folder

MEASURED 2026-08-18: 38 of 130 archive files carry folder_ids: [] because their chat is in no tracked folder - exported directly with --chats, or the folder membership changed later. ship refuses to guess a brain for them (correct, D8 and eval-44), so they nev

### task-32: tg brain status: show what fraction of the archive is actually searchable

IDEA, and the metric that would have caught today's biggest problem in one command instead of after a full ingest.

After the first successful ingestion the numbers were: 92 pages shipped, 64 embedded, 1958 chunks - and 62 of 130 archive files are oversized, h

## MEDIUM priority

### task-7: Absorb Saved Messages: drop inputPeerSelf from the folder skip list

`src/folders/index.ts:58` skips `inputPeerSelf`, so Saved Messages is never exported. Remove the condition and Saved Messages becomes an ordinary tracked chat with a gapless minId watermark like every other.

WHY: this is the whole functional surface telegram-

### task-10: Salvage tg-saved policy as prose before the tree is deleted

Copy the policy content worth keeping out of tg-saved into `docs/salvage/tg-saved.md`: the SENSITIVE_PATTERNS list, SAFE_PDF_PATTERNS, the PDF default-deny posture, and the M4A faststart note.

WHY prose and not code: preserving 282 LOC of unreachable code to 

### task-11: Seed the Saved Messages watermark, then delete the tg-saved tree  (blocked by task-10, task-7)

Set `chats[<self id>].lastMessageId = 1730595` in data/archive/sync-state.json, verify one incremental export against it, and only then delete the tg-saved tree and `~/.config/gbrain/{tg-saved-checkpoint.json,tg-folder-html/}`.

WHY the ordering is the whole t

### task-15: EXTERNAL: gbrain init on the target host and register the destination brains

Run `gbrain init` on the host that will hold the brain, and register `personal` and `proximata` as sources (local mode) or OAuth clients (thin mode).

WHY this is the real external blocker: nothing is initialised anywhere today. Verified read-only — ~/.gbrain/

### task-16: HUMAN: provision the VM and seed the vault with API credentials

Run `deploy/install.sh` on the target host, then `psst init` in /srv/tgu and `psst set API_ID --stdin` / `psst set API_HASH --stdin` as the tgu user.

WHY --stdin and never argv: a value passed as an argument is visible to `ps` and lands in shell history. Pipi

### task-17: Create the VM's own Telegram session and pick the tracked folders  (blocked by task-16)

Run `telegram-utils session login` on the VM as the tgu user, at a terminal, then `telegram-utils setup` to choose which folders are tracked.

WHY a human: only a person receives the login code. There is no way to automate this and no way around it, and trying

### task-18: >-  (blocked by task-17, task-15)

Trigger `systemctl start tgu.service` once by hand, read the journal, confirm pages exist in the brain, and confirm `gbrain integrations doctor --json` no longer answers no_integrations.

WHY the doctor check is worth naming as an outcome: it currently returns

### task-25: Outreach queue: draft, human approval, then drip within the caps

PAIN, from transcripts: the riskiest workflow is the least structured one. 2026-08-09, verbatim: 'find a list of recruiters i've spoke before on telegram, and build unique message for all of them, and fde profile attached. approve list with me and lets try tel

### task-28: Replace ship's mtime watermark with a per-file ledger  (blocked by task-29)

From the 2026-08-18 autoplan review, Eng finding 10. 'Running this twice is a no-op' is currently vacuous: ship keys off one .last-ship mtime, while appendToChatFile REWRITES whole files (one chat here is 3.7MB), bumping mtime and re-shipping everything. And '

### task-31: Reconcile deletions and edits: nothing ever leaves the archive or the brain

IDEA, from the 2026-08-18 eng review (finding 6), never filed until now. The whole pipeline is append-only in a way nobody chose:

- fetchMessages uses iterHistory({minId}), which NEVER revisits an id it has already passed. So a message edited after export kee

### task-33: Push media into gbrain file storage so photos and PDFs are retrievable  (blocked by task-27)

IDEA. gbrain 0.46 already has 'files upload-raw' with size routing and signed URLs; tg already knows how to download media ('tg media pull'). Nothing connects them, so the brain holds the CAPTION of a PDF and not the PDF.

The operator's own request from 2026-

### task-34: tg ask: one command from a question to an answer, without a credential  (blocked by task-26)

IDEA, aimed squarely at the agent that will use this tool.

Right now answering 'where did we discuss X' takes two tools and knowledge of both: gbrain query for retrieval, tg for everything else. An agent has to know the brain exists, that it is configured, wh

### task-35: Saved Messages as an inbox: watch, capture, and clear  (blocked by task-7)

IDEA, and the operator's longest-running unmet want. From 2026-06-03: 'i want no more than 5 latest saved messages to be processed (per manual run). i want to also have a variant where all processed records are deleted from saved messages chat + message back t

## LOW priority

### task-19: >-

The committed demo GIF still types `symbiotic-chats`. Re-render it against the renamed binary, inspect every frame for leaks, then `cp -p` the result into ~/Desktop/demos/hobby/telegram-utils/{final,source}/ and add the row to the library README and MANIFEST.


### task-21: New chat filtering rules: participant allowlist, folder allowlist, title regex

Salvaged from .planning/ROADMAP.md Phase 9 before that tree was deleted. Sync auto-adds every chat it finds in a tracked folder; there is no way to say 'this folder, but not that chat'. Configurable rules applied before a newly discovered chat is added to sync

### task-22: Memory-only session mode: no auth key on disk for one-shot runs

Salvaged from .planning/ROADMAP.md Phase 7 before that tree was deleted. An opt-in mode where the session lives only in process memory and is discarded on exit, for hosts where writing an auth key to disk is not acceptable.

Interacts with the per-folder works

## The one thing that is not a task

TASK-12 requires the operator to revoke a Telegram authorization by hand in the
Telegram app. No code can do it, and it is the oldest open security item in the
repo: a live auth key for a deleted project is still sitting at
~/.config/gbrain/telegram.session.db.

