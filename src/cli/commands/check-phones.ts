import { spinner } from '@clack/prompts'
import type { Command } from 'commander'
import { importContactsByPhone } from '../../contacts/import.js'
import { normalizePhoneInput } from '../args.js'
import { handlePlainError, runCommand } from '../errors.js'
import { logSummary, logWarning } from '../log.js'
import { withAuthenticatedClient } from './shared.js'

export function registerCheckPhonesCommand(program: Command): void {
  program
    .command('check-phones')
    .description('Check phone numbers via contacts import, output CSV to stdout')
    .argument('<phones>', 'Comma-separated phone numbers (e.g., +1234567890,+0987654321)')
    .option('--batch <number>', 'Contacts per import batch (default: 1)', '1')
    .option('--delay <number>', 'Delay between batches in ms (default: 1500)', '1500')
    .option('--keep', 'Do not remove imported contacts after checking')
    .option('--debug', 'Print import request/response details to stderr')
    .action(async (phonesArg: string, options: { batch: string; delay: string; keep?: boolean; debug?: boolean }) => {
      await runCommand(async () => {
        // Parse comma-separated phones
        const rawParts = phonesArg.split(',')
        const phones = rawParts.map(normalizePhoneInput).filter(Boolean)
        const skippedCount = rawParts.length - phones.length

        if (phones.length === 0) {
          console.error('Error: No phone numbers provided')
          process.exit(1)
        }
        if (skippedCount > 0) {
          logWarning(`Skipped ${skippedCount} empty entries after parsing`, { stderr: true })
        }

        // Session password via prompt (stderr so it doesn't pollute CSV output)
        await withAuthenticatedClient(
          'Enter session password:',
          async (tg) => {
            const parsedBatchSize = Number.parseInt(options.batch, 10)
            const parsedDelayMs = Number.parseInt(options.delay, 10)
            if (!Number.isFinite(parsedBatchSize) || parsedBatchSize < 1) {
              console.error('Error: --batch must be a positive integer')
              process.exit(1)
            }
            if (!Number.isFinite(parsedDelayMs) || parsedDelayMs < 0) {
              console.error('Error: --delay must be zero or a positive integer')
              process.exit(1)
            }

            const s = spinner()
            s.start(`Checked 0 of ${phones.length} phones...`)

            const results = await importContactsByPhone(tg, phones, {
              batchSize: parsedBatchSize,
              delayMs: parsedDelayMs,
              deleteAfter: !options.keep,
              debug: options.debug,
              onProgress: (checked, total) => {
                s.message(`Checked ${checked} of ${total} phones...`)
              }
            })

            s.stop(`Checked ${phones.length} phones`)
            const validResults = results.filter(r => r.userId != null)

            // Output CSV to stdout (header + data)
            if (validResults.length > 0) {
              console.log('user_id,phone_number,username')
              for (const r of validResults) {
                console.log(`${r.userId},${r.phone},${r.username ?? ''}`)
              }
            }
            logSummary(`checked=${results.length}, valid=${validResults.length}`, { stderr: true })
          }
        )
      }, handlePlainError)
    })
}
