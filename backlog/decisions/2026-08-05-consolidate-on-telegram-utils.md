# Decision — consolidate on telegram-utils; tg-saved dies; the ingester never learns the word "gbrain"

Date: 2026-08-05 | Author: agent (synthesis of five research reports, re-verified read-only against the repo)
Scope: naming, secrets, VM deployment, tg-saved deletion, gbrain integration, eval harness, backlog.

**Thesis.** telegram-utils is the surviving codebase. tg-saved dies. Everything else is one
rename, five frontmatter fields, one formatter fix, a golden-file gate, and ~40 lines of systemd.

Task cards: TASK-1 … TASK-19. This document records WHY; the cards record WHAT and the checks.

---

## D1 — Name `telegram-utils`, alias `tgu`, env `TGU_NON_INTERACTIVE`, no shim

DECIDED: hard rename. Package `telegram-utils`, `bin` map with two keys onto one file,
`SYMBIOTIC_NON_INTERACTIVE` → `TGU_NON_INTERACTIVE`, version 0.2.0. → TASK-4.

BECAUSE: every non-CLI surface already says telegram-utils — the repo directory, the git remote,
`README.md:1`, the demo artefacts. Only the CLI disagrees, so move the one name that is wrong.

ALTERNATIVES REJECTED:
- `tgarc` / `chatvault` — a fifth name disagreeing with four existing surfaces; multiplies the rename surface.
- `TG_NON_INTERACTIVE` — `TG_*` is the *shared* vault namespace; `src/session/psst.ts:26-29` reads
  `TG_API_ID`/`TG_API_HASH` from the global vault on purpose.
- A compatibility shim — zero live consumers: no global link, no cron, no launchd, no shell rc, no VM.

RIPPLES: if the no-shim call is wrong the failure is LOUD (a run hangs on a prompt), never silent.

## D2 — Secrets on a headless VM: env-first, already implemented

DECIDED: no code change. `readSecret()` (`src/session/psst.ts:64`) already resolves
env → local vault → global vault. Default path is psst in `/srv/tgu`; fallback is systemd
`EnvironmentFile=/etc/tgu.env` (root:tgu 0640), which the existing env-first order already honours. → TASK-14, TASK-16.

BECAUSE: env is checked first for every secret and alias, so both paths cost zero lines.

ALTERNATIVES REJECTED: keytar/Keychain — macOS Security framework; headless Linux would need
libsecret + gnome-keyring + an unlocked keyring + a D-Bus session that does not exist.

EVIDENCE THIN: psst headless unlock on Linux is unverified. Default taken: ship both paths, prefer psst.

## D3 — The VM gets its own `session login` and its own auth key

DECIDED: one auth key per machine. → TASK-13, TASK-17.

BECAUSE: `README.md:53-54` currently documents piping `TG_SESSION_STRING` into a second host's vault.
That puts ONE auth key on TWO machines, and `data/session.lock` is cwd-relative (`src/session/lock.ts:5`)
so it cannot see across hosts. Two clients on one auth key desynchronise `pts/qts/seq` and can earn
`AUTH_KEY_DUPLICATED`. **The README documents what `AGENTS.md` forbids.** That is a real doc bug, not a preference.

RIPPLES: distinct keys are free and safe; a shared key is the only genuinely dangerous configuration.

## D4 — tg-saved is deleted; telegram-utils absorbs ~40 LOC

DECIDED: telegram-utils absorbs, tg-saved tree is deleted. Absorb cost is exactly two things:
drop `inputPeerSelf` from the skip list (`src/folders/index.ts:58`) and seed
`sync-state.json` with `lastMessageId: 1730595`. → TASK-7, TASK-10, TASK-11, TASK-12.

BECAUSE: tg-saved has no lock, no non-interactive mode, no rate limiting, no gapless watermarks,
no tests, and a Keychain binding that cannot reach Linux.

ALTERNATIVES REJECTED:
- tg-saved absorbs telegram-utils — inverts the quality gradient.
- Both survive on a shared session module — the "shared module" is already three byte-identical
  copies of a 36-line file; extracting a package adds a fourth thing to version while leaving two
  entrypoints, two checkpoint formats and two secret stores alive.
- Both independent — keeps a shared FLOOD_WAIT budget, doubled credential blast radius, duplicate
  ingestion, and tg-saved's *internal* daemon-vs-cron collision on one auth key with no lock.

DO NOT PORT: `media.ts` (MacWhisper is a sandboxed macOS GUI app), `process.ts` (OpenRouter — violates D7),
`folder-listener.ts` + `html-render.ts` (never produced a file), `extract-cvs.ts` (contains a real person's name).
SALVAGE AS PROSE ONLY: `SENSITIVE_PATTERNS`, `SAFE_PDF_PATTERNS`, PDF default-deny, the M4A faststart note.
Preserving 282 LOC of unreachable code to protect 20 lines of policy is the wrong trade.

## D5 — gbrain output: markdown that is already a valid gbrain page, shipped with `capture`

DECIDED: `data/archive/*.md` keeps its shape plus `type: note` and `title:`. Shipping is
`gbrain capture --slug <s> --quiet --stdin < file`, one process per file, exit-code checked,
in a ~15-line `deploy/ship.sh` OUTSIDE the ingester. → TASK-5, TASK-14.

BECAUSE: `import`, `sync` and `embed` are `localOnly` and *refused* in thin-client mode
(`src/cli.ts:isThinClient`), and cannot express per-file brain routing without a directory split.
`capture` works in both shapes — which is what makes a later move to a remote brain a one-line change.

`type` must be one of the 15 in `gbrain-base-v2.yaml` → `note`. Anything else is silently retyped with
`legacy_type`; the drift is invisible in production. Slug namespace `tg/chat/<sanitized-name>_<chat_id>`;
the slug is the `UNIQUE (source_id, slug)` dedup key, so the loop is idempotent.

## D6 — Archive on the VM: `/srv/tgu`, mode 0700, agents never mount it

DECIDED: `WorkingDirectory=/srv/tgu`, `tgu:tgu`, `0700`. All four data paths stay cwd-relative —
verified: `data/session.db` (`cache.ts:11`), `data/session.lock` (`lock.ts:5`), `data/config.json`
(`config/index.ts:16`), `data/archive/sync-state.json` (`sync/state.ts:32`). Zero code change.
Agents read the BRAIN, never the directory. → TASK-14, TASK-16.

ALTERNATIVES REJECTED: a configurable data root now; a copy into an agent-readable directory — nothing needs one yet.

`ponytail:` the data root is a hard-coded relative path. Ceiling: it breaks when two things on one host
need different roots. Upgrade path: `TGU_DATA_DIR` in `src/utils/archive-path.ts` plus the three other path consts.

## D7 — The ingester never calls an LLM and never calls gbrain

DECIDED: telegram-utils does field extraction, escaping, sorting, dedup, watermarks, frontmatter.
Nothing else. No gbrain dependency, no OpenRouter key. Capture and heartbeat live in `deploy/ship.sh`.
Pinned mechanically by the eval-32 grep gate. → TASK-8, TASK-14.

BECAUSE:
1. A non-deterministic export makes "synced up to id N" unverifiable — no diff, no repair, no trustworthy resume.
2. Better extraction in two years must apply to five years of history without re-fetching Telegram.
3. The ingester holds a full account credential; it must be the smallest, most boring, least-edited code in the system.
4. tg-saved already made this mistake and quarantined it itself — `process.ts` header:
   *"Used only in --clean mode (report generation)."*

## D8 — Multi-brain routing by `folder_ids` in frontmatter, no directory split

DECIDED: Telegram folders are the brain boundary. Stamp `folder_ids: [N]` + `folder_title:` into
frontmatter; `ship.sh` greps it and picks the target brain. The archive directory stays flat.
Dual membership is a list, not a duplicate export: `folder_ids: [7, 12]`. → TASK-5, TASK-14.

ALTERNATIVES REJECTED:
- Per-folder directories (`data/archive/<folder-slug>/`) — forces the watermark key from `chatId` to
  `folderId:chatId` plus a state migration. Get it wrong and the second folder's pass reads an
  already-advanced watermark and writes nothing: **silent data loss in the second brain.** The
  frontmatter field buys the same routing for one `grep` and zero state change. This reverses the
  recommendation of report 5, which itself flagged the migration as the one non-trivial cost —
  so delete the cost rather than manage it.
- A chat→brain map in `data/config.json` — a second truth that drifts.
- LLM classification — violates D7.
- Chat-title conventions — forces renaming chats other people can see.

## D9 — Eval harness: extend `node:test`. Do not build a second harness.

DECIDED: `test/` gains `assertGolden()` (~15 lines, bootstrap-loud, never auto-updating) plus
`test/fixtures/` and `test/golden/`. `pnpm test` exit code is the verdict; `npx tsc --noEmit` is the
second gate. 34 evals, zero network. → TASK-3, TASK-8, TASK-14.

ALTERNATIVES REJECTED: porting the house `evals/lib.sh` + `run.sh` + per-phase `expected/`, or the
`evals-v2` suite — a second language, runner and gate for a repo with 35 passing `node:test` cases.

PRINCIPLES KEPT VERBATIM: normalization lives in the render helper, never in the diff; a failing eval
never auto-updates a golden; the bootstrap banner is loud; frozen literals ARE the assertion; the exit
code is the verdict. Three volatiles are normalized and no more — `exported_at`, tmpdir, pid.

## D10 — Adopt the house backlog conventions as-is

DECIDED: standard eight directories, shared `config.yml` shape, flat topical labels, decisions
hand-written per the template in `backlog/decisions/README.md`. → TASK-9.

BECAUSE: flat labels rather than a `prio:N` label axis, because this repo uses the real `priority`
field and a priority label would be a second truth that drifts.

RIPPLES: never edit `backlog/tasks/**` directly — CLI only, `--plain` on every scripted call.

## D11 — Delete `src/sync/detect.ts`

DECIDED: delete. 285 LOC, zero importers. → TASK-2.
ALTERNATIVES REJECTED: keeping it "in case" — git history is the "in case".

## D12 — The plan docs in `~/Desktop/self/` are fiction; do not chase them from here

DECIDED: treat as stale narrative, correct nothing outside this repo, make `gbrain init` an explicit
external prerequisite. → TASK-15.

BECAUSE, verified read-only: `~/.gbrain/` has no `config.json`; `gbrain sources list` → `No brain configured`;
`~/.pi/agent/mcp.json` is `{"mcpServers": {}}`; `crontab -l` is empty; there are no gbrain launchd agents;
`gbrain integrations doctor` → `no_integrations`; `gbrain-private` execs a path that does not exist.

ALTERNATIVES REJECTED: rewriting them — the fix is a working system, not an updated story.

---

## Ordering constraints that are decisions in their own right

- **TASK-1 (ms fix) before TASK-4 (rename).** The pending `cache.ts` fix is a behaviour change:
  mtcute's `updated` is MILLISECONDS, so the old code put `session status` ~56 000 years in the future.
  Landing it inside a 44-token rename makes both unreviewable.
- **TASK-3 (goldens) before TASK-5 (frontmatter delta).** Goldens must capture CURRENT behaviour first,
  or there is no baseline against which the intended diff can be distinguished from a regression.
- **TASK-10 (salvage) before TASK-11 (delete).** `self/` is not a git repo and the tree is not in the
  backup zip. Deletion is irreversible; anything not copied out first is gone.
- **TASK-11 (seed) before deleting the checkpoint.** Seed `lastMessageId: 1730595` first or Saved
  Messages re-ingests from zero; delete first and the value that makes seeding possible is gone.
- **TASK-12: revoke before delete.** Deleting `telegram.session.db` first leaves a LIVE auth key on
  Telegram's side and nothing local identifying which row to revoke.

## Security boundary (two one-way rules, both mechanically checkable)

1. Nothing holding a Telegram credential may call an LLM or gbrain. — evals 30, 32 (TASK-8).
2. Nothing talking to gbrain may hold a Telegram credential. `ship.sh` runs after the ingester exits
   and imports no repo source. — TASK-14.

No write-back to Telegram: `disableUpdates: true` (`src/client.ts:38`) means the client never even
receives updates, and there are ZERO `sendText`/`sendMedia`/`forwardMessages`/`deleteMessages`/
`editMessage`/`readHistory` call sites in `src/`. tg-saved's `tg.sendText('self', report)` dies with tg-saved.
One exception, fenced: `src/contacts/import.ts:54,91` calls `importContacts`/`deleteContacts` — reachable
only from the human-invoked `check-phones`, never from the timer, and pinned to that one file by eval-31.

**THE SPECIFIC HAZARD.** `data/session.db` and `.psst/` sit in the same working-directory tree as
`data/archive/`, the directory agents are meant to read. Paths are cwd-relative by design, so anything
granted read access to the archive gets read access to the credential store one level up — and
`TG_SESSION_STRING` is a full account credential: whoever holds it is logged in, no password, no 2FA in the way.
Mitigation in force order: (1) `/srv/tgu` is `0700 tgu:tgu`; (2) **agents get no filesystem path into it at
all — they read the brain**, which is the real fix, because the hazard only exists if someone hands out a
path; (3) `0600` on `data/session.db` and `sync-state.json` as defence in depth — `0644` is exactly the bug
found on tg-saved's session db; (4) `data/` stays gitignored and the pre-commit hook is never bypassed.

`ponytail:` co-locating the secret and the archive is a deliberate shortcut that survives only on rule 2.
Ceiling: it fails the moment a local agent, a backup job or a bind mount needs the archive.
Upgrade path: `TGU_DATA_DIR` splits the roots — secrets under `/srv/tgu`, archive under `/srv/tgu-archive` `0750 tgu:brain`.

---

## Amendment 2026-08-09 — `deploy/ship.sh` becomes `tgu ship`; D5/D7/D14 amended, not overturned

DECIDED by the human, binding: shipping is a SUBCOMMAND OF THE SAME CLI but a SEPARATE PROCESS.
`deploy/ship.sh` does not exist; `tgu ship` does (`src/ship/index.ts`, `src/cli/commands/ship.ts`).

BECAUSE: one binary is the whole ergonomic argument, and D7 never depended on the shipper being a
shell script. It depended on the shipper being a different PROCESS that never holds a Telegram
credential. `tgu.service` has two `ExecStart=` lines, so `tgu ship` starts only after
`tgu export chats` has exited, and the archive it reads is finished markdown on disk.

WHAT REPLACES "imports no repo source": eval-48 walks the transitive import graph from
`src/ship/index.ts` and `src/cli/commands/ship.ts` and fails if a `session`, `client.ts`, `storage`
or `@mtcute` module ever appears in it, or if any reachable file so much as names `TG_*`,
`readSecret` or `SESSION_DB_PATH`. That is a stronger gate than "is a .sh file", which was only ever
a proxy for it.

RIPPLES: the ingester's own entrypoint still registers the session commands, so the `tgu` PROCESS
that runs `ship` does load those modules. Loading them reads no secret — `readSecret` is a function,
not a module side effect — but this is the seam to watch. `ponytail:` the boundary is now enforced
at the module-graph level for the ship code path rather than at the binary level. Ceiling: it fails
the day a session module acquires a top-level side effect that touches the vault. Upgrade path:
split `bin/tgu-ship` onto its own entrypoint that registers only the ship command.

ROUTING, as built: `TGU_BRAIN_MAP="7=personal,12=proximata"` in `/etc/tgu.env`, folder id to gbrain
`--source` id. Env rather than a new persisted file, because this is deploy configuration, not a
second copy of the folder truth. An unmapped or empty `folder_ids` fails the run.

BRAIN LOCATION (TASK-15 AC#4): STILL UNRECORDED, deliberately. `gbrain init` is blocked on the human
(PGLite is broken by a Bun vfs bug on this machine; no embedding key is present; the engine choice
costs money). Writing down a location for a brain nobody has built is precisely the
`~/Desktop/self/` failure mode D12 exists to stop repeating. See `backlog/MANUAL-gbrain-init.md`.

---

## State of the tree when this was written

`git status`: `src/session/cache.ts` and `test/session.test.ts` modified (the TASK-1 fix, uncommitted).
An earlier report claiming a clean tree was stale. Because the vault holds no session today
(`vaultSession null, localCache null, peers 0`), a loud `OperatorError` is *correct* behaviour right now —
and every work item except the live smoke test must therefore be fixture-based.
