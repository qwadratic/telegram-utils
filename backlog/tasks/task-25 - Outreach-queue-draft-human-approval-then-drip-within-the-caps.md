---
id: TASK-25
title: 'Outreach queue: draft, human approval, then drip within the caps'
status: To Do
assignee: []
created_date: '2026-08-17 19:31'
labels:
  - send
  - workflow
dependencies: []
priority: medium
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PAIN, from transcripts: the riskiest workflow is the least structured one. 2026-08-09, verbatim: 'find a list of recruiters i've spoke before on telegram, and build unique message for all of them, and fde profile attached. approve list with me and lets try telegram automated msg sending, not more than 3 messsages a day.' Earlier, 2026-06-12, the same shape for job applications: 'approve with me and hit apply'.

The operator asks for three things every time: a drafted batch, an explicit approval step, and a slow drip. The send guards added 2026-08-17 give per-run and per-day caps and an audit log, but no queue and no approval record -- so the only way to do this today is an agent looping 'tgu send text', which is exactly the unattended-burst shape the caps exist to prevent.

BUILD:
- 'tgu outreach add <peerId> --body-file <f>' appending to a 0600 queue in the workspace.
- 'tgu outreach review' resolving each peerId to a NAME, showing the body, recording approved/rejected per item. Human-only: refuses when it cannot prompt.
- 'tgu outreach run [--max-per-day 3]' sending only approved items, through the existing src/send/ guards and log, spread across days, idempotent (never re-sends a delivered item) and resumable after a crash.

WHY: it turns messaging strangers from a personal account into something with an approval gate and an audit trail, and it removes the reason an agent would ever want the caps raised.

NOTE: run must stay human-invoked. It must NOT become a timer target, or eval-30 (unattended paths cannot reach src/send/) has to be weakened -- which would be the wrong trade.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 queue and approval state are 0600 under the workspace data root, never containing a session
- [ ] #2 review resolves peer ids to names and refuses to approve in a non-interactive run
- [ ] #3 run sends only approved items, respects the existing per-run and per-day caps, and never re-sends
- [ ] #4 eval-30 still passes: no unattended entry point can reach the outreach run path
<!-- AC:END -->
