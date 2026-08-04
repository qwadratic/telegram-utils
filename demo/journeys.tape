# Export journeys for symbiotic-chats.
#
# Drives the real CLI against demo/workspace, a synthetic archive built by
# make-fixture.mjs. Every folder and chat name on screen is invented; no real
# Telegram account is touched, so the recording is safe to publish.
#
# Render:  demo/render.sh

Output demo/out/telegram-utils-export-journeys.gif
Output demo/out/telegram-utils-export-journeys.mp4

Set Shell "bash"
Set FontSize 20
Set Width 1300
Set Height 520
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 45ms

Hide
Type "cd demo/workspace && export PS1='$ ' && clear" Enter
Sleep 1s
Show

# --- Journey 1: what has already been exported, and how stale is it? ---
Type "symbiotic-chats folders list"
Sleep 500ms
Enter
Sleep 3s

# --- Journey 2: the same view for a script or an agent ---
Type "symbiotic-chats folders list --json | jq -c '.[] | {title, lastUpdated}'"
Sleep 500ms
Enter
Sleep 3s

Type "clear"
Enter
Sleep 500ms

# --- Journey 3: pick a folder to re-export, stalest first is visible ---
Type "symbiotic-chats folders update"
Sleep 500ms
Enter
Sleep 3s
Down
Sleep 1s
Down
Sleep 2s
Ctrl+C
Sleep 3s

Type "clear"
Enter
Sleep 500ms

# --- Journey 4: unattended run with no session refuses, and says what to do ---
Type "SYMBIOTIC_NON_INTERACTIVE=1 symbiotic-chats export chats"
Sleep 500ms
Enter
Sleep 3s

# --- Journey 5: only one client may hold the session ---
Type "sleep 60 & echo $! > data/session.lock"
Sleep 300ms
Enter
Sleep 1s
Type "symbiotic-chats folders update --folder 2"
Sleep 500ms
Enter
Sleep 3.5s

Hide
Type "kill %1 2>/dev/null; rm -f data/session.lock; clear"
Enter
Sleep 500ms
Show

# --- Journey 6: one place to see session, cache and lock state ---
Type "symbiotic-chats session status"
Sleep 500ms
Enter
Sleep 4s
