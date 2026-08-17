---
id: TASK-23
title: 'Session doctor: prove a session is live before an agent commits to a long task'
status: To Do
assignee: []
created_date: '2026-08-17 19:31'
labels:
  - session
  - agent-ux
dependencies: []
priority: high
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PAIN, from transcripts: auth failure is the only pain that recurs across the whole recorded span (15 mentions on 5 distinct days, 2026-04-27 to 2026-08-17) and it always costs human attention mid-task. Verbatim, 2026-08-17: 'if you cannot login to telegram, let me know. I will rerun the authorization.' Same day: 'tg unblocked, lets replan wf accordingly. any issues?' And 2026-08-13: 'try telegram again?'

The shape of the failure is always the same: an agent plans work, starts it, hits an auth wall partway through, and the human has to notice and intervene. 'session status' already exists but answers 'what is on disk', not 'will this work'.

BUILD:
- 'tgu session doctor [--json]' answering one question: will unattended runs work? Checks vault session present, cache present, peer count, lock state, AND server-side liveness via one cheap authenticated probe.
- Record lastVerifiedAt; warn when a session has not been proven live in N days.
- A machine-readable needs-human outcome, e.g. {"status":"needs_human_login","command":"tgu session login","workspace":"/abs/path"} so an orchestrator surfaces exactly one actionable request instead of a stack trace.
- A distinct exit code for needs-human vs broken-environment, so a workflow can gate BEFORE doing 40 minutes of planning.

WHY THIS FIRST: it is the only pain in the transcripts that spans four months and blocks the human every time. Every other feature is worth less if the session is dead when the agent reaches it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 session doctor reports vault/cache/peers/lock without connecting, and liveness with exactly one probe
- [ ] #2 a dead or absent session exits with a distinct code and a machine-readable needs_human_login payload
- [ ] #3 lastVerifiedAt is persisted and a staleness warning appears past the threshold
- [ ] #4 doctor never prints the session string, only a fingerprint
<!-- AC:END -->
