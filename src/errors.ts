/**
 * An error caused by the environment rather than a bug: no session yet, another
 * instance running, a missing credential.
 *
 * The message already says what to do about it, so the CLI prints it bare. A
 * stack trace on top would only bury the instruction - and an agent reading
 * stdout would have to skip past it to find the actual next step.
 */
export class OperatorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OperatorError'
  }
}
