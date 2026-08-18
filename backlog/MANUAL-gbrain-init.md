# MANUAL — initialise the real gbrain brain (TASK-15)

Status: **blocked on Ivan.** Everything that does not depend on it has landed;
`tg ship` is proven end to end against a throwaway brain (see "What was already
proven" below). Two decisions and one credential are yours, not an agent's.

> **NEVER restore anything from `~/.quarantine-gbrain-20260804`.** It contains a
> leaked plaintext Supabase password. It stays dead. Nothing below reuses it, and
> nothing below should be "recovered" from it — initialise fresh.

## Verified starting state (2026-08-09, read-only)

- `gbrain sources list` → `No brain configured`
- `~/.gbrain/` contains only `.locks/` and `last-update-check` — no `config.json`
- `gbrain --version` → `0.42.26.0`, installed at `~/.bun/bin/gbrain`
- no `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `VOYAGE_*` / `GEMINI_*` in env;
  `OPENROUTER_API_KEY` **is** present (gbrain auto-detected it for chat)

## Blocker 1 — PGLite does not work on this machine

`gbrain init --pglite` fails before it writes anything:

```
PGLite failed to initialize its WASM runtime.
  ... `/$$bunfs/root` is read-only on your system, so PGLite cannot extract
  its pglite.data WASM payload.
  Fix: `bun upgrade`
```

So the documented default (local PGLite, no server) is unavailable until
`bun upgrade` fixes it. **Try `bun upgrade` first** — if PGLite then works it is
the smallest possible brain and needs no database at all.

## Blocker 2 — you must choose the engine, and you must supply an embedding key

Both are money/data decisions and neither may be guessed.

| choice | what it costs | notes |
|---|---|---|
| PGLite | nothing | blocked above; retry after `bun upgrade` |
| local Postgres | nothing | already running on `:5432`; `pgvector 0.8.6` was installed for the proof below |
| Supabase | ~$25/mo | remote; **do not** reuse the quarantined credential |

Embeddings: no embedding-capable key is in the environment. Without one, keyword
`gbrain search` works and hybrid `gbrain query` does not. `--no-embedding` is a
supported, reversible choice — you can set a model later with
`gbrain config set embedding_model <id>`.

## Commands to run

### Option A — local Postgres, co-located (matches D15's "co-located" default)

```sh
createdb gbrain
gbrain init --url "postgres://$(whoami)@localhost:5432/gbrain" --no-embedding
```

Drop `--no-embedding` and pass `--model openrouter` (or `--embedding-model
<provider>:<model>`) if you want hybrid search from the start. Interactive
prompts you may hit: a provider picker (only when several keys are present) and
an "install the bundled skillpacks?" question at the very end — answering no is
safe and reversible.

### Option B — PGLite, after `bun upgrade`

```sh
bun upgrade
gbrain init --pglite --no-embedding
```

### Then register the two destination brains

```sh
gbrain sources add personal   --path ~/brains/personal
gbrain sources add proximata  --path ~/brains/proximata
gbrain sources list          # must no longer say "No brain configured"
```

### Then tell ship which Telegram folder feeds which brain

Get the folder ids from `tg folders list`, then put them in `/etc/tg.env`
(VM) or your shell (local):

```sh
export TGU_BRAIN_MAP="7=personal,12=proximata"
tg ship --dry-run      # prints slug -> source per file, execs nothing
tg ship
```

A file whose `folder_ids` names a folder that is not in the map **fails the
run**. That is deliberate: ship never picks a default brain.

## What was already proven, and what it does not prove

Proven, against the real `gbrain 0.42.26` binary, in a throwaway brain
(`GBRAIN_HOME=/tmp/tg-gbrain-scratch.25he/home`, Postgres db `tgu_scratch_brain`):

- a real archive file rendered by `writeChatFile` ships with `tg ship` and
  comes back out of both `gbrain search` and `gbrain get <slug>`
- gbrain parses the frontmatter as YAML and **keeps `type: note`** — no
  `legacy_type`, no silent retype
- `folder_ids: [7]` survives as a YAML list; `title` keeps its embedded quotes
- re-running `tg ship` captures nothing; `tg ship --all` re-captures and the
  brain still holds exactly one page — the slug is doing its job as the
  `UNIQUE (source_id, slug)` dedup key
- an unroutable file exits non-zero with the filename in the message

Not proven: anything about the brain you are about to create — engine choice,
embedding model, `personal`/`proximata` naming, or that a VM exists. Also not
proven: that `--source` routing behaves the same on a *thin-client* install; the
scratch brain is local, and `--source` is explicitly unsupported in thin-client
mode. If the brain ends up remote, ship needs a per-brain remote client secret
and must drop `--source`.

Cleanup of the scratch brain, whenever you like:

```sh
rm -rf /tmp/tg-gbrain-scratch.25he
dropdb tgu_scratch_brain
```

`pgvector` was installed via Homebrew to make the proof possible. Keep it — the
real brain needs it too if you go with Option A.
