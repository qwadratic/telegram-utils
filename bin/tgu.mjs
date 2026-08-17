#!/usr/bin/env node
/**
 * The `tgu` entry point.
 *
 * Data paths (data/session.db, data/config.json, data/archive, data/sent.jsonl)
 * resolve against the *caller's* working directory, so one global install drives
 * as many workspaces as you have directories. Only the code comes from here.
 *
 * Two ways to run, picked automatically:
 *   1. A published install has `dist/`, so it runs compiled JavaScript. Shipping
 *      a TypeScript transpiler as a runtime dependency would make every
 *      invocation slower and the install far heavier, for nothing.
 *   2. A git checkout with no build yet falls back to `tsx` on `src/`, so the
 *      demo and a fresh clone work without a build step.
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const compiled = join(root, 'dist', 'index.js')

if (existsSync(compiled)) {
  await import(compiled)
} else {
  const tsx = join(root, 'node_modules', '.bin', 'tsx')
  const source = join(root, 'src', 'index.ts')

  if (!existsSync(tsx) || !existsSync(source)) {
    process.stderr.write(
      'tgu is not built and no TypeScript runner is available.\n' +
      `  Expected compiled output at ${compiled}\n` +
      '  In a checkout, run:  pnpm install && pnpm build\n'
    )
    process.exit(1)
  }

  // stdio inherit: this is a CLI, and the child owns the terminal for prompts.
  const result = spawnSync(tsx, [source, ...process.argv.slice(2)], { stdio: 'inherit' })
  process.exit(result.status ?? 1)
}
