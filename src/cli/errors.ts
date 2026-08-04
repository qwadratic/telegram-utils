import chalk from 'chalk'
import { OperatorError } from '../errors.js'

export function handleChalkError(error: unknown): never {
  if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`))
    if (error.stack && !(error instanceof OperatorError)) {
      console.error(chalk.red(error.stack))
    }
  } else {
    console.error(chalk.red('An unexpected error occurred'))
  }
  process.exit(1)
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
  process.exit(1)
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
