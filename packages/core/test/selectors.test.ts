import {
  groupTasks,
  onDeck,
  projectProgress,
  computeStreak,
  activeProjectCount,
  groupLogEntriesByWeek,
} from '../src/selectors';
import type { Task, Project, LogEntry } from '../src/types';

function makeLogEntry(overrides: Partial<LogEntry>): LogEntry {
  return {
    id: overrides.id ?? Math.random().toString(36),
    date: '2026-08-31',
    text: 'test entry',
    projectId: null,
    source: 'manual',
    createdAt: '2026-08-31T00:00:00.000Z',
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? Math.random().toString(36),
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

describe('groupTasks', () => {
  const today = '2026-08-31';

  it('buckets tasks by due date relative to today', () => {
    const tasks = [
      makeTask({ id: 'overdue', due: '2026-08-20' }),
      makeTask({ id: 'today', due: today }),
      makeTask({ id: 'upcoming', due: '2026-09-15' }),
      makeTask({ id: 'nodate', due: null }),
      makeTask({ id: 'done', due: '2026-08-01', done: true }),
    ];
    const groups = groupTasks(tasks, today);
    expect(groups.overdue.map((t) => t.id)).toEqual(['overdue']);
    expect(groups.dueToday.map((t) => t.id)).toEqual(['today']);
    expect(groups.upcoming.map((t) => t.id)).toEqual(['upcoming']);
    expect(groups.noDate.map((t) => t.id)).toEqual(['nodate']);
    expect(groups.done.map((t) => t.id)).toEqual(['done']);
  });

  it('never buckets a completed task as overdue or due today', () => {
    const tasks = [makeTask({ id: 'done-overdue', due: '2026-01-01', done: true })];
    const groups = groupTasks(tasks, today);
    expect(groups.overdue).toHaveLength(0);
    expect(groups.done).toHaveLength(1);
  });

  it('sorts upcoming tasks by nearest due date first', () => {
    const tasks = [
      makeTask({ id: 'far', due: '2026-12-01' }),
      makeTask({ id: 'near', due: '2026-09-01' }),
    ];
    const groups = groupTasks(tasks, today);
    expect(groups.upcoming.map((t) => t.id)).toEqual(['near', 'far']);
  });
});

describe('onDeck', () => {
  it('is overdue followed by due-today, excluding everything else', () => {
    const today = '2026-08-31';
    const tasks = [
      makeTask({ id: 'upcoming', due: '2026-09-01' }),
      makeTask({ id: 'overdue', due: '2026-08-01' }),
      makeTask({ id: 'today', due: today }),
    ];
    expect(onDeck(tasks, today).map((t) => t.id)).toEqual(['overdue', 'today']);
  });
});

describe('projectProgress', () => {
  const project: Project = {
    id: 'p1',
    name: 'Test project',
    status: 'active',
    notes: '',
    color: null,
    githubRepo: null,
    archived: false,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
  };

  it('reports 0% with no linked tasks, not NaN or a crash', () => {
    expect(projectProgress([], project)).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it('computes rounded percentage from linked tasks only', () => {
    const tasks = [
      makeTask({ projectId: 'p1', done: true }),
      makeTask({ projectId: 'p1', done: false }),
      makeTask({ projectId: 'p1', done: true }),
      makeTask({ projectId: 'other', done: true }), // unrelated project, must be ignored
    ];
    expect(projectProgress(tasks, project)).toEqual({ done: 2, total: 3, pct: 67 });
  });
});

describe('computeStreak', () => {
  function entry(date: string): LogEntry {
    return { id: date, date, text: 'x', projectId: null, source: 'manual', createdAt: `${date}T00:00:00.000Z` };
  }

  it('is 0 with no entries', () => {
    expect(computeStreak([], '2026-08-31')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const entries = [entry('2026-08-29'), entry('2026-08-30'), entry('2026-08-31')];
    expect(computeStreak(entries, '2026-08-31')).toBe(3);
  });

  it('still counts through yesterday if today has no entry yet', () => {
    const entries = [entry('2026-08-29'), entry('2026-08-30')];
    expect(computeStreak(entries, '2026-08-31')).toBe(2);
  });

  it('resets to 0 across a gap', () => {
    const entries = [entry('2026-08-20'), entry('2026-08-30')];
    expect(computeStreak(entries, '2026-08-31')).toBe(1);
  });
});

describe('activeProjectCount', () => {
  const base: Project = {
    id: 'x',
    name: 'x',
    status: 'active',
    notes: '',
    color: null,
    githubRepo: null,
    archived: false,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
  };

  it('counts only active, non-archived projects', () => {
    const projects = [
      { ...base, id: '1', status: 'active' as const },
      { ...base, id: '2', status: 'paused' as const },
      { ...base, id: '3', status: 'active' as const, archived: true },
      { ...base, id: '4', status: 'active' as const },
    ];
    expect(activeProjectCount(projects)).toBe(2);
  });
});

describe('groupLogEntriesByWeek', () => {
  it('groups entries into Monday-start weeks, most recent week first', () => {
    const entries = [
      // Week of 2026-08-24 (Mon) - 2026-08-30 (Sun)
      makeLogEntry({ id: 'a', date: '2026-08-24' }),
      makeLogEntry({ id: 'b', date: '2026-08-26' }),
      // Week of 2026-08-31 (Mon) - 2026-09-06 (Sun)
      makeLogEntry({ id: 'c', date: '2026-08-31' }),
      makeLogEntry({ id: 'd', date: '2026-09-01' }),
    ];
    const groups = groupLogEntriesByWeek(entries);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ weekStart: '2026-08-31', weekEnd: '2026-09-06' });
    expect(groups[0]?.entries.map((e) => e.id)).toEqual(['d', 'c']);
    expect(groups[1]).toMatchObject({ weekStart: '2026-08-24', weekEnd: '2026-08-30' });
    expect(groups[1]?.entries.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('treats Sunday as the last day of its week, not the start of a new one', () => {
    const entries = [
      makeLogEntry({ id: 'mon', date: '2026-08-24' }),
      makeLogEntry({ id: 'sun', date: '2026-08-30' }),
    ];
    const groups = groupLogEntriesByWeek(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ weekStart: '2026-08-24', weekEnd: '2026-08-30' });
  });

  it('returns an empty array for no entries', () => {
    expect(groupLogEntriesByWeek([])).toEqual([]);
  });
});
