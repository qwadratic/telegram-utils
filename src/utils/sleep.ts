/**
 * Sleep for the specified number of milliseconds.
 *
 * One implementation on purpose: this used to exist twice, byte-identical, in
 * `messages/fetch.ts` and `utils/flood-wait.ts`.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
