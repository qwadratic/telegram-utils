import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Configuration structure for tracked folders and chats.
 * Stored at data/config.json for persistence across runs.
 */
export interface Config {
  trackedFolders: {
    [folderId: number]: number[] // folder_id -> [chat_ids]
  }
}

/**
 * Path to the config file
 */
export const CONFIG_PATH = 'data/config.json'

/**
 * Load config from disk. Returns empty config if file doesn't exist.
 * Uses sync operations for CLI simplicity and to avoid race conditions.
 */
export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    return { trackedFolders: {} }
  }

  const content = readFileSync(CONFIG_PATH, 'utf-8')
  return JSON.parse(content) as Config
}

/**
 * Save config to disk. Creates data/ directory if needed.
 * Uses sync operations for CLI simplicity and to avoid race conditions.
 */
export function saveConfig(config: Config): void {
  const dir = dirname(CONFIG_PATH)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}
