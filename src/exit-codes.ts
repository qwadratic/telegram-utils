/**
 * Exit codes, so an agent can act on a failure without parsing prose.
 *
 * Until now every failure exited 1, which forced a caller to regex the error
 * text to tell "you must log in" from "another run holds the lock" from "this
 * is a bug". Those need different responses: one needs a human, one needs a
 * retry in a minute, one needs a bug report. A cron job that cannot tell them
 * apart alerts on all three or none.
 *
 * Numbers are part of the contract now. Add, never renumber.
 */
export const EXIT = {
  /** Success. */
  ok: 0,
  /** A bug in this tool. Keeps its stack trace. */
  bug: 1,
  /** The caller used the CLI wrong: bad flag, bad peer reference, bad date. */
  usage: 2,
  /** Only a human can fix this, and only at a terminal: a login is required. */
  needsHuman: 3,
  /** Missing configuration or a missing external tool. Fixable unattended. */
  notConfigured: 4,
  /** Another run holds the workspace lock. Retrying later is the right move. */
  busy: 5,
  /** Something upstream failed: Telegram, gbrain, the network. Not our fault. */
  upstream: 6
} as const

export type ExitCode = (typeof EXIT)[keyof typeof EXIT]
