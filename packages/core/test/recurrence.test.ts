import { occurrencesInRange } from '../src/recurrence';
import type { CalendarEvent, DateKey } from '../src/types';

function makeEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: overrides.id ?? Math.random().toString(36),
    date: '2026-01-01',
    title: 'test event',
    time: null,
    projectId: null,
    recurrence: 'none',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function datesOf(result: Record<DateKey, ReturnType<typeof occurrencesInRange>[string]>): string[] {
  return Object.keys(result).sort();
}

describe('occurrencesInRange', () => {
  it('daily: occurrences fully within range', () => {
    const event = makeEvent({ id: 'e1', date: '2026-03-10', recurrence: 'daily' });
    const result = occurrencesInRange({ '2026-03-10': [event] }, '2026-03-10', '2026-03-13');
    expect(datesOf(result)).toEqual(['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13']);
    expect(result['2026-03-12']?.[0]?.originalDate).toBe('2026-03-10');
  });

  it('daily: event starts before the range', () => {
    const event = makeEvent({ id: 'e2', date: '2026-03-01', recurrence: 'daily' });
    const result = occurrencesInRange({ '2026-03-01': [event] }, '2026-03-10', '2026-03-12');
    expect(datesOf(result)).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
    expect(result['2026-03-10']?.[0]?.originalDate).toBe('2026-03-01');
  });

  it('weekly: spanning a month boundary', () => {
    const event = makeEvent({ id: 'e3', date: '2026-01-20', recurrence: 'weekly' });
    const result = occurrencesInRange({ '2026-01-20': [event] }, '2026-01-20', '2026-02-10');
    expect(datesOf(result)).toEqual(['2026-01-20', '2026-01-27', '2026-02-03', '2026-02-10']);
  });

  it('monthly: simple case (same day each month)', () => {
    const event = makeEvent({ id: 'e4', date: '2026-01-15', recurrence: 'monthly' });
    const result = occurrencesInRange({ '2026-01-15': [event] }, '2026-01-01', '2026-04-30');
    expect(datesOf(result)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15']);
  });

  it('monthly: day-31 edge case skips months without a 31st, without drifting', () => {
    const event = makeEvent({ id: 'e5', date: '2026-01-31', recurrence: 'monthly' });
    const result = occurrencesInRange({ '2026-01-31': [event] }, '2026-01-01', '2026-05-31');
    expect(datesOf(result)).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
  });

  it('monthly: event starts well before the requested range', () => {
    const event = makeEvent({ id: 'e6', date: '2025-01-15', recurrence: 'monthly' });
    const result = occurrencesInRange({ '2025-01-15': [event] }, '2026-01-01', '2026-03-31');
    expect(datesOf(result)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  it('non-recurring event outside the range is excluded', () => {
    const event = makeEvent({ id: 'e7', date: '2026-01-01', recurrence: 'none' });
    const result = occurrencesInRange({ '2026-01-01': [event] }, '2026-02-01', '2026-02-28');
    expect(datesOf(result)).toEqual([]);
  });

  it('range entirely before the event start date yields an empty result', () => {
    const event = makeEvent({ id: 'e8', date: '2026-06-01', recurrence: 'weekly' });
    const result = occurrencesInRange({ '2026-06-01': [event] }, '2026-01-01', '2026-03-01');
    expect(datesOf(result)).toEqual([]);
  });

  it('monthly day-31 event over many decades terminates quickly', () => {
    const event = makeEvent({ id: 'e9', date: '1970-01-31', recurrence: 'monthly' });
    const start = Date.now();
    const result = occurrencesInRange({ '1970-01-31': [event] }, '1970-01-01', '2043-01-31');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
    const dates = datesOf(result);
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every((d) => d.endsWith('-31'))).toBe(true);
  });
});
