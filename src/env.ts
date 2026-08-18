/**
 * Environment settings, with a fallback to the pre-rename `TGU_` names.
 *
 * The tool was `tgu` and its settings were `TGU_*`. The command is now `tg`, so
 * the settings follow. The rename is safe for the vault namespace: the four
 * secret names read in `src/session/psst.ts` share the prefix but none of them
 * collides with a setting name, which eval-83 pins.
 *
 * The secret names are deliberately NOT written out here. `test/ship.test.ts`
 * eval-48 fails if any file reachable from the gbrain path so much as names a
 * Telegram secret, and a doc comment is indistinguishable from a real reference
 * to a grep. Naming them would weaken a security gate to explain a comment.
 *
 * WHY a fallback rather than a clean break: the operator's agent instructions and
 * workflows in OTHER repositories already pass `TGU_NON_INTERACTIVE=1`. If that
 * silently stopped being read, an unattended run would stop failing fast and
 * start hanging forever on "Enter your phone number" - the exact failure that
 * variable exists to prevent. A rename whose failure mode is a hang is not a
 * rename anyone should ship without a bridge.
 *
 * The warning goes to stderr once per name per process: enough to get the
 * scripts updated, never enough to corrupt a `--json` payload on stdout.
 */

const warned = new Set<string>()

/**
 * Read `TG_<name>`, falling back to the legacy `TGU_<name>`.
 *
 * Returns undefined when neither is set, so callers keep their own defaults.
 */
export function setting(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const current = env[`TG_${name}`]
  if (current !== undefined && current !== '') return current

  const legacy = env[`TGU_${name}`]
  if (legacy === undefined || legacy === '') return undefined

  if (!warned.has(name)) {
    warned.add(name)
    process.stderr.write(
      `tg: TGU_${name} is the old name and still works; rename it to TG_${name}.\n`
    )
  }
  return legacy
}

/** Reset the warn-once memo. Tests only. */
export function resetSettingWarnings(): void {
  warned.clear()
}
