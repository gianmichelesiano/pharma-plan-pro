// Returns a 6×7 grid of ISO dates (YYYY-MM-DD) covering the given month,
// starting on Monday. Cells outside the month are still valid dates.
export function monthGrid(year: number, month0: number): string[][] {
  const firstOfMonth = new Date(Date.UTC(year, month0, 1));
  const dayOfWeek = (firstOfMonth.getUTCDay() + 6) % 7; // 0=Mon
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(firstOfMonth.getUTCDate() - dayOfWeek);

  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: string[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(gridStart);
      cur.setUTCDate(gridStart.getUTCDate() + w * 7 + d);
      row.push(cur.toISOString().slice(0, 10));
    }
    weeks.push(row);
  }
  return weeks;
}

export function isInMonth(isoDate: string, year: number, month0: number): boolean {
  const d = new Date(isoDate);
  return d.getUTCFullYear() === year && d.getUTCMonth() === month0;
}
