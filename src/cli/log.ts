import chalk from 'chalk'

type LogOptions = { stderr?: boolean }
type SummaryOptions = LogOptions & { leadingNewline?: boolean }

function writeLine(message: string, options?: LogOptions): void {
  if (options?.stderr) {
    console.error(message)
    return
  }
  console.log(message)
}

export function logInfo(message: string, options?: LogOptions): void {
  writeLine(message, options)
}

export function logWarning(message: string, options?: LogOptions): void {
  writeLine(chalk.yellow(message), options)
}

export function logSummary(message: string, options?: SummaryOptions): void {
  const prefix = options?.leadingNewline ? '\n' : ''
  writeLine(chalk.green(`${prefix}${message}`), options)
}
