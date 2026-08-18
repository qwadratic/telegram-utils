# Telegram Utils

A command-line tool for reading your own Telegram from a terminal or an agent:
find a chat, dump a thread, pull media, archive folders into Markdown, and send
a message when you mean to.

`tgu` and `telegram-utils` are the same command; `tgu` is what the examples type.

![Export journeys](https://raw.githubusercontent.com/qwadratic/telegram-utils/master/demo/out/telegram-utils-export-journeys.gif)

## Install

```sh
npm install -g telegram-utils
```

It also needs [psst](https://github.com/vpetrigo/psst), a separate binary that
holds the secrets. `npm` cannot install it for you, so `tgu init` checks for it
and tells you if it is missing.

## Quick start

```sh
mkdir ~/chats/work && cd ~/chats/work

tgu init                 # scaffold this directory as a workspace
psst init                # a vault for this workspace
tgu session login        # once, at a terminal: phone + code + 2FA

tgu peers list --type user --no-bots     # who do I talk to?
tgu dump 108844221 --since last-7-days   # read one thread
```

After `session login`, no command ever prompts for a password again. That is
what makes cron jobs and agents possible.

## Workspaces

A workspace is a directory. Everything a run reads or writes lives under
`./data` inside it: the session, the config, the archive, the watermarks, the
send log.

```
~/chats/work/data/        <- one Telegram authorisation
~/chats/personal/data/    <- a different one
```

`cd` selects the workspace. No flag, no global config. Set `TGU_DATA_DIR` to
point the data root somewhere else, e.g. `TGU_DATA_DIR=/srv/tgu` for a service.

**Each workspace logs in separately and owns its own auth key.** This is the
important rule and the reason `init` does not offer to copy a session:

- A session string *is* an auth key. Whoever holds it is logged in as you, with
  no password and no 2FA challenge in the way.
- One auth key used from two places desynchronises Telegram's `pts`/`qts`/`seq`
  message-box state and can earn `AUTH_KEY_DUPLICATED`, which revokes it for
  everyone using it.
- The single-instance lock cannot save you: `data/session.lock` is
  workspace-relative, so it cannot see another directory, let alone another host.

Distinct keys are free, and each is one revocable row under Settings > Privacy &
Security > Active Sessions. A shared key is the only genuinely dangerous
configuration.

App credentials are the deliberate exception. `API_ID` and `API_HASH` identify
the *application*, not the login, and Telegram expects one app to have many user
sessions, so a new workspace inherits them from your global vault (also accepted
as `TG_API_ID` / `TG_API_HASH`) and only has to do the phone-code step.

`tgu init` also chmods the data root to `0700` and adds it to `.gitignore`,
because that directory holds a full account credential *and* real messages.

## Reading

| command | what it does |
| --- | --- |
| `peers list [--type user] [--since <date>] [--no-bots] [--json]` | chats, most recent activity first |
| `peers find <needle> [--json]` | chats whose name or username matches, accent-insensitively |
| `dump <peerId> [--since <date>] [--limit n] [--json]` | one chat as a flat chronological transcript on stdout |
| `media pull [peerId] [--kind photo,video] [--max n] [--to dir]` | download media; no peer means your Saved Messages |
| `watch [peerId] [--minutes n] [--kind ...]` | wait for media that has not been sent yet, then download it |

`peers find` exists because every other command takes a **numeric peer id**,
never a name. That is deliberate: a fuzzy match on the path that reads or writes
a real person's chat is one typo away from the wrong person. Look the id up once,
read it with your own eyes, then use it.

```sh
tgu peers find zoe            # -> 904417238  Zoë Ünal  user
tgu dump 904417238 --json | jq -r '.[].text'
tgu media pull 904417238 --kind video --max 4 --to /tmp/clips
```

`dump` writes the payload to stdout and everything else to stderr, so it pipes.

## Archiving

The archive path is the original job: whole folders of chats into one Markdown
file each, incrementally, shaped for a knowledge base.

- `export chats [--private-only] [--chats <ids>]` — export tracked folders, or
  just the listed chat ids
- `export recent --cutoff <value>` — combined recent export (cutoff required, inclusive)
- `export historical [--cutoff <value>]` — combined historical export (cutoff optional, exclusive)
- `folders list [--json]` — folders already synced, most recently updated first
- `folders update [--folder <id> | --all]` — re-export one folder, or every folder stalest-first
- `setup` — pick which folders to track
- `ship [--dry-run] [--all]` — capture new archive files into gbrain

Recency exports are incremental and rely on `data/archive/sync-state.json` for
per-chat watermarks. Cutoffs are interpreted in your local timezone at the start
of the day, and must not move earlier than a previous run for the same mode.

Cutoff shortcuts, accepted anywhere a date is: `today`, `yesterday`,
`start-of-week` (Monday), `start-of-month`, `start-of-year`, `last-7-days`, or
`YYYY-MM-DD`.

`ship` runs AFTER an export has exited, never during: it is a separate process
that holds no Telegram credential. It needs
`TGU_BRAIN_MAP="<folderId>=<gbrainSource>,..."`, and a file whose folder is
unmapped fails the run rather than picking a brain. See `deploy/README.md`.

## Sending

These are the only commands that write to Telegram, and they are built to be
hard to fire by accident.

| command | what it does |
| --- | --- |
| `send text <peerId> <text>` | send a message |
| `send media <peerId> <file> [--caption ...]` | send a file |
| `note <text>` | send to your own Saved Messages |
| `send log [--json]` | what this workspace has sent |

Five guards, each one enforced by a test:

1. **Numeric ids only.** `send text @durov ...` is refused. Use `peers find`.
2. **The recipient is confirmed by name.** An id is unreadable, so before
   sending, `tgu` resolves it back to a name and asks. `--yes` skips this.
3. **Unattended runs need `--yes`.** Without a human to ask and without the flag,
   the send is refused rather than assumed.
4. **Capped.** 5 per run and 20 per day (`TGU_MAX_SENDS_PER_RUN`,
   `TGU_MAX_SENDS_PER_DAY`). Failed attempts count too, because a retry loop
   against a peer that rejects is exactly what draws a report.
5. **Logged.** Every attempt appends to `data/sent.jsonl`, mode `0600`, recording
   the peer, kind, size and outcome — never the message content.

`note` takes no peer at all, so the everyday case of leaving yourself a note
cannot be aimed at another person by mistake.

The unattended commands provably cannot send: `test/trust.test.ts` walks the
import graphs of `export`, `folders`, `ship` and every read verb and fails the
suite if any of them can reach the send module. A cron job cannot message anyone.

## Sessions

The session lives in a psst vault as `TG_SESSION_STRING`. A run resolves it
cheapest-first:

1. `$TG_SESSION_STRING` in the environment — set by `psst run`, `psst NAME -- cmd`, or CI
2. the local encrypted cache at `data/session.db`
3. this workspace's vault, imported into a fresh cache
4. an interactive login, whose result is written back to this workspace's vault

| command | purpose |
| --- | --- |
| `session login [--force]` | manual auth flow; stores the session string in psst |
| `session status [--json]` | session, peer cache and lock state; connects to nothing |
| `session verify` | proves the peer cache survives across separate processes |
| `session probe [--resolve n]` | one authenticated run, JSON report (used by `verify`) |

`session status` prints a **fingerprint** of the session string, never the
string, so you can tell two sessions apart without exposing either.

`TG_SESSION_DB_KEY` encrypts `data/session.db` at rest and is generated per
workspace on first use. It is not worth copying: the cache it protects is
regenerable.

### Why a local cache exists at all

A string session carries `{ version, primaryDcs, self, authKey }` and **no
peers**. Without `data/session.db` every run would re-resolve every chat's access
hash, which is slow and burns rate limit. `session verify` is the proof that it
works: it runs two independent processes and checks that the second one sees the
first one's peers *before* opening a connection.

### One instance at a time

`data/session.lock` holds the pid of the running instance. Two clients sharing
one auth key corrupt Telegram's message-box state, so a second run in the same
workspace is refused rather than queued. A lock left behind by a crash is
reclaimed automatically once its pid is gone.

Different workspaces have different locks and different auth keys, so they can
run at the same time.

## Automation

- `TGU_NON_INTERACTIVE=1` turns "ask the user" into a clear failure. Set it in
  cron jobs and agent runs, which often have a pty and would otherwise hang
  forever on a phone-number prompt.
- `--json` is machine-readable on every read verb; stdout carries only the payload.
- Exit codes: `0` success, `1` failure. Environment problems print an
  instruction and no stack trace.
- Rate limiting is built in: history reads pause 1.5s plus jitter every 100
  messages, and `FLOOD_WAIT` is caught and waited out.

## Development

```sh
pnpm install
pnpm test              # 91 tests, node:test, no network
npx tsc --noEmit
```

Work is tracked in `backlog/` (`backlog task list --plain`); the reasoning behind
the build is in `backlog/decisions/`. `AGENTS.md` is the contract for anything
automated working in this repo.

`demo/render.sh` rebuilds the recording above. It drives the real CLI against
`demo/workspace`, a synthetic archive built by `demo/make-fixture.mjs`, so every
folder and chat name on screen is invented and nothing publishable can leak.
