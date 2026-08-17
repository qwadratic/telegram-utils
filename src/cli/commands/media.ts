import type { Command } from 'commander'
import chalk from 'chalk'
import { MEDIA_KINDS, pullMedia, renderPulled } from '../../media/index.js'
import { runCommand } from '../errors.js'
import { OperatorError } from '../../errors.js'
import { resolveSelfPeer, withAuthenticatedClient } from './shared.js'
import { parseSince } from '../args.js'
import { assertPeerId } from '../../peers/id.js'

/** Validate `--kind photo,video` against the known kinds. */
function parseKinds(raw?: string): string[] {
  if (!raw) return []

  const kinds = raw
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)

  const unknown = kinds.filter((k) => !MEDIA_KINDS.includes(k as never))
  if (unknown.length > 0) {
    throw new OperatorError(
      `Unknown media kind(s): ${unknown.join(', ')}\n` +
      `  Known kinds: ${MEDIA_KINDS.join(', ')}`
    )
  }
  return kinds
}

export function registerMediaCommand(program: Command): void {
  const media = program
    .command('media')
    .description('Download media out of a chat')
    .action(() => media.help())

  media
    .command('pull [peerId]')
    .description('Download media from a chat, or from Saved Messages when no peer is given')
    .option('--to <dir>', 'Destination directory', 'media')
    .option('--kind <kinds>', `Comma-separated: ${MEDIA_KINDS.join(', ')}`)
    .option('--max <n>', 'Stop after this many files', '10')
    .option('--scan <n>', 'Messages to scan while looking for matches', '200')
    .option('--since <date>', 'Ignore messages older than this')
    .option('--json', 'Machine-readable output')
    .action(async (peerId: string | undefined, options) => {
      await runCommand(async () => {
        // Everything checkable is checked before a session is opened, so a typo
        // costs nothing. The peer is validated here too, when given: only the
        // *absent* case needs a client, because Saved Messages is your own id.
        const kinds = parseKinds(options.kind)
        const since = options.since ? parseSince(options.since) : undefined
        const explicitId = peerId ? assertPeerId(peerId) : null

        const files = await withAuthenticatedClient(async (tg) => {
          // No peer means Saved Messages, which is the chat with yourself. That
          // was the most common case among the throwaway scripts.
          const id = explicitId ?? (await resolveSelfPeer(tg))

          return pullMedia(tg, id, {
            destDir: options.to,
            kinds,
            max: Number.parseInt(options.max, 10),
            scanLimit: Number.parseInt(options.scan, 10),
            since,
            onFile: options.json
              ? undefined
              : (file) => console.error(chalk.dim(`  got ${file.path}`))
          })
        })

        process.stdout.write(
          options.json ? `${JSON.stringify(files, null, 2)}\n` : renderPulled(files)
        )
      })
    })
}
