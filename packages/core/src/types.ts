/**
 * Domain types shared by every Worklight surface (mobile, desktop, and
 * any future platform). Nothing platform-specific lives in this file —
 * no React, no storage APIs, just the shape of the data.
 */

export type ID = string;

/** ISO 8601 date-time string, e.g. "2026-08-31T14:03:00.000Z". */
export type ISODateTime = string;

/** Calendar date only, "YYYY-MM-DD". Used for due dates, log dates, events. */
export type DateKey = string;

export type TaskPriority = 'low' | 'medium' | 'high';

export interface GithubIssueRef {
  owner: string;
  repo: string;
  number: number;
  url: string;
  state: 'open' | 'closed';
}

export interface Subtask {
  id: ID;
  text: string;
  done: boolean;
}

export interface Task {
  id: ID;
  text: string;
  done: boolean;
  projectId: ID | null;
  due: DateKey | null;
  priority: TaskPriority;
  githubIssue: GithubIssueRef | null;
  subtasks: Subtask[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type ProjectStatus = 'active' | 'paused' | 'done';

/** Fixed palette for `Project.color` — identical hex values on both platforms. */
export const PROJECT_COLORS = [
  '#E4572E',
  '#F2A93B',
  '#3E8F5C',
  '#1E8F82',
  '#3B7DD8',
  '#7C5CE0',
  '#D8548C',
  '#6E7E72',
] as const;

export interface Project {
  id: ID;
  name: string;
  status: ProjectStatus;
  notes: string;
  color: string | null;
  /** "owner/repo" — the GitHub repo this project is linked to, if any. */
  githubRepo: string | null;
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type EventRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface CalendarEvent {
  id: ID;
  date: DateKey;
  title: string;
  time: string | null; // "HH:MM", 24h
  projectId: ID | null;
  recurrence: EventRecurrence;
  createdAt: ISODateTime;
}

export type LogSource = 'manual' | 'github';

export interface LogEntry {
  id: ID;
  date: DateKey;
  text: string;
  projectId: ID | null;
  source: LogSource;
  createdAt: ISODateTime;
}

export type IdeaStatus = 'raw' | 'exploring' | 'parked' | 'shipped';

export interface Idea {
  id: ID;
  text: string;
  tag: string | null;
  status: IdeaStatus;
  riff: string | null;
  links: string[];
  /**
   * Opaque local image identifiers (filenames on desktop) — never a raw
   * filesystem path. Each platform resolves these to actual image bytes
   * through its own storage layer; this field only exists to keep the
   * ordered list of attachments per idea.
   */
  images: string[];
  starred: boolean;
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type AccentTheme = 'amber' | 'violet' | 'teal' | 'green';
export type ThemeMode = 'system' | 'light' | 'dark';
export type TextScale = 'small' | 'normal' | 'large' | 'xlarge';

/**
 * Settings deliberately excludes the GitHub token. The token is a secret
 * and lives only in each platform's secure storage (Keychain / Windows
 * Credential Manager via Electron's safeStorage) behind the
 * `SecureTokenStore` interface in storage.ts — never in `WorklightState`,
 * so it can never end up in a JSON export or a synced-to-GitHub backup.
 */
export interface Settings {
  themeMode: ThemeMode;
  accent: AccentTheme;
  textScale: TextScale;
  githubUsername: string | null;
  /** "owner/repo" list chosen to feed the activity feed / issue sync. */
  linkedRepos: string[];
  /** ISO timestamp of the last time the user viewed GitHub activity; null means never viewed. */
  githubActivitySeenAt: string | null;
  /** ISO timestamp of the last time commits were synced into the progress log; null means never synced. */
  lastCommitLogSyncAt: string | null;
  /** Opt-in: local reminder notifications for upcoming calendar events and task due dates. */
  remindersEnabled: boolean;
  /** How many minutes before a calendar event's time to fire its reminder. */
  reminderMinutesBefore: number;
  /**
   * "owner/repo" of the repo dedicated to storing this app's synced data
   * file — deliberately separate from `linkedRepos`, which are for source
   * repos feeding the activity feed / issue sync. Typically a private repo
   * the user doesn't otherwise host source code in. Null means sync isn't
   * set up yet.
   */
  syncRepo: string | null;
}

export interface WorklightState {
  version: 1;
  tasks: Task[];
  projects: Project[];
  /** Keyed by DateKey. */
  events: Record<DateKey, CalendarEvent[]>;
  logEntries: LogEntry[];
  ideas: Idea[];
  settings: Settings;
}

export interface TaskGroups {
  overdue: Task[];
  dueToday: Task[];
  upcoming: Task[];
  noDate: Task[];
  done: Task[];
}

export interface ProjectProgress {
  done: number;
  total: number;
  pct: number; // 0-100, 0 when total is 0
}
