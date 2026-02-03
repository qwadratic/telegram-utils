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
    // Set encryption key before any other operations
    // Escape single quotes in password for SQL pragma safety
    db.pragma(`key='${this._password.replace(/'/g, "''")}'`)
    return db as unknown as ISqliteDatabase
  }
}
