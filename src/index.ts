import dotenv from 'dotenv'
// quiet: the startup banner would otherwise land on stdout and break
// `... --json | jq` for anything scripting this CLI.
dotenv.config({ override: true, quiet: true })

import { Command } from 'commander'
import { registerAuthCommand } from './cli/commands/auth.js'
import { registerSessionCommand } from './cli/commands/session.js'
import { registerFoldersCommand } from './cli/commands/folders.js'
import { registerSetupCommand } from './cli/commands/setup.js'
import { registerInitCommand } from './cli/commands/init.js'
import { registerExportSyncCommand } from './cli/commands/export-sync.js'
import { registerExportRecentCommand } from './cli/commands/export-recent.js'
import { registerExportHistoricalCommand } from './cli/commands/export-historical.js'
import { registerCheckPhonesCommand } from './cli/commands/check-phones.js'
import { registerShipCommand } from './cli/commands/ship.js'
import { registerPeersCommand } from './cli/commands/peers.js'
import { registerDumpCommand } from './cli/commands/dump.js'
import { registerMediaCommand } from './cli/commands/media.js'
import { registerWatchCommand } from './cli/commands/watch.js'
import { registerSendCommand } from './cli/commands/send.js'
import { registerUpdateCommand } from './cli/commands/update.js'
import { registerDoctorCommand } from './cli/commands/doctor.js'
import { scheduleUpdateCheck } from './update/index.js'

const VERSION = '0.3.11'

const program = new Command()
  .name('tg')
  .description('Read, archive and send Telegram from the command line')
  .version(VERSION)

registerInitCommand(program)
registerDoctorCommand(program)
registerAuthCommand(program)
registerSessionCommand(program)
registerSetupCommand(program)
registerFoldersCommand(program)

// Read verbs: discovery, transcripts, media, waiting for media.
registerPeersCommand(program)
registerDumpCommand(program)
registerMediaCommand(program)
registerWatchCommand(program)

const exportCommand = program
  .command('export')
  .description('Export chats from tracked folders')
  .action(() => {
    exportCommand.help()
  })

registerExportSyncCommand(exportCommand)
registerExportRecentCommand(exportCommand)
registerExportHistoricalCommand(exportCommand)

registerCheckPhonesCommand(program)
registerShipCommand(program)

// Write verbs last, and registered from one place, so the only path into
// `src/send/` is a command a human typed. See test/trust.test.ts.
registerSendCommand(program)
registerUpdateCommand(program, VERSION)

// One synchronous file read, then a detached child if the cache is stale. This
// deliberately runs before parse() and adds no measurable time to any command.
scheduleUpdateCheck(VERSION)

program.parse()
