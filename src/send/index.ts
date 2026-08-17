import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { TelegramClient } from '@mtcute/node'
import { OperatorError } from '../errors.js'
import { assertPeerId } from '../peers/id.js'
import { assertConfirmed, guardedSend, type SentRecord } from './gate.js'

/**
 * The ONLY module in `src/` that calls a Telegram write RPC.
 *
 * Everything else in this codebase reads. That was once an absolute:
 *
 *   backlog/decisions/2026-08-05-consolidate-on-telegram-utils.md, line 193:
 *   "No write-back to Telegram: disableUpdates: true means the client never even
 *    receives updates, and there are ZERO sendText/sendMedia/forwardMessages/
 *    deleteMessages/editMessage/readHistory call sites in src/."
 *
 * That invariant is now deliberately NARROWED, not abandoned. The operator sent
 * an APK, images, notes and outreach messages this month from four throwaway
 * scripts that held the same credential with none of the guards below, so the
 * capability already existed - it was simply unguarded, uncapped and unlogged.
 * Moving it in here is what makes it checkable.
 *
 * The narrowed rule, each clause pinned by an eval in `test/trust.test.ts`:
 *   1. Write RPCs appear in this file and nowhere else under `src/`.
 *      (`src/contacts/import.ts` keeps its older, separately fenced exception.)
 *   2. No unattended entry point can reach this module: the import graphs of
 *      `export`, `folders`, `ship` and every read verb are checked and must not
 *      contain it, so a cron job or timer provably cannot send.
 *   3. A send needs a numeric peer id. Never a name, never a username.
 *   4. A send needs a human, or an explicit `--yes` standing in for one.
 *   5. Sends are capped per run and per day, and every attempt is logged.
 */

export type { SentRecord } from './gate.js'

export interface SendTextOptions {
  yes?: boolean
}

/** Send a plain text message to a numeric peer id. */
export async function sendText(
  tg: TelegramClient,
  rawPeer: string | number,
  text: string,
  options: SendTextOptions = {}
): Promise<SentRecord> {
  const peerId = assertPeerId(rawPeer)
  assertConfirmed(options)

  if (!text.trim()) throw new OperatorError('Refusing to send an empty message.')

  const peer = await tg.resolvePeer(peerId)
  return guardedSend(peerId, 'text', text.length, () => tg.sendText(peer, text))
}

export interface SendMediaOptions extends SendTextOptions {
  caption?: string
  /** Override the detected mime type. */
  mime?: string
}

/** Photo when the extension says so, document otherwise. */
export function mediaKindFor(path: string): 'photo' | 'document' {
  return /\.(jpe?g|png|gif|webp)$/i.test(path) ? 'photo' : 'document'
}

/** Send a file to a numeric peer id. */
export async function sendMedia(
  tg: TelegramClient,
  rawPeer: string | number,
  filePath: string,
  options: SendMediaOptions = {}
): Promise<SentRecord> {
  const peerId = assertPeerId(rawPeer)
  assertConfirmed(options)

  if (!existsSync(filePath)) throw new OperatorError(`No such file: ${filePath}`)

  const file = await readFile(filePath)
  const kind = mediaKindFor(filePath)
  const peer = await tg.resolvePeer(peerId)

  return guardedSend(peerId, kind, file.length, () =>
    tg.sendMedia(peer, {
      type: kind,
      file,
      fileName: basename(filePath),
      ...(options.mime ? { fileMime: options.mime } : {}),
      ...(options.caption ? { caption: options.caption } : {})
    } as never)
  )
}

/**
 * Send to Saved Messages, the chat with yourself.
 *
 * Kept separate from {@link sendText} so the everyday case - leaving yourself a
 * note - needs no peer id and therefore cannot be aimed at another person by
 * mistake. Saved Messages is your own user id, which is why this resolves
 * `getMe` rather than accepting a target at all.
 */
export async function sendNote(
  tg: TelegramClient,
  text: string,
  options: SendTextOptions = {}
): Promise<SentRecord> {
  assertConfirmed(options)

  if (!text.trim()) throw new OperatorError('Refusing to send an empty note.')

  const me = await tg.getMe()
  const peer = await tg.resolvePeer(me.id)
  return guardedSend(me.id, 'text', text.length, () => tg.sendText(peer, text))
}
