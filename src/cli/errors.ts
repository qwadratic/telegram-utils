import chalk from 'chalk'
import { OperatorError } from '../errors.js'
import { EXIT } from '../exit-codes.js'

/**
 * Map an error to its exit code.
 *
 * Anything that is not an OperatorError is a bug in this tool, and bugs exit 1
 * with their stack. An OperatorError carries the code that says what the caller
 * should do about it.
 */
export function exitCodeFor(error: unknown): number {
  return error instanceof OperatorError ? error.exitCode : EXIT.bug
}

/**
 * Did this invocation ask for machine-readable output?
 *
 * Read from argv rather than threaded through every command, because the error
 * handler is reached from paths that never parsed options - a throw inside
 * argument validation happens before commander finishes.
 */
function wantsJson(argv: string[] = process.argv): boolean {
  return argv.includes('--json')
}

/**
 * Print a failure as JSON on stdout, mirroring the exit code.
 *
 * Without this, `tg dump ... --json | jq` on a failure yields an empty stream
 * and a status code, so "no results", "not configured" and "broken" are
 * indistinguishable to the consumer that most needs to tell them apart.
 */
function printJsonError(error: unknown): void {
  const exit = exitCodeFor(error)
  const name = (Object.entries(EXIT).find(([, v]) => v === exit) ?? ['bug'])[0]
  const message = error instanceof Error ? error.message : String(error)
  process.stdout.write(
    `${JSON.stringify({
      ok: false,
      error: { code: name, exit, message: message.split('\n')[0], detail: message }
    }, null, 2)}\n`
  )
}

export function handleChalkError(error: unknown): never {
  if (wantsJson()) {
    printJsonError(error)
    process.exit(exitCodeFor(error))
  }

  if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`))
    if (error.stack && !(error instanceof OperatorError)) {
      console.error(chalk.red(error.stack))
    }
  } else {
    console.error(chalk.red('An unexpected error occurred'))
  }
  process.exit(exitCodeFor(error))
}

export function handlePlainError(error: unknown): never {
  if (wantsJson()) {
    printJsonError(error)
    process.exit(exitCodeFor(error))
  }

  if (error instanceof Error) {
    console.error(`Error: ${error.message}`)
    if (error.stack && !(error instanceof OperatorError)) {
      console.error(error.stack)
    }
  } else {
    console.error('An unexpected error occurred')
  }
  process.exit(exitCodeFor(error))
}

export async function runCommand(
  fn: () => Promise<void>,
  onError: (error: unknown) => never = handleChalkError
): Promise<void> {
  try {
    await fn()
  } catch (error) {
    onError(error)
  }
}
