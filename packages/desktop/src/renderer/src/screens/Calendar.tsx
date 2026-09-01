import React, { useEffect, useMemo, useState } from 'react';
import { todayKey, dateKeyFrom, daysInMonth, firstWeekdayOfMonth, yearMonthOf, eventsForDate, addDays, weekDates } from '@moonlight/core';
import type { GithubMilestone } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';
import { useGithub } from '../store/useGithub';

const DOW_MONTH = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function fmtShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function weekLabel(dates: string[]): string {
  return `${fmtShort(dates[0] ?? '')} – ${fmtShort(dates[6] ?? '')}`;
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
  const { status: githubStatus, client: githubClient } = useGithub();
  const today = todayKey();
  const [month, setMonth] = useState(yearMonthOf(today));
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState<'month' | 'week'>('month');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [projectId, setProjectId] = useState('');
  const [milestonesByRepo, setMilestonesByRepo] = useState<Record<string, GithubMilestone[]>>({});

  function projectOf(id: string | null) {
    return id ? state.projects.find((p) => p.id === id) : undefined;
  }

  const reposWithGithub = useMemo(
    () => Array.from(new Set(state.projects.map((p) => p.githubRepo).filter((r): r is string => !!r))),
    [state.projects],
  );

  useEffect(() => {
    if (githubStatus !== 'connected' || !githubClient || reposWithGithub.length === 0) return;
    let cancelled = false;
    void Promise.all(
      reposWithGithub.map((repo) =>
        githubClient
          .listMilestones(repo, 'open')
          .then((ms) => [repo, ms] as const)
          .catch(() => [repo, []] as const),
      ),
    ).then((pairs) => {
      if (!cancelled) setMilestonesByRepo(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [githubStatus, githubClient, reposWithGithub]);

  const milestonesByDate = useMemo(() => {
    const map: Record<string, GithubMilestone[]> = {};
    for (const list of Object.values(milestonesByRepo)) {
      for (const m of list) {
        if (!m.dueOn) continue;
        const key = m.dueOn.slice(0, 10);
        (map[key] ??= []).push(m);
      }
    }
    return map;
  }, [milestonesByRepo]);

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

  function shiftWeek(delta: number) {
    pickDay(addDays(selected, delta * 7));
  }

  function submitEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    store.addEvent({ date: selected, title, time: time || null, projectId: projectId || null });
    setTitle('');
    setTime('');
    setProjectId('');
  }

  function dayCell(key: string, label: number) {
    const has = (state.events[key]?.length ?? 0) > 0;
    const hasMilestone = (milestonesByDate[key]?.length ?? 0) > 0;
    const isToday = key === today;
    const isSelected = key === selected;
    return (
      <button
        key={key}
        className={`cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
        onClick={() => pickDay(key)}
      >
        <span className="cal-daynum">{label}</span>
        <span className="cal-dots">
          {has && <span className="cal-dot" />}
          {hasMilestone && <span className="cal-dot milestone" />}
        </span>
      </button>
    );
  }

  const cells: React.ReactElement[] = [];
  if (view === 'week') {
    for (const key of weekDates(selected)) cells.push(dayCell(key, Number(key.slice(-2))));
  } else {
    for (let i = 0; i < startDow; i++) {
      cells.push(<div key={`empty-${i}`} className="cal-cell empty-cell" />);
    }
    for (let d = 1; d <= total; d++) cells.push(dayCell(dateKeyFrom(year, monthNum, d), d));
  }

  const selectedEvents = eventsForDate(state.events, selected);
  const selectedMilestones = milestonesByDate[selected] ?? [];

  return (
    <div>
      <div className="card">
        <div className="cal-view-toggle">
          <button className={`btn-plain${view === 'month' ? ' active' : ''}`} onClick={() => setView('month')}>
            Month
          </button>
          <button className={`btn-plain${view === 'week' ? ' active' : ''}`} onClick={() => setView('week')}>
            Week
          </button>
        </div>
        <div className="cal-head">
          <button className="btn-plain" onClick={() => (view === 'week' ? shiftWeek(-1) : shiftMonth(-1))}>
            &larr; Prev
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
            <strong style={{ fontFamily: 'var(--font-display)' }}>{view === 'week' ? weekLabel(weekDates(selected)) : monthLabel(month)}</strong>
            {month !== yearMonthOf(today) && (
              <button className="btn-plain" onClick={() => pickDay(today)}>
                Today
              </button>
            )}
          </div>
          <button className="btn-plain" onClick={() => (view === 'week' ? shiftWeek(1) : shiftMonth(1))}>
            Next &rarr;
          </button>
        </div>
        <div className="cal-grid">
          {(view === 'week' ? DOW_WEEK : DOW_MONTH).map((d) => (
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
          {selectedMilestones.map((m) => (
            <li key={m.id} className="row">
              <span className="row-text">🎯 {m.title}</span>
              <span className="pill milestone">milestone</span>
            </li>
          ))}
          {selectedEvents.length === 0 && selectedMilestones.length === 0 && <li className="empty">No events yet.</li>}
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
