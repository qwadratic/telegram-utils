---
id: TASK-15
title: 'EXTERNAL: gbrain init on the target host and register the destination brains'
status: To Do
assignee: []
created_date: '2026-08-05 00:37'
updated_date: '2026-08-09 20:29'
labels:
  - gbrain
  - external
  - reflector
  - blocked
dependencies: []
priority: medium
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run `gbrain init` on the host that will hold the brain, and register `personal` and `proximata` as sources (local mode) or OAuth clients (thin mode).

WHY this is the real external blocker: nothing is initialised anywhere today. Verified read-only — ~/.gbrain/ has no config.json, `gbrain sources list` returns 'No brain configured', ~/.pi/agent/mcp.json is an empty server map, crontab is empty, there are no gbrain launchd agents, `gbrain integrations doctor` returns no_integrations, and gbrain-private execs a path that does not exist. The planning documents under ~/Desktop/self/ that describe a wired MCP, 652 pages, launchd and cron are stale narrative. They are not corrected from this repo: the fix is a working system, not an updated story.

Default taken: the brain runs co-located on the same VM — fewer moving parts, no network secret, and --source routing works. Evidence is thin here because no brain exists yet. If it later becomes remote, the only change is ship.sh gaining a per-brain remote client secret and dropping --source.

Runs in parallel with everything else; owned outside this repo.

Size: M — the commands are trivial; the blocker is that nothing exists yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 gbrain sources list on the target host no longer returns 'No brain configured'
- [ ] #2 the personal and proximata destinations are both registered and each is addressable by the mechanism ship.sh uses
- [ ] #3 a hand-run gbrain capture of one sample file lands a page that is retrievable by slug
- [ ] #4 the brain's location (co-located or remote) is recorded in the decision log so ship.sh's routing matches reality
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
BLOCKED ON IVAN (status stays To Do; no Blocked status exists in this config, hence the 'blocked' label). Exact commands and both decisions are in backlog/MANUAL-gbrain-init.md.

Two blockers, neither guessable by an agent:
1. gbrain init --pglite fails on this machine - PGLite cannot extract its WASM payload because Bun's bunfs root is read-only. Fix is 'bun upgrade'. So the documented zero-config default is unavailable right now.
2. No embedding-capable key is in the environment (OPENROUTER_API_KEY is, and gbrain picked it up for chat only). Engine choice (PGLite / local Postgres / Supabase ~25 a month) and embedding provider are money and data decisions.

NOT DONE and never to be done: restoring anything from ~/.quarantine-gbrain-20260804. It holds a leaked plaintext Supabase password. The brain is initialised fresh or not at all.

What was proven anyway, against the real gbrain 0.42.26 binary in a throwaway brain (GBRAIN_HOME=/tmp/tgu-gbrain-scratch.25he/home, Postgres db tgu_scratch_brain, pgvector 0.8.6 installed via brew to make it possible): a real archive file rendered by writeChatFile ships with 'tgu ship' and comes back out of both 'gbrain search' and 'gbrain get <slug>'; gbrain parses the frontmatter and KEEPS type: note with no legacy_type; folder_ids survives as a YAML list; --source routing works and an unknown source exits 1. So AC#1, #2 and #3 hold for a brain of the shape ship expects - just not yet for Ivan's real brain.

AC#4 (record the brain's location in the decision log) stays open until the engine is actually chosen: writing down a location nobody has built would be exactly the ~/Desktop/self/ failure mode D12 exists to stop repeating.
<!-- SECTION:NOTES:END -->
