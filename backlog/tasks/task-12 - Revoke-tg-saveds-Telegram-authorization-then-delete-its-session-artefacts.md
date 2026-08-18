---
id: TASK-12
title: 'Revoke tg-saved''s Telegram authorization, then delete its session artefacts'
status: To Do
assignee: []
created_date: '2026-08-05 00:37'
updated_date: '2026-08-18 06:53'
labels:
  - security
  - cleanup
  - human
dependencies: []
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In Telegram: Settings > Privacy and Security > Active Sessions, revoke the authorization tg-saved created. THEN delete `~/.config/gbrain/telegram.session.db` and the `gbrain-telegram` Keychain items.

WHY the order: deleting the file first leaves a LIVE auth key on Telegram's side with nothing left locally that identifies which row to revoke. A session string is a full account credential — whoever holds it is logged in, with no password and no 2FA challenge in the way. Deleting the local copy does nothing to that; only revocation does.

That session db was also found at mode 0644.

Size: S — three clicks and two deletes, in an order that matters.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 the tg-saved authorization no longer appears in Telegram Active Sessions
- [ ] #2 revocation happened BEFORE any local deletion
- [ ] #3 ~/.config/gbrain/telegram.session.db no longer exists
- [ ] #4 the gbrain-telegram Keychain items no longer exist
- [ ] #5 telegram-utils' own session still works afterwards — session status --json still reports its fingerprint
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
UNBLOCKED 2026-08-18 after review. It had been gated behind task-11, which is gated behind writing a prose doc - so a LIVE full-account auth key waited on documentation. Verified that nothing is actually needed first: revoking happens in the Telegram app and deletes nothing locally, and the checkpoint value task-11 needs (lastMessageId 1730595) is already written into task-11's own text, so revocation cannot destroy it. Three clicks. Do it today.
<!-- SECTION:NOTES:END -->
