import React, { useState } from 'react';
import { onDeck, computeStreak, activeProjectCount, todayKey, eventsForDate } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';
import TaskRow from '../components/TaskRow';
import type { ViewId } from '../App';

export default function TodayScreen({ onNavigate: _onNavigate }: { onNavigate: (v: ViewId) => void }): React.ReactElement {
  const { state, store } = useWorklight();
  const [logText, setLogText] = useState('');

  const today = todayKey();
  const deck = onDeck(state.tasks, today);
  const streak = computeStreak(state.logEntries, today);
  const todaysEvents = eventsForDate(state.events, today);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  function projectOf(id: string | null) {
    return id ? state.projects.find((p) => p.id === id) : undefined;
  }

  function submitLog(e: React.FormEvent) {
    e.preventDefault();
    if (!logText.trim()) return;
    store.addLogEntry({ text: logText });
    setLogText('');
  }

  return (
    <div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', marginBottom: '1rem' }}>
        {greeting}, Kameron.
      </h3>

      <div className="stat-row">
        <div className="stat">
          <div className="n">{deck.filter((t) => t.due === today).length}</div>
          <div className="l">Due today</div>
        </div>
        <div className="stat">
          <div className={`n${deck.some((t) => t.due && t.due < today) ? ' warn' : ''}`}>
            {deck.filter((t) => t.due && t.due < today).length}
          </div>
          <div className="l">Overdue</div>
        </div>
        <div className="stat">
          <div className="n">{activeProjectCount(state.projects)}</div>
          <div className="l">Active projects</div>
        </div>
        <div className="stat">
          <div className="n">{streak}</div>
          <div className="l">Day streak</div>
        </div>
      </div>

      <div className="card">
        <h3>On deck</h3>
        <ul className="list">
          {deck.length === 0 && <li className="empty">Nothing due today. Clear runway.</li>}
          {deck.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              project={projectOf(t.projectId)}
              onToggle={(id, done) => store.toggleTask(id, done)}
              onDelete={(id) => store.deleteTask(id)}
            />
          ))}
        </ul>
      </div>

      {todaysEvents.length > 0 && (
        <div className="card">
          <h3>Today on the calendar</h3>
          <ul className="list">
            {todaysEvents.map((ev) => (
              <li key={ev.id} className="row">
                <span className="row-text">{ev.title}</span>
                {ev.time && <span className="tag mono">{ev.time}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>Log today&rsquo;s progress</h3>
        <form onSubmit={submitLog}>
          <div className="form-row" style={{ marginBottom: '0.6rem' }}>
            <textarea
              rows={2}
              placeholder="What did you move forward today?"
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              required
            />
          </div>
          <button className="btn-accent" type="submit">
            Add to log
          </button>
        </form>
      </div>
    </div>
  );
}
