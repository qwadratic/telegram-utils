import { existsSync, rmSync } from 'node:fs'
import type { TelegramClient, User } from '@mtcute/node'
import { ensureAuthenticated, checkSession } from '../auth.js'
import { createClient } from '../client.js'
import { acquireLock } from './lock.js'
import { OperatorError } from '../errors.js'
import { SESSION_DB_PATH } from './cache.js'
import { getOrCreateDbKey, readSecret, writeSecret, SECRETS } from './psst.js'

/** Where this run's authorisation came from. */
export type SessionSource =
  | 'cache' // local encrypted cache already held an auth key
  | 'vault' // imported the string session out of psst
  | 'login' // no usable session anywhere, so the user logged in by hand

/**
 * Would a login prompt actually reach a human?
 *
 * A TTY alone is not enough: an agent or CI job often runs with a pty attached
 * and would sit forever on "Enter your phone number". TGU_NON_INTERACTIVE=1
 * is the explicit way such a caller says "fail instead of asking".
 */
export function canPrompt(): boolean {
  if (process.env.TGU_NON_INTERACTIVE === '1') return false
  return Boolean(process.stdin.isTTY)
}

export interface OpenSessionOptions {
  /**
   * May this run prompt for a phone number and code?
   * Defaults to {@link canPrompt}, so unattended runs fail loudly instead of
   * hanging on a prompt nobody is there to answer.
   */
  interactive?: boolean
  /**
   * Discard the local cache and re-import from the vault. Use when deploying a
   * session that was created on another machine, or after rotating one.
   */
  forceImport?: boolean
}

export interface SessionHandle {
  tg: TelegramClient
  user: User
  source: SessionSource
  /** Disconnect and drop the single-instance lock. */
  close: () => Promise<void>
}

function noSessionError(): OperatorError {
  return new OperatorError(
    'No usable Telegram session.\n' +
    `  The vault has no valid ${SECRETS.session} and the local cache is empty or stale.\n` +
    '  Run this once, at a terminal:  tgu session login\n' +
    '  Then unattended runs pick the session up automatically.'
  )
}

/**
 * Delete the local cache. Safe: everything in it is either regenerable
 * (peers) or also held in the vault (the auth key).
 */
export function resetLocalCache(path = SESSION_DB_PATH): void {
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(`${path}${suffix}`, { force: true })
  }
}

/**
 * Get an authenticated client, without ever prompting for a password.
 *
 * Resolution order, cheapest first:
 *   1. the local encrypted cache, which also carries the peer table
 *   2. the string session in psst, imported into a fresh cache
 *   3. an interactive login, whose result is written back to psst
 *
 * Step 3 is what makes step 2 possible on the next machine: the exported
 * string is the unit of deployment.
 */
export async function openSession(options: OpenSessionOptions = {}): Promise<SessionHandle> {
  const interactive = options.interactive ?? canPrompt()

  // Taken before touching the session so two runs can never share one auth key.
  const release = acquireLock()

  try {
    if (options.forceImport) resetLocalCache()

    const hadCache = existsSync(SESSION_DB_PATH)
    const vaultSession = readSecret(SECRETS.session)

    // Nothing to authenticate with and nobody to ask: say so now rather than
    // opening a socket, generating a cache key and failing a round trip later.
    if (!hadCache && !vaultSession && !interactive) throw noSessionError()

    const cacheKey = getOrCreateDbKey()
    const tg = createClient(cacheKey)

    try {
      if (vaultSession) {
        // A no-op when the cache already holds an auth key - that is precisely
        // what preserves the peer table from run to run.
        await tg.importSession(vaultSession)
      }

      await tg.connect()

      let user = await checkSession(tg)
      let source: SessionSource = hadCache ? 'cache' : 'vault'

      if (!user) {
        if (!interactive) throw noSessionError()

        user = await ensureAuthenticated(tg)
        writeSecret(SECRETS.session, await tg.exportSession())
        source = 'login'
      } else if (!vaultSession) {
        // Authorised from a local cache that predates the vault: capture it now
        // so this session becomes deployable too.
        writeSecret(SECRETS.session, await tg.exportSession())
      }

      const close = async () => {
        await tg.destroy().catch(() => undefined)
        release()
      }

      return { tg, user, source, close }
    } catch (error) {
      await tg.destroy().catch(() => undefined)
      throw error
    }
  } catch (error) {
    release()
    throw error
  }
}

/** Run `fn` with an authenticated client, always releasing the lock afterwards. */
export async function withSession<T>(
  fn: (tg: TelegramClient, session: SessionHandle) => Promise<T>,
  options: OpenSessionOptions = {}
): Promise<T> {
  const session = await openSession(options)
  try {
    return await fn(session.tg, session)
  } finally {
    await session.close()
  }
}
