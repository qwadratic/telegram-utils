import { execFileSync } from 'node:child_process'
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ARCHIVE_DIR, DATA_DIR, SESSION_DB_PATH } from '../paths.js'
import { readSecret, SECRETS } from '../session/psst.js'

/**
 * A workspace is a directory that owns its own Telegram authorisation.
 *
 * WHY per-directory instead of one shared session: `tgu` is meant to be
 * installed once, globally, and used from many project directories - a chat
 * folder per project. Every one of those needs its own auth key, because two
 * clients sharing one key desynchronise Telegram's pts/qts/seq message-box state
 * and can earn AUTH_KEY_DUPLICATED, which revokes the session for all of them.
 * The single-instance lock cannot prevent that: it is workspace-relative and
 * cannot see another directory.
 *
 * So: one directory, one vault, one auth key, one Active Sessions row. Distinct
 * keys are free. A shared key is the only genuinely dangerous configuration.
 *
 * The app credentials (API_ID / API_HASH) are the exception, and deliberately so
 * - they identify the *application*, not the login, and Telegram expects one app
 * to have many user sessions. `readSecret` already falls back to the global
 * vault and accepts TG_API_ID / TG_API_HASH, so a new workspace inherits them
 * and only has to do the phone-code step.
 */

export interface WorkspaceStatus {
  dataDir: string
  /** Absolute, for a message that is unambiguous about which directory this is. */
  absoluteDataDir: string
  hasVault: boolean
  hasApiCredentials: boolean
  hasSession: boolean
  gitignored: boolean
}

/** Is there a psst vault reachable from here? */
function vaultPresent(): boolean {
  if (existsSync('.psst')) return true
  try {
    // A global vault counts: API credentials commonly live there.
    execFileSync('psst', ['-g', 'list'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Is `psst` on PATH at all? A globally installed CLI cannot assume it.
 *
 * Re-exported from the session layer rather than duplicated, so there is one
 * memoised check instead of two spawns saying the same thing.
 */
export { psstAvailable as psstInstalled } from '../session/psst.js'

export function workspaceStatus(): WorkspaceStatus {
  return {
    dataDir: DATA_DIR,
    absoluteDataDir: resolve(DATA_DIR),
    hasVault: vaultPresent(),
    hasApiCredentials: Boolean(readSecret(SECRETS.apiId) && readSecret(SECRETS.apiHash)),
    hasSession: existsSync(SESSION_DB_PATH) || Boolean(readSecret(SECRETS.session)),
    gitignored: dataDirIgnored()
  }
}

/**
 * Does .gitignore already cover the data directory?
 *
 * This matters more than it looks: the data directory holds the encrypted
 * session cache AND real exported messages, and a workspace inside someone's
 * project repo is one `git add -A` away from committing both.
 */
export function dataDirIgnored(gitignorePath = '.gitignore'): boolean {
  if (!existsSync(gitignorePath)) return false

  const patterns = readFileSync(gitignorePath, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  return patterns.some((p) => p === DATA_DIR || p === `${DATA_DIR}/` || p === `${DATA_DIR}/*`)
}

/**
 * Create the directories and make sure the data root cannot be committed.
 *
 * Idempotent: safe to run in a directory that is already a workspace.
 * Returns what it actually changed, so the caller can report honestly rather
 * than claiming to have set up something that was already there.
 */
export function scaffoldWorkspace(): { created: string[]; ignoredAdded: boolean } {
  const created: string[] = []

  for (const dir of [DATA_DIR, ARCHIVE_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
      created.push(dir)
    }
  }

  // 0700, set explicitly rather than via mkdir's mode, which umask can widen.
  // The data root holds a full account credential: anything that can read it is
  // logged in as the user, with no password and no 2FA in the way.
  chmodSync(DATA_DIR, 0o700)

  let ignoredAdded = false
  if (!dataDirIgnored()) {
    appendFileSync(
      '.gitignore',
      `\n# tgu workspace: encrypted session plus real exported messages\n${DATA_DIR}/\n`,
      'utf-8'
    )
    ignoredAdded = true
  }

  return { created, ignoredAdded }
}
