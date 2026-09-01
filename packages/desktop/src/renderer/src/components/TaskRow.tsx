import React, { useState } from 'react';
import type { Task, Project } from '@moonlight/core';
import { todayKey } from '@moonlight/core';

interface Props {
  task: Task;
  project: Project | undefined;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string, done: boolean) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
}

function fmtShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function TaskRow({
  task,
  project,
  onToggle,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: Props): React.ReactElement {
  const today = todayKey();
  const [expanded, setExpanded] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');
  const subtasks = task.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.done).length;

  let dueClass = '';
  if (task.due && !task.done) {
    if (task.due < today) dueClass = 'overdue';
    else if (task.due === today) dueClass = 'due-today';
  }

  function submitSubtask(e: React.FormEvent): void {
    e.preventDefault();
    if (!subtaskText.trim()) return;
    onAddSubtask(task.id, subtaskText);
    setSubtaskText('');
  }

  return (
    <>
      <li className={`row${task.done ? ' done' : ''}`}>
        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => onToggle(task.id, e.target.checked)}
        />
        <span className="row-text">{task.text}</span>
        {subtasks.length > 0 && (
          <span className="tag mono">
            {doneCount}/{subtasks.length}
          </span>
        )}
        {task.priority === 'high' && !task.done && <span className="tag priority-high">high</span>}
        {project && <span className="tag">{project.name}</span>}
        {task.due && <span className={`tag mono${dueClass ? ` ${dueClass}` : ''}`}>{fmtShort(task.due)}</span>}
        <button
          className="btn-plain"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
        >
          {expanded ? '▾' : '▸'}
        </button>
        <button className="btn-plain" onClick={() => onDelete(task.id)} aria-label="Delete task">
          ×
        </button>
      </li>
      {expanded && (
        <li className="subtask-panel">
          {subtasks.length > 0 && (
            <ul className="list subtask-list">
              {subtasks.map((s) => (
                <li key={s.id} className={`row subtask-row${s.done ? ' done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) => onToggleSubtask(task.id, s.id, e.target.checked)}
                  />
                  <span className="row-text">{s.text}</span>
                  <button className="btn-plain" onClick={() => onDeleteSubtask(task.id, s.id)} aria-label="Delete subtask">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="subtask-add" onSubmit={submitSubtask}>
            <input
              type="text"
              placeholder="Add a subtask…"
              value={subtaskText}
              onChange={(e) => setSubtaskText(e.target.value)}
            />
          </form>
        </li>
      )}
    </>
  );
}
