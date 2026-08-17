import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { CONFIG_PATH } from '../paths.js'

/**
 * Configuration structure for tracked folders and chats.
 * Stored at data/config.json for persistence across runs.
 */
export interface Config {
  trackedFolderIds: number[]
  trackedChatIds: number[]
}

/** Path to the config file. Derived from the workspace data root. */
export { CONFIG_PATH }

/**
 * Load config from disk. Returns empty config if file doesn't exist.
 * Uses sync operations for CLI simplicity and to avoid race conditions.
 */
export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    return { trackedFolderIds: [], trackedChatIds: [] }
  }

  const content = readFileSync(CONFIG_PATH, 'utf-8')
  const parsed = JSON.parse(content) as Partial<Config>

  if (parsed.trackedFolderIds && parsed.trackedChatIds) {
    return {
      trackedFolderIds: parsed.trackedFolderIds,
      trackedChatIds: parsed.trackedChatIds
    }
  }

  return { trackedFolderIds: [], trackedChatIds: [] }
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

/**
 * Update config file with new values.
 * Alias for saveConfig - kept for semantic clarity when modifying existing config.
 */
export function updateConfig(config: Config): void {
  saveConfig(config)
}
