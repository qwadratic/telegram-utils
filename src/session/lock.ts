import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'
import { OperatorError } from '../errors.js'
import { LOCK_PATH } from '../paths.js'

export { LOCK_PATH }

/** Thrown when another process already holds the lock. */
export class LockHeldError extends OperatorError {
  constructor(public readonly pid: number, path: string) {
    super(
      `Another tgu instance is already running (pid ${pid}).\n` +
      `  Two clients sharing one Telegram session corrupt the message-box state and\n` +
      `  can get the session revoked, so this run was refused.\n` +
      `  If that process is gone, remove the stale lock:  rm ${path}`
    )
    this.name = 'LockHeldError'
  }
}

/** Does a process with this pid exist? Signal 0 checks without delivering. */
function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM: process exists but belongs to another user - still running.
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * Take the single-instance lock, returning a release function.
 *
 * `openSync(path, 'wx')` is an atomic create-if-absent at the syscall level,
 * so two processes racing here cannot both win. A leftover lock from a crashed
 * run is detected by checking whether its recorded pid is still alive.
 *
 * ponytail: pid-liveness cannot distinguish a crashed run from an unrelated
 * process that later reused the same pid, which would keep a stale lock alive
 * until it is removed by hand. Upgrade path when that ever bites: an flock(2)
 * binding, which the kernel releases on process death.
 */
export function acquireLock(path: string = LOCK_PATH): () => void {
  mkdirSync(dirname(path), { recursive: true })

  // Two passes at most: the second runs only after clearing a stale lock.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, 'wx')
      writeSync(fd, `${process.pid}\n`)
      closeSync(fd)
      return registerRelease(path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error

      const pid = Number(readFileSync(path, 'utf-8').trim())
      if (pid && pid !== process.pid && isRunning(pid)) throw new LockHeldError(pid, path)

      // Empty, unparseable, or owned by a dead pid: reclaim it and retry once.
      try {
        unlinkSync(path)
      } catch {
        // Another process cleaned it up first; the retry will settle the race.
      }
    }
  }

  throw new Error(`Could not acquire ${path} after clearing a stale lock.`)
}

function registerRelease(path: string): () => void {
  let released = false

  const release = () => {
    if (released) return
    released = true
    try {
      unlinkSync(path)
    } catch {
      // Already gone - nothing to release.
    }
  }

  // Normal exits and Ctrl-C both have to drop the lock, or the next run
  // starts by reporting a phantom instance.
  process.once('exit', release)
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.once(signal, () => {
      release()
      process.exit(130)
    })
  }

  return release
}
