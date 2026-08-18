import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Keep a global install current, without ever slowing down a command.
 *
 * The shape matters more than the feature. A naive implementation checks the
 * registry on startup and awaits it, which puts a network round trip in front of
 * every invocation - including `tg dump ... | jq` in a pipeline and every agent
 * call. So the foreground does nothing but read one small JSON file:
 *
 *   foreground  read the cache (sync, sub-millisecond). Say one line on stderr
 *               if a newer version is already known. Spawn a DETACHED child if
 *               the cache is stale. Never block, never touch stdout.
 *   background  fetch the registry, write the cache, and if a newer version
 *               exists, run `npm install -g`. Nobody is waiting on it.
 *
 * Safe to replace files under a running process because this CLI imports its
 * whole command tree at startup and never lazily imports afterwards, so the
 * files npm rewrites are already resident in memory.
 */

/**
 * The published package name, in ONE place.
 *
 * It is used to query the registry, to build the `npm install -g` command, and
 * to recognise an installed copy by its path. Those three drifted apart during
 * the rename to @qwadratic/tg: the path marker kept the old name while its own
 * doc comment was updated, so a real install reported "not a global install" and
 * quietly disabled updates forever. Pinned by eval-76.
 */
export const PACKAGE_NAME = '@qwadratic/tg'

/** Where the check state lives: per USER, not per workspace, since the install is global. */
export function stateDir(): string {
  return process.env.TGU_STATE_DIR?.trim() || join(homedir(), '.tg')
}

export function stateFile(): string {
  return join(stateDir(), 'update-check.json')
}

export interface UpdateState {
  /** ISO of the last completed registry check. */
  lastCheckAt?: string
  /** Newest version the registry reported. */
  latestSeen?: string
  /** Version of the last auto-install attempt, successful or not. */
  lastAttemptVersion?: string
  lastAttemptAt?: string
  /** Consecutive failed auto-installs for lastAttemptVersion. */
  failures?: number
}

export function readState(path = stateFile()): UpdateState {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as UpdateState
  } catch {
    // Absent, unreadable or corrupt all mean "no idea, check again".
    return {}
  }
}

export function writeState(state: UpdateState, path = stateFile()): void {
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, 'utf-8')
  } catch {
    // A read-only home directory must not break the actual command.
  }
}

/**
 * Compare two semver-ish versions. Returns >0 when `a` is newer.
 *
 * Deliberately small: it only has to order releases of THIS package. A version
 * carrying a prerelease tag (1.2.3-beta.1) sorts BELOW the same release, which
 * is what stops a beta from being auto-installed over a stable one.
 */
export function compareVersions(a: string, b: string): number {
  const split = (v: string) => {
    const [core, pre] = v.replace(/^v/, '').split('-', 2)
    return { nums: core.split('.').map((n) => Number.parseInt(n, 10) || 0), pre }
  }
  const left = split(a)
  const right = split(b)

  for (let i = 0; i < 3; i++) {
    const diff = (left.nums[i] ?? 0) - (right.nums[i] ?? 0)
    if (diff !== 0) return diff
  }

  if (left.pre && !right.pre) return -1
  if (!left.pre && right.pre) return 1
  if (left.pre && right.pre) return left.pre < right.pre ? -1 : left.pre > right.pre ? 1 : 0
  return 0
}

/** Reasons to leave the installed version alone. */
export type SkipReason =
  | 'disabled'
  | 'ci'
  | 'not-a-global-install'
  | null

/**
 * Should this process touch updates at all?
 *
 * `TGU_NO_UPDATE=1` is the explicit opt-out. CI is excluded because a build
 * agent installing a different version mid-pipeline makes that pipeline
 * unreproducible. A git checkout is excluded because `npm install -g` would
 * silently replace the developer's working copy with a published release.
 */
export function updateSkipReason(env = process.env): SkipReason {
  if (env.TGU_NO_UPDATE === '1' || env.NO_UPDATE_NOTIFIER === '1') return 'disabled'
  if (env.CI === 'true' || env.CI === '1') return 'ci'
  if (!isGlobalInstall()) return 'not-a-global-install'
  return null
}

/**
 * Is this a published install rather than a checkout?
 *
 * The test is the installed layout: a published copy lives inside a
 * `node_modules/@qwadratic/tg` directory and ships `dist/`. A clone has neither
 * of those in its path, so it can never be auto-updated over.
 */
export function isGlobalInstall(moduleUrl = import.meta.url): boolean {
  const here = fileURLToPath(moduleUrl)
  // Built from PACKAGE_NAME so a scoped name contributes both segments
  // (@qwadratic then tg) and a rename cannot leave a stale literal behind.
  const marker = `${sep}node_modules${sep}${PACKAGE_NAME.split('/').join(sep)}${sep}`
  return here.includes(marker)
}

/** Has enough time passed to ask the registry again? */
export function isCheckDue(state: UpdateState, now = Date.now(), env = process.env): boolean {
  const hours = Number(env.TGU_UPDATE_INTERVAL_HOURS ?? 24)
  const interval = (Number.isFinite(hours) && hours > 0 ? hours : 24) * 3600_000

  if (!state.lastCheckAt) return true
  const last = Date.parse(state.lastCheckAt)
  if (Number.isNaN(last)) return true
  return now - last >= interval
}

/**
 * Give up on a version that has already failed to install.
 *
 * A global install can fail permanently for a reason no retry fixes, usually
 * EACCES on a prefix that needs sudo. Without this the same doomed install runs
 * every day forever.
 */
export function hasExhaustedAttempts(state: UpdateState, version: string): boolean {
  return state.lastAttemptVersion === version && (state.failures ?? 0) >= 2
}

/**
 * The registry URL for a package's newest version.
 *
 * Two things here were wrong for the entire life of this feature, and both
 * failed the same silent way - the check returned null and the CLI reported
 * "could not reach the npm registry", which reads like a network problem:
 *
 * 1. The slash in a scoped name has to be percent-encoded. `@scope/name` does
 *    happen to work today, but `%2f` is the documented form and the one npm's
 *    own clients send.
 * 2. The `application/vnd.npm.install-v1+json` accept header is only valid on
 *    the PACKUMENT endpoint. Sending it to `/latest` returns 406 Not Acceptable
 *    for every package, scoped or not. That header was the actual bug; the scope
 *    merely made it visible, because before the rename nothing was published to
 *    check against and the failure looked like "not published yet".
 *
 * The version endpoint is used rather than the abbreviated packument because it
 * is a fixed size, while the packument grows with every release.
 */
export function registryUrl(packageName = PACKAGE_NAME): string {
  return `https://registry.npmjs.org/${packageName.replace('/', '%2f')}/latest`
}

/** Ask the registry for the newest published version. Null on any failure. */
export async function fetchLatestVersion(
  packageName = PACKAGE_NAME,
  timeoutMs = 3000,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(registryUrl(packageName), {
      signal: controller.signal,
      headers: { accept: 'application/json' }
    })
    if (!response.ok) return null

    const body = (await response.json()) as { version?: unknown }
    return typeof body.version === 'string' ? body.version : null
  } catch {
    // Offline, DNS failure, timeout, registry outage: none are worth a word.
    return null
  } finally {
    // Without this the timer keeps the event loop alive for its full duration,
    // adding up to three seconds to a command that has already finished.
    clearTimeout(timer)
  }
}

/** Run the global install. Resolves to true when npm exits 0. */
export function installLatest(packageName = PACKAGE_NAME): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('npm', ['install', '-g', `${packageName}@latest`], {
      stdio: 'ignore',
      // Detached so it survives if the parent is killed mid-install, which would
      // otherwise leave a half-written global package.
      detached: true
    })
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0))
  })
}

/**
 * The line shown when a newer version is already known from the cache.
 *
 * stderr only. A version notice on stdout would corrupt `--json` output, which
 * is the difference between a helpful message and a broken pipeline.
 */
export function updateNotice(current: string, latest: string, auto: boolean): string {
  return auto
    ? `tg ${latest} is available (you have ${current}); updating in the background. Disable with TGU_NO_UPDATE=1`
    : `tg ${latest} is available (you have ${current}). Run: npm install -g ${PACKAGE_NAME}@latest`
}

/** What the foreground should do, decided without any IO so it can be tested. */
export interface UpdatePlan {
  /** A newer version is already known from the cache. */
  notify: boolean
  /** An install will actually be attempted by the child we are about to spawn. */
  auto: boolean
  /** Spawn the detached worker. */
  spawn: boolean
}

/**
 * Decide what this run does about updates.
 *
 * The invariant worth naming: `auto` is true only when `spawn` is also true.
 * Saying "updating in the background" while spawning nothing is a lie the user
 * cannot detect, and it hid a real gap - a known-but-failed update was announced
 * on every run and retried on none of them, because the retry was gated behind
 * the 24h registry interval it had already satisfied.
 */
export function planUpdate(
  state: UpdateState,
  currentVersion: string,
  now = Date.now(),
  env = process.env
): UpdatePlan {
  const pending = Boolean(
    state.latestSeen && compareVersions(state.latestSeen, currentVersion) > 0
  )
  const retryable = pending && !hasExhaustedAttempts(state, state.latestSeen as string)

  // The interval throttles asking the REGISTRY. A version we already know about
  // and have not given up on deserves another install attempt regardless.
  const spawn = isCheckDue(state, now, env) || retryable

  return { notify: pending, auto: retryable && spawn, spawn }
}

/**
 * Foreground half: read the cache, maybe warn, maybe spawn the background check.
 *
 * Costs one small synchronous file read. Everything expensive happens in a
 * detached child that the caller never waits for.
 */
export function scheduleUpdateCheck(currentVersion: string, argv: string[] = process.argv): void {
  if (updateSkipReason()) return
  // Never recurse: the background worker runs this same binary.
  if (argv.includes('--background-update-check')) return

  const state = readState()
  const plan = planUpdate(state, currentVersion)

  if (plan.notify) {
    process.stderr.write(
      `${updateNotice(currentVersion, state.latestSeen as string, plan.auto)}\n`
    )
  }

  if (!plan.spawn) return

  try {
    // The child re-runs this CLI in a mode that only checks and installs. Fully
    // detached and unref'd, so the foreground exits without waiting.
    const child = spawn(process.execPath, [process.argv[1], 'update', '--background-update-check'], {
      stdio: 'ignore',
      detached: true
    })
    child.unref()
  } catch {
    // Spawning is best effort; a failure here must never surface.
  }
}

export interface UpdateOutcome {
  current: string
  latest: string | null
  updated: boolean
  skipped: SkipReason
}

/**
 * Background half, and also what `tg update` runs in the foreground.
 *
 * A skip reason ALWAYS wins, even for an explicitly typed `tg update`. Asking
 * by hand is not a reason to install over a git checkout, to ignore
 * TGU_NO_UPDATE, or to swap versions inside a CI job - in CI in particular
 * nobody typed anything, some script did.
 *
 * `force` therefore does one thing only: it retries a version that automatic
 * attempts have given up on, which is exactly what a human running
 * `tg update` after fixing their permissions wants.
 */
export async function runUpdateCheck(
  currentVersion: string,
  options: { force?: boolean; install?: boolean } = {}
): Promise<UpdateOutcome> {
  const skipped = updateSkipReason()
  if (skipped) {
    return { current: currentVersion, latest: null, updated: false, skipped }
  }

  const state = readState()
  const latest = await fetchLatestVersion()

  if (!latest) {
    // Record the attempt so a flapping network does not retry every invocation.
    writeState({ ...state, lastCheckAt: new Date().toISOString() })
    return { current: currentVersion, latest: null, updated: false, skipped: null }
  }

  const next: UpdateState = {
    ...state,
    lastCheckAt: new Date().toISOString(),
    latestSeen: latest
  }

  const newer = compareVersions(latest, currentVersion) > 0
  if (!newer || options.install === false) {
    writeState(next)
    return { current: currentVersion, latest, updated: false, skipped: null }
  }

  if (!options.force && hasExhaustedAttempts(state, latest)) {
    writeState(next)
    return { current: currentVersion, latest, updated: false, skipped: null }
  }

  const ok = await installLatest()
  writeState({
    ...next,
    lastAttemptVersion: latest,
    lastAttemptAt: new Date().toISOString(),
    failures: ok ? 0 : (state.lastAttemptVersion === latest ? (state.failures ?? 0) + 1 : 1)
  })

  return { current: currentVersion, latest, updated: ok, skipped: null }
}
