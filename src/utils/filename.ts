/**
 * Characters invalid on Windows/Mac/Linux filesystems.
 * Includes: < > : " / \ | ? * and control characters (0x00-0x1f, 0x80-0x9f)
 */
const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f\x80-\x9f]/g

/**
 * Windows reserved device names (case-insensitive).
 * These cannot be used as filenames on Windows.
 */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/**
 * Maximum filename length (leave room for path and .md extension)
 */
const MAX_LENGTH = 200

/**
 * Sanitize a string for use as a filename.
 *
 * Handles:
 * - Removes characters invalid on Windows/Mac/Linux
 * - Collapses multiple spaces to single space
 * - Trims whitespace
 * - Removes trailing dots (Windows issue)
 * - Prefixes Windows reserved names with underscore
 * - Truncates to 200 characters
 * - Falls back to chat-{fallbackId} or 'unnamed' if result is empty
 *
 * @param name - The string to sanitize
 * @param fallbackId - Optional chat ID to use if name becomes empty
 * @returns A filesystem-safe filename
 */
export function sanitizeFilename(name: string, fallbackId?: number): string {
  let safe = name
    .replace(INVALID_CHARS, '') // Remove invalid chars
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim()
    .replace(/\.+$/, '') // Remove trailing dots (Windows)

  // Handle Windows reserved names
  if (WINDOWS_RESERVED.test(safe)) {
    safe = `_${safe}`
  }

  // Truncate to max length
  if (safe.length > MAX_LENGTH) {
    safe = safe.slice(0, MAX_LENGTH)
  }

  // Fallback if empty
  if (!safe) {
    return fallbackId !== undefined ? `chat-${fallbackId}` : 'unnamed'
  }

  return safe
}
