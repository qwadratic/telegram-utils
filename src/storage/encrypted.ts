import { BaseSqliteStorageDriver, type ISqliteDatabase } from '@mtcute/core'
import Database from 'better-sqlite3-multiple-ciphers'

/**
 * Encrypted SQLite storage for mtcute session data.
 * Uses better-sqlite3-multiple-ciphers for transparent encryption.
 */
export class EncryptedSqliteStorage extends BaseSqliteStorageDriver {
  private _filename: string
  private _password: string

  constructor(filename: string, password: string) {
    super()
    this._filename = filename
    this._password = password
  }

  _createDatabase(): ISqliteDatabase {
    const db = new Database(this._filename)
    try {
      // Set encryption key before any other operations
      // Escape single quotes in password for SQL pragma safety
      db.pragma(`key='${this._password.replace(/'/g, "''")}'`)
      // Force a read to validate the key early and surface clearer errors
      db.prepare('SELECT count(*) FROM sqlite_master').get()
      return db as unknown as ISqliteDatabase
    } catch (error) {
      db.close()
      const message = error instanceof Error ? error.message : String(error)
      if (/file is not a database|file is encrypted|wrong key/i.test(message)) {
        throw new Error('Invalid session password.')
      }
      throw error
    }
  }
}
