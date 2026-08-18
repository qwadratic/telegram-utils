import { chmodSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { sanitizeFilename } from './filename.js'
import { ARCHIVE_DIR } from '../paths.js'

/**
 * The archive directory, 0700.
 *
 * It holds every message this workspace has exported: 189MB of real private
 * conversations at the time this mode was added, and it had been 0755 with 0644
 * files since the archive existed. On a shared machine that is world-readable
 * chat history. Set explicitly rather than via mkdir's mode, which umask widens.
 */
export function ensureArchiveDir(): string {
  mkdirSync(ARCHIVE_DIR, { recursive: true })
  chmodSync(ARCHIVE_DIR, 0o700)
  return ARCHIVE_DIR
}

/**
 * Mode for every file under the archive.
 *
 * The same 0600 the session cache and the send log already use. An archive file
 * is not less sensitive than the watermark that points at it: it IS the
 * messages.
 */
export const ARCHIVE_FILE_MODE = 0o600

export function getArchivePath(chatName: string, chatId: number): string {
  const safeFilename = sanitizeFilename(chatName, chatId)
  return join(ensureArchiveDir(), `${safeFilename}.md`)
}
