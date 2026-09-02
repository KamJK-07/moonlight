import React, { useEffect, useState } from 'react';
import { groupLogEntriesByWeek, startOfWeek, todayKey, addDays, tasksCompletedByWeek } from '@moonlight/core';
import type { DateKey } from '@moonlight/core';
import { useWorklight, useAnthropicSecrets } from '../store/WorklightContext';

function fmtShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function weekLabel(weekStart: DateKey, weekEnd: DateKey): string {
  const thisWeekStart = startOfWeek(todayKey());
  if (weekStart === thisWeekStart) return 'This week';
  if (weekStart === addDays(thisWeekStart, -7)) return 'Last week';
  return `${fmtShort(weekStart)} – ${fmtShort(weekEnd)}`;
}

export default function LogScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const anthropic = useAnthropicSecrets();
  const [text, setText] = useState('');
  const [date, setDate] = useState(todayKey());
  const [projectId, setProjectId] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [recap, setRecap] = useState<string | null>(null);
  const [recapping, setRecapping] = useState(false);
  const [recapError, setRecapError] = useState<string | null>(null);

  useEffect(() => {
    void anthropic.has().then(setHasKey);
  }, [anthropic]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    store.addLogEntry({ text, date, projectId: projectId || null });
    setText('');
    setDate(todayKey());
    setProjectId('');
  }

  function projectOf(id: string | null | undefined) {
    return id ? state.projects.find((p) => p.id === id) : undefined;
  }

  async function generateRecap(): Promise<void> {
    const since = addDays(todayKey(), -6);
    const weekEntries = state.logEntries
      .filter((e) => e.date >= since)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({ date: e.date, text: e.text }));
    if (weekEntries.length === 0) {
      setRecapError('No log entries in the last 7 days to summarize.');
      return;
    }
    setRecapping(true);
    setRecapError(null);
    try {
      setRecap(await window.moonlight.generateWeeklyRecap(weekEntries));
    } catch (err) {
      setRecapError(err instanceof Error ? err.message : 'Could not reach Claude right now.');
    } finally {
      setRecapping(false);
    }
  }

  function saveRecapToLog(): void {
    if (!recap) return;
    store.addLogEntry({ text: recap, date: todayKey() });
    setRecap(null);
  }

  const weekGroups = groupLogEntriesByWeek(state.logEntries);
  const weeklyTaskCounts = tasksCompletedByWeek(state.tasks, 8);
  const maxWeeklyCount = Math.max(1, ...weeklyTaskCounts.map((w) => w.count));

  return (
    <div>
      <div className="card">
        <form onSubmit={submit}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <textarea
              rows={2}
              placeholder="What moved forward?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              style={{ flex: '3 1 260px' }}
            />
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="btn-accent" type="submit">
              Add entry
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Tasks completed per week</h3>
        <div className="chart-bars">
          {weeklyTaskCounts.map((w) => (
            <div key={w.weekStart} className="chart-bar-col">
              <div
                className="chart-bar"
                style={{ height: `${(w.count / maxWeeklyCount) * 100}%` }}
                title={`Week of ${fmtShort(w.weekStart)}: ${w.count} completed`}
              />
              <span className="chart-bar-label">{fmtShort(w.weekStart)}</span>
            </div>
          ))}
        </div>
      </div>

      {hasKey === false && (
        <div className="card" style={{ borderColor: 'var(--warning)' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
            Connect an Anthropic API key in <strong>Settings</strong> to generate a weekly recap.
          </p>
        </div>
      )}

      {hasKey && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
            <h3 style={{ margin: 0 }}>Weekly recap</h3>
            <button className="btn-plain" onClick={() => void generateRecap()} disabled={recapping}>
              {recapping ? 'Thinking…' : 'Generate recap'}
            </button>
          </div>
          {recapError && (
            <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginBottom: 0 }}>{recapError}</p>
          )}
          {recap && (
            <div style={{ marginTop: '0.7rem' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--ink-soft)', whiteSpace: 'pre-wrap' }}>{recap}</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-plain" onClick={saveRecapToLog}>
                  Save as log entry
                </button>
                <button className="btn-plain" onClick={() => setRecap(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {weekGroups.length === 0 ? (
        <p className="empty">No entries yet.</p>
      ) : (
        <div className="card">
          {weekGroups.map((g) => (
            <React.Fragment key={g.weekStart}>
              <div className="group-label">
                {weekLabel(g.weekStart, g.weekEnd)} ({g.entries.length})
              </div>
              <ul className="list">
                {g.entries.map((e) => {
                  const project = projectOf(e.projectId);
                  return (
                    <li key={e.id} className="row">
                      <span className="tag mono">{fmtShort(e.date)}</span>
                      <span className="row-text">{e.text}</span>
                      {project && <span className="tag">{project.name}</span>}
                      {e.source === 'github' && <span className="tag">github</span>}
                      <button className="btn-plain" onClick={() => store.deleteLogEntry(e.id)} aria-label="Delete entry">
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
