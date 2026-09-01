import type { Task, CalendarEvent, DateKey, Settings } from './types';
import { parseDateKey } from './dates';

export interface PendingReminder {
  id: string;
  title: string;
  body: string;
  fireAt: string;
}

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REMINDERS = 60;
const TASK_REMINDER_HOUR = 9;

/**
 * Pure date math for scheduling local reminders — kept platform-free so the
 * mobile (expo-notifications) and desktop (polling + Notification API)
 * adapters both reconcile against the same computed list rather than each
 * re-deriving it.
 */
export function computeReminders(
  tasks: Task[],
  events: Record<DateKey, CalendarEvent[]>,
  settings: Settings,
  now: Date = new Date(),
): PendingReminder[] {
  if (!settings.remindersEnabled) return [];

  const nowMs = now.getTime();
  const windowEndMs = nowMs + WINDOW_MS;
  const reminders: PendingReminder[] = [];

  for (const dateEvents of Object.values(events)) {
    for (const event of dateEvents) {
      if (!event.time) continue;
      const [hh, mm] = event.time.split(':').map(Number);
      const eventAt = parseDateKey(event.date);
      eventAt.setHours(hh ?? 0, mm ?? 0, 0, 0);
      const fireAtMs = eventAt.getTime() - settings.reminderMinutesBefore * 60 * 1000;
      if (fireAtMs <= nowMs || fireAtMs > windowEndMs) continue;
      reminders.push({
        id: `event:${event.id}`,
        title: `Upcoming: ${event.title}`,
        body: `${event.time} on ${event.date}`,
        fireAt: new Date(fireAtMs).toISOString(),
      });
    }
  }

  for (const task of tasks) {
    if (task.done || !task.due) continue;
    const dueAt = parseDateKey(task.due);
    dueAt.setHours(TASK_REMINDER_HOUR, 0, 0, 0);
    const fireAtMs = dueAt.getTime();
    if (fireAtMs <= nowMs || fireAtMs > windowEndMs) continue;
    reminders.push({
      id: `task:${task.id}`,
      title: `Due today: ${task.text}`,
      body: `Due ${task.due}`,
      fireAt: dueAt.toISOString(),
    });
  }

  // iOS caps the OS at ~64 pending local notifications; 60 is a safety
  // margin under that, keeping the soonest reminders if there's overflow.
  reminders.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
  return reminders.slice(0, MAX_REMINDERS);
}
