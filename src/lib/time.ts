/**
 * Start of a local calendar day, expressed as a UTC Date.
 * `tzOffsetMin` is the browser's `new Date().getTimezoneOffset()` value.
 */
export function startOfLocalDay(tzOffsetMin: number, daysAgo = 0): Date {
  const shifted = new Date(Date.now() - tzOffsetMin * 60_000);
  const startShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - daysAgo);
  return new Date(startShifted + tzOffsetMin * 60_000);
}

/** YYYY-MM-DD key of the local day a timestamp falls in. */
export function localDayKey(date: Date, tzOffsetMin: number): string {
  return new Date(date.getTime() - tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

export function parseTz(value: string | null): number {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? n : 0;
}