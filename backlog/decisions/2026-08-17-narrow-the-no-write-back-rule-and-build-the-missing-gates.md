# Decision — the no-write-back rule is narrowed, not dropped; and the gates it assumed now exist

Date: 2026-08-17 | Author: agent (with the operator's explicit decision on the write question)
Scope: the security boundary, `src/send/`, evals 29-39, workspaces, the throwaway scripts.

Amends the 2026-08-05 decision log. Nothing there is overturned except where stated.

---

## D13 — Writing to Telegram is allowed, from one fenced module

DECIDED: `src/send/` exists and is the only place in `src/` that calls a Telegram
write RPC. `tgu send text`, `tgu send media`, `tgu note`, `tgu send log`.

BECAUSE the previous absolute was already false in practice. The 2026-08-05 log
recorded, correctly at the time:

> No write-back to Telegram: `disableUpdates: true` (`src/client.ts:38`) means the
> client never even receives updates, and there are ZERO `sendText`/`sendMedia`/
> `forwardMessages`/`deleteMessages`/`editMessage`/`readHistory` call sites in `src/`.

Between Aug 11 and Aug 17 the operator sent an APK, two images, notes to Saved
Messages and outreach messages — from four throwaway scripts in the repo root
(`send-apk.ts`, `sendimg.ts`, `send-text.ts`, `save-note.ts`) that imported
`src/session/index.js` and therefore held the same credential, with no cap, no
confirmation, no log and no test. The capability was already present. What was
absent was every guard. Keeping the rule as written would have preserved a clean
`src/` tree while the real sends continued happening somewhere unreviewable.

So the rule becomes a fence rather than a prohibition:

1. Write RPCs appear only in files on an allowlist — eval-29.
2. No unattended entry point can reach the send module — eval-30. The import
   graphs of `export`, `folders`, `ship` and `sync` are walked and must not
   contain it, so a cron job or timer provably cannot message anyone.
3. Read verbs cannot reach it either — eval-31. This is why `assertPeerId` lives
   in `src/peers/id.ts` rather than in `src/send/`: `dump` and `media` need the
   numeric-id rule without linking the code that can write.
4. Numeric peer ids only, never a name or `@username` — eval-33.
5. `--yes` required when no human can be asked — eval-34.
6. Caps per run (5) and per day (20), failed attempts included — eval-37.
7. An append-only `0600` log of peer, kind, size and outcome, never content —
   eval-35, eval-36.

ALTERNATIVES REJECTED:
- **Keep `src/` read-only, leave sending in scripts.** Preserves a true statement
  about `src/` and nothing else. The sends keep happening with zero guards; the
  invariant protects the codebase rather than the account.
- **A separate `tgu-send` binary.** The one-binary ergonomics argument that
  produced `tgu ship` (Amendment 2026-08-09) applies unchanged, and a second
  binary sharing the session module gains no isolation the import-graph evals do
  not already provide.
- **Allow `--peer @username`.** One typo, one homoglyph or one stale cache entry
  delivers to the wrong person with no undo. `peers find` makes the lookup a
  read-only step a human eyeballs.

RIPPLES: `check-phones`'s `importContacts`/`deleteContacts` exception is now one
of several allowlist entries rather than a lone special case, and eval-29 covers
both. The `disableUpdates: true` setting is untouched — this adds sending, not
receiving.

`ponytail:` the caps are per workspace, because the log is per workspace. Ceiling:
five workspaces means five separate daily budgets against one Telegram account.
Upgrade path when that matters: a shared counter under `$HOME`, at the cost of
making workspaces non-independent.

## D14 — The gates D-boundary claimed were never written; they are now

DECIDED: `test/trust.test.ts` holds evals 29-39.

BECAUSE the 2026-08-05 log's "Security boundary (two one-way rules, both
mechanically checkable)" section cited evals 30, 31 and 32 as the enforcement.
Those evals did not exist. The suite ran 1-9, 11-17, 22-28, 40-49: the whole
29-39 range was empty, and TASK-8 ("Trust-model static gates") was still To Do.
Only eval-48, the ship-side import graph, was ever built. So the
credential-holding half of the boundary — the half that matters for an account
credential — was documentation describing a test suite that did not exist.

Both new graph gates were tripwire-verified rather than assumed: injecting
`tg.sendText(` into `src/folders/status.ts` fails eval-29, and adding
`import { sendText } from '../send/index.js'` to `src/sync/index.ts` fails
eval-30. A gate that has never been observed failing is not known to be a gate.

RIPPLES: closes TASK-8's static-gate half. The `--dry-run` flag on export that
TASK-8 also asked for is not part of this and stays open.

## D15 — A workspace is a directory, and each owns its own auth key

DECIDED: `TGU_DATA_DIR` in `src/paths.ts` is the single data root; `tgu init`
scaffolds a workspace, chmods it `0700` and gitignores it. Default stays the
relative string `data`.

BECAUSE this is verbatim the upgrade path D6 wrote for itself:

> `ponytail:` the data root is a hard-coded relative path. Ceiling: it breaks when
> two things on one host need different roots. Upgrade path: `TGU_DATA_DIR` in
> `src/utils/archive-path.ts` plus the three other path consts.

Two things on one host now need different roots: the operator wants `tgu`
installed globally and used from a chat folder per project. Keeping the default
RELATIVE is what preserves `cd`-selects-the-workspace and keeps the 69
pre-existing tests passing unchanged — they rely on `withTempDir`'s `chdir`, which
only works because paths resolve at the moment of the fs call.

App credentials are the deliberate exception: `API_ID`/`API_HASH` identify the
application, not the login, and `readSecret` already falls back to the global
vault, so a new workspace inherits them and only does the phone-code step. This
is the operator's explicit choice, to avoid re-entering the API pair per folder.

ALTERNATIVES REJECTED:
- **One shared session across workspaces.** This is the `AUTH_KEY_DUPLICATED`
  configuration. `data/session.lock` is workspace-relative and cannot see another
  directory, so nothing would detect it. Rejected for the same reason TASK-13
  removed the README recipe that did it across hosts.
- **An absolute default data root.** Silently merges every workspace into one.
- **A global config mapping directories to workspaces.** A second truth that
  drifts from the directory you are standing in.

## D16 — The thirteen root scripts are deleted, having become verbs

DECIDED: deleted. `dump`, `peers list`, `peers find`, `media pull`, `watch`,
`send text`, `send media`, `note` replace them. Git history is the "in case",
exactly as D11 argued when deleting `src/sync/detect.ts`.

BECAUSE they were the tracker nobody was reading: three near-duplicate thread
dumpers, three near-duplicate media pullers, four near-duplicate senders, each
one written because the CLI could not do the thing, each one holding a live
credential with no test. The uncommitted `--chats` patch to `export-sync` was a
fourth attempt at the same gap.

RIPPLES: `mediaFilename` deliberately does NOT reuse `sanitizeFilename` — that
helper appends `_<chatId>` after the extension, turning `report.png` into
`report.png_99`, a file no viewer opens. Pinned by eval-38, which also covers
traversal.
