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

---

## Amendment 2026-08-18 — D17: chats can be named by @username or link, everywhere

DECIDED by the operator, binding, after the alternative was argued and declined:
every command that takes a chat accepts a numeric id, an `@username`, a `t.me`
link, or `me`. Including `send`. This narrows D13 clause 3 ("numeric peer ids
only, never a name or @username"), which is hereby superseded.

BECAUSE the id-only rule was applied uniformly to reads, where it bought little
and cost a lot. The loop it forced was: run `peers find`, read a table by eye,
retype nine digits, every single time, for `dump`, `media pull` and `watch` -
none of which do anything irreversible. Asked whether the tool was usable by
someone other than its author, the honest answer was no, and this was the
largest reason.

WHAT REPLACES THE RULE. "Ids only" was a *prevention* control: an unresolvable
name cannot reach the wrong person. Its replacement is a *detection* control,
and the substitution is only sound because of what is bolted to it:

1. **Resolve then show.** Every command turns the reference into a concrete
   identity and prints name, @handle and id together before acting. For sends
   this is a blocking confirmation that names the resolved peer, and states when
   the target came from a handle rather than an id.
2. **Lookalikes are rejected at parse time, offline.** Telegram usernames are
   ASCII by definition, so a Cyrillic "о" in `@durоv` is not a valid username at
   all. `parsePeerRef` refuses it before any network call. This is the only
   homoglyph defence that actually works here: a confirmation prompt cannot help,
   because the resolved name of the impostor account would look equally correct.
   Pinned by eval-63.
3. **Resolution lives in the command layer, never in `src/send/`.** There remains
   exactly one place where a reference becomes an identity and exactly one place
   that identity is confirmed and logged. `assertPeerId` stays as the send
   module's own boundary. Pinned by eval-33 and eval-65.

RESIDUAL RISK, stated plainly: a *typo* in a handle that happens to be a real
account (`@durvo` for `@durov`) still resolves, and the confirmation prompt is
the only thing between that and a delivered message. Under the old rule this
failure was impossible. That risk was raised, and the operator chose the
ergonomics; the mitigation is that the prompt shows the full resolved identity
rather than an unreadable number, which is strictly more legible than what it
replaced.

ALSO: `peers find --id-only` prints exactly one id for shell composition and
REFUSES when the needle matches several chats, rather than picking the first.
Silent first-match selection would reintroduce the wrong-person failure through
the back door.

## Amendment 2026-08-18 — D18: the package is `@qwadratic/tg`, the command is `tg`

DECIDED by the operator: publish as `@qwadratic/tg`; the installed command is
`tg`. Supersedes D1's `telegram-utils` / `tgu` naming.

BECAUSE npm refused the unscoped name outright:

> 403 Forbidden - Package name too similar to existing package telegramutils;
> try renaming your package to '@qwadratic/telegram-utils'

`telegramutils` is abandoned - six versions, last published 2018 - but npm's
similarity check does not care. Scoped names skip that check entirely, so a
scope was the only candidate guaranteed to publish. `tgu`, `tgutils` and
`telegram-utils-cli` were all free but sit equally close to the blocked name and
`tgu-cli`, so any of them could have produced the same 403 on the next attempt.

The GitHub repository is NOT renamed. `repository`, `homepage` and `bugs` still
point at qwadratic/telegram-utils, which is where the code actually lives.

ENV VARS KEEP THE `TGU_` PREFIX, deliberately. Renaming them to `TG_` would put
settings in the same namespace as the vault secrets (`TG_SESSION_STRING`,
`TG_API_ID`), which D1 rejected for its own reasons, and - more concretely - the
operator's existing agent instructions and workflows in other repositories pass
`TGU_NON_INTERACTIVE=1`. If that stopped being read, an unattended run would hang
forever on a phone-number prompt, which is the exact failure that variable
exists to prevent. A rename there is a separate change needing a fallback shim.

WHAT THE RENAME BROKE, and how it was caught. `isGlobalInstall()` built its path
marker from a hardcoded `node_modules/telegram-utils/` literal assembled out of
`${sep}` fragments, so the bulk rename updated the doc comment above it and left
the code alone. A real scoped install then reported "not a global install" and
disabled auto-update permanently and silently. No test caught it, because the
suite always runs from a checkout where that answer is correct. Fixed by
deriving the marker from a single `PACKAGE_NAME` constant, and pinned by eval-75
(fake module URLs standing in for an installed copy, including a near-miss
`@someoneelse/tg`) and eval-76 (the constant matches package.json).

`ponytail:` three literals now derive from `PACKAGE_NAME`, but `bin.tg` in
package.json and the smoke job's `tg` invocations are still independent strings.
Ceiling: renaming the COMMAND, as opposed to the package, still touches several
places. Upgrade path if that ever happens: assert the bin key inside eval-76,
which already reads package.json (it checks the key is exactly `tg` today).
