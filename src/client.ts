import { TelegramClient } from '@mtcute/node'
import { BaseSqliteStorage, networkMiddlewares } from '@mtcute/core'
import { EncryptedSqliteStorage } from './storage/encrypted.js'
import { SESSION_DB_PATH } from './session/cache.js'
import { readSecret, SECRETS } from './session/psst.js'

/** Errors the session layer handles itself; logging them would be noise. */
const EXPECTED_RPC_ERRORS = new Set([
  'AUTH_KEY_UNREGISTERED',
  'AUTH_KEY_DUPLICATED',
  'SESSION_REVOKED',
  'SESSION_EXPIRED'
])

/**
 * @param cacheKey - encrypts data/session.db at rest. Supplied by the session
 *   layer from the psst vault; no longer typed in by a human on every run.
 */
export function createClient(cacheKey: string): TelegramClient {
  // readSecret checks process.env first, so a .env file keeps working unchanged.
  const apiId = readSecret(SECRETS.apiId)
  const apiHash = readSecret(SECRETS.apiHash)

  if (!apiId || !apiHash) {
    throw new Error(
      'API_ID and API_HASH are not set.\n' +
      '  Store them in the vault:  psst set API_ID && psst set API_HASH\n' +
      '  Or put them in a .env file (see .env.example).'
    )
  }

  // EncryptedSqliteStorage is a driver; wrap it with BaseSqliteStorage
  const driver = new EncryptedSqliteStorage(SESSION_DB_PATH, cacheKey)
  const storage = new BaseSqliteStorage(driver)

  return new TelegramClient({
    apiId: parseInt(apiId, 10),
    apiHash,
    storage,
    disableUpdates: true,
    network: {
      // Use built-in middlewares with flood wait handling up to 60 seconds
      middlewares: [
        ...networkMiddlewares.basic({
          floodWaiter: {
            maxWait: 60_000,
          },
        }),
        networkMiddlewares.onRpcError((ctx, error) => {
          // A dead auth key is how the session layer probes for "do we need to
          // log in?", so reporting it here would be alarming and wrong.
          if (EXPECTED_RPC_ERRORS.has(error.errorMessage)) return
          console.error(`RPC error in ${ctx.request._}: ${error.errorMessage}`)
        }),
      ],
    },
  })
}
