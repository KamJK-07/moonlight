import React, { useState } from 'react';
import { sortLogEntries, todayKey } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';

function fmtShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function LogScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const [text, setText] = useState('');
  const [date, setDate] = useState(todayKey());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    store.addLogEntry({ text, date });
    setText('');
    setDate(todayKey());
  }

  const sorted = sortLogEntries(state.logEntries);

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
            <button className="btn-accent" type="submit">
              Add entry
            </button>
          </div>
        </form>
      </div>

      {sorted.length === 0 ? (
        <p className="empty">No entries yet.</p>
      ) : (
        <div className="card">
          <ul className="list">
            {sorted.map((e) => (
              <li key={e.id} className="row">
                <span className="tag mono">{fmtShort(e.date)}</span>
                <span className="row-text">{e.text}</span>
                {e.source === 'github' && <span className="tag">github</span>}
                <button className="btn-plain" onClick={() => store.deleteLogEntry(e.id)} aria-label="Delete entry">
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
