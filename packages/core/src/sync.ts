import type { WorklightState } from './types';

const EPOCH = '1970-01-01T00:00:00.000Z';

/** The freshest `updatedAt`/`createdAt` timestamp found anywhere in the state. */
export function latestUpdatedAt(state: WorklightState): string {
  let latest = EPOCH;
  for (const task of state.tasks) {
    if (task.updatedAt > latest) latest = task.updatedAt;
  }
  for (const project of state.projects) {
    if (project.updatedAt > latest) latest = project.updatedAt;
  }
  for (const idea of state.ideas) {
    if (idea.updatedAt > latest) latest = idea.updatedAt;
  }
  for (const entry of state.logEntries) {
    if (entry.createdAt > latest) latest = entry.createdAt;
  }
  for (const dateEvents of Object.values(state.events)) {
    for (const event of dateEvents) {
      if (event.createdAt > latest) latest = event.createdAt;
    }
  }
  return latest;
}

export type SyncAction = 'push' | 'pull' | 'noop';

export function planSync(local: WorklightState, remote: WorklightState | null): SyncAction {
  if (remote === null) return 'push';
  const localLatest = latestUpdatedAt(local);
  const remoteLatest = latestUpdatedAt(remote);
  if (localLatest === remoteLatest) return 'noop';
  return localLatest > remoteLatest ? 'push' : 'pull';
}

function diffById<T extends { id: string }>(from: T[], to: T[]): { added: number; removed: number; common: Array<[T, T]> } {
  const fromMap = new Map(from.map((x) => [x.id, x]));
  const toMap = new Map(to.map((x) => [x.id, x]));
  let added = 0;
  const common: Array<[T, T]> = [];
  for (const [id, item] of toMap) {
    const prev = fromMap.get(id);
    if (!prev) added += 1;
    else common.push([prev, item]);
  }
  let removed = 0;
  for (const id of fromMap.keys()) {
    if (!toMap.has(id)) removed += 1;
  }
  return { added, removed, common };
}

function plural(n: number, singular: string, pluralForm: string = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/**
 * Human-readable summary of what would change going from `from` to `to` —
 * used to show a real diff before a sync confirms an overwrite, instead of
 * a generic "this replaces everything" message.
 */
export function summarizeSyncDiff(from: WorklightState, to: WorklightState): string[] {
  const lines: string[] = [];

  const tasks = diffById(from.tasks, to.tasks);
  const tasksRenamed = tasks.common.filter(([a, b]) => a.text !== b.text).length;
  const tasksStatusChanged = tasks.common.filter(([a, b]) => a.done !== b.done).length;
  if (tasks.added) lines.push(`${plural(tasks.added, 'task')} added`);
  if (tasks.removed) lines.push(`${plural(tasks.removed, 'task')} removed`);
  if (tasksRenamed) lines.push(`${plural(tasksRenamed, 'task')} renamed`);
  if (tasksStatusChanged) lines.push(`${plural(tasksStatusChanged, 'task')} completed or reopened`);

  const projects = diffById(from.projects, to.projects);
  const projectsRenamed = projects.common.filter(([a, b]) => a.name !== b.name).length;
  if (projects.added) lines.push(`${plural(projects.added, 'project')} added`);
  if (projects.removed) lines.push(`${plural(projects.removed, 'project')} removed`);
  if (projectsRenamed) lines.push(`${plural(projectsRenamed, 'project')} renamed`);

  const ideas = diffById(from.ideas, to.ideas);
  if (ideas.added) lines.push(`${plural(ideas.added, 'idea')} added`);
  if (ideas.removed) lines.push(`${plural(ideas.removed, 'idea')} removed`);

  const logEntries = diffById(from.logEntries, to.logEntries);
  if (logEntries.added) lines.push(`${plural(logEntries.added, 'log entry', 'log entries')} added`);
  if (logEntries.removed) lines.push(`${plural(logEntries.removed, 'log entry', 'log entries')} removed`);

  const fromEvents = Object.values(from.events).flat();
  const toEvents = Object.values(to.events).flat();
  const events = diffById(fromEvents, toEvents);
  if (events.added) lines.push(`${plural(events.added, 'event')} added`);
  if (events.removed) lines.push(`${plural(events.removed, 'event')} removed`);

  return lines.length > 0 ? lines : ['No changes to tasks, projects, ideas, log entries, or events.'];
}
