import React, { useState } from 'react';
import type { Task, Project, EventRecurrence } from '@moonlight/core';
import { todayKey } from '@moonlight/core';

const RECURRENCE_OPTIONS: EventRecurrence[] = ['none', 'daily', 'weekly', 'monthly'];

interface Props {
  task: Task;
  project: Project | undefined;
  allTasks: Task[];
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string, done: boolean) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
  onCreateIssue?: (taskId: string) => void;
  onSetRecurrence: (taskId: string, recurrence: EventRecurrence) => void;
  onAddBlocker: (taskId: string, blockerId: string) => void;
  onRemoveBlocker: (taskId: string, blockerId: string) => void;
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
  allTasks,
  onToggle,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onCreateIssue,
  onSetRecurrence,
  onAddBlocker,
  onRemoveBlocker,
}: Props): React.ReactElement {
  const today = todayKey();
  const [expanded, setExpanded] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');
  const subtasks = task.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.done).length;
  const blockedBy = task.blockedBy ?? [];
  const blockers = blockedBy.map((id) => allTasks.find((t) => t.id === id)).filter((t): t is Task => !!t);
  const isBlocked = blockers.some((b) => !b.done);
  const blockerCandidates = allTasks.filter((t) => t.id !== task.id && !t.done && !blockedBy.includes(t.id));

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
        {task.recurrence !== 'none' && <span className="tag" title="Repeats">↻ {task.recurrence}</span>}
        {isBlocked && !task.done && (
          <span className="tag blocked-tag" title={`Blocked by: ${blockers.filter((b) => !b.done).map((b) => b.text).join(', ')}`}>
            🔒 Blocked
          </span>
        )}
        <button
          className="btn-plain"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
        >
          {expanded ? '▾' : '▸'}
        </button>
        {onCreateIssue && !task.githubIssue && (
          <button className="btn-plain" onClick={() => onCreateIssue(task.id)}>
            → Issue
          </button>
        )}
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
          <div className="task-detail-row">
            <span className="l">Repeats</span>
            <select
              value={task.recurrence}
              onChange={(e) => onSetRecurrence(task.id, e.target.value as EventRecurrence)}
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r === 'none' ? 'Does not repeat' : r[0]!.toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="task-detail-row">
            <span className="l">Blocked by</span>
            {blockers.length > 0 && (
              <ul className="list">
                {blockers.map((b) => (
                  <li key={b.id} className="row">
                    <span className={`row-text${b.done ? ' done' : ''}`}>{b.text}</span>
                    <button className="btn-plain" onClick={() => onRemoveBlocker(task.id, b.id)} aria-label="Remove blocker">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {blockerCandidates.length > 0 && (
              <select value="" onChange={(e) => e.target.value && onAddBlocker(task.id, e.target.value)}>
                <option value="">+ Add a blocking task…</option>
                {blockerCandidates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.text}
                  </option>
                ))}
              </select>
            )}
          </div>
        </li>
      )}
    </>
  );
}
