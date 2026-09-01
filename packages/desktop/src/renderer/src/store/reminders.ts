import { useEffect, useRef } from 'react';
import { computeReminders } from '@moonlight/core';
import { useWorklight } from './WorklightContext';

const POLL_INTERVAL_MS = 60_000;
// computeReminders excludes anything whose fireAt is already in the past
// relative to the `now` it's given, so a real "now" would never surface a
// reminder that crossed into the past between two polls. Passing a `now`
// from just before the poll interval keeps that item visible for one more
// check, where we then decide locally whether it's actually due.
const LOOKBACK_MS = POLL_INTERVAL_MS + 5_000;

/**
 * Electron has no OS-level "schedule for later" primitive, so this polls
 * instead: every minute, recompute the reminder list and fire any that have
 * become due since the last check. Firing is tracked in-memory per reminder
 * id for this session only — reminders missed while the app wasn't running
 * are not backfilled, and nothing fires once the app is closed.
 */
export function useReminderPoller(): void {
  const { state } = useWorklight();
  const { tasks, events, settings } = state;
  const { remindersEnabled, reminderMinutesBefore } = settings;
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!remindersEnabled) return;

    function check() {
      const lookbackNow = new Date(Date.now() - LOOKBACK_MS);
      const reminders = computeReminders(tasks, events, settings, lookbackNow);
      const nowMs = Date.now();
      for (const reminder of reminders) {
        const firedKey = `${reminder.id}@${reminder.fireAt}`;
        if (firedRef.current.has(firedKey)) continue;
        if (new Date(reminder.fireAt).getTime() > nowMs) continue;
        firedRef.current.add(firedKey);
        new Notification(reminder.title, { body: reminder.body });
      }
    }

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, events, remindersEnabled, reminderMinutesBefore]);
}
