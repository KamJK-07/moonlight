import type { WorklightState } from './types';
import { generateId } from './id';
import { todayKey } from './dates';

/**
 * Persistence is injected, not baked in — mobile implements this against
 * AsyncStorage (or SQLite later), desktop against a JSON file on disk.
 * Core never imports a platform storage API directly.
 */
export interface StorageAdapter {
  load(): Promise<WorklightState | null>;
  save(state: WorklightState): Promise<void>;
}

/**
 * The GitHub token is a secret and is handled entirely separately from
 * `WorklightState` so it can never leak into a JSON export or a
 * synced-to-GitHub backup. Mobile implements this with expo-secure-store
 * (iOS Keychain); desktop with Electron's `safeStorage` (Windows
 * Credential Manager / DPAPI-backed).
 */
export interface SecureTokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory adapters — used by tests, and as a safe fallback if a real one fails to init. */
export class InMemoryStorageAdapter implements StorageAdapter {
  private state: WorklightState | null = null;
  async load(): Promise<WorklightState | null> {
    return this.state;
  }
  async save(state: WorklightState): Promise<void> {
    this.state = state;
  }
}

export class InMemoryTokenStore implements SecureTokenStore {
  private token: string | null = null;
  async get(): Promise<string | null> {
    return this.token;
  }
  async set(token: string): Promise<void> {
    this.token = token;
  }
  async clear(): Promise<void> {
    this.token = null;
  }
}

/**
 * Fresh state for a first-ever launch. A few example entries ship so the
 * app doesn't open to a blank void — they're plainly example content and
 * trivial to delete.
 */
export function createInitialState(): WorklightState {
  const now = new Date().toISOString();
  const seedProjectId = generateId();
  return {
    version: 1,
    tasks: [
      {
        id: generateId(),
        text: 'Add your first real task',
        done: false,
        projectId: seedProjectId,
        due: null,
        priority: 'medium',
        githubIssue: null,
        subtasks: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    projects: [
      {
        id: seedProjectId,
        name: 'Get set up',
        status: 'active',
        notes: 'Replace this with a real project — link tasks, jot notes, connect a repo.',
        color: null,
        githubRepo: null,
        archived: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    events: {},
    logEntries: [
      {
        id: generateId(),
        date: todayKey(),
        text: 'Created Worklight.',
        projectId: null,
        source: 'manual',
        createdAt: now,
      },
    ],
    ideas: [
      {
        id: generateId(),
        text: 'Try the "Ask Claude to riff" button to bounce an idea around.',
        tag: 'meta',
        status: 'raw',
        riff: null,
        links: [],
        starred: false,
        archived: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    settings: {
      themeMode: 'system',
      accent: 'amber',
      textScale: 'normal',
      githubUsername: null,
      linkedRepos: [],
      githubActivitySeenAt: null,
      lastCommitLogSyncAt: null,
      remindersEnabled: false,
      reminderMinutesBefore: 30,
      syncRepo: null,
    },
  };
}

export const STATE_SCHEMA_VERSION = 1 as const;

export function serializeState(state: WorklightState): string {
  return JSON.stringify(state, null, 2);
}

export class InvalidStateError extends Error {}

/**
 * Parses and shape-checks a JSON backup before it's trusted. Deliberately
 * conservative: unknown/missing fields fail loudly rather than silently
 * producing a half-populated app.
 */
export function deserializeState(json: string): WorklightState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new InvalidStateError('Not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new InvalidStateError('Backup is not an object.');
  }
  const obj = parsed as Record<string, unknown>;
  const required = ['tasks', 'projects', 'events', 'logEntries', 'ideas', 'settings'];
  for (const key of required) {
    if (!(key in obj)) {
      throw new InvalidStateError(`Backup is missing "${key}".`);
    }
  }
  if (!Array.isArray(obj.tasks) || !Array.isArray(obj.projects)) {
    throw new InvalidStateError('Backup has malformed lists.');
  }
  return { ...obj, version: STATE_SCHEMA_VERSION } as WorklightState;
}
