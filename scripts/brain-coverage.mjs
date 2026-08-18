#!/usr/bin/env node
/**
 * How much of the archive can the brain actually answer about?
 *
 * Three numbers that are easy to confuse and mean very different things:
 *   - in the brain      : a page exists, so KEYWORD search can find it
 *   - oversized         : the page exists but gbrain skipped its embedding,
 *                         so semantic search cannot reach it
 *   - semantic coverage : what is left, and the only number that answers
 *                         "can I ask my Telegram a question in my own words?"
 *
 * A stopgap until `tg brain status` exists (backlog task-32).
 *
 * Note on paging: `gbrain list` returns 50 rows by default and `-n` is NOT the
 * limit flag - it is silently ignored. Use --limit with --offset, or you will
 * measure 50 pages and believe it.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ARCHIVE = process.env.TG_DATA_DIR
  ? join(process.env.TG_DATA_DIR, 'archive')
  : join('data', 'archive')
const OVERSIZE = 100_000

function brainSlugs() {
  const slugs = new Set()
  for (let offset = 0; offset < 10_000; offset += 100) {
    let out = ''
    try {
      out = execFileSync('gbrain',
        ['list', '--limit', '100', '--offset', String(offset), '--sort', 'slug'],
        { encoding: 'utf-8' })
    } catch {
      break
    }
    const rows = out.split('\n')
      .filter((l) => l.startsWith('tg/chat/'))
      .map((l) => l.split('\t')[0].trim())
    if (rows.length === 0) break
    const before = slugs.size
    for (const r of rows) slugs.add(r)
    if (slugs.size === before) break
  }
  return slugs
}

const files = readdirSync(ARCHIVE)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ name: f, slug: `tg/chat/${f.slice(0, -3)}`, size: statSync(join(ARCHIVE, f)).size }))

if (files.length === 0) {
  console.error(`no archive files under ${ARCHIVE}`)
  process.exit(4)
}

const slugs = brainSlugs()
const total = files.reduce((n, f) => n + f.size, 0)
const present = files.filter((f) => slugs.has(f.slug))
const missing = files.filter((f) => !slugs.has(f.slug))
const oversized = present.filter((f) => f.size > OVERSIZE)

const bytes = (xs) => xs.reduce((n, f) => n + f.size, 0)
const pct = (n) => `${((n / total) * 100).toFixed(1)}%`
const semantic = bytes(present) - bytes(oversized)

console.log(`archive              ${files.length} chats, ${(total / 1e6).toFixed(0)} MB`)
console.log(`in the brain         ${present.length} chats, ${pct(bytes(present))} of bytes`)
console.log(`not in the brain     ${missing.length} chats  (unroutable: no tracked folder)`)
console.log(`oversized            ${oversized.length} chats, ${pct(bytes(oversized))}  (keyword only, embedding skipped)`)
console.log('')
console.log(`KEYWORD searchable   ${pct(bytes(present))}`)
console.log(`SEMANTIC searchable  ${pct(semantic)}`)

if (missing.length > 0) {
  console.log('')
  console.log(`largest chats missing from the brain:`)
  for (const f of missing.sort((a, b) => b.size - a.size).slice(0, 5)) {
    console.log(`  ${(f.size / 1e6).toFixed(1).padStart(6)} MB  ${f.name}`)
  }
}
