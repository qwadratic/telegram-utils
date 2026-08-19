import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stateDir } from '../paths.js'

/**
 * The numbers this human has logged in with, so a fresh workspace can offer
 * them instead of asking someone to retype a phone number from memory.
 *
 * No Telegram client, no network and no prompt appears in this file: it is a
 * small store over one JSON file, so the retention rules and the masking can be
 * tested without logging anyone in.
 *
 * WHY this is per-user and not per-workspace: every workspace holds its own
 * authorisation and must never read another's session, but the human typing the
 * number is the same person each time. A per-workspace list would be empty in
 * exactly the situation the suggestion exists for - the first login in a new
 * directory.
 *
 * WHY only the number: the code and the 2FA password are never written
 * anywhere, and a phone number alone cannot log anyone in.
 */

/** One remembered number. */
export interface PhoneRecord {
  /** E.164, always with the leading `+`. */
  phone: string
  lastUsedAt: string
  useCount: number
}

/**
 * How many to keep.
 *
 * Small on purpose. This is a convenience, and an unbounded history of every
 * number an operator ever used is a liability rather than a feature.
 */
export const MAX_REMEMBERED = 5

export function phonesPath(): string {
  return join(stateDir(), 'phones.json')
}

/**
 * Is remembering switched on?
 *
 * `TG_NO_PHONE_HISTORY=1` turns the whole feature off: nothing is read, nothing
 * is written, and login goes straight to the text prompt. Anyone who does not
 * want their numbers on disk needs a way to say so that does not involve
 * remembering to delete a file.
 */
export function historyEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const off = env.TG_NO_PHONE_HISTORY?.trim().toLowerCase()
  return !off || off === '0' || off === 'false'
}

/**
 * E.164 or nothing.
 *
 * Strict because this value is stored and later offered back as a thing to log
 * in with. Accepting "my phone" or a half-typed number would put junk in the
 * picker that the operator then has to read past every time.
 */
export function normalisePhone(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const digits = trimmed.replace(/[\s()\-.]/g, '').replace(/^\+/, '')
  if (!/^[0-9]{7,15}$/.test(digits)) return null
  return `+${digits}`
}

/** Newest first. Missing, unreadable or malformed files read as empty. */
export function readPhones(path: string = phonesPath()): PhoneRecord[] {
  if (!existsSync(path)) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    // A truncated file is not a reason to refuse a login. The worst case is
    // that this login is typed by hand and rewrites the file.
    return []
  }

  if (!Array.isArray(parsed)) return []

  return parsed
    .flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const record = entry as Partial<PhoneRecord>
      const phone = typeof record.phone === 'string' ? normalisePhone(record.phone) : null
      if (!phone) return []

      const lastUsedAt =
        typeof record.lastUsedAt === 'string' && !Number.isNaN(Date.parse(record.lastUsedAt))
          ? record.lastUsedAt
          : new Date(0).toISOString()

      const useCount =
        typeof record.useCount === 'number' && Number.isFinite(record.useCount) && record.useCount > 0
          ? Math.floor(record.useCount)
          : 1

      return [{ phone, lastUsedAt, useCount }]
    })
    .sort((a, b) => Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt))
    .slice(0, MAX_REMEMBERED)
}

/** Write the list, 0600. A phone number is personal data. */
export function writePhones(records: PhoneRecord[], path: string = phonesPath()): void {
  const dir = join(path, '..')

  // mode applies only to directories mkdir actually creates, which is the point:
  // a state dir we made is ours to lock down, one that already existed is not.
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  try {
    chmodSync(dir, 0o700)
  } catch {
    // TG_STATE_DIR can point at a directory this user does not own - /tmp is the
    // obvious one, and it throws EPERM. Tightening it is defence in depth, so
    // failing to is not a reason to refuse a login. The 0600 file below is what
    // actually protects the contents, and that one is not optional.
  }

  writeFileSync(path, `${JSON.stringify(records, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 })
  // writeFileSync's mode applies only when it CREATES the file, so an existing
  // file keeps whatever mode it had. Set it every time.
  chmodSync(path, 0o600)
}

/**
 * Record a successful login.
 *
 * Call this only after Telegram has accepted the number. Recording at the point
 * it is typed would fill the picker with numbers that do not work, which is
 * worse than an empty picker.
 */
export function rememberPhone(
  raw: string,
  options: { path?: string; now?: Date } = {}
): PhoneRecord[] {
  if (!historyEnabled()) return []

  const phone = normalisePhone(raw)
  if (!phone) return readPhones(options.path)

  const path = options.path ?? phonesPath()
  const now = options.now ?? new Date()
  const existing = readPhones(path)
  const previous = existing.find((r) => r.phone === phone)

  const updated: PhoneRecord[] = [
    { phone, lastUsedAt: now.toISOString(), useCount: (previous?.useCount ?? 0) + 1 },
    ...existing.filter((r) => r.phone !== phone)
  ].slice(0, MAX_REMEMBERED)

  writePhones(updated, path)
  return updated
}

/** Drop one number, or all of them. Returns how many were removed. */
export function forgetPhone(target: string, path: string = phonesPath()): number {
  const existing = readPhones(path)

  if (target === 'all') {
    if (existing.length) writePhones([], path)
    return existing.length
  }

  const phone = normalisePhone(target)
  const kept = phone ? existing.filter((r) => r.phone !== phone) : existing
  const removed = existing.length - kept.length
  if (removed) writePhones(kept, path)
  return removed
}

/**
 * Show enough to recognise, not enough to dial.
 *
 * Used everywhere the number might end up somewhere it outlives the terminal -
 * `--json` output an agent could paste into a transcript, a bug report, a
 * screen recording. The interactive picker deliberately shows the full number,
 * because a masked list is one you cannot choose from.
 */
export function maskPhone(phone: string): string {
  const normalised = normalisePhone(phone) ?? phone
  const digits = normalised.replace(/^\+/, '')
  if (digits.length <= 4) return `+${digits}`
  return `+${digits.slice(0, 2)}${'•'.repeat(Math.max(0, digits.length - 6))}${digits.slice(-4)}`
}

/** "3d ago". Coarse on purpose: the exact minute of a past login is noise. */
export function describeAge(iso: string, now: Date = new Date()): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return 'unknown'

  const minutes = Math.floor((now.getTime() - then) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

/** Sentinel for "none of the above". Never a valid E.164 value, so it cannot collide. */
export const ANOTHER_NUMBER = 'another'

export interface PhoneChoice {
  value: string
  label: string
  hint?: string
}

/**
 * The picker's options, newest first, always ending in an escape hatch.
 *
 * Separated from the prompt so the ordering and the escape hatch can be tested
 * without a terminal. A picker with no way to type a new number would make a
 * remembered list a trap on the day someone changes phone.
 */
export function phoneChoices(records: PhoneRecord[], now: Date = new Date()): PhoneChoice[] {
  return [
    ...records.map((record) => ({
      value: record.phone,
      label: record.phone,
      hint: `last used ${describeAge(record.lastUsedAt, now)}`
    })),
    { value: ANOTHER_NUMBER, label: 'Use a different number' }
  ]
}
