export function renderTable(rows: string[][]): string {
  if (!rows || rows.length === 0) return '';
  const widths = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] ?? '').length)));
  return rows
    .map(r => r.map((c, i) => (c ?? '').padEnd(widths[i])).join('  '))
    .join('\n');
}


