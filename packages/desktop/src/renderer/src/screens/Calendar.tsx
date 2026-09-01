import React, { useState } from 'react';
import { todayKey, dateKeyFrom, daysInMonth, firstWeekdayOfMonth, yearMonthOf, eventsForDate } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function fmtLong(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CalendarScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const today = todayKey();
  const [month, setMonth] = useState(yearMonthOf(today));
  const [selected, setSelected] = useState(today);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [projectId, setProjectId] = useState('');

  function projectOf(id: string | null) {
    return id ? state.projects.find((p) => p.id === id) : undefined;
  }

  const [y, m] = month.split('-').map(Number);
  const year = y ?? 2026;
  const monthNum = m ?? 1;
  const startDow = firstWeekdayOfMonth(year, monthNum);
  const total = daysInMonth(year, monthNum);

  function shiftMonth(delta: number) {
    let newMonth = monthNum + delta;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    if (newMonth > 12) { newMonth = 1; newYear += 1; }
    setMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  }

  function pickDay(dateKey: string) {
    setSelected(dateKey);
    setMonth(yearMonthOf(dateKey));
  }

  function submitEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    store.addEvent({ date: selected, title, time: time || null, projectId: projectId || null });
    setTitle('');
    setTime('');
    setProjectId('');
  }

  const cells: React.ReactElement[] = [];
  for (let i = 0; i < startDow; i++) {
    cells.push(<div key={`empty-${i}`} className="cal-cell empty-cell" />);
  }
  for (let d = 1; d <= total; d++) {
    const key = dateKeyFrom(year, monthNum, d);
    const has = (state.events[key]?.length ?? 0) > 0;
    const isToday = key === today;
    const isSelected = key === selected;
    cells.push(
      <button
        key={key}
        className={`cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
        onClick={() => pickDay(key)}
      >
        <span className="cal-daynum">{d}</span>
        {has && <span className="cal-dot" />}
      </button>,
    );
  }

  const selectedEvents = eventsForDate(state.events, selected);

  return (
    <div>
      <div className="card">
        <div className="cal-head">
          <button className="btn-plain" onClick={() => shiftMonth(-1)}>
            &larr; Prev
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
            <strong style={{ fontFamily: 'var(--font-display)' }}>{monthLabel(month)}</strong>
            {month !== yearMonthOf(today) && (
              <button className="btn-plain" onClick={() => pickDay(today)}>
                Today
              </button>
            )}
          </div>
          <button className="btn-plain" onClick={() => shiftMonth(1)}>
            Next &rarr;
          </button>
        </div>
        <div className="cal-grid">
          {DOW.map((d) => (
            <div key={d} className="cal-dow">
              {d}
            </div>
          ))}
          {cells}
        </div>
      </div>

      <div className="card">
        <div className="group-label" style={{ marginTop: 0 }}>
          {fmtLong(selected)}
        </div>
        <ul className="list">
          {selectedEvents.length === 0 && <li className="empty">No events yet.</li>}
          {selectedEvents.map((ev) => {
            const evProject = projectOf(ev.projectId);
            return (
              <li key={ev.id} className="row">
                <span className="row-text">{ev.title}</span>
                {evProject && <span className="tag">{evProject.name}</span>}
                {ev.time && <span className="tag mono">{ev.time}</span>}
                <button className="btn-plain" onClick={() => store.deleteEvent(selected, ev.id)} aria-label="Delete event">
                  ×
                </button>
              </li>
            );
          })}
        </ul>
        <form onSubmit={submitEvent} style={{ marginTop: '0.6rem' }}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <input
              type="text"
              placeholder="Add an event…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="btn-accent" type="submit">
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
