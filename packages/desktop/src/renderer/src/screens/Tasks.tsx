import React, { useState } from 'react';
import { groupTasks } from '@moonlight/core';
import type { TaskPriority } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';
import TaskRow from '../components/TaskRow';

export default function TasksScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const [text, setText] = useState('');
  const [projectId, setProjectId] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');

  function projectOf(id: string | null) {
    return id ? state.projects.find((p) => p.id === id) : undefined;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    store.addTask({ text, projectId: projectId || null, due: due || null, priority });
    setText('');
    setDue('');
    setPriority('medium');
  }

  const groups = groupTasks(state.tasks);

  function renderGroup(label: string, tasks: typeof groups.overdue) {
    if (tasks.length === 0) return null;
    return (
      <>
        <div className="group-label">{label}</div>
        <ul className="list">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              project={projectOf(t.projectId)}
              onToggle={(id, done) => store.toggleTask(id, done)}
              onDelete={(id) => store.deleteTask(id)}
              onAddSubtask={(taskId, subtaskText) => store.addSubtask(taskId, subtaskText)}
              onToggleSubtask={(taskId, subtaskId, done) => store.toggleSubtask(taskId, subtaskId, done)}
              onDeleteSubtask={(taskId, subtaskId) => store.deleteSubtask(taskId, subtaskId)}
            />
          ))}
        </ul>
      </>
    );
  }

  const openCount = groups.overdue.length + groups.dueToday.length + groups.upcoming.length + groups.noDate.length;

  return (
    <div>
      <div className="card">
        <form onSubmit={submit}>
          <div className="form-row">
            <input
              type="text"
              placeholder="What needs doing?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            <button className="btn-accent" type="submit">
              Add task
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        {openCount === 0 && <p className="empty">No open tasks. Add one above.</p>}
        {renderGroup('Overdue', groups.overdue)}
        {renderGroup('Today', groups.dueToday)}
        {renderGroup('Upcoming', groups.upcoming)}
        {renderGroup('No date', groups.noDate)}
      </div>

      {groups.done.length > 0 && (
        <div className="card">
          <div className="group-label" style={{ marginTop: 0 }}>
            Done
          </div>
          <ul className="list">
            {groups.done.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                project={projectOf(t.projectId)}
                onToggle={(id, done) => store.toggleTask(id, done)}
                onDelete={(id) => store.deleteTask(id)}
                onAddSubtask={(taskId, subtaskText) => store.addSubtask(taskId, subtaskText)}
                onToggleSubtask={(taskId, subtaskId, done) => store.toggleSubtask(taskId, subtaskId, done)}
                onDeleteSubtask={(taskId, subtaskId) => store.deleteSubtask(taskId, subtaskId)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
