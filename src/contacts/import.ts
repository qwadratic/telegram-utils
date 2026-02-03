import type { TelegramClient } from '@mtcute/node'

interface ImportResult {
  userId: number | null
  phone: string
}

export async function importContactsByPhone(
  tg: TelegramClient,
  phones: string[]
): Promise<ImportResult[]> {
  // Build contacts array for import (clientId is optional, omit it)
  const contacts = phones.map((phone) => ({
    phone: phone.trim(),
    firstName: 'Import',
    lastName: phone.trim()
  }))

  // Call mtcute importContacts
  const result = await tg.importContacts(contacts)

  // Map results: find user for each phone
  return phones.map(phone => {
    const trimmed = phone.trim()
    // Find user by matching phone number
    const user = result.users.find(u =>
      u._ === 'user' && u.phone === trimmed.replace(/^\+/, '')
    )
    return {
      userId: user && user._ === 'user' ? user.id : null,
      phone: trimmed
    }
  })
}
