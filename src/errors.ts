/**
 * An error caused by the environment rather than a bug: no session yet, another
 * instance running, a missing credential.
 *
 * The message already says what to do about it, so the CLI prints it bare. A
 * stack trace on top would only bury the instruction - and an agent reading
 * stdout would have to skip past it to find the actual next step.
 */
export class OperatorError extends Error {
  /**
   * How the caller should react, as an exit code.
   *
   * Defaults to `notConfigured`, which is what almost every OperatorError has
   * always meant: something in the environment is missing and fixing it does
   * not require a human at a terminal. The two that DO differ - needing a login,
   * and losing the lock - set it explicitly.
   */
  readonly exitCode: number

  constructor(message: string, exitCode = 4) {
    super(message)
    this.name = 'OperatorError'
    this.exitCode = exitCode
  }
}
