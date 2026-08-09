# Working in this repo

## Run commands, do not ask for passwords

There is no session password prompt. `openSession()` in `src/session/index.ts`
resolves auth from the psst vault or the local cache. If a command asks you for
anything, that is a bug.

Always set `TGU_NON_INTERACTIVE=1`. Without it, a run with a pty attached
that has no session will stop on "Enter your phone number" and wait forever.

```sh
TGU_NON_INTERACTIVE=1 tgu folders list --json
```

Only a human can create a session, because only a human receives the login code.
When you see `No usable Telegram session`, stop and ask for
`tgu session login` to be run at a terminal. Do not try to work
around it.

## Never print a session

`TG_SESSION_STRING` is a full account credential: whoever holds it is logged in
as the user, and no password or 2FA challenge stands in the way.

- Do not `psst get TG_SESSION_STRING` to "check" it. Use
  `tgu session status`, which prints a fingerprint.
- Do not echo it into a log, a commit, an issue, or a demo recording.
- Write secrets with `psst set NAME --stdin` so the value goes over a pipe and
  never lands in argv, where `ps` and shell history can see it.

If one does leak, revoking it in Telegram (Settings > Privacy & Security >
Active Sessions) is the fix. Deleting the vault entry does nothing.

## One instance at a time

`data/session.lock` is taken by every command that connects. Do not run two
export commands concurrently and do not delete the lock to "unblock" a run -
two clients on one auth key corrupt Telegram's message-box state and can get the
session revoked. If a lock is genuinely stale, the next run reclaims it on its
own once the recorded pid is gone.

## Layout

| path | role |
| --- | --- |
| `src/session/psst.ts` | vault access; the only place that shells out to `psst` |
| `src/session/lock.ts` | single-instance lock |
| `src/session/cache.ts` | local encrypted cache path and peer-count helpers |
| `src/session/index.ts` | `openSession` / `withSession` - the entry point for auth |
| `src/folders/status.ts` | pure derivation of folder recency from sync state |
| `src/cli/commands/` | one file per command group, registered in `src/index.ts` |

Data paths (`data/config.json`, `data/archive`, `data/session.db`) resolve
against the current working directory, not the repo.

## Conventions

- `OperatorError` (`src/errors.ts`) is for environment problems: the CLI prints
  its message with no stack trace, so the message must say what to do next.
  Anything else is a bug and keeps its stack.
- Folder recency is derived from per-chat watermarks, never stored separately.
  Keep it that way, or the two drift apart.
- Tests are `node:test` + `assert`, no framework: `pnpm test`.
- Typecheck with `npx tsc --noEmit` before calling anything done.

## Before you commit

The pre-commit hook runs psst and gitleaks. It is tracked at
`.githooks/pre-commit`; a fresh clone needs `git config core.hooksPath .githooks`
once. Never bypass it to get a commit through.

Never commit anything under `data/` - it holds the session cache and real
exported messages. It is gitignored; keep it that way.
