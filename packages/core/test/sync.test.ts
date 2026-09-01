import { latestUpdatedAt, planSync } from '../src/sync';
import type { WorklightState, Task, Settings } from '../src/types';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    themeMode: 'system',
    accent: 'amber',
    githubUsername: null,
    linkedRepos: [],
    githubActivitySeenAt: null,
    lastCommitLogSyncAt: null,
    remindersEnabled: false,
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
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    ...overrides,
  };
}

function makeState(overrides: Partial<WorklightState> = {}): WorklightState {
  return {
    version: 1,
    tasks: [],
    projects: [],
    events: {},
    logEntries: [],
    ideas: [],
    settings: makeSettings(),
    ...overrides,
  };
}

describe('latestUpdatedAt', () => {
  it('returns the epoch for a state with no records', () => {
    expect(() => latestUpdatedAt(makeState())).not.toThrow();
    expect(latestUpdatedAt(makeState())).toBe('1970-01-01T00:00:00.000Z');
  });

  it('finds the freshest timestamp across tasks, projects, ideas, log entries, and events', () => {
    const state = makeState({
      tasks: [makeTask({ updatedAt: '2026-08-01T00:00:00.000Z' })],
      projects: [
        {
          id: 'p1',
          name: 'Proj',
          status: 'active',
          notes: '',
          color: null,
          githubRepo: null,
          archived: false,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-15T00:00:00.000Z',
        },
      ],
      ideas: [
        {
          id: 'i1',
          text: 'idea',
          tag: null,
          status: 'raw',
          riff: null,
          links: [],
          starred: false,
          archived: false,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-10T00:00:00.000Z',
        },
      ],
      logEntries: [
        {
          id: 'l1',
          date: '2026-08-20',
          text: 'log',
          projectId: null,
          source: 'manual',
          createdAt: '2026-08-25T00:00:00.000Z',
        },
      ],
      events: {
        '2026-08-31': [
          {
            id: 'e1',
            date: '2026-08-31',
            title: 'event',
            time: null,
            projectId: null,
            createdAt: '2026-08-31T12:00:00.000Z',
          },
        ],
      },
    });
    expect(latestUpdatedAt(state)).toBe('2026-08-31T12:00:00.000Z');
  });
});

describe('planSync', () => {
  it('pushes when there is no remote state yet', () => {
    expect(planSync(makeState(), null)).toBe('push');
  });

  it('is a noop when local and remote have the same latest timestamp', () => {
    const local = makeState({ tasks: [makeTask({ updatedAt: '2026-08-30T00:00:00.000Z' })] });
    const remote = makeState({ tasks: [makeTask({ updatedAt: '2026-08-30T00:00:00.000Z' })] });
    expect(planSync(local, remote)).toBe('noop');
  });

  it('pushes when local is newer than remote', () => {
    const local = makeState({ tasks: [makeTask({ updatedAt: '2026-08-31T00:00:00.000Z' })] });
    const remote = makeState({ tasks: [makeTask({ updatedAt: '2026-08-01T00:00:00.000Z' })] });
    expect(planSync(local, remote)).toBe('push');
  });

  it('pulls when remote is newer than local', () => {
    const local = makeState({ tasks: [makeTask({ updatedAt: '2026-08-01T00:00:00.000Z' })] });
    const remote = makeState({ tasks: [makeTask({ updatedAt: '2026-08-31T00:00:00.000Z' })] });
    expect(planSync(local, remote)).toBe('pull');
  });

  it('does not throw when comparing two empty states', () => {
    expect(() => planSync(makeState(), makeState())).not.toThrow();
    expect(planSync(makeState(), makeState())).toBe('noop');
  });
});
