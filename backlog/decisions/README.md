# Decision log

One short md file per notable build choice. Filename: `<YYYY-MM-DD>-<slug>.md`.

Template (keep it 5-15 lines):
```
# <decision one-liner>
Date: YYYY-MM-DD  |  Author: <agent/human>
DECIDED: <what>
BECAUSE: <constraint/evidence, cite file:line or cmd output>
ALTERNATIVES REJECTED: <one line each, why>
RIPPLES: <what this fixes/freezes downstream>
```

Rules:
- Log CHOICES, not progress (progress = git history + backlog checkboxes).
- "Notable" = anything a future maintainer would ask "why is it like this?" about:
  config values, workarounds, ordering constraints, dropped features, tool picks.
- Written by agents as they go and by humans; committed with the change that
  embodies the decision.
- Hand-written, NOT via `backlog decision create` — matching the house convention.
  Everything else under `backlog/` is CLI-only: never edit `backlog/tasks/**` by hand.
