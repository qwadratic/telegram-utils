export function parseCutoffDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

export function normalizePhoneInput(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const hasPlus = trimmed.startsWith('+')
  const digitsOnly = trimmed.replace(/\D/g, '')
  if (!digitsOnly) return ''
  return hasPlus ? `+${digitsOnly}` : digitsOnly
}
