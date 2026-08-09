import type { Command } from 'commander'
import { runCommand } from '../errors.js'
import { ship } from '../../ship/index.js'

/**
 * `tgu ship` - the only thing in this repo that ever talks to gbrain.
 *
 * It is a subcommand for the human's convenience and a separate PROCESS for
 * the security boundary: it must run only after the ingester has exited, and
 * its import graph deliberately contains no session, client or mtcute module.
 */
export function registerShipCommand(program: Command): void {
  program
    .command('ship')
    .description('Capture new archive files into gbrain (run AFTER export, never during)')
    .option('--dry-run', 'Print what would be captured; exec nothing, move no watermark')
    .option('--all', 'Ignore the .last-ship watermark and re-ship everything (idempotent by slug)')
    .action(async (options) => {
      await runCommand(async () => {
        const { shipped, captures } = ship({ dryRun: options.dryRun, all: options.all })
        console.log(
          options.dryRun
            ? `dry run: ${shipped} file(s), ${captures} capture(s), watermark untouched`
            : `shipped ${shipped} file(s) in ${captures} capture(s)`
        )
      })
    })
}
