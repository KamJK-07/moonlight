import React, { useState } from 'react';
import { groupLogEntriesByWeek, startOfWeek, todayKey, addDays } from '@moonlight/core';
import type { DateKey } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';

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
  const [text, setText] = useState('');
  const [date, setDate] = useState(todayKey());
  const [projectId, setProjectId] = useState('');

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

  const weekGroups = groupLogEntriesByWeek(state.logEntries);

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
