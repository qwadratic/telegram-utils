import { confirm, isCancel } from '@clack/prompts'
import chalk from 'chalk'
import type { Command } from 'commander'
import type { TelegramClient } from '@mtcute/node'
import { sendMedia, sendNote, sendText, type SentRecord } from '../../send/index.js'
import {
  MAX_SENDS_PER_DAY,
  MAX_SENDS_PER_RUN,
  readSendLog,
  sendsToday
} from '../../send/gate.js'
import { listPeers } from '../../peers/index.js'
import { assertPeerId } from '../../peers/id.js'
import { runCommand } from '../errors.js'
import { OperatorError } from '../../errors.js'
import { canPrompt } from '../../session/index.js'
import { logSummary } from '../log.js'
import { withAuthenticatedClient } from './shared.js'

/**
 * `tgu send` - the only commands that write to Telegram.
 *
 * Every one of them is human-invoked. Nothing in the export, folders, ship or
 * read-verb import graphs reaches this file, and `test/trust.test.ts` fails the
 * suite if that ever stops being true.
 */

/**
 * Show who the id belongs to and require a yes.
 *
 * The id is the safe way to address a peer, but it is unreadable, so the one
 * thing a human cannot verify by looking at the command is whether 245605314 is
 * the person they meant. This resolves the id back to a name and asks. Skipped
 * when `--yes` was passed, which is the caller taking that responsibility.
 */
async function confirmRecipient(
  tg: TelegramClient,
  peerId: number,
  what: string,
  yes: boolean
): Promise<boolean> {
  if (yes || !canPrompt()) return true

  const peer = (await listPeers(tg, { limit: 500 })).find((p) => p.id === peerId)
  const who = peer ? `${peer.name}${peer.username ? ` (@${peer.username})` : ''}` : 'UNKNOWN CHAT'

  console.log(chalk.yellow(`\nAbout to send ${what} to ${chalk.bold(who)} [id ${peerId}]`))
  if (!peer) {
    console.log(
      chalk.yellow('  This id is not in your recent dialogs, so the name could not be shown.')
    )
  }

  const ok = await confirm({ message: 'Send it?' })
  if (isCancel(ok) || !ok) {
    console.log('Cancelled. Nothing was sent.')
    return false
  }
  return true
}

function report(record: SentRecord): void {
  logSummary(`sent ${record.kind} to ${record.peerId} as message ${record.messageId}`)
}

export function registerSendCommand(program: Command): void {
  const send = program
    .command('send')
    .description('Send a message or file to a chat (human-invoked only)')
    .action(() => send.help())

  send
    .command('text <peerId> <text>')
    .description('Send a text message to a numeric peer id')
    .option('--yes', 'Skip the recipient confirmation; required for unattended runs')
    .action(async (peerId: string, text: string, options) => {
      await runCommand(async () => {
        const id = assertPeerId(peerId)
        await withAuthenticatedClient(async (tg) => {
          if (!(await confirmRecipient(tg, id, 'a text message', Boolean(options.yes)))) return
          report(await sendText(tg, id, text, { yes: options.yes }))
        })
      })
    })

  send
    .command('media <peerId> <file>')
    .description('Send a file to a numeric peer id')
    .option('--caption <text>', 'Caption for the file')
    .option('--mime <type>', 'Override the detected mime type')
    .option('--yes', 'Skip the recipient confirmation; required for unattended runs')
    .action(async (peerId: string, file: string, options) => {
      await runCommand(async () => {
        const id = assertPeerId(peerId)
        await withAuthenticatedClient(async (tg) => {
          if (!(await confirmRecipient(tg, id, `the file ${file}`, Boolean(options.yes)))) return
          report(
            await sendMedia(tg, id, file, {
              caption: options.caption,
              mime: options.mime,
              yes: options.yes
            })
          )
        })
      })
    })

  send
    .command('log')
    .description('Show what this workspace has sent')
    .option('--json', 'Machine-readable output')
    .action(async (options) => {
      // Reads a local file; no client, no lock, no network.
      await runCommand(async () => {
        const records = readSendLog()

        if (options.json) {
          process.stdout.write(`${JSON.stringify(records, null, 2)}\n`)
          return
        }

        if (records.length === 0) {
          console.log('Nothing sent from this workspace.')
          return
        }

        for (const r of records) {
          const status = r.ok ? 'ok  ' : 'FAIL'
          console.log(
            `${r.at.slice(0, 16)}  ${status}  ${r.kind.padEnd(8)}  peer ${r.peerId}` +
            `${r.error ? `  ${r.error}` : ''}`
          )
        }
        console.log(
          chalk.dim(
            `\n${sendsToday(records)}/${MAX_SENDS_PER_DAY} in the last 24h; ` +
            `${MAX_SENDS_PER_RUN} allowed per run`
          )
        )
      })
    })

  program
    .command('note <text>')
    .description('Send a note to your own Saved Messages')
    .option('--yes', 'Required for unattended runs')
    .action(async (text: string, options) => {
      await runCommand(async () => {
        if (!text.trim()) throw new OperatorError('Give some text to save.')
        await withAuthenticatedClient(async (tg) => {
          // No recipient confirmation: the only possible target is yourself.
          report(await sendNote(tg, text, { yes: options.yes }))
        })
      })
    })
}
