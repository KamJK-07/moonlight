import type { DateKey } from './types';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Today's date as a DateKey ("YYYY-MM-DD"), in local time. */
export function todayKey(now: Date = new Date()): DateKey {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function dateKeyFrom(y: number, m1to12: number, d: number): DateKey {
  return `${y}-${pad2(m1to12)}-${pad2(d)}`;
}

export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(key: DateKey, delta: number): DateKey {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + delta);
  return todayKey(d);
}

export function isBefore(a: DateKey, b: DateKey): boolean {
  return a < b; // "YYYY-MM-DD" sorts lexicographically = chronologically
}

/** Monday of the week containing the given date, as a DateKey. */
export function startOfWeek(key: DateKey): DateKey {
  const dow = parseDateKey(key).getDay(); // 0 Sun .. 6 Sat
  return addDays(key, dow === 0 ? -6 : 1 - dow);
}

export function yearMonthOf(key: DateKey): string {
  return key.slice(0, 7);
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

/** Day-of-week for the 1st of the month, 0 = Sunday. */
export function firstWeekdayOfMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12 - 1, 1).getDay();
}
