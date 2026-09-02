import type {
  Task,
  TaskGroups,
  Project,
  ProjectProgress,
  LogEntry,
  CalendarEvent,
  DateKey,
} from './types';
import { todayKey, addDays, isBefore, startOfWeek } from './dates';

/** Splits open/closed tasks into the buckets the Tasks and Today views render. */
export function groupTasks(tasks: Task[], today: DateKey = todayKey()): TaskGroups {
  const open = tasks.filter((t) => !t.done);
  return {
    overdue: open.filter((t) => t.due != null && isBefore(t.due, today)),
    dueToday: open.filter((t) => t.due === today),
    upcoming: open
      .filter((t) => t.due != null && isBefore(today, t.due))
      .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '')),
    noDate: open.filter((t) => t.due == null),
    done: tasks.filter((t) => t.done).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };
}

/** Overdue + due-today, in that order — what the Today screen calls "on deck". */
export function onDeck(tasks: Task[], today: DateKey = todayKey()): Task[] {
  const groups = groupTasks(tasks, today);
  return [...groups.overdue, ...groups.dueToday];
}

export function tasksForProject(tasks: Task[], projectId: string): Task[] {
  return tasks.filter((t) => t.projectId === projectId);
}

export function projectProgress(tasks: Task[], project: Project): ProjectProgress {
  const linked = tasksForProject(tasks, project.id);
  const done = linked.filter((t) => t.done).length;
  const total = linked.length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function eventsForDate(
  events: Record<DateKey, CalendarEvent[]>,
  date: DateKey,
): CalendarEvent[] {
  return events[date] ?? [];
}

/**
 * Consecutive-day streak of progress-log entries, counting back from today.
 * If there's no entry today yet, the streak still counts through yesterday
 * (so logging first thing in the morning doesn't reset it to zero) but a
 * streak of 0 with a gap yesterday-or-earlier correctly resets to 0.
 */
export function computeStreak(logEntries: LogEntry[], today: DateKey = todayKey()): number {
  const dates = new Set(logEntries.map((e) => e.date));
  let cursor = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  // Guard against runaway loops on corrupt data.
  for (let i = 0; i < 3660; i++) {
    if (!dates.has(cursor)) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function activeProjectCount(projects: Project[]): number {
  return projects.filter((p) => p.status === 'active' && !p.archived).length;
}

export function sortLogEntries(entries: LogEntry[]): LogEntry[] {
  return [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}

export function sortIdeasByRecency<T extends { createdAt: string }>(ideas: T[]): T[] {
  return [...ideas].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface LogWeekGroup {
  weekStart: DateKey;
  weekEnd: DateKey;
  entries: LogEntry[];
}

/** Buckets log entries into Monday-start weeks, most recent week first. */
export function groupLogEntriesByWeek(entries: LogEntry[]): LogWeekGroup[] {
  const groups: LogWeekGroup[] = [];
  for (const entry of sortLogEntries(entries)) {
    const weekStart = startOfWeek(entry.date);
    const current = groups[groups.length - 1];
    if (current && current.weekStart === weekStart) {
      current.entries.push(entry);
    } else {
      groups.push({ weekStart, weekEnd: addDays(weekStart, 6), entries: [entry] });
    }
  }
  return groups;
}

/** Renders a project's notes, tasks, and log entries as a standalone Markdown document. */
export function projectToMarkdown(project: Project, tasks: Task[], logEntries: LogEntry[]): string {
  const lines: string[] = [`# ${project.name}`, ''];
  lines.push(`**Status:** ${project.status}`);
  if (project.githubRepo) lines.push(`**GitHub:** ${project.githubRepo}`);
  lines.push('');

  if (project.notes.trim()) {
    lines.push('## Notes', '', project.notes.trim(), '');
  }

  const linked = tasksForProject(tasks, project.id);
  if (linked.length > 0) {
    lines.push('## Tasks', '');
    for (const t of linked) {
      const box = t.done ? '[x]' : '[ ]';
      const due = t.due ? ` (due ${t.due})` : '';
      lines.push(`- ${box} ${t.text}${due}`);
    }
    lines.push('');
  }

  const projectLog = sortLogEntries(logEntries.filter((e) => e.projectId === project.id));
  if (projectLog.length > 0) {
    lines.push('## Progress log', '');
    for (const entry of projectLog) {
      lines.push(`- ${entry.date}: ${entry.text}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}
