import { renameSync, writeFileSync } from 'node:fs'

/**
 * Write a file so a reader ever sees either the old bytes or the new ones.
 *
 * A crash mid-`writeFileSync` leaves a TRUNCATED file, and a truncated
 * sync-state is worse than a lost archive file: the watermark is what decides
 * whether the missing messages are ever fetched again. Temp+rename makes the
 * publish step a single atomic syscall on the same filesystem.
 *
 * The temp file is a sibling of the target on purpose - rename(2) is only
 * atomic within one filesystem, so /tmp is not a safe staging area.
 *
 * @param mode - passed straight to the temp file, so the target never exists
 *   with wider permissions than intended, not even for an instant.
 */
export function writeFileAtomic(path: string, content: string, mode?: number): void {
  const tempPath = `${path}.tmp`
  writeFileSync(tempPath, content, mode === undefined ? 'utf-8' : { encoding: 'utf-8', mode })
  renameSync(tempPath, path)
}
