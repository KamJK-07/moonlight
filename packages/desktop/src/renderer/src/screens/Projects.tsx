import React, { useState } from 'react';
import { projectProgress } from '@moonlight/core';
import type { ProjectStatus } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';

export default function ProjectsScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    store.addProject({ name, status });
    setName('');
    setStatus('active');
  }

  const visible = state.projects.filter((p) => !p.archived);

  return (
    <div>
      <div className="card">
        <form onSubmit={submit}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <input
              type="text"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="done">Done</option>
            </select>
            <button className="btn-accent" type="submit">
              Add project
            </button>
          </div>
        </form>
      </div>

      {visible.length === 0 && <p className="empty">No projects yet. Add one above.</p>}

      <div className="project-grid">
        {visible.map((p) => {
          const progress = projectProgress(state.tasks, p);
          return (
            <div key={p.id} className="project-card">
              <div className="project-card-head">
                <h4>{p.name}</h4>
                <button className="btn-plain" onClick={() => store.deleteProject(p.id)} aria-label="Delete project">
                  ×
                </button>
              </div>
              <div>
                <span className={`pill ${p.status}`}>{p.status}</span>
                {p.githubRepo && <span className="tag mono" style={{ marginLeft: '0.4rem' }}>{p.githubRepo}</span>}
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
              <textarea
                className="project-notes"
                defaultValue={p.notes}
                placeholder="Notes…"
                onBlur={(e) => {
                  if (e.target.value !== p.notes) store.updateProject(p.id, { notes: e.target.value });
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
