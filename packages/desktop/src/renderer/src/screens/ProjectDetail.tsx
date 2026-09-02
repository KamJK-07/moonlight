import React, { useEffect, useState } from 'react';
import { groupTasks, sortLogEntries, tasksForProject, projectProgress } from '@moonlight/core';
import type { GithubActivityItem, Task } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';
import { useGithub } from '../store/useGithub';
import { useTaskGithubSync } from '../store/useTaskGithubSync';
import { useTaskDetails } from '../store/useTaskDetails';
import TaskRow from '../components/TaskRow';

function fmtShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ProjectDetail({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}): React.ReactElement {
  const { state, store } = useWorklight();
  const { status: githubStatus, client: githubClient } = useGithub();
  const { toggleTaskWithSync } = useTaskGithubSync();
  const { setRecurrence: setTaskRecurrence, addBlocker, removeBlocker, duplicate: duplicateTask } = useTaskDetails();
  const [githubActivity, setGithubActivity] = useState<GithubActivityItem[] | null>(null);
  const [openPrs, setOpenPrs] = useState<GithubActivityItem[] | null>(null);

  const project = state.projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (githubStatus === 'connected' && githubClient && project?.githubRepo) {
      const repo = project.githubRepo;
      void githubClient.fetchActivityFeed([repo]).then(setGithubActivity).catch(() => setGithubActivity([]));
      void githubClient.listPullRequests(repo, 'open').then(setOpenPrs).catch(() => setOpenPrs([]));
    }
  }, [githubStatus, githubClient, project?.githubRepo]);

  if (!project) {
    return (
      <div>
        <button className="btn-plain" onClick={onBack}>
          ← Back to Projects
        </button>
        <p className="empty">Project not found.</p>
      </div>
    );
  }

  const progress = projectProgress(state.tasks, project);
  const projectTasks = tasksForProject(state.tasks, project.id);
  const groups = groupTasks(projectTasks);
  const logEntries = sortLogEntries(state.logEntries.filter((e) => e.projectId === project.id));
  const githubReady = githubStatus === 'connected' && !!project.githubRepo;
  const openCount = groups.overdue.length + groups.dueToday.length + groups.upcoming.length + groups.noDate.length;

  function renderGroup(label: string, tasks: Task[]) {
    if (tasks.length === 0) return null;
    return (
      <>
        <div className="group-label">{label}</div>
        <ul className="list">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              project={undefined}
              allTasks={state.tasks}
              onToggle={(id, done) => toggleTaskWithSync(t, done)}
              onDelete={(id) => store.deleteTask(id)}
              onAddSubtask={(taskId, subtaskText) => store.addSubtask(taskId, subtaskText)}
              onToggleSubtask={(taskId, subtaskId, done) => store.toggleSubtask(taskId, subtaskId, done)}
              onDeleteSubtask={(taskId, subtaskId) => store.deleteSubtask(taskId, subtaskId)}
              onSetRecurrence={setTaskRecurrence}
              onAddBlocker={addBlocker}
              onRemoveBlocker={removeBlocker}
              onDuplicate={duplicateTask}
            />
          ))}
        </ul>
      </>
    );
  }

  return (
    <div>
      <button className="btn-plain" onClick={onBack} style={{ marginBottom: '0.8rem' }}>
        ← Back to Projects
      </button>

      <div className="card">
        <div className="project-card-head">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {project.color && (
              <span
                style={{ width: '0.7rem', height: '0.7rem', borderRadius: '50%', background: project.color, flexShrink: 0 }}
              />
            )}
            {project.name}
          </h3>
        </div>
        <div>
          <span className={`pill ${project.status}`}>{project.status}</span>
          {project.githubRepo && <span className="tag mono" style={{ marginLeft: '0.4rem' }}>{project.githubRepo}</span>}
        </div>
        {progress.total > 0 ? (
          <div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
            </div>
            <div className="progress-label">
              {progress.done}/{progress.total} tasks · {progress.pct}%
            </div>
          </div>
        ) : (
          <div className="progress-label">No tasks linked yet</div>
        )}
        {project.notes && <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>{project.notes}</p>}
      </div>

      {githubReady && (
        <div className="card">
          <h3>Open pull requests</h3>
          {openPrs === null && <p className="empty">Loading…</p>}
          {openPrs !== null && openPrs.length === 0 && <p className="empty">No open PRs.</p>}
          {openPrs !== null && openPrs.length > 0 && (
            <>
              <p style={{ color: 'var(--ink-soft)', fontSize: '0.8rem', marginTop: 0 }}>
                {openPrs.length} open PR{openPrs.length === 1 ? '' : 's'}
              </p>
              <ul className="list">
                {openPrs.map((pr) => (
                  <li key={pr.id} className="row">
                    <span className="pill open">open</span>
                    <span className="row-text">{pr.title}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {githubReady && (
        <div className="card">
          <h3>GitHub activity</h3>
          {githubActivity === null && <p className="empty">Loading…</p>}
          {githubActivity !== null && githubActivity.length === 0 && <p className="empty">No recent activity.</p>}
          {githubActivity !== null && githubActivity.length > 0 && (
            <ul className="list">
              {githubActivity.slice(0, 10).map((item) => (
                <li key={`${item.type}-${item.id}`} className="row">
                  <span className={`pill ${item.state ?? 'open'}`}>
                    {item.type === 'commit' ? 'commit' : item.state ?? 'pr'}
                  </span>
                  <span className="row-text">{item.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <h3>Tasks</h3>
        {openCount === 0 && groups.done.length === 0 && <p className="empty">No tasks for this project.</p>}
        {renderGroup('Overdue', groups.overdue)}
        {renderGroup('Today', groups.dueToday)}
        {renderGroup('Upcoming', groups.upcoming)}
        {renderGroup('No date', groups.noDate)}
        {groups.done.length > 0 && (
          <>
            <div className="group-label">Done</div>
            <ul className="list">
              {groups.done.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  project={undefined}
                  allTasks={state.tasks}
                  onToggle={(id, done) => toggleTaskWithSync(t, done)}
                  onDelete={(id) => store.deleteTask(id)}
                  onAddSubtask={(taskId, subtaskText) => store.addSubtask(taskId, subtaskText)}
                  onToggleSubtask={(taskId, subtaskId, done) => store.toggleSubtask(taskId, subtaskId, done)}
                  onDeleteSubtask={(taskId, subtaskId) => store.deleteSubtask(taskId, subtaskId)}
                  onSetRecurrence={setTaskRecurrence}
                  onAddBlocker={addBlocker}
                  onRemoveBlocker={removeBlocker}
              onDuplicate={duplicateTask}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="card">
        <h3>Progress log</h3>
        {logEntries.length === 0 ? (
          <p className="empty">No log entries for this project.</p>
        ) : (
          <ul className="list">
            {logEntries.map((e) => (
              <li key={e.id} className="row">
                <span className="tag mono">{fmtShort(e.date)}</span>
                <span className="row-text">{e.text}</span>
                {e.source === 'github' && <span className="tag">github</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
