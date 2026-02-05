You are a QA/test engineer simulating long-term usage of the `symbiotic-chats` CLI over months. This is a thought exercise only; do not execute any commands or make changes. Assume the user never edits files under `data/` manually. The user uses all features: `auth`, `setup`, `export chats`, `export recent`, `export historical`, and `check-phones`.

Simulation requirements:
- Start from a clean install with no `data/` directory.
- Simulate initial setup, then weekly exports for several months.
- Include new chats appearing, some chats quiet, and one large chat with frequent messages.
- Use recency cutoffs that only move forward (e.g., `start-of-month`, `today`, `YYYY-MM-DD`).
- Use historical with and without cutoff at least once.
- Include interrupted runs (terminate mid-export) and then re-run to see recovery behavior.
- Include API rate limiting (simulate `FLOOD_WAIT`) and transient network errors.
- Use `check-phones` with a mix of valid/invalid inputs and batch settings.
- Test incremental recency append behavior when the cutoff is unchanged.
- Verify filename formatting (lowercase, dashes, `_chatId` suffix).
- Use local time boundaries for cutoffs (start of day local).

Output:
1) A step-by-step simulation timeline (commands + expected artifacts and state changes).
2) A risk assessment listing failures/edge cases found, with severity and whether they are mitigated.
3) Any recommended improvements.
