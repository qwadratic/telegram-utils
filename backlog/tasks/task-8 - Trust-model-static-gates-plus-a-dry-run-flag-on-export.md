---
id: TASK-8
title: Trust-model static gates plus a --dry-run flag on export
status: In Progress
assignee: []
created_date: '2026-08-05 00:36'
updated_date: '2026-08-18 06:53'
labels:
  - evals
  - security
dependencies:
  - TASK-3
priority: high
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the five mechanical gates that pin the trust model to the test suite, and give `export` a `--dry-run` flag.

The two one-way rules the gates enforce: nothing holding a Telegram credential may call an LLM or gbrain; nothing talking to gbrain may hold a Telegram credential.

Gates (greps over src/ and package.json, run as node:test cases):
- no-telegram-write-api: zero hits for sendText|sendMedia|sendPhoto|forwardMessages|deleteMessages|editMessage|readHistory. No allowlist.
- account-mutation-allowlisted: every importContacts|deleteContacts hit is in src/contacts/import.ts and nowhere else. Those two calls are human-invoked via check-phones and never on the unattended timer path.
- no-llm-in-ingester: zero hits for openrouter|openai|anthropic|gbrain in src/, and no such dependency in package.json.
- no-writes-outside-cwd: snapshot $HOME before and after a full fixture export; the file list is unchanged. This is the property systemd's WorkingDirectory= contract depends on.
- archive-write-atomic: an interrupted write leaves the target absent or complete, never truncated.

WHY greps and not review: tg-saved's run.ts did `tg.sendText('self', report)` — a write back to Telegram in a codebase whose stated trust model forbids it. A rule nobody can regress against is not a rule.

`--dry-run` is what lets an agent verify which chats a run would touch before anything is written.

Size: S — greps and one flag.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 grep gate: zero sendText|sendMedia|sendPhoto|forwardMessages|deleteMessages|editMessage|readHistory anywhere in src/
- [ ] #2 grep gate: every importContacts|deleteContacts hit resolves to src/contacts/import.ts
- [ ] #3 grep gate: zero openrouter|openai|anthropic|gbrain in src/ and no such dependency in package.json
- [ ] #4 a full fixture export in a tmpdir cwd leaves the $HOME file list byte-identical before and after
- [ ] #5 export --dry-run prints the chats and message counts it would write and creates no file under data/
- [ ] #6 all five gates run in pnpm test with no network access
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC #1 AND #3 ARE NOW UNSATISFIABLE and must be rewritten before this task is worked. They demand 'zero sendText|sendMedia anywhere in src/' and 'zero gbrain in src/', both of which were deliberately overturned: src/send/ exists by decision D13 and src/ship/ talks to gbrain by design. The real gates that replaced them are evals 29-32, 48 and 84, which are stronger because they fence rather than forbid. Only AC #5 (export --dry-run) is still outstanding; #4 and #6 are worth keeping. Rewrite the AC to match the fences that exist, or split the --dry-run work into its own task and close this one.
<!-- SECTION:NOTES:END -->
