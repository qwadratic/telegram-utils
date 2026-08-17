import type { Command } from 'commander'
import { listPeers, matchPeers, renderPeers } from '../../peers/index.js'
import { runCommand } from '../errors.js'
import { OperatorError } from '../../errors.js'
import { withAuthenticatedClient } from './shared.js'
import { parseSince } from '../args.js'

/**
 * Peer discovery. Read-only.
 *
 * This is the lookup step that keeps names off the send path: `peers find`
 * prints ids for a human to read, and `send` takes only ids.
 */
export function registerPeersCommand(program: Command): void {
  const peers = program
    .command('peers')
    .description('Find chats and their numeric ids')
    .action(() => peers.help())

  peers
    .command('list')
    .description('List chats, most recent activity first')
    .option('--type <type>', 'Only this peer type: user, chat, channel')
    .option('--since <date>', 'Only chats active since this date (YYYY-MM-DD or a cutoff shortcut)')
    .option('--no-bots', 'Exclude bot chats')
    .option('--limit <n>', 'Dialogs to walk', '500')
    .option('--json', 'Machine-readable output')
    .action(async (options) => {
      await runCommand(async () => {
        // Parsed before the session is opened, so a bad --since costs no
        // connection and no lock. Pinned by eval-61.
        const since = options.since ? parseSince(options.since) : undefined
        const limit = Number.parseInt(options.limit, 10)
        if (!Number.isFinite(limit) || limit <= 0) {
          throw new OperatorError(`--limit must be a positive number, got ${options.limit}`)
        }

        const found = await withAuthenticatedClient((tg) =>
          listPeers(tg, {
            type: options.type,
            since,
            excludeBots: options.bots === false,
            limit
          })
        )

        // stdout carries only the payload, so `... --json | jq` works.
        process.stdout.write(options.json ? `${JSON.stringify(found, null, 2)}\n` : renderPeers(found))
      })
    })

  peers
    .command('find <needle>')
    .description('Find chats whose name or username contains <needle>')
    .option('--limit <n>', 'Dialogs to walk', '500')
    .option('--json', 'Machine-readable output')
    .action(async (needle: string, options) => {
      await runCommand(async () => {
        if (!needle.trim()) throw new OperatorError('Give a name to search for.')

        const limit = Number.parseInt(options.limit, 10)
        if (!Number.isFinite(limit) || limit <= 0) {
          throw new OperatorError(`--limit must be a positive number, got ${options.limit}`)
        }

        const found = await withAuthenticatedClient(async (tg) =>
          matchPeers(await listPeers(tg, { limit }), needle)
        )

        process.stdout.write(options.json ? `${JSON.stringify(found, null, 2)}\n` : renderPeers(found))
      })
    })
}
