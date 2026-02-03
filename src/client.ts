import { TelegramClient } from '@mtcute/node'
import { BaseSqliteStorage, networkMiddlewares } from '@mtcute/core'
import { EncryptedSqliteStorage } from './storage/encrypted.js'

export function createClient(sessionPassword: string): TelegramClient {
  const apiId = process.env.API_ID
  const apiHash = process.env.API_HASH

  if (!apiId || !apiHash) {
    throw new Error('API_ID and API_HASH must be set in .env file')
  }

  // EncryptedSqliteStorage is a driver; wrap it with BaseSqliteStorage
  const driver = new EncryptedSqliteStorage('data/session.db', sessionPassword)
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
          // console.error(`RPC error in ${ctx.request._}: ${error.error_message}`)
        }),
      ],
    },
  })
}
