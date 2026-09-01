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
