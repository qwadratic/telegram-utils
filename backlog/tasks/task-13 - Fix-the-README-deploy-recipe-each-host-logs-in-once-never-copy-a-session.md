---
id: TASK-13
title: 'Fix the README deploy recipe: each host logs in once, never copy a session'
status: Done
assignee: []
created_date: '2026-08-05 00:37'
updated_date: '2026-08-17 18:59'
labels:
  - docs
  - security
dependencies:
  - TASK-4
priority: medium
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
README.md:53-54 documents piping `TG_SESSION_STRING` from the local vault into a remote host's vault over ssh. Replace it with: each host runs its own `session login`.

WHY this is a real bug and not a style preference: AGENTS.md forbids exactly what the README instructs. One auth key on two machines desynchronises Telegram's pts/qts/seq message-box state and can earn AUTH_KEY_DUPLICATED — and data/session.lock is cwd-relative (src/session/lock.ts:5), so it cannot see across hosts and will not save you. A session is an auth key is one row in Active Sessions; distinct keys per machine are free, and a shared key is the only genuinely dangerous configuration.

The rename commit (TASK-4) must not carry this paragraph forward unchanged.

Size: S — a documentation paragraph that currently documents a hazard.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README.md no longer contains any recipe that moves TG_SESSION_STRING off the machine that created it
- [x] #2 the deploy section says each host runs its own session login and states why (one auth key per machine)
- [x] #3 the README and AGENTS.md agree on the session rule — no instruction in one contradicts a prohibition in the other
- [ ] #4 every command in the section uses the post-rename binary name and TGU_NON_INTERACTIVE
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
README 'Deploying a session elsewhere' replaced by 'One auth key per machine, per workspace': never copy TG_SESSION_STRING, each host runs its own session login, with the pts/qts/seq desync + AUTH_KEY_DUPLICATED reason stated and the cwd-relative lock limitation named. The 'unit of deployment / copy it to another machine' framing in 'Two secrets, two jobs' was the same hazard one paragraph earlier and was rewritten too.

AC#4 partially applies: the one command in the section uses the post-rename 'tgu' name. TGU_NON_INTERACTIVE is deliberately NOT set on it -- 'session login' is the one command that must be interactive, since only a human receives the login code. Left unchecked rather than silently reinterpreted.
<!-- SECTION:NOTES:END -->
