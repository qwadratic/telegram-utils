import assert from 'node:assert'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  compareVersions,
  hasExhaustedAttempts,
  isCheckDue,
  planUpdate,
  readState,
  updateNotice,
  updateSkipReason,
  writeState,
  type UpdateState
} from '../src/update/index.js'
import { withTempDir } from './helpers.js'

const ROOT = fileURLToPath(new URL('../', import.meta.url))

test('eval-66 version comparison orders releases and keeps prereleases below them', () => {
  assert.ok(compareVersions('0.4.0', '0.3.0') > 0)
  assert.ok(compareVersions('0.3.1', '0.3.0') > 0)
  assert.ok(compareVersions('1.0.0', '0.99.99') > 0)
  assert.equal(compareVersions('0.3.0', '0.3.0'), 0)
  assert.equal(compareVersions('v0.3.0', '0.3.0'), 0, 'a leading v is tolerated')
  assert.ok(compareVersions('0.3.0', '0.4.0') < 0)

  // The property that matters for auto-install: a prerelease must never look
  // newer than the release it precedes, or a beta gets pushed to every install.
  assert.ok(compareVersions('0.4.0-beta.1', '0.4.0') < 0)
  assert.ok(compareVersions('0.4.0', '0.4.0-beta.1') > 0)
  assert.ok(compareVersions('0.4.0-beta.2', '0.4.0-beta.1') > 0)

  // Ragged version strings must not throw; they are attacker-adjacent input.
  assert.equal(typeof compareVersions('', ''), 'number')
  assert.equal(typeof compareVersions('not.a.version', '0.3.0'), 'number')
})

test('eval-67 updates are skipped in CI, when disabled, and outside a global install', () => {
  assert.equal(updateSkipReason({ TGU_NO_UPDATE: '1' } as never), 'disabled')
  assert.equal(updateSkipReason({ NO_UPDATE_NOTIFIER: '1' } as never), 'disabled')
  // A build agent that silently installs a different version makes its own
  // pipeline unreproducible.
  assert.equal(updateSkipReason({ CI: 'true' } as never), 'ci')

  // This test suite runs from a checkout, never from node_modules/@qwadratic/tg,
  // so the global-install guard must be the reason here. That guard is what stops
  // `npm install -g` from overwriting a developer's working copy.
  assert.equal(updateSkipReason({} as never), 'not-a-global-install')
})

test('eval-68 the check interval is honoured and a missing or corrupt state re-checks', () => {
  const now = Date.parse('2026-08-18T12:00:00.000Z')
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000).toISOString()

  assert.equal(isCheckDue({}, now, {} as never), true, 'never checked')
  assert.equal(isCheckDue({ lastCheckAt: 'garbage' }, now, {} as never), true, 'unparseable')
  assert.equal(isCheckDue({ lastCheckAt: at(1) }, now, {} as never), false, 'checked an hour ago')
  assert.equal(isCheckDue({ lastCheckAt: at(25) }, now, {} as never), true, 'checked yesterday')

  // Interval is configurable, and nonsense falls back to the default.
  const env = { TGU_UPDATE_INTERVAL_HOURS: '1' } as never
  assert.equal(isCheckDue({ lastCheckAt: at(2) }, now, env), true)
  const bad = { TGU_UPDATE_INTERVAL_HOURS: 'soon' } as never
  assert.equal(isCheckDue({ lastCheckAt: at(2) }, now, bad), false, 'falls back to 24h')
})

test('eval-69 a version that fails to install twice stops being retried', () => {
  // Without this, a global prefix that needs sudo retries the same doomed
  // install every single day, forever.
  assert.equal(hasExhaustedAttempts({ lastAttemptVersion: '0.4.0', failures: 2 }, '0.4.0'), true)
  assert.equal(hasExhaustedAttempts({ lastAttemptVersion: '0.4.0', failures: 1 }, '0.4.0'), false)
  // A NEW version is always worth one attempt, whatever happened to the old one.
  assert.equal(hasExhaustedAttempts({ lastAttemptVersion: '0.4.0', failures: 9 }, '0.5.0'), false)
  assert.equal(hasExhaustedAttempts({}, '0.4.0'), false)
})

test('eval-70 update state survives a round trip and tolerates a corrupt file', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'nested', 'update-check.json')
    const state: UpdateState = { lastCheckAt: '2026-08-18T00:00:00.000Z', latestSeen: '0.4.0' }

    writeState(state, path)
    assert.deepEqual(readState(path), state, 'writes the directory it needs')

    // A half-written file from a killed process must not break the CLI.
    const { writeFileSync } = await import('node:fs')
    writeFileSync(path, '{"lastCheckAt": "2026', 'utf-8')
    assert.deepEqual(readState(path), {}, 'corrupt state reads as unknown, not a crash')

    assert.deepEqual(readState(join(dir, 'absent.json')), {})
  })
})

test('eval-71 the update notice never implies an install that will not happen', () => {
  assert.match(updateNotice('0.3.0', '0.4.0', true), /updating in the background/)
  assert.match(updateNotice('0.3.0', '0.4.0', true), /TGU_NO_UPDATE=1/)
  // After the attempts are exhausted the notice must tell the truth and hand
  // over the manual command instead of promising another silent retry.
  assert.match(updateNotice('0.3.0', '0.4.0', false), /npm install -g @qwadratic\/tg@latest/)
  assert.doesNotMatch(updateNotice('0.3.0', '0.4.0', false), /background/)
})

test('eval-72 the CLI version matches package.json', () => {
  // src/index.ts carries the version as a literal so the compiled bin needs no
  // filesystem lookup at startup. That is only safe with this tripwire.
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as { version: string }
  const source = readFileSync(join(ROOT, 'src', 'index.ts'), 'utf-8')
  const declared = /const VERSION = '([^']+)'/.exec(source)?.[1]

  assert.equal(
    declared,
    pkg.version,
    'src/index.ts VERSION and package.json version have drifted. An installed CLI ' +
    'would compare the registry against the wrong number and update in a loop.'
  )
})

test('eval-73 the notice never promises a background update that will not happen', () => {
  const now = Date.parse('2026-08-18T12:00:00.000Z')
  const at = (h: number) => new Date(now - h * 3600_000).toISOString()
  const plan = (state: UpdateState) => planUpdate(state, '0.3.0', now, {} as never)

  // Nothing known, interval elapsed: check quietly, say nothing.
  const fresh = plan({})
  assert.deepEqual(fresh, { notify: false, auto: false, spawn: true })

  // Up to date and checked recently: completely silent, no child process.
  const current = plan({ lastCheckAt: at(1), latestSeen: '0.3.0' })
  assert.deepEqual(current, { notify: false, auto: false, spawn: false })

  // A known newer version, checked an hour ago. The old code notified with
  // "updating in the background" and spawned nothing, so the update never
  // landed and the same line printed forever.
  const pending = plan({ lastCheckAt: at(1), latestSeen: '0.4.0' })
  assert.equal(pending.notify, true)
  assert.equal(pending.spawn, true, 'a pending update is retried despite the interval')
  assert.equal(pending.auto, true)

  // Given up after repeated failures: still tell the user, but stop claiming an
  // automatic install, and stop spawning children that cannot succeed.
  const exhausted = plan({
    lastCheckAt: at(1),
    latestSeen: '0.4.0',
    lastAttemptVersion: '0.4.0',
    failures: 2
  })
  assert.equal(exhausted.notify, true)
  assert.equal(exhausted.auto, false, 'no promise of an install')
  assert.equal(exhausted.spawn, false, 'and no doomed child process')

  // THE INVARIANT: auto is never true unless a child is actually spawned.
  for (const state of [
    {},
    { lastCheckAt: at(1) },
    { lastCheckAt: at(1), latestSeen: '0.4.0' },
    { lastCheckAt: at(99), latestSeen: '0.4.0' },
    { lastCheckAt: at(1), latestSeen: '0.4.0', lastAttemptVersion: '0.4.0', failures: 2 },
    { lastCheckAt: at(99), latestSeen: '0.4.0', lastAttemptVersion: '0.4.0', failures: 2 },
    { lastCheckAt: at(1), latestSeen: '0.2.0' }
  ] as UpdateState[]) {
    const p = plan(state)
    assert.ok(!p.auto || p.spawn, `auto without spawn for ${JSON.stringify(state)}`)
  }
})

test('eval-74 a skip reason wins even over an explicitly typed update', async () => {
  // `tg update` typed by a human must still not install over a git checkout,
  // ignore TGU_NO_UPDATE, or swap versions inside a CI job - in CI nobody typed
  // anything, some script did. force only retries a version that automatic
  // attempts gave up on.
  const { runUpdateCheck } = await import('../src/update/index.js')

  const original = process.env.CI
  process.env.CI = 'true'
  try {
    const outcome = await runUpdateCheck('0.3.0', { force: true })
    assert.equal(outcome.skipped, 'ci', 'force must not override the CI guard')
    assert.equal(outcome.updated, false)
    assert.equal(outcome.latest, null, 'and it must not even reach the registry')
  } finally {
    if (original === undefined) delete process.env.CI
    else process.env.CI = original
  }
})

test('eval-75 a scoped global install is recognised, a checkout is not', async () => {
  // The rename to @qwadratic/tg broke exactly this: the marker kept the old
  // unscoped literal, so a real install answered "not a global install" and
  // disabled updates permanently. Nothing caught it because the suite always
  // runs from a checkout, where that answer happens to be correct. Passing an
  // explicit module URL is what makes the installed case testable at all.
  const { isGlobalInstall } = await import('../src/update/index.js')

  for (const installed of [
    'file:///usr/local/lib/node_modules/@qwadratic/tg/dist/update/index.js',
    'file:///home/me/.npm-global/lib/node_modules/@qwadratic/tg/dist/update/index.js',
    'file:///opt/homebrew/lib/node_modules/@qwadratic/tg/dist/update/index.js'
  ]) {
    assert.equal(isGlobalInstall(installed), true, `should be a global install: ${installed}`)
  }

  for (const checkout of [
    'file:///home/me/projects/telegram-utils/src/update/index.ts',
    'file:///home/me/projects/tg/dist/update/index.js',
    // A DIFFERENT scoped package that merely lives near ours must not match.
    'file:///usr/local/lib/node_modules/@someoneelse/tg/dist/update/index.js',
    'file:///usr/local/lib/node_modules/tg/dist/update/index.js'
  ]) {
    assert.equal(isGlobalInstall(checkout), false, `should NOT be a global install: ${checkout}`)
  }
})

test('eval-76 the package name is one constant, matching package.json', () => {
  // Three things derive from it: the registry query, the install command and the
  // install-detection marker. They drifted during the rename; this stops that.
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as {
    name: string
    bin: Record<string, string>
  }
  const source = readFileSync(join(ROOT, 'src', 'update', 'index.ts'), 'utf-8')
  const declared = /const PACKAGE_NAME = '([^']+)'/.exec(source)?.[1]

  assert.equal(declared, pkg.name, 'PACKAGE_NAME and package.json name have drifted')
  assert.deepEqual(Object.keys(pkg.bin), ['tg'], 'the command is tg, and only tg')

  // No stale literal of the old name anywhere in the update path.
  assert.ok(
    !/telegram-utils/.test(source),
    'src/update/index.ts still names the pre-rename package somewhere'
  )
})

test('eval-77 the registry request is shaped so it can actually succeed', async () => {
  const { registryUrl, fetchLatestVersion, PACKAGE_NAME } = await import('../src/update/index.js')

  // The slash in a scoped name is percent-encoded, which is the form npm's own
  // clients send.
  assert.equal(registryUrl('@qwadratic/tg'), 'https://registry.npmjs.org/@qwadratic%2ftg/latest')
  assert.equal(registryUrl('chalk'), 'https://registry.npmjs.org/chalk/latest')
  assert.ok(!registryUrl(PACKAGE_NAME).includes('@qwadratic/tg'), 'the raw slash must not survive')

  // THE REGRESSION THIS EXISTS FOR: the abbreviated-packument accept header is
  // only valid on the packument endpoint. Sent to /latest it returns 406 for
  // every package, so every check failed and reported "could not reach the npm
  // registry" - indistinguishable from being offline. No network here; the fetch
  // is stubbed so the assertion is about the REQUEST we make.
  let seen: { url: string; accept: string } | null = null
  const stub = (async (url: string | URL, init?: RequestInit) => {
    seen = {
      url: String(url),
      accept: String((init?.headers as Record<string, string>)?.accept ?? '')
    }
    return {
      ok: true,
      json: async () => ({ version: '9.9.9' })
    } as unknown as Response
  }) as unknown as typeof fetch

  const version = await fetchLatestVersion('@qwadratic/tg', 3000, stub)

  assert.equal(version, '9.9.9')
  assert.equal(seen!.url, 'https://registry.npmjs.org/@qwadratic%2ftg/latest')
  assert.ok(
    !seen!.accept.includes('vnd.npm.install-v1'),
    'the abbreviated-packument accept header returns 406 on the version endpoint'
  )
})

test('eval-78 a failed registry call is silent and never throws', async () => {
  const { fetchLatestVersion } = await import('../src/update/index.js')

  const failures: Array<() => Promise<Response>> = [
    async () => ({ ok: false, status: 404 }) as unknown as Response,
    async () => { throw new Error('ENOTFOUND registry.npmjs.org') },
    async () => ({ ok: true, json: async () => ({ nope: true }) }) as unknown as Response,
    async () => ({ ok: true, json: async () => { throw new Error('bad json') } }) as unknown as Response
  ]

  for (const impl of failures) {
    const result = await fetchLatestVersion('@qwadratic/tg', 500, impl as unknown as typeof fetch)
    assert.equal(result, null, 'every failure mode resolves to null, never a rejection')
  }
})
