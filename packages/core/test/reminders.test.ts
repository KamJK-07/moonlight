import { computeReminders } from '../src/reminders';
import { addDays } from '../src/dates';
import type { Task, CalendarEvent, Settings, DateKey } from '../src/types';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    themeMode: 'system',
    accent: 'amber',
    textScale: 'normal',
    githubUsername: null,
    linkedRepos: [],
    githubActivitySeenAt: null,
    lastCommitLogSyncAt: null,
    remindersEnabled: true,
    reminderMinutesBefore: 30,
    syncRepo: null,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 'task-1',
    text: 'test task',
    done: false,
    projectId: null,
    due: null,
    priority: 'medium',
    githubIssue: null,
    subtasks: [],
    recurrence: 'none',
    blockedBy: [],
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: overrides.id ?? 'event-1',
    date: '2026-08-31',
    title: 'test event',
    time: '10:00',
    projectId: null,
    recurrence: 'none',
    createdAt: '2026-08-30T00:00:00.000Z',
    ...overrides,
  };
}

// Local midnight, Aug 31 2026 — constructed via local Date fields (not an
// ISO "Z" string) so this lines up with parseDateKey/setHours, which are
// also local-time, regardless of the machine's timezone.
const NOW = new Date(2026, 7, 31, 0, 0, 0, 0);

describe('computeReminders', () => {
  it('returns an empty array when reminders are disabled', () => {
    const settings = makeSettings({ remindersEnabled: false });
    const tasks = [makeTask({ due: '2026-09-01' })];
    const events = { '2026-08-31': [makeEvent({ time: '23:00' })] };
    expect(computeReminders(tasks, events, settings, NOW)).toEqual([]);
  });

  it('excludes calendar events with no time set', () => {
    const settings = makeSettings();
    const events: Record<DateKey, CalendarEvent[]> = {
      '2026-08-31': [makeEvent({ id: 'no-time', time: null })],
    };
    expect(computeReminders([], events, settings, NOW)).toEqual([]);
  });

  it('excludes done tasks even with a future due date', () => {
    const settings = makeSettings();
    const tasks = [makeTask({ id: 'done-task', due: '2026-09-01', done: true })];
    expect(computeReminders(tasks, {}, settings, NOW)).toEqual([]);
  });

  it('excludes a task/event whose computed fireAt is already in the past', () => {
    const settings = makeSettings({ reminderMinutesBefore: 30 });
    // An event at 00:10 with a 30-minute lead-in fires at 23:40 the previous
    // day — before NOW (local midnight Aug 31).
    const events: Record<DateKey, CalendarEvent[]> = {
      '2026-08-31': [makeEvent({ id: 'past-event', time: '00:10' })],
    };
    const tasks = [makeTask({ id: 'past-task', due: '2026-08-01' })];
    expect(computeReminders(tasks, events, settings, NOW)).toEqual([]);
  });

  it('computes an event fireAt as reminderMinutesBefore minutes before event time', () => {
    const settings = makeSettings({ reminderMinutesBefore: 15 });
    const events: Record<DateKey, CalendarEvent[]> = {
      '2026-08-31': [makeEvent({ id: 'ev', date: '2026-08-31', time: '10:00' })],
    };
    const result = computeReminders([], events, settings, NOW);
    const expected = new Date(2026, 7, 31, 9, 45, 0, 0);
    expect(result).toEqual([
      {
        id: 'event:ev',
        title: 'Upcoming: test event',
        body: '10:00 on 2026-08-31',
        fireAt: expected.toISOString(),
      },
    ]);
  });

  it('computes a task fireAt as 09:00 local time on the due date', () => {
    const settings = makeSettings();
    const tasks = [makeTask({ id: 't1', text: 'ship it', due: '2026-09-02' })];
    const result = computeReminders(tasks, {}, settings, NOW);
    const expected = new Date(2026, 8, 2, 9, 0, 0, 0);
    expect(result).toEqual([
      {
        id: 'task:t1',
        title: 'Due today: ship it',
        body: 'Due 2026-09-02',
        fireAt: expected.toISOString(),
      },
    ]);
  });

  it('respects the 7-day window boundary, inclusive of the exact edge', () => {
    const settings = makeSettings({ reminderMinutesBefore: 30 });
    const dayPlus7 = addDays('2026-08-31', 7); // '2026-09-07'
    const events: Record<DateKey, CalendarEvent[]> = {
      [dayPlus7]: [
        // fireAt = 00:30 - 30min = local midnight on day+7 = NOW + 7 days exactly.
        makeEvent({ id: 'on-boundary', date: dayPlus7, time: '00:30' }),
        // fireAt = 1 minute past the boundary.
        makeEvent({ id: 'past-boundary', date: dayPlus7, time: '00:31' }),
      ],
    };
    const result = computeReminders([], events, settings, NOW);
    expect(result.map((r) => r.id)).toEqual(['event:on-boundary']);
    expect(result[0]!.fireAt).toBe(new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());
  });

  it('caps the result at 60 items, keeping the soonest first', () => {
    const settings = makeSettings({ reminderMinutesBefore: 30 });
    // 80 events on the same day, 15 minutes apart starting at 01:00, so every
    // computed fireAt is distinct and strictly increasing with i — the
    // soonest 60 (i = 0..59) should survive the cap, in order.
    const events: Record<DateKey, CalendarEvent[]> = { '2026-09-01': [] };
    for (let i = 0; i < 80; i++) {
      const totalMinutes = 60 + i * 15;
      const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
      const mm = String(totalMinutes % 60).padStart(2, '0');
      events['2026-09-01']!.push(
        makeEvent({ id: `e${i}`, date: '2026-09-01', time: `${hh}:${mm}` }),
      );
    }
    const result = computeReminders([], events, settings, NOW);
    expect(result).toHaveLength(60);
    expect(result.map((r) => r.id)).toEqual(Array.from({ length: 60 }, (_, i) => `event:e${i}`));
    const fireAts = result.map((r) => r.fireAt);
    expect(fireAts).toEqual([...fireAts].sort());
  });
});
