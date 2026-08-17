import chalk from 'chalk'
import type { Command } from 'commander'
import { psstInstalled, scaffoldWorkspace, workspaceStatus } from '../../workspace/index.js'
import { runCommand } from '../errors.js'
import { OperatorError } from '../../errors.js'

/**
 * `tgu init` - make the current directory a workspace.
 *
 * Connects to nothing. It creates directories, protects them from git, and then
 * tells the operator the one thing only a human can do: run `session login`,
 * because only a human receives the login code.
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Make the current directory a tgu workspace with its own session')
    .option('--json', 'Machine-readable output')
    .action(async (options) => {
      await runCommand(async () => {
        // A globally installed CLI cannot assume psst exists: it is a separate
        // Rust binary that `npm i -g` does not bring along.
        if (!psstInstalled()) {
          throw new OperatorError(
            'psst is not on PATH, and tgu stores its secrets in a psst vault.\n' +
            '  Install it:  https://github.com/vpetrigo/psst\n' +
            '  Or supply secrets directly as environment variables:\n' +
            '    API_ID=... API_HASH=... TG_SESSION_STRING=... tgu ...'
          )
        }

        const { created, ignoredAdded } = scaffoldWorkspace()
        const status = workspaceStatus()

        if (options.json) {
          process.stdout.write(`${JSON.stringify({ ...status, created, ignoredAdded }, null, 2)}\n`)
          return
        }

        console.log(chalk.cyan(`Workspace: ${status.absoluteDataDir}`))
        for (const dir of created) console.log(`  created ${dir}`)
        if (ignoredAdded) console.log(`  added ${status.dataDir}/ to .gitignore`)
        if (created.length === 0 && !ignoredAdded) console.log('  already set up')

        console.log('')
        console.log(`  psst vault        ${status.hasVault ? chalk.green('found') : chalk.yellow('missing')}`)
        console.log(
          `  API_ID/API_HASH   ${status.hasApiCredentials ? chalk.green('found') : chalk.yellow('missing')}`
        )
        console.log(
          `  session           ${status.hasSession ? chalk.green('present') : chalk.yellow('none yet')}`
        )

        console.log('')
        if (!status.hasVault) {
          console.log(chalk.yellow('Next:  psst init'))
        }
        if (!status.hasApiCredentials) {
          console.log(
            chalk.yellow('Next:  psst set API_ID && psst set API_HASH') +
            chalk.dim('   (or keep them in your global vault as TG_API_ID / TG_API_HASH)')
          )
        }
        if (!status.hasSession) {
          console.log(
            chalk.yellow('Next:  tgu session login') +
            chalk.dim('   once, at a terminal: this workspace gets its OWN auth key')
          )
          console.log(
            chalk.dim('       Never copy a session from another workspace. One auth key per')
          )
          console.log(
            chalk.dim('       workspace, or Telegram may revoke all of them at once.')
          )
        } else {
          console.log(chalk.green('Ready. Try:  tgu peers list --type user --no-bots'))
        }
      })
    })
}
