import type {
  WorklightState,
  Task,
  Subtask,
  TaskPriority,
  Project,
  ProjectStatus,
  CalendarEvent,
  LogEntry,
  Idea,
  IdeaStatus,
  AccentTheme,
  ThemeMode,
  DateKey,
} from './types';
import type { StorageAdapter } from './storage';
import { generateId } from './id';
import { todayKey } from './dates';

type Listener = () => void;

export interface NewTaskInput {
  text: string;
  projectId?: string | null;
  due?: DateKey | null;
  priority?: TaskPriority;
}

export interface NewProjectInput {
  name: string;
  status?: ProjectStatus;
}

export interface NewEventInput {
  date: DateKey;
  title: string;
  time?: string | null;
  projectId?: string | null;
}

export interface NewLogEntryInput {
  date?: DateKey;
  text: string;
  projectId?: string | null;
}

export interface NewIdeaInput {
  text: string;
  tag?: string | null;
}

/**
 * The single mutable store every UI layer reads from and writes through.
 * Framework-agnostic on purpose: mobile and desktop each wrap this in a
 * thin hook (`useSyncExternalStore`) rather than re-implementing state
 * management twice.
 *
 * Every mutating method updates state, notifies subscribers, and persists
 * via the injected `StorageAdapter` — callers never touch persistence
 * directly, so it's impossible to change data without saving it.
 */
export class WorklightStore {
  private state: WorklightState;
  private listeners = new Set<Listener>();
  private adapter: StorageAdapter;

  constructor(initialState: WorklightState, adapter: StorageAdapter) {
    this.state = initialState;
    this.adapter = adapter;
  }

  getState(): WorklightState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private set(next: WorklightState): void {
    this.state = next;
    this.listeners.forEach((l) => l());
    // Fire-and-forget: persistence failures shouldn't block the UI update.
    // Platform adapters are responsible for surfacing their own errors
    // (e.g. desktop's disk-write failing) through their own channels.
    void this.adapter.save(next);
  }

  // ---------- tasks ----------

  addTask(input: NewTaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: generateId(),
      text: input.text.trim(),
      done: false,
      projectId: input.projectId ?? null,
      due: input.due ?? null,
      priority: input.priority ?? 'medium',
      githubIssue: null,
      subtasks: [],
      createdAt: now,
      updatedAt: now,
    };
    this.set({ ...this.state, tasks: [...this.state.tasks, task] });
    return task;
  }

  toggleTask(id: string, done?: boolean): void {
    const now = new Date().toISOString();
    this.set({
      ...this.state,
      tasks: this.state.tasks.map((t) =>
        t.id === id ? { ...t, done: done ?? !t.done, updatedAt: now } : t,
      ),
    });
  }

  updateTask(id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>): void {
    const now = new Date().toISOString();
    this.set({
      ...this.state,
      tasks: this.state.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: now } : t)),
    });
  }

  deleteTask(id: string): void {
    this.set({ ...this.state, tasks: this.state.tasks.filter((t) => t.id !== id) });
  }

  addSubtask(taskId: string, text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const subtask: Subtask = { id: generateId(), text: trimmed, done: false };
    this.set({
      ...this.state,
      tasks: this.state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: [...(t.subtasks ?? []), subtask], updatedAt: now }
          : t,
      ),
    });
  }

  toggleSubtask(taskId: string, subtaskId: string, done?: boolean): void {
    const now = new Date().toISOString();
    this.set({
      ...this.state,
      tasks: this.state.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: (t.subtasks ?? []).map((s) =>
                s.id === subtaskId ? { ...s, done: done ?? !s.done } : s,
              ),
              updatedAt: now,
            }
          : t,
      ),
    });
  }

  deleteSubtask(taskId: string, subtaskId: string): void {
    const now = new Date().toISOString();
    this.set({
      ...this.state,
      tasks: this.state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: (t.subtasks ?? []).filter((s) => s.id !== subtaskId), updatedAt: now }
          : t,
      ),
    });
  }

  // ---------- projects ----------

  addProject(input: NewProjectInput): Project {
    const now = new Date().toISOString();
    const project: Project = {
      id: generateId(),
      name: input.name.trim(),
      status: input.status ?? 'active',
      notes: '',
      color: null,
      githubRepo: null,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    this.set({ ...this.state, projects: [...this.state.projects, project] });
    return project;
  }

  updateProject(id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>): void {
    const now = new Date().toISOString();
    this.set({
      ...this.state,
      projects: this.state.projects.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: now } : p,
      ),
    });
  }

  deleteProject(id: string): void {
    this.set({
      ...this.state,
      projects: this.state.projects.filter((p) => p.id !== id),
      // Unlink rather than delete the tasks that pointed at this project.
      tasks: this.state.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
    });
  }

  // ---------- calendar events ----------

  addEvent(input: NewEventInput): CalendarEvent {
    const event: CalendarEvent = {
      id: generateId(),
      date: input.date,
      title: input.title.trim(),
      time: input.time ?? null,
      projectId: input.projectId ?? null,
      createdAt: new Date().toISOString(),
    };
    const existing = this.state.events[input.date] ?? [];
    this.set({
      ...this.state,
      events: { ...this.state.events, [input.date]: [...existing, event] },
    });
    return event;
  }

  deleteEvent(date: DateKey, id: string): void {
    const remaining = (this.state.events[date] ?? []).filter((e) => e.id !== id);
    const events = { ...this.state.events };
    if (remaining.length > 0) {
      events[date] = remaining;
    } else {
      delete events[date];
    }
    this.set({ ...this.state, events });
  }

  // ---------- progress log ----------

  addLogEntry(input: NewLogEntryInput): LogEntry {
    const entry: LogEntry = {
      id: generateId(),
      date: input.date ?? todayKey(),
      text: input.text.trim(),
      projectId: input.projectId ?? null,
      source: 'manual',
      createdAt: new Date().toISOString(),
    };
    this.set({ ...this.state, logEntries: [...this.state.logEntries, entry] });
    return entry;
  }

  deleteLogEntry(id: string): void {
    this.set({ ...this.state, logEntries: this.state.logEntries.filter((e) => e.id !== id) });
  }

  // ---------- ideas ----------

  addIdea(input: NewIdeaInput): Idea {
    const now = new Date().toISOString();
    const idea: Idea = {
      id: generateId(),
      text: input.text.trim(),
      tag: input.tag?.trim() || null,
      status: 'raw',
      riff: null,
      links: [],
      starred: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    this.set({ ...this.state, ideas: [...this.state.ideas, idea] });
    return idea;
  }

  setIdeaRiff(id: string, riff: string | null): void {
    const now = new Date().toISOString();
    this.set({
      ...this.state,
      ideas: this.state.ideas.map((i) => (i.id === id ? { ...i, riff, updatedAt: now } : i)),
    });
  }

  setIdeaStatus(id: string, status: IdeaStatus): void {
    const now = new Date().toISOString();
    this.set({
      ...this.state,
      ideas: this.state.ideas.map((i) => (i.id === id ? { ...i, status, updatedAt: now } : i)),
    });
  }

  toggleIdeaStar(id: string, starred?: boolean): void {
    const now = new Date().toISOString();
    this.set({
      ...this.state,
      ideas: this.state.ideas.map((i) =>
        i.id === id ? { ...i, starred: starred ?? !i.starred, updatedAt: now } : i,
      ),
    });
  }

  addIdeaLink(id: string, url: string): void {
    const trimmed = url.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    this.set({
      ...this.state,
      ideas: this.state.ideas.map((i) =>
        i.id === id ? { ...i, links: [...(i.links ?? []), trimmed], updatedAt: now } : i,
      ),
    });
  }

  removeIdeaLink(id: string, url: string): void {
    const now = new Date().toISOString();
    this.set({
      ...this.state,
      ideas: this.state.ideas.map((i) => {
        if (i.id !== id) return i;
        const links = [...(i.links ?? [])];
        const idx = links.indexOf(url);
        if (idx !== -1) links.splice(idx, 1);
        return { ...i, links, updatedAt: now };
      }),
    });
  }

  setIdeaArchived(id: string, archived: boolean): void {
    const now = new Date().toISOString();
    this.set({
      ...this.state,
      ideas: this.state.ideas.map((i) => (i.id === id ? { ...i, archived, updatedAt: now } : i)),
    });
  }

  deleteIdea(id: string): void {
    this.set({ ...this.state, ideas: this.state.ideas.filter((i) => i.id !== id) });
  }

  // ---------- settings ----------

  setThemeMode(themeMode: ThemeMode): void {
    this.set({ ...this.state, settings: { ...this.state.settings, themeMode } });
  }

  setAccent(accent: AccentTheme): void {
    this.set({ ...this.state, settings: { ...this.state.settings, accent } });
  }

  setLinkedRepos(linkedRepos: string[]): void {
    this.set({ ...this.state, settings: { ...this.state.settings, linkedRepos } });
  }

  setGithubUsername(githubUsername: string | null): void {
    this.set({ ...this.state, settings: { ...this.state.settings, githubUsername } });
  }

  setGithubActivitySeenAt(timestamp: string): void {
    this.set({ ...this.state, settings: { ...this.state.settings, githubActivitySeenAt: timestamp } });
  }

  /** Used by import — replaces everything at once. */
  replaceState(next: WorklightState): void {
    this.set(next);
  }
}
