import type { Command } from 'commander'
import { dumpThread, renderDump } from '../../dump/index.js'
import { runCommand, handlePlainError } from '../errors.js'
import { OperatorError } from '../../errors.js'
import { withAuthenticatedClient } from './shared.js'
import { parseSince } from '../args.js'
import { assertPeerId } from '../../peers/id.js'

/**
 * `tgu dump <peer>` - one chat as a flat transcript on stdout.
 *
 * Errors go to stderr in plain text and the payload goes to stdout, so this
 * pipes: `tgu dump 245605314 --since last-7-days > thread.txt`.
 */
export function registerDumpCommand(program: Command): void {
  program
    .command('dump <peerId>')
    .description('Print one chat as a flat chronological transcript')
    .option('--since <date>', 'Stop at messages older than this')
    .option('--limit <n>', 'Maximum messages to read', '600')
    .option('--json', 'Machine-readable output')
    .action(async (peerId: string, options) => {
      await runCommand(async () => {
        // Validate every argument BEFORE opening a session. Otherwise a typo in
        // --since costs a connection and the single-instance lock, and reports
        // the wrong problem first.
        //
        // Same numeric-id rule as sending: a dump names a real person's chat,
        // and a fuzzy match here would silently read the wrong one.
        const id = assertPeerId(peerId)
        const since = options.since ? parseSince(options.since) : undefined
        const limit = Number.parseInt(options.limit, 10)
        if (!Number.isFinite(limit) || limit <= 0) {
          throw new OperatorError(`--limit must be a positive number, got ${options.limit}`)
        }

        const lines = await withAuthenticatedClient((tg) => dumpThread(tg, id, { limit, since }))

        process.stdout.write(
          options.json ? `${JSON.stringify(lines, null, 2)}\n` : renderDump(lines)
        )
      }, handlePlainError)
    })
}
