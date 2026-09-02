import type { CalendarEvent, DateKey } from './types';
import { addDays, parseDateKey, dateKeyFrom, daysInMonth } from './dates';

const MAX_OCCURRENCES = 500; // hard safety cap, independent of the requested range's size

/** A CalendarEvent occurrence within a range — `date` is the occurrence's own date;
 * `originalDate` is the DateKey the event is actually *stored* under (state.events'
 * key), which delete actions must use regardless of which occurrence triggered them. */
export interface EventOccurrence extends CalendarEvent {
  originalDate: DateKey;
}

function occurrenceDates(startKey: DateKey, recurrence: CalendarEvent['recurrence'], rangeStart: DateKey, rangeEnd: DateKey): DateKey[] {
  const out: DateKey[] = [];
  if (recurrence === 'none') {
    if (startKey >= rangeStart && startKey <= rangeEnd) out.push(startKey);
    return out;
  }
  const start = parseDateKey(startKey);
  for (let i = 0; i < MAX_OCCURRENCES; i++) {
    let candidate: DateKey;
    if (recurrence === 'daily') {
      candidate = addDays(startKey, i);
    } else if (recurrence === 'weekly') {
      candidate = addDays(startKey, i * 7);
    } else {
      const targetMonthIndex = start.getMonth() + i;
      const targetYear = start.getFullYear() + Math.floor(targetMonthIndex / 12);
      const targetMonth1to12 = (((targetMonthIndex % 12) + 12) % 12) + 1;
      const day = start.getDate();
      if (day > daysInMonth(targetYear, targetMonth1to12)) continue;
      candidate = dateKeyFrom(targetYear, targetMonth1to12, day);
    }
    if (candidate > rangeEnd) break;
    if (candidate >= rangeStart) out.push(candidate);
  }
  return out;
}

/**
 * Advances a single DateKey forward one step of the given recurrence —
 * used to recreate a recurring task's next due date on completion (tasks
 * are single objects, not expanded into occurrences like events are).
 * Monthly clamps to the target month's last day instead of skipping it,
 * e.g. Jan 31 -> Feb 28, since a "next due date" needs exactly one answer.
 */
export function nextRecurrenceDate(fromKey: DateKey, recurrence: 'daily' | 'weekly' | 'monthly'): DateKey {
  if (recurrence === 'daily') return addDays(fromKey, 1);
  if (recurrence === 'weekly') return addDays(fromKey, 7);
  const start = parseDateKey(fromKey);
  const targetMonthIndex = start.getMonth() + 1;
  const targetYear = start.getFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth1to12 = (((targetMonthIndex % 12) + 12) % 12) + 1;
  const day = Math.min(start.getDate(), daysInMonth(targetYear, targetMonth1to12));
  return dateKeyFrom(targetYear, targetMonth1to12, day);
}

/** Expands stored events (including recurring ones) into every occurrence
 * falling within [rangeStart, rangeEnd] (inclusive), keyed by occurrence date. */
export function occurrencesInRange(
  events: Record<DateKey, CalendarEvent[]>,
  rangeStart: DateKey,
  rangeEnd: DateKey,
): Record<DateKey, EventOccurrence[]> {
  const result: Record<DateKey, EventOccurrence[]> = {};
  for (const [storedDate, dateEvents] of Object.entries(events)) {
    for (const event of dateEvents) {
      for (const occDate of occurrenceDates(event.date, event.recurrence, rangeStart, rangeEnd)) {
        (result[occDate] ??= []).push({ ...event, date: occDate, originalDate: storedDate });
      }
    }
  }
  return result;
}
