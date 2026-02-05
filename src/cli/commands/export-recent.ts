import chalk from 'chalk'
import type { Command } from 'commander'
import { parseCutoffDate } from '../args.js'
import { runCommand } from '../errors.js'
import { runRecencyExport } from './recency-export.js'

export function registerExportRecentCommand(exportCommand: Command): void {
  exportCommand
    .command('recent')
    .description('Export recent messages across all chats to data/archive/recent.md')
    .requiredOption('--cutoff <YYYY-MM-DD>', 'Cutoff date for recent messages (inclusive)')
    .action(async (options: { cutoff: string }) => {
      await runCommand(async () => {
        const cutoffDate = parseCutoffDate(options.cutoff)
        if (!cutoffDate) {
          console.error(chalk.red('Error: --cutoff must be in YYYY-MM-DD format'))
          process.exit(1)
        }
        await runRecencyExport({
          mode: 'recent',
          cutoffDate,
          cutoffLabel: options.cutoff,
          introTitle: 'Export Recent Messages'
        })
      })
    })
}
