---
id: TASK-12
title: 'Revoke tg-saved''s Telegram authorization, then delete its session artefacts'
status: To Do
assignee: []
created_date: '2026-08-05 00:37'
updated_date: '2026-08-18 05:17'
labels:
  - security
  - cleanup
  - human
dependencies:
  - TASK-11
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
STILL LIVE AND STILL UNREVOKED, verified 2026-08-18: ~/.config/gbrain/telegram.session.db is present on this machine. That is a full Telegram auth key belonging to the deleted tg-saved project - anyone holding it is logged in as the operator, with no password and no 2FA in the way, and it has been sitting there since at least 2026-08-05.

ORDER MATTERS, and it is the reverse of the intuitive one: REVOKE FIRST in Telegram (Settings > Privacy & Security > Active Sessions), THEN delete the file. Deleting first leaves a live authorisation on Telegram's side with nothing local left to identify which row in Active Sessions to revoke.

This is now the oldest open security item in the repo and the only one that cannot be fixed by code.
<!-- SECTION:NOTES:END -->
