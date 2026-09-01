import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { computeReminders } from '@moonlight/core';
import { useWorklight } from './WorklightContext';

/**
 * Reconciles OS-scheduled local notifications with the current state on
 * every relevant change. Cancel-and-reschedule-everything is simple and
 * correct here: a full recompute already accounts for edits/deletes without
 * tracking per-item notification IDs.
 */
export function useReminderScheduler(): void {
  const { state } = useWorklight();
  const { tasks, events, settings } = state;
  const { remindersEnabled, reminderMinutesBefore } = settings;

  useEffect(() => {
    let cancelled = false;

    async function reconcile() {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!remindersEnabled) return;

      const reminders = computeReminders(tasks, events, settings);
      for (const reminder of reminders) {
        if (cancelled) return;
        await Notifications.scheduleNotificationAsync({
          content: { title: reminder.title, body: reminder.body },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(reminder.fireAt),
          },
        });
      }
    }

    void reconcile();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, events, remindersEnabled, reminderMinutesBefore]);
}
