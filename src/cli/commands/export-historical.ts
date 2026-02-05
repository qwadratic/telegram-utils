import chalk from 'chalk'
import type { Command } from 'commander'
import { parseCutoffDate } from '../args.js'
import { runCommand } from '../errors.js'
import { runRecencyExport } from './recency-export.js'

export function registerExportHistoricalCommand(exportCommand: Command): void {
  exportCommand
    .command('historical')
    .description('Export historical messages across all chats to data/archive/historical.md')
    .option('--cutoff <YYYY-MM-DD>', 'Cutoff date for historical messages (exclusive)')
    .action(async (options: { cutoff?: string }) => {
      await runCommand(async () => {
        const cutoffDate = options.cutoff ? parseCutoffDate(options.cutoff) : null
        if (options.cutoff && !cutoffDate) {
          console.error(chalk.red('Error: --cutoff must be in YYYY-MM-DD format'))
          process.exit(1)
        }
        await runRecencyExport({
          mode: 'historical',
          cutoffDate,
          cutoffLabel: options.cutoff ?? null,
          introTitle: 'Export Historical Messages'
        })
      })
    })
}
