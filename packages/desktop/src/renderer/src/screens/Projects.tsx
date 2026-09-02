import React, { useEffect, useRef, useState } from 'react';
import { projectProgress, projectToMarkdown, PROJECT_COLORS } from '@moonlight/core';
import type { ProjectStatus, Project } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';
import { useGithub } from '../store/useGithub';

function ProjectNotes({ notes, onSave }: { notes: string; onSave: (value: string) => void }): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <div
        className="project-notes-preview"
        onClick={() => setEditing(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
      >
        {notes.trim() ? notes : <span className="ph">Notes…</span>}
      </div>
    );
  }

  return (
    <textarea
      ref={ref}
      className="project-notes"
      defaultValue={notes}
      placeholder="Notes…"
      onBlur={(e) => {
        if (e.target.value !== notes) onSave(e.target.value);
        setEditing(false);
      }}
    />
  );
}

export default function ProjectsScreen({
  onSelectProject,
}: {
  onSelectProject: (id: string) => void;
}): React.ReactElement {
  const { state, store } = useWorklight();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [templateId, setTemplateId] = useState('');
  const { status: githubStatus, client: githubClient } = useGithub();
  const [prCounts, setPrCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (githubStatus !== 'connected' || !githubClient) return;
    const repos = Array.from(
      new Set(state.projects.filter((p) => !p.archived && p.githubRepo).map((p) => p.githubRepo as string)),
    );
    if (repos.length === 0) return;
    let cancelled = false;
    void Promise.all(
      repos.map((repo) =>
        githubClient
          .listPullRequests(repo, 'open')
          .then((prs) => [repo, prs.length] as const)
          .catch(() => [repo, 0] as const),
      ),
    ).then((entries) => {
      if (!cancelled) setPrCounts(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [githubStatus, githubClient, state.projects]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (templateId) store.addProjectFromTemplate({ name, status }, templateId);
    else store.addProject({ name, status });
    setName('');
    setStatus('active');
    setTemplateId('');
  }

  function saveAsTemplate(p: Project): void {
    const templateName = window.prompt('Template name', p.name);
    if (!templateName || !templateName.trim()) return;
    const taskTitles = state.tasks.filter((t) => t.projectId === p.id && !t.done).map((t) => t.text);
    store.addProjectTemplate({ name: templateName, taskTitles });
  }

  function exportMarkdown(p: Project): void {
    const md = projectToMarkdown(p, state.tasks, state.logEntries);
    const safeName = p.name.replace(/[\\/:*?"<>|]/g, '-');
    void window.moonlight.exportMarkdown(safeName, md);
  }

  const visible = state.projects.filter((p) => !p.archived);
  const archived = state.projects.filter((p) => p.archived);
  const repos = state.settings.linkedRepos;
  const templates = state.projectTemplates ?? [];

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
            {templates.length > 0 && (
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Blank project</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    From template: {t.name}
                  </option>
                ))}
              </select>
            )}
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
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {p.color && (
                    <span
                      style={{ width: '0.6rem', height: '0.6rem', borderRadius: '50%', background: p.color, flexShrink: 0 }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectProject(p.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      color: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {p.name}
                  </button>
                </h4>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn-plain" onClick={() => saveAsTemplate(p)} title="Save this project's open tasks as a reusable template">
                    Template
                  </button>
                  <button className="btn-plain" onClick={() => exportMarkdown(p)} title="Export notes, tasks, and log as Markdown">
                    Export
                  </button>
                  <button
                    className="btn-plain"
                    onClick={() => store.updateProject(p.id, { archived: true })}
                    aria-label="Archive project"
                  >
                    Archive
                  </button>
                  <button className="btn-plain" onClick={() => store.deleteProject(p.id)} aria-label="Delete project">
                    ×
                  </button>
                </div>
              </div>
              <div>
                <span className={`pill ${p.status}`}>{p.status}</span>
                {p.githubRepo && <span className="tag mono" style={{ marginLeft: '0.4rem' }}>{p.githubRepo}</span>}
                {p.githubRepo && (prCounts[p.githubRepo] ?? 0) > 0 && (
                  <span className="pill open" style={{ marginLeft: '0.4rem' }}>
                    {prCounts[p.githubRepo]} PR{prCounts[p.githubRepo] === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="theme-row">
                <button
                  type="button"
                  className={`swatch${!p.color ? ' active' : ''}`}
                  style={{ background: 'var(--surface-2)' }}
                  onClick={() => store.updateProject(p.id, { color: null })}
                  aria-label="No color"
                />
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch${p.color === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => store.updateProject(p.id, { color: c })}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
              {repos.length > 0 && (
                <select
                  value={p.githubRepo ?? ''}
                  onChange={(e) => store.updateProject(p.id, { githubRepo: e.target.value || null })}
                >
                  <option value="">No repo linked</option>
                  {repos.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
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
              <ProjectNotes notes={p.notes} onSave={(value) => store.updateProject(p.id, { notes: value })} />
            </div>
          );
        })}
      </div>

      {templates.length > 0 && (
        <div>
          <div className="group-label">Project templates ({templates.length})</div>
          <ul className="list">
            {templates.map((t) => (
              <li key={t.id} className="row">
                <span className="row-text">{t.name}</span>
                <span className="tag mono">
                  {t.taskTitles.length} task{t.taskTitles.length === 1 ? '' : 's'}
                </span>
                <button className="btn-plain" onClick={() => store.deleteProjectTemplate(t.id)} aria-label="Delete template">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {archived.length > 0 && (
        <div>
          <div className="group-label">Archived ({archived.length})</div>
          <ul className="list">
            {archived.map((p) => (
              <li key={p.id} className="row">
                <span className="row-text">{p.name}</span>
                <button className="btn-plain" onClick={() => store.updateProject(p.id, { archived: false })}>
                  Restore
                </button>
                <button className="btn-plain" onClick={() => store.deleteProject(p.id)} aria-label="Delete project">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
