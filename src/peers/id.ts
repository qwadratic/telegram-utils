import { OperatorError } from '../errors.js'
import { EXIT } from '../exit-codes.js'

/**
 * Require a numeric peer id.
 *
 * WHY every command that names a chat goes through this: resolving a
 * human-readable string means one typo, one homoglyph or one stale cache entry
 * points the command at the wrong person's chat. On the send path there is no
 * undo; on a dump it means quietly reading a stranger's conversation.
 *
 * `tg peers find <name>` exists to do that lookup as a separate, read-only step
 * whose output a human reads before pasting an id here.
 *
 * Lives in its own module, importing nothing but the error type, so read-only
 * commands can validate an id without importing `src/send/`, which is the module
 * the trust evals require the unattended paths never reach.
 */
export function assertPeerId(raw: string | number): number {
  const id = typeof raw === 'number' ? raw : Number(String(raw).trim())

  if (!Number.isSafeInteger(id) || id === 0) {
    throw new OperatorError(
      `Not a numeric peer id: ${JSON.stringify(String(raw))}\n` +
      '  Commands take an id, never a name or @username, so a typo cannot reach\n' +
      '  the wrong chat. Find the id first:  tg peers find <name>',
      EXIT.usage
    )
  }
  return id
}
