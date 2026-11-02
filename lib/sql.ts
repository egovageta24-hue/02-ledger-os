/** Escape `%`, `_` and `\` so user input is matched literally inside an ILIKE pattern. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}
