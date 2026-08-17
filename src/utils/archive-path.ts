import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { sanitizeFilename } from './filename.js'
import { ARCHIVE_DIR } from '../paths.js'

export function ensureArchiveDir(): string {
  mkdirSync(ARCHIVE_DIR, { recursive: true })
  return ARCHIVE_DIR
}

export function getArchivePath(chatName: string, chatId: number): string {
  const safeFilename = sanitizeFilename(chatName, chatId)
  return join(ensureArchiveDir(), `${safeFilename}.md`)
}
