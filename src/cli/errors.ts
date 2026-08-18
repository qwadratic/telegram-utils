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

export function handleChalkError(error: unknown): never {
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
