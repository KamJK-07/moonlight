import { WorklightStore } from '../src/store';
import { createInitialState, InMemoryStorageAdapter } from '../src/storage';

function freshStore() {
  const adapter = new InMemoryStorageAdapter();
  const store = new WorklightStore(createInitialState(), adapter);
  return { store, adapter };
}

describe('WorklightStore — tasks', () => {
  it('adds a task and notifies subscribers exactly once', () => {
    const { store } = freshStore();
    const listener = jest.fn();
    store.subscribe(listener);
    const task = store.addTask({ text: '  Write tests  ' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(task.text).toBe('Write tests'); // trimmed
    expect(store.getState().tasks.some((t) => t.id === task.id)).toBe(true);
  });

  it('toggling a task flips done and is idempotent under explicit value', () => {
    const { store } = freshStore();
    const task = store.addTask({ text: 'A task' });
    store.toggleTask(task.id, true);
    expect(store.getState().tasks.find((t) => t.id === task.id)?.done).toBe(true);
    store.toggleTask(task.id, true);
    expect(store.getState().tasks.find((t) => t.id === task.id)?.done).toBe(true);
    store.toggleTask(task.id); // no explicit value → flips
    expect(store.getState().tasks.find((t) => t.id === task.id)?.done).toBe(false);
  });

  it('deleting a task removes exactly that task', () => {
    const { store } = freshStore();
    const a = store.addTask({ text: 'keep' });
    const b = store.addTask({ text: 'remove' });
    store.deleteTask(b.id);
    const ids = store.getState().tasks.map((t) => t.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
  });
});

describe('WorklightStore — projects', () => {
  it('deleting a project unlinks its tasks instead of deleting them', () => {
    const { store } = freshStore();
    const project = store.addProject({ name: 'Doomed project' });
    const task = store.addTask({ text: 'orphan me', projectId: project.id });
    store.deleteProject(project.id);
    const state = store.getState();
    expect(state.projects.some((p) => p.id === project.id)).toBe(false);
    const survivor = state.tasks.find((t) => t.id === task.id);
    expect(survivor).toBeDefined();
    expect(survivor?.projectId).toBeNull();
  });
});

describe('WorklightStore — calendar events', () => {
  it('adds and removes events under the right date key without disturbing other dates', () => {
    const { store } = freshStore();
    store.addEvent({ date: '2026-09-01', title: 'Launch' });
    const ev = store.addEvent({ date: '2026-09-01', title: 'Follow-up' });
    store.addEvent({ date: '2026-09-02', title: 'Other day' });

    expect(store.getState().events['2026-09-01']).toHaveLength(2);
    store.deleteEvent('2026-09-01', ev.id);
    expect(store.getState().events['2026-09-01']).toHaveLength(1);
    expect(store.getState().events['2026-09-02']).toHaveLength(1);
  });

  it('removes the date key entirely once its last event is deleted', () => {
    const { store } = freshStore();
    const ev = store.addEvent({ date: '2026-09-05', title: 'Only one' });
    store.deleteEvent('2026-09-05', ev.id);
    expect(store.getState().events['2026-09-05']).toBeUndefined();
  });
});

describe('WorklightStore — persistence', () => {
  it('saves to the injected adapter on every mutation', async () => {
    const { store, adapter } = freshStore();
    store.addTask({ text: 'persist me' });
    // save() is fire-and-forget; flush microtasks before asserting.
    await Promise.resolve();
    const saved = await adapter.load();
    expect(saved?.tasks.some((t) => t.text === 'persist me')).toBe(true);
  });
});

describe('WorklightStore — settings', () => {
  it('updates theme mode and accent independently', () => {
    const { store } = freshStore();
    store.setThemeMode('dark');
    store.setAccent('violet');
    expect(store.getState().settings.themeMode).toBe('dark');
    expect(store.getState().settings.accent).toBe('violet');
  });
});
