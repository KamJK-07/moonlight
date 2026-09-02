import { useCallback } from 'react';
import type { EventRecurrence } from '@moonlight/core';
import { useWorklight } from './WorklightContext';

/**
 * Shared mutators for a TaskRow's expanded panel (recurrence + blockedBy).
 * Pulled out once every screen that renders TaskRow (Today, Tasks,
 * ProjectDetail) needed the exact same three callbacks.
 */
export function useTaskDetails(): {
  setRecurrence: (taskId: string, recurrence: EventRecurrence) => void;
  addBlocker: (taskId: string, blockerId: string) => void;
  removeBlocker: (taskId: string, blockerId: string) => void;
  duplicate: (taskId: string) => void;
} {
  const { state, store } = useWorklight();

  const duplicate = useCallback((taskId: string) => store.duplicateTask(taskId), [store]);

  const setRecurrence = useCallback(
    (taskId: string, recurrence: EventRecurrence) => store.updateTask(taskId, { recurrence }),
    [store],
  );

  const addBlocker = useCallback(
    (taskId: string, blockerId: string) => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (task) store.updateTask(taskId, { blockedBy: [...(task.blockedBy ?? []), blockerId] });
    },
    [state.tasks, store],
  );

  const removeBlocker = useCallback(
    (taskId: string, blockerId: string) => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (task) store.updateTask(taskId, { blockedBy: (task.blockedBy ?? []).filter((id) => id !== blockerId) });
    },
    [state.tasks, store],
  );

  return { setRecurrence, addBlocker, removeBlocker, duplicate };
}
