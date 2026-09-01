import React, { useState } from 'react';
import { groupTasks } from '@moonlight/core';
import type { TaskPriority } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';
import { useGithub } from '../store/useGithub';
import { useTaskGithubSync } from '../store/useTaskGithubSync';
import TaskRow from '../components/TaskRow';

export default function TasksScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const { status: githubStatus, client: githubClient } = useGithub();
  const { toggleTaskWithSync } = useTaskGithubSync();
  const [text, setText] = useState('');
  const [projectId, setProjectId] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [search, setSearch] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');

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

  const filteredTasks = state.tasks.filter((t) => {
    if (search.trim() && !t.text.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (filterProjectId && t.projectId !== filterProjectId) return false;
    return true;
  });

  const groups = groupTasks(filteredTasks);

  function createIssueForTask(taskId: string) {
    const task = state.tasks.find((t) => t.id === taskId);
    const project = task ? projectOf(task.projectId) : undefined;
    if (!task || !project?.githubRepo || !githubClient) return;
    const [owner, repoName] = project.githubRepo.split('/');
    if (!owner || !repoName) return;
    void githubClient.createIssue(project.githubRepo, task.text).then((created) => {
      store.updateTask(task.id, {
        githubIssue: { owner, repo: repoName, number: created.number, url: created.url, state: created.state },
      });
    });
  }

  function renderGroup(label: string, tasks: typeof groups.overdue) {
    if (tasks.length === 0) return null;
    return (
      <>
        <div className="group-label">{label}</div>
        <ul className="list">
          {tasks.map((t) => {
            const proj = projectOf(t.projectId);
            return (
              <TaskRow
                key={t.id}
                task={t}
                project={proj}
                onToggle={(id, done) => toggleTaskWithSync(t, done)}
                onDelete={(id) => store.deleteTask(id)}
                onAddSubtask={(taskId, subtaskText) => store.addSubtask(taskId, subtaskText)}
                onToggleSubtask={(taskId, subtaskId, done) => store.toggleSubtask(taskId, subtaskId, done)}
                onDeleteSubtask={(taskId, subtaskId) => store.deleteSubtask(taskId, subtaskId)}
                onCreateIssue={proj?.githubRepo && githubStatus === 'connected' ? createIssueForTask : undefined}
              />
            );
          })}
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
        <div className="form-row">
          <input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filterProjectId} onChange={(e) => setFilterProjectId(e.target.value)}>
            <option value="">All projects</option>
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
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
            {groups.done.map((t) => {
              const proj = projectOf(t.projectId);
              return (
                <TaskRow
                  key={t.id}
                  task={t}
                  project={proj}
                  onToggle={(id, done) => toggleTaskWithSync(t, done)}
                  onDelete={(id) => store.deleteTask(id)}
                  onAddSubtask={(taskId, subtaskText) => store.addSubtask(taskId, subtaskText)}
                  onToggleSubtask={(taskId, subtaskId, done) => store.toggleSubtask(taskId, subtaskId, done)}
                  onDeleteSubtask={(taskId, subtaskId) => store.deleteSubtask(taskId, subtaskId)}
                  onCreateIssue={proj?.githubRepo && githubStatus === 'connected' ? createIssueForTask : undefined}
                />
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
