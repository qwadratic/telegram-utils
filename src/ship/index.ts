/**
 * Ship archive files into gbrain. A SEPARATE PROCESS from the ingester.
 *
 * SECURITY BOUNDARY (binding, decision doc D7 / "two one-way rules"):
 *   1. Nothing holding a Telegram credential may call an LLM or gbrain.
 *   2. Nothing talking to gbrain may hold a Telegram credential.
 *
 * `tgu ship` is a subcommand of the same binary for the human's convenience,
 * but it is its own process and this module imports NOTHING from src/session,
 * src/client.ts or @mtcute. It reads finished markdown off disk and execs the
 * gbrain CLI. The eval in test/ship.test.ts walks this file's transitive
 * import graph and fails if that ever stops being true.
 *
 * It shells out - one gbrain process per file, exit code checked - rather than
 * linking a library, so a gbrain crash cannot take the archive with it and
 * the credential separation is enforced by the process boundary, not by care.
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, utimesSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { OperatorError } from '../errors.js'

/** Written after a fully successful run; its mtime is the ship watermark. */
export const SHIP_STAMP_PATH = 'data/archive/.last-ship'

/**
 * One JSONL line per run, so a timer that stopped firing is distinguishable
 * from a timer that fires and finds nothing to do. Overridable so a test - or
 * a second archive on the same host - never writes into the real brain.
 */
function heartbeatPath(): string {
  return process.env.TGU_HEARTBEAT_PATH
    ?? join(homedir(), '.gbrain', 'integrations', 'telegram-utils', 'heartbeat.jsonl')
}

export interface ShipPlanEntry {
  file: string
  slug: string
  /** One entry per destination brain: a chat in two folders ships to both. */
  sources: string[]
}

/**
 * An OperatorError, so the CLI prints the instruction bare. Every ShipError
 * is something the human must fix in config or in a file - a stack trace on
 * top would only bury the sentence that says which file and which folder.
 */
export class ShipError extends OperatorError {
  override name = 'ShipError'
}

/**
 * Parse `TGU_BRAIN_MAP` - `"7=personal,12=proximata"`.
 *
 * `ponytail:` deploy config in one env var rather than a new persisted file.
 * Ceiling: unreadable past ~10 folders, and it cannot be edited by the CLI.
 * Upgrade path: a `folderBrains` object in data/config.json.
 */
export function parseBrainMap(raw: string | undefined): Map<number, string> {
  const map = new Map<number, string>()
  for (const pair of (raw ?? '').split(',')) {
    const trimmed = pair.trim()
    if (!trimmed) continue
    const [rawId, source] = trimmed.split('=')
    const id = Number(rawId)
    if (!Number.isInteger(id) || !source) {
      throw new ShipError(`TGU_BRAIN_MAP entry is not <folderId>=<source>: "${trimmed}"`)
    }
    map.set(id, source.trim())
  }
  return map
}

/** `folder_ids: [7, 12]` out of a file's frontmatter. */
export function readFolderIds(content: string): number[] {
  const match = /^folder_ids:\s*\[([^\]]*)\]\s*$/m.exec(content)
  if (!match) return []
  return match[1]
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)   // `[]` must be empty, not [NaN] and not [0]
    .map(Number)
    .filter((id) => Number.isInteger(id))
}

/**
 * The slug IS the dedup key: gbrain enforces UNIQUE (source_id, slug), so a
 * stable slug is what makes running this loop twice a no-op. The archive
 * filename is already `<sanitized-name>_<chat_id>.md`, so deriving the slug
 * from it costs nothing and cannot drift from the file it names.
 */
export function slugForFile(file: string): string {
  return `tg/chat/${basename(file, '.md')}`
}

function archiveFiles(archiveDir: string, since: number): string[] {
  if (!existsSync(archiveDir)) return []
  return readdirSync(archiveDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(archiveDir, name))
    .filter((file) => statSync(file).mtimeMs > since)
    .sort()
}

/**
 * Decide what would be shipped where. Pure enough to test: no gbrain, no exec.
 *
 * A file with no routable folder FAILS the whole run. Defaulting it to some
 * brain would put private chats in the wrong one silently, which is the one
 * failure mode nobody would notice.
 */
export function planShip(options: {
  archiveDir: string
  since: number
  brainMap: Map<number, string>
}): ShipPlanEntry[] {
  return archiveFiles(options.archiveDir, options.since).map((file) => {
    const folderIds = readFolderIds(readFileSync(file, 'utf-8'))
    if (folderIds.length === 0) {
      throw new ShipError(`${file}: no folder_ids in frontmatter - nothing says which brain owns it`)
    }
    const sources = folderIds.map((id) => {
      const source = options.brainMap.get(id)
      if (!source) {
        throw new ShipError(`${file}: folder ${id} is not in TGU_BRAIN_MAP - refusing to guess a brain`)
      }
      return source
    })
    return { file, slug: slugForFile(file), sources: [...new Set(sources)] }
  })
}

function capture(gbrainBin: string, file: string, slug: string, source: string): void {
  const result = spawnSync(
    gbrainBin,
    ['capture', '--stdin', '--slug', slug, '--source', source, '--quiet'],
    { input: readFileSync(file), stdio: ['pipe', 'pipe', 'inherit'] }
  )
  if (result.error) throw new ShipError(`${gbrainBin} could not be run: ${result.error.message}`)
  if (result.status !== 0) {
    throw new ShipError(`gbrain capture ${slug} -> ${source} exited ${result.status}`)
  }
}

function heartbeat(status: string, details: Record<string, unknown>): void {
  try {
    const path = heartbeatPath()
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, `${JSON.stringify({
      ts: new Date().toISOString(),
      event: 'ship',
      source_version: process.env.npm_package_version ?? '0.2.0',
      status,
      details
    })}\n`)
  } catch {
    // A missing heartbeat must never fail a successful ship: it is telemetry,
    // not the job. The exit code is still the verdict.
  }
}

/**
 * Ship every archive file newer than the stamp, then advance the stamp.
 *
 * The stamp is touched ONLY on a clean run. Any non-zero gbrain exit aborts
 * and leaves it untouched, so the next run retries the same set - which is
 * safe precisely because the slug makes each capture idempotent.
 */
export function ship(options: {
  archiveDir?: string
  dryRun?: boolean
  brainMap?: Map<number, string>
  gbrainBin?: string
  all?: boolean
} = {}): { shipped: number; captures: number } {
  const archiveDir = options.archiveDir ?? join('data', 'archive')
  const stamp = join(archiveDir, '.last-ship')
  const since = options.all || !existsSync(stamp) ? 0 : statSync(stamp).mtimeMs
  const brainMap = options.brainMap ?? parseBrainMap(process.env.TGU_BRAIN_MAP)
  const gbrainBin = options.gbrainBin ?? process.env.GBRAIN_BIN ?? 'gbrain'

  const startedAt = Date.now()
  let captures = 0
  let plan: ShipPlanEntry[] = []

  try {
    plan = planShip({ archiveDir, since, brainMap })
    for (const entry of plan) {
      for (const source of entry.sources) {
        if (options.dryRun) {
          console.log(`would capture ${entry.slug} -> ${source} (${entry.file})`)
        } else {
          capture(gbrainBin, entry.file, entry.slug, source)
        }
        captures++
      }
    }
  } catch (error) {
    // One heartbeat per run either way: a run that fails silently looks
    // exactly like a run that never fired.
    if (!options.dryRun) {
      heartbeat('error', { captures, error: error instanceof Error ? error.message : String(error) })
    }
    throw error
  }

  if (!options.dryRun) {
    // Stamped with the run's START time, floored to the millisecond by
    // Date.now(): a file modified while the run was in flight must not be
    // skipped by the next one. The floor can re-ship a file written in the
    // same millisecond the run started, which is harmless - the slug makes a
    // repeat capture an update - and is the right way to round.
    const startSeconds = startedAt / 1000
    appendFileSync(stamp, '')
    utimesSync(stamp, startSeconds, startSeconds)
    heartbeat('ok', { files: plan.length, captures })
  }

  return { shipped: plan.length, captures }
}
