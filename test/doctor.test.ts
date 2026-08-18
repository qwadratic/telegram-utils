import assert from 'node:assert'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderReport, summarise, type Check } from '../src/doctor/index.js'
import { EXIT } from '../src/exit-codes.js'
import { OperatorError } from '../src/errors.js'
import { exitCodeFor } from '../src/cli/errors.js'
import { assertGolden } from './helpers.js'

const ok = (name: string): Check => ({ name, status: 'ok', detail: 'fine' })

test('eval-86 a dead session is needs_human_login, not a generic failure', () => {
  // This is the whole reason doctor exists. Auth failing mid-task is the most
  // evidenced pain in the corpus: 15 mentions across 5 days spanning four
  // months, every one ending with a human having to notice and intervene. An
  // orchestrator must be able to tell "ask the operator to log in" from
  // "something is misconfigured" from "retry in a minute" WITHOUT reading prose.
  const dead = summarise(
    [ok('psst'), ok('api-credentials'), { name: 'session', status: 'fail', detail: 'none', fix: 'tg session login' }],
    '/w'
  )
  assert.equal(dead.status, 'needs_human_login')
  assert.equal(dead.exitCode, EXIT.needsHuman)
  assert.equal(dead.hint, 'tg session login')
  assert.equal(dead.ok, false)

  // A session that exists on disk but is dead server-side lands the same way:
  // the liveness probe is what distinguishes them, and both need a human.
  const revoked = summarise(
    [ok('session'), { name: 'liveness', status: 'fail', detail: 'AUTH_KEY_UNREGISTERED', fix: 'tg session login' }],
    '/w'
  )
  assert.equal(revoked.status, 'needs_human_login')
  assert.equal(revoked.exitCode, EXIT.needsHuman)
})

test('eval-87 missing configuration is distinguishable from a missing login', () => {
  const report = summarise(
    [ok('psst'), { name: 'api-credentials', status: 'fail', detail: 'missing API_ID', fix: 'psst set API_ID' }, ok('session')],
    '/w'
  )
  assert.equal(report.status, 'not_configured')
  assert.equal(report.exitCode, EXIT.notConfigured)
  assert.equal(report.hint, 'psst set API_ID', 'the hint is the first actionable fix')
})

test('eval-88 a lock held by a live run is not a failure', () => {
  // An hourly job overlapping the previous one is normal operation. Reporting
  // it as broken would page someone every night for a system working correctly.
  const report = summarise(
    [ok('session'), { name: 'lock', status: 'warn', detail: 'held by pid 1234; another run is working' }],
    '/w'
  )
  assert.equal(report.ok, true, 'busy is not broken')
  assert.equal(report.status, 'busy')
  assert.equal(report.exitCode, EXIT.ok, 'a cron wrapper must not treat this as failure')
})

test('eval-89 a ready workspace exits 0 and says so', () => {
  const report = summarise([ok('psst'), ok('api-credentials'), ok('session'), ok('lock')], '/w')
  assert.equal(report.status, 'ready')
  assert.equal(report.exitCode, EXIT.ok)
  assert.equal(report.hint, undefined)
  assertGolden('eval-89-doctor-ready', renderReport(report))
})

test('eval-90 the rendered report shows the fix under the failing check', () => {
  const report = summarise(
    [
      ok('psst'),
      { name: 'api-credentials', status: 'fail', detail: 'missing API_HASH', fix: 'psst set API_HASH' },
      { name: 'archive-permissions', status: 'warn', detail: '0755, readable beyond you', fix: 'chmod 700 data/archive' }
    ],
    '/w'
  )
  assertGolden('eval-90-doctor-broken', renderReport(report))
})

test('eval-91 exit codes are a stable contract, and errors carry one', () => {
  // Numbers are part of the CLI contract now: add, never renumber.
  assert.deepEqual(EXIT, {
    ok: 0, bug: 1, usage: 2, needsHuman: 3, notConfigured: 4, busy: 5, upstream: 6
  })

  // An OperatorError defaults to not-configured, which is what nearly all of
  // them have always meant.
  assert.equal(exitCodeFor(new OperatorError('missing thing')), EXIT.notConfigured)
  assert.equal(exitCodeFor(new OperatorError('log in', EXIT.needsHuman)), EXIT.needsHuman)

  // Anything that is NOT an OperatorError is a bug in this tool and keeps 1.
  assert.equal(exitCodeFor(new TypeError('undefined is not a function')), EXIT.bug)
  assert.equal(exitCodeFor('a thrown string'), EXIT.bug)

  // The two errors whose code is not the default actually set it.
  const src = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf-8')
  assert.match(src('../src/session/lock.ts'), /EXIT\.busy/, 'LockHeldError must exit busy')
  assert.match(src('../src/session/index.ts'), /EXIT\.needsHuman/, 'no-session must exit needsHuman')
})
