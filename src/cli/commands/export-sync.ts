import { intro } from '@clack/prompts'
import chalk from 'chalk'
import type { Command } from 'commander'
import { syncChats } from '../../sync/index.js'
import { runCommand } from '../errors.js'
import { logSummary } from '../log.js'
import { formatDuration, resolveExportConfig, withAuthenticatedClient } from './shared.js'

export function registerExportSyncCommand(exportCommand: Command): void {
  exportCommand
    .command('chats')
    .description('Export chats into per-chat archive files')
    .action(async () => {
      await runCommand(async () => {
        intro(chalk.cyan('Export Chats'))
        await withAuthenticatedClient(
          'Enter session password:',
          async (tg) => {
            const config = await resolveExportConfig(tg)
            if (!config) {
              return
            }

            // Run incremental sync
            const result = await syncChats(tg, config)

            // Display sync summary
            const duration = formatDuration(result.durationMs)
            const parts = [
              `${result.chatsProcessed} chats synced`,
              `${result.messagesAppended} messages`,
              `${result.filesUpdated} files updated`,
            ]
            if (result.newChatsAdded > 0) {
              parts.push(`${result.newChatsAdded} new chats added`)
            }
            if (result.newFoldersAdded > 0) {
              parts.push(`${result.newFoldersAdded} new folders tracked`)
            }
            if (result.chatsSkipped > 0) {
              parts.push(`${result.chatsSkipped} empty chats skipped`)
            }
            logSummary(`${parts.join(', ')} in ${duration}`, { leadingNewline: true })
          },
          { silentCancel: true }
        )
      })
    })
}
