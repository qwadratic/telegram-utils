---
phase: quick
plan: 001
type: execute
wave: 1
depends_on: []
files_modified:
  - src/contacts/import.ts
  - src/index.ts
autonomous: true

must_haves:
  truths:
    - "User can pass comma-separated phone numbers to CLI"
    - "CLI attempts to import each phone as a contact"
    - "CSV output shows user_id,phone_number for successful imports"
  artifacts:
    - path: "src/contacts/import.ts"
      provides: "Contact import logic using mtcute importContacts"
      exports: ["importContactsByPhone"]
    - path: "src/index.ts"
      provides: "CLI command for contact import"
      contains: "command('import-contacts')"
  key_links:
    - from: "src/index.ts"
      to: "src/contacts/import.ts"
      via: "importContactsByPhone function call"
      pattern: "importContactsByPhone"
---

<objective>
Add CLI command to import contacts by comma-separated phone numbers and output results as CSV.

Purpose: Enable bulk contact import with machine-readable output for scripting/piping.
Output: New `import-contacts` command that outputs `user_id,phone_number` CSV to stdout.
</objective>

<execution_context>
@/Users/i/.claude/get-shit-done/workflows/execute-plan.md
@/Users/i/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/index.ts
@src/client.ts
@src/auth.ts

mtcute API:
- `tg.importContacts(contacts)` accepts array of `{ phone, firstName, lastName, clientId? }`
- Returns `{ imported, users, retryContacts }` where `users` array has user objects with `id` field
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create contact import module</name>
  <files>src/contacts/import.ts</files>
  <action>
Create `src/contacts/import.ts` with:

```typescript
import type { TelegramClient } from '@mtcute/node'

interface ImportResult {
  userId: number | null
  phone: string
}

export async function importContactsByPhone(
  tg: TelegramClient,
  phones: string[]
): Promise<ImportResult[]> {
  // Build contacts array for import
  const contacts = phones.map((phone, idx) => ({
    phone: phone.trim(),
    firstName: 'Import',
    lastName: phone.trim(),
    clientId: BigInt(idx)
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
```

Note: Phone matching strips leading `+` since Telegram stores without it.
  </action>
  <verify>File exists and TypeScript compiles: `npx tsc --noEmit`</verify>
  <done>Contact import module exports importContactsByPhone function</done>
</task>

<task type="auto">
  <name>Task 2: Add CLI command for contact import</name>
  <files>src/index.ts</files>
  <action>
Add new CLI command `import-contacts` to src/index.ts:

1. Add import at top:
```typescript
import { importContactsByPhone } from './contacts/import.js'
```

2. Add command after the `export` command:
```typescript
program
  .command('import-contacts')
  .description('Import contacts by phone numbers, output CSV to stdout')
  .argument('<phones>', 'Comma-separated phone numbers (e.g., +1234567890,+0987654321)')
  .action(async (phonesArg: string) => {
    try {
      // Parse comma-separated phones
      const phones = phonesArg.split(',').map(p => p.trim()).filter(Boolean)

      if (phones.length === 0) {
        console.error('Error: No phone numbers provided')
        process.exit(1)
      }

      // Session password via prompt (stderr so it doesn't pollute CSV output)
      const sessionPass = await password({
        message: 'Enter session password:'
      })
      if (isCancel(sessionPass)) {
        process.exit(0)
      }

      const tg = createClient(sessionPass as string)

      try {
        await tg.connect()
        await ensureAuthenticated(tg)

        const results = await importContactsByPhone(tg, phones)

        // Output CSV to stdout (header + data)
        console.log('user_id,phone_number')
        for (const r of results) {
          console.log(`${r.userId ?? ''},${r.phone}`)
        }

      } finally {
        await tg.destroy()
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error(`Error: ${e.message}`)
      } else {
        console.error('An unexpected error occurred')
      }
      process.exit(1)
    }
  })
```

Key points:
- Password prompt goes to stderr (clack default), CSV to stdout
- Empty user_id for phones that didn't resolve to a user
- No chalk coloring on CSV output to keep it clean
  </action>
  <verify>
1. `npx tsc --noEmit` compiles without errors
2. `npm run dev -- import-contacts --help` shows command usage
  </verify>
  <done>CLI accepts `import-contacts +123,+456` and outputs CSV</done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `npx tsc --noEmit`
2. Help shows new command: `npm run dev -- --help`
3. Command help: `npm run dev -- import-contacts --help`
</verification>

<success_criteria>
- `import-contacts` command exists and accepts comma-separated phone argument
- Output is valid CSV with header `user_id,phone_number`
- Failed lookups show empty user_id, not error
- Password prompt does not interfere with CSV output
</success_criteria>

<output>
After completion, create `.planning/quick/001-contact-import-csv/001-SUMMARY.md`
</output>
