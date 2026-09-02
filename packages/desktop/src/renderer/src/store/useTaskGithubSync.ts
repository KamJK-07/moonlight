import { useCallback } from 'react';
import { nextRecurrenceDate, todayKey } from '@moonlight/core';
import type { Task } from '@moonlight/core';
import { useWorklight } from './WorklightContext';
import { useGithub } from './useGithub';

export function useTaskGithubSync(): { toggleTaskWithSync: (task: Task, done: boolean) => void } {
  const { store } = useWorklight();
  const { status, client } = useGithub();

  const toggleTaskWithSync = useCallback(
    (task: Task, done: boolean) => {
      store.toggleTask(task.id, done);
      if (task.githubIssue && status === 'connected' && client) {
        const { owner, repo, number } = task.githubIssue;
        void client.setIssueState(`${owner}/${repo}`, number, done ? 'closed' : 'open').catch(() => {});
      }
      if (done && task.recurrence !== 'none') {
        store.addTask({
          text: task.text,
          projectId: task.projectId,
          priority: task.priority,
          recurrence: task.recurrence,
          due: nextRecurrenceDate(task.due ?? todayKey(), task.recurrence),
        });
      }
    },
    [store, status, client],
  );

  return { toggleTaskWithSync };
}
