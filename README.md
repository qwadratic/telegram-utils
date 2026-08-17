# Telegram Utils

TypeScript CLI tool that exports Telegram chats from selected folders into a searchable archive for AI-powered knowledge bases.

![Export journeys](demo/out/telegram-utils-export-journeys.gif)

## Quick start

```sh
pnpm install
psst init                              # local vault for this project
psst set API_ID && psst set API_HASH   # or reuse TG_API_ID / TG_API_HASH from your global vault

tgu session login    # once, at a terminal: phone + code + 2FA
tgu setup            # pick which Telegram folders to export
tgu export chats     # unattended from here on
```

`tgu` and `telegram-utils` are the same command; `tgu` is what the examples type.

After `session login` no command ever prompts for a password again, which is
what makes cron jobs and agents possible.

## Sessions

The Telegram session lives in a [psst](https://github.com/vpetrigo/psst) vault as
`TG_SESSION_STRING`. A run resolves it cheapest-first:

1. `$TG_SESSION_STRING` in the environment - set by `psst run`, `psst NAME -- cmd`, or CI
2. the local encrypted cache at `data/session.db`
3. the vault, imported into a fresh cache
4. an interactive login, whose result is written back to the vault

| command | purpose |
| --- | --- |
| `session login [--force]` | manual auth flow; stores the session string in psst |
| `session status [--json]` | session, peer cache and lock state; connects to nothing |
| `session verify` | proves the peer cache survives across separate processes |
| `session probe [--resolve n]` | one authenticated run, JSON report (used by `verify`) |

### Two secrets, two jobs

- **`TG_SESSION_STRING`** is an auth key: whoever holds it is logged in as you,
  with no password and no 2FA challenge in the way. Treat it like the account
  itself. It belongs to the machine and workspace that created it.
- **`TG_SESSION_DB_KEY`** encrypts `data/session.db` at rest and is generated per
  workspace on first use. It is not worth copying - the cache it protects is
  regenerable.

`session status` prints a **fingerprint** of the session string, never the
string, so you can tell two sessions apart without exposing either.

### One auth key per machine, per workspace

**Never copy `TG_SESSION_STRING` anywhere.** Each host and each workspace runs
its own `tgu session login` and gets its own auth key.

```sh
ssh host 'cd /srv/tgu && tgu session login'   # its own key, its own Active Sessions row
```

This is not a style preference. Two clients sharing one auth key desynchronise
Telegram's `pts`/`qts`/`seq` message-box state and can earn
`AUTH_KEY_DUPLICATED`, which revokes the session for everyone using it. The
single-instance lock cannot save you here: `data/session.lock` is
workspace-relative, so it cannot see another directory, let alone another host.

Distinct keys are free. A shared key is the only genuinely dangerous
configuration.

Revoke a leaked session in Telegram under Settings > Privacy & Security >
Active Sessions. Deleting the vault entry alone does not revoke anything.

### Why a local cache exists at all

A string session carries `{ version, primaryDcs, self, authKey }` and **no
peers**. Without `data/session.db` every run would re-resolve every chat's
access hash, which is slow and burns rate limit. `session verify` is the proof
that it works: it runs two independent processes and checks that the second one
sees the first one's peers *before* opening a connection.

### One instance at a time

`data/session.lock` holds the pid of the running instance. Two clients sharing
one auth key corrupt Telegram's message-box state and can get the session
revoked, so a second run is refused rather than queued. A lock left behind by a
crash is reclaimed automatically once its pid is gone.

## Automation

- `TGU_NON_INTERACTIVE=1` turns "ask the user" into a clear failure. Set it
  in cron jobs and agent runs, which often have a pty and would otherwise hang
  forever on a phone-number prompt.
- `--json` on `folders list` and `session status` is machine-readable; stdout
  carries only the payload.
- Exit codes: `0` success, `1` failure. Environment problems print an
  instruction and no stack trace.
- Data paths resolve against the current directory, so one install can drive
  several archives by `cd`-ing into them.

## Major Requirements (MVP)

- Authenticate with Telegram and persist encrypted session
- Discover folders, track chats, and refresh tracked chats before sync
- Export messages to a single file per chat with YAML frontmatter metadata
- Incrementally sync new messages with rate limiting and FLOOD_WAIT handling

## Roadmap Highlights

- Perplexity-friendly output research + additional export formats
- Google Drive upload command and live-sync archive research
- Live mode realtime sync with memory-only session option
- Cloud security research for safe deployment
- New chat filtering rules (participant allowlist, folder allowlist, title regex)

## Current State

- MVP complete: export + incremental sync working
- Archives stored at `data/archive` (single file per chat)
- Work is tracked in `backlog/`; decisions in `backlog/decisions/`

## Commands (MVP)

- `tgu export chats` - export chats into per-chat archives
- `tgu export recent --cutoff <value>` - combined recent export (cutoff required, inclusive)
- `tgu export historical [--cutoff <value>]` - combined historical export (cutoff optional, exclusive)
- `tgu folders list [--json]` - folders already synced, most recently updated first
- `tgu folders update [--folder <id> | --all]` - re-export one folder, or every folder stalest-first
- `tgu ship [--dry-run] [--all]` - capture new archive files into gbrain. Runs
  AFTER an export has exited, never during: it is a separate process that holds
  no Telegram credential. Needs `TGU_BRAIN_MAP="<folderId>=<gbrainSource>,..."`;
  a file whose folder is unmapped fails the run rather than picking a brain.
  See `deploy/README.md`.

Notes:

- Recency exports are incremental and rely on `data/archive/sync-state.json` for per-chat watermarks.
- Cutoff values are interpreted in your local timezone at the start of the day.
- Cutoff dates must not move earlier than a previous run for the same mode.

Cutoff shortcuts:

- `today`
- `yesterday`
- `start-of-week` (Monday)
- `start-of-month`
- `start-of-year`
- `last-7-days`

## Demo

`demo/render.sh` rebuilds the recording above. It drives the real CLI against
`demo/workspace`, a synthetic archive built by `demo/make-fixture.mjs`, so every
folder and chat name on screen is invented and nothing publishable can leak.
