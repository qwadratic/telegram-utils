import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { sanitizeFilename } from './filename.js'

export function ensureArchiveDir(): string {
  const dirPath = join('data', 'archive')
  mkdirSync(dirPath, { recursive: true })
  return dirPath
}

export function getArchivePath(chatName: string, chatId: number): string {
  const safeFilename = sanitizeFilename(chatName, chatId)
  return join(ensureArchiveDir(), `${safeFilename}.md`)
}
