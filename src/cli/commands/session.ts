import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import chalk from 'chalk'
import type { Command } from 'commander'
import { openSession, resetLocalCache } from '../../session/index.js'
import { peerCacheStats, SESSION_DB_PATH } from '../../session/cache.js'
import { getOrCreateDbKey, readSecret, SECRETS } from '../../session/psst.js'
import { LOCK_PATH } from '../../session/lock.js'
import { loadConfig } from '../../config/index.js'
import { runCommand, handlePlainError } from '../errors.js'

/**
 * Short, non-reversible identifier for a session string.
 *
 * Printing the session itself would defeat the vault; a fingerprint still
 * answers the question that matters during a deploy - "is the session on this
 * machine the same one I exported from that machine?"
 */
function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

/** Re-run this same CLI as a child process, carrying any tsx loader flags. */
function respawn(args: string[]): string {
  return execFileSync(process.execPath, [...process.execArgv, process.argv[1], ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'inherit']
  })
}

interface ProbeReport {
  user: string
  source: string
  peersBefore: number
  peersAfter: number
  resolved: number
}

export function registerSessionCommand(program: Command): void {
  const session = program
    .command('session')
    .description('Manage the Telegram session stored in psst')
    .action(() => session.help())

  session
    .command('login')
    .description('Authenticate by hand and store the session string in psst')
    .option('--force', 'Discard the local cache and log in again')
    .action(async (options) => {
      await runCommand(async () => {
        if (options.force) resetLocalCache()

        const handle = await openSession({ interactive: true, forceImport: options.force })
        try {
          const label = `${handle.user.firstName} ${handle.user.lastName ?? ''}`.trim()
          console.log(chalk.green(`\nLogged in as ${label} (@${handle.user.username ?? 'no username'})`))
          console.log(
            handle.source === 'login'
              ? `Session stored in psst as ${SECRETS.session}.`
              : `Existing session reused (source: ${handle.source}). Use --force to re-authenticate.`
          )
          console.log(chalk.dim('Deploy it elsewhere:  psst get TG_SESSION_STRING | psst set TG_SESSION_STRING --stdin'))
        } finally {
          await handle.close()
        }
      })
    })

  session
    .command('status')
    .description('Show session, peer cache and lock state without connecting')
    .option('--json', 'Machine-readable output')
    .action(async (options) => {
      await runCommand(async () => {
        const vaultSession = readSecret(SECRETS.session)
        const cacheKey = readSecret(SECRETS.dbKey)
        const peers = cacheKey ? peerCacheStats(cacheKey) : { count: 0, lastUpdated: null }
        const config = loadConfig()
        const lockPid = existsSync(LOCK_PATH) ? readFileSync(LOCK_PATH, 'utf-8').trim() : null

        const report = {
          vaultSession: vaultSession ? fingerprint(vaultSession) : null,
          cacheKeyPresent: Boolean(cacheKey),
          apiCredentials: Boolean(readSecret(SECRETS.apiId) && readSecret(SECRETS.apiHash)),
          localCache: existsSync(SESSION_DB_PATH) ? SESSION_DB_PATH : null,
          peers: peers.count,
          peersLastUpdated: peers.lastUpdated,
          trackedFolders: config.trackedFolderIds.length,
          trackedChats: config.trackedChatIds.length,
          lockedByPid: lockPid
        }

        if (options.json) {
          console.log(JSON.stringify(report, null, 2))
          return
        }

        const yes = (v: boolean) => (v ? chalk.green('yes') : chalk.red('no'))
        console.log(chalk.cyan('Session'))
        console.log(`  vault session      ${report.vaultSession ? chalk.green(report.vaultSession) : chalk.red('absent')}`)
        console.log(`  cache key in vault ${yes(report.cacheKeyPresent)}`)
        console.log(`  api credentials    ${yes(report.apiCredentials)}`)
        console.log(chalk.cyan('Local cache'))
        console.log(`  file               ${report.localCache ?? chalk.dim('none')}`)
        console.log(`  cached peers       ${report.peers}`)
        console.log(`  peers updated      ${report.peersLastUpdated ?? chalk.dim('never')}`)
        console.log(chalk.cyan('Export config'))
        console.log(`  tracked folders    ${report.trackedFolders}`)
        console.log(`  tracked chats      ${report.trackedChats}`)
        console.log(`  lock               ${report.lockedByPid ? chalk.yellow(`held by pid ${report.lockedByPid}`) : chalk.dim('free')}`)
      })
    })

  session
    .command('probe')
    .description('One authenticated run that reports peer cache counts as JSON')
    .option('--resolve <n>', 'How many tracked chats to resolve', '5')
    .action(async (options) => {
      // handlePlainError: stdout must stay parseable JSON for `session verify`.
      await runCommand(async () => {
        const limit = Number.parseInt(options.resolve, 10)
        if (!Number.isFinite(limit) || limit < 0) {
          throw new Error('--resolve must be a non-negative integer')
        }

        // Counted before openSession connects, so this reflects only what an
        // earlier, already-finished process left behind.
        const peersBefore = peerCacheStats(getOrCreateDbKey()).count

        const handle = await openSession({ interactive: false })
        let resolved = 0
        try {
          const config = loadConfig()
          for (const chatId of config.trackedChatIds.slice(0, limit)) {
            try {
              await handle.tg.getPeer(chatId)
              resolved++
            } catch {
              // A chat we can no longer see must not fail the probe.
            }
          }
        } finally {
          await handle.close()
        }

        const report: ProbeReport = {
          user: handle.user.username ?? String(handle.user.id),
          source: handle.source,
          peersBefore,
          peersAfter: peerCacheStats(getOrCreateDbKey()).count,
          resolved
        }
        console.log(JSON.stringify(report))
      }, handlePlainError)
    })

  session
    .command('verify')
    .description('Prove the peer cache survives across independent client runs')
    .action(async () => {
      await runCommand(async () => {
        console.log(chalk.cyan('Verifying peer persistence across independent runs\n'))

        // This command holds no lock of its own: each child takes and releases
        // it in turn, which also demonstrates the lock does not deadlock a
        // sequence of runs.
        console.log(chalk.dim('run 1: connecting and resolving peers...'))
        const first: ProbeReport = JSON.parse(respawn(['session', 'probe']).trim())
        console.log(`  peers ${first.peersBefore} -> ${first.peersAfter} (resolved ${first.resolved})`)

        console.log(chalk.dim('run 2: fresh process, reading cache before connecting...'))
        const second: ProbeReport = JSON.parse(respawn(['session', 'probe']).trim())
        console.log(`  peers ${second.peersBefore} -> ${second.peersAfter} (source: ${second.source})`)

        const checks: [string, boolean, string][] = [
          [
            'run 2 saw run 1\'s peers before opening a connection',
            second.peersBefore >= first.peersAfter && second.peersBefore > 0,
            `expected >= ${first.peersAfter} and > 0, got ${second.peersBefore}`
          ],
          [
            'run 2 reused the cached session rather than re-importing',
            second.source === 'cache',
            `source was ${second.source}`
          ],
          [
            'both runs authenticated as the same user',
            first.user === second.user,
            `${first.user} vs ${second.user}`
          ]
        ]

        console.log('')
        let failed = 0
        for (const [name, ok, detail] of checks) {
          console.log(`  ${ok ? chalk.green('PASS') : chalk.red('FAIL')}  ${name}`)
          if (!ok) {
            console.log(chalk.red(`        ${detail}`))
            failed++
          }
        }

        if (failed > 0) {
          throw new Error(`${failed} of ${checks.length} peer-persistence checks failed`)
        }
        console.log(chalk.green('\nPeer list is maintained across client-independent runs.'))
      })
    })
}
