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

describe('WorklightStore — subtasks', () => {
  it('adds a subtask and notifies subscribers exactly once', () => {
    const { store } = freshStore();
    const task = store.addTask({ text: 'Parent task' });
    const listener = jest.fn();
    store.subscribe(listener);
    store.addSubtask(task.id, '  Do the thing  ');
    expect(listener).toHaveBeenCalledTimes(1);
    const subtasks = store.getState().tasks.find((t) => t.id === task.id)?.subtasks;
    expect(subtasks).toHaveLength(1);
    expect(subtasks?.[0]?.text).toBe('Do the thing'); // trimmed
    expect(subtasks?.[0]?.done).toBe(false);
  });

  it('does not add a subtask when text is empty after trim', () => {
    const { store } = freshStore();
    const task = store.addTask({ text: 'Parent task' });
    store.addSubtask(task.id, '   ');
    expect(store.getState().tasks.find((t) => t.id === task.id)?.subtasks).toHaveLength(0);
  });

  it('toggling a subtask flips done and is idempotent under explicit value', () => {
    const { store } = freshStore();
    const task = store.addTask({ text: 'Parent task' });
    store.addSubtask(task.id, 'Sub A');
    const subtaskId = store.getState().tasks.find((t) => t.id === task.id)!.subtasks[0]!.id;

    store.toggleSubtask(task.id, subtaskId, true);
    expect(
      store.getState().tasks.find((t) => t.id === task.id)?.subtasks.find((s) => s.id === subtaskId)
        ?.done,
    ).toBe(true);
    store.toggleSubtask(task.id, subtaskId, true);
    expect(
      store.getState().tasks.find((t) => t.id === task.id)?.subtasks.find((s) => s.id === subtaskId)
        ?.done,
    ).toBe(true);
    store.toggleSubtask(task.id, subtaskId); // no explicit value → flips
    expect(
      store.getState().tasks.find((t) => t.id === task.id)?.subtasks.find((s) => s.id === subtaskId)
        ?.done,
    ).toBe(false);
  });

  it('deleting a subtask removes exactly that subtask', () => {
    const { store } = freshStore();
    const task = store.addTask({ text: 'Parent task' });
    store.addSubtask(task.id, 'keep');
    store.addSubtask(task.id, 'remove');
    const subtasks = store.getState().tasks.find((t) => t.id === task.id)!.subtasks;
    const keep = subtasks[0]!;
    const remove = subtasks[1]!;
    store.deleteSubtask(task.id, remove.id);
    const ids = store.getState().tasks.find((t) => t.id === task.id)!.subtasks.map((s) => s.id);
    expect(ids).toContain(keep.id);
    expect(ids).not.toContain(remove.id);
  });

  it('does not throw when operating on a task with no subtasks array at all (old persisted data)', () => {
    const { store } = freshStore();
    const task = store.addTask({ text: 'Legacy task' });
    const state = store.getState();
    // Simulate pre-migration data that predates the `subtasks` field.
    const legacyTask = { ...state.tasks.find((t) => t.id === task.id) } as Record<string, unknown>;
    delete legacyTask.subtasks;
    store.replaceState({
      ...state,
      tasks: state.tasks.map((t) => (t.id === task.id ? (legacyTask as unknown as typeof t) : t)),
    });

    expect(() => store.addSubtask(task.id, 'first')).not.toThrow();
    const afterAdd = store.getState().tasks.find((t) => t.id === task.id)?.subtasks;
    expect(afterAdd).toHaveLength(1);
    const subtaskId = afterAdd![0]!.id;

    expect(() => store.toggleSubtask(task.id, subtaskId, true)).not.toThrow();
    expect(() => store.deleteSubtask(task.id, subtaskId)).not.toThrow();
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

describe('WorklightStore — ideas', () => {
  it('toggling a star flips starred and is idempotent under explicit value', () => {
    const { store } = freshStore();
    const idea = store.addIdea({ text: 'Star me' });
    expect(idea.starred).toBe(false);

    store.toggleIdeaStar(idea.id, true);
    expect(store.getState().ideas.find((i) => i.id === idea.id)?.starred).toBe(true);
    store.toggleIdeaStar(idea.id, true);
    expect(store.getState().ideas.find((i) => i.id === idea.id)?.starred).toBe(true);
    store.toggleIdeaStar(idea.id); // no explicit value → flips
    expect(store.getState().ideas.find((i) => i.id === idea.id)?.starred).toBe(false);
  });

  it('toggling a star notifies subscribers exactly once', () => {
    const { store } = freshStore();
    const idea = store.addIdea({ text: 'Notify me' });
    const listener = jest.fn();
    store.subscribe(listener);
    store.toggleIdeaStar(idea.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('archiving and restoring an idea sets archived accordingly', () => {
    const { store } = freshStore();
    const idea = store.addIdea({ text: 'Archive me' });
    expect(idea.archived).toBe(false);

    store.setIdeaArchived(idea.id, true);
    expect(store.getState().ideas.find((i) => i.id === idea.id)?.archived).toBe(true);
    store.setIdeaArchived(idea.id, false);
    expect(store.getState().ideas.find((i) => i.id === idea.id)?.archived).toBe(false);
  });

  it('adds a link and notifies subscribers exactly once', () => {
    const { store } = freshStore();
    const idea = store.addIdea({ text: 'Link me' });
    const listener = jest.fn();
    store.subscribe(listener);
    store.addIdeaLink(idea.id, '  https://example.com  ');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().ideas.find((i) => i.id === idea.id)?.links).toEqual([
      'https://example.com',
    ]);
  });

  it('does not add a link when the url is empty after trim', () => {
    const { store } = freshStore();
    const idea = store.addIdea({ text: 'No link' });
    store.addIdeaLink(idea.id, '   ');
    expect(store.getState().ideas.find((i) => i.id === idea.id)?.links).toHaveLength(0);
  });

  it('removing a link removes only the first exact match', () => {
    const { store } = freshStore();
    const idea = store.addIdea({ text: 'Dupes' });
    store.addIdeaLink(idea.id, 'https://a.com');
    store.addIdeaLink(idea.id, 'https://b.com');
    store.addIdeaLink(idea.id, 'https://a.com');
    store.removeIdeaLink(idea.id, 'https://a.com');
    expect(store.getState().ideas.find((i) => i.id === idea.id)?.links).toEqual([
      'https://b.com',
      'https://a.com',
    ]);
  });

  it('does not throw when operating on an idea with no links array at all (old persisted data)', () => {
    const { store } = freshStore();
    const idea = store.addIdea({ text: 'Legacy idea' });
    const state = store.getState();
    const legacyIdea = { ...state.ideas.find((i) => i.id === idea.id) } as Record<string, unknown>;
    delete legacyIdea.links;
    store.replaceState({
      ...state,
      ideas: state.ideas.map((i) => (i.id === idea.id ? (legacyIdea as unknown as typeof i) : i)),
    });

    expect(() => store.addIdeaLink(idea.id, 'https://example.com')).not.toThrow();
    expect(store.getState().ideas.find((i) => i.id === idea.id)?.links).toEqual([
      'https://example.com',
    ]);
    expect(() => store.removeIdeaLink(idea.id, 'https://example.com')).not.toThrow();
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

describe('WorklightStore — project templates', () => {
  it('saves a template with trimmed, non-empty task titles', () => {
    const { store } = freshStore();
    const template = store.addProjectTemplate({ name: '  Feature  ', taskTitles: ['Design', '  ', 'Ship'] });
    expect(template.name).toBe('Feature');
    expect(template.taskTitles).toEqual(['Design', 'Ship']);
    expect(store.getState().projectTemplates.some((t) => t.id === template.id)).toBe(true);
  });

  it('deleting a template removes exactly that template', () => {
    const { store } = freshStore();
    const a = store.addProjectTemplate({ name: 'A', taskTitles: [] });
    const b = store.addProjectTemplate({ name: 'B', taskTitles: [] });
    store.deleteProjectTemplate(a.id);
    const ids = store.getState().projectTemplates.map((t) => t.id);
    expect(ids).not.toContain(a.id);
    expect(ids).toContain(b.id);
  });

  it('creates a project pre-populated with the template\'s tasks', () => {
    const { store } = freshStore();
    const template = store.addProjectTemplate({ name: 'Feature', taskTitles: ['Design', 'Implement', 'Ship'] });
    const project = store.addProjectFromTemplate({ name: 'New feature' }, template.id);
    const tasks = store.getState().tasks.filter((t) => t.projectId === project.id);
    expect(tasks.map((t) => t.text)).toEqual(['Design', 'Implement', 'Ship']);
  });

  it('creating from an unknown template id still creates the project, with no tasks', () => {
    const { store } = freshStore();
    const before = store.getState().tasks.length;
    const project = store.addProjectFromTemplate({ name: 'Solo' }, 'does-not-exist');
    expect(project.name).toBe('Solo');
    expect(store.getState().tasks.length).toBe(before);
  });
});
