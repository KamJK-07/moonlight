import React from 'react';
import type { Task, Project } from '@moonlight/core';
import { todayKey } from '@moonlight/core';

interface Props {
  task: Task;
  project: Project | undefined;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}

function fmtShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function TaskRow({ task, project, onToggle, onDelete }: Props): React.ReactElement {
  const today = todayKey();
  let dueClass = '';
  if (task.due && !task.done) {
    if (task.due < today) dueClass = 'overdue';
    else if (task.due === today) dueClass = 'due-today';
  }

  return (
    <li className={`row${task.done ? ' done' : ''}`}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={(e) => onToggle(task.id, e.target.checked)}
      />
      <span className="row-text">{task.text}</span>
      {task.priority === 'high' && !task.done && <span className="tag priority-high">high</span>}
      {project && <span className="tag">{project.name}</span>}
      {task.due && <span className={`tag mono${dueClass ? ` ${dueClass}` : ''}`}>{fmtShort(task.due)}</span>}
      <button className="btn-plain" onClick={() => onDelete(task.id)} aria-label="Delete task">
        ×
      </button>
    </li>
  );
}
