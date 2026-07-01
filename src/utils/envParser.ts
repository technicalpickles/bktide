export function parseEnvEntries(entries: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const eqIndex = entry.indexOf('=');
    if (eqIndex <= 0) {
      throw new Error(`Invalid --env entry: "${entry}". Use KEY=VAL.`);
    }
    const key = entry.substring(0, eqIndex);
    const value = entry.substring(eqIndex + 1);
    result[key] = value;
  }
  return result;
}
