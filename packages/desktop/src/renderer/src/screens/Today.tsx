import React, { useEffect, useState } from 'react';
import { onDeck, computeStreak, activeProjectCount, todayKey, eventsForDate } from '@moonlight/core';
import type { GithubActivityItem } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';
import { useGithub } from '../store/useGithub';
import { useTaskGithubSync } from '../store/useTaskGithubSync';
import { useTaskDetails } from '../store/useTaskDetails';
import TaskRow from '../components/TaskRow';
import type { ViewId } from '../App';

export default function TodayScreen({ onNavigate: _onNavigate }: { onNavigate: (v: ViewId) => void }): React.ReactElement {
  const { state, store } = useWorklight();
  const { status: githubStatus, client: githubClient } = useGithub();
  const { toggleTaskWithSync } = useTaskGithubSync();
  const { setRecurrence: setTaskRecurrence, addBlocker, removeBlocker } = useTaskDetails();
  const [logText, setLogText] = useState('');
  const [githubActivity, setGithubActivity] = useState<GithubActivityItem[] | null>(null);

  const today = todayKey();
  const deck = onDeck(state.tasks, today);
  const streak = computeStreak(state.logEntries, today);
  const todaysEvents = eventsForDate(state.events, today);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const githubReady = githubStatus === 'connected' && state.settings.linkedRepos.length > 0;

  useEffect(() => {
    if (githubStatus === 'connected' && githubClient && state.settings.linkedRepos.length > 0) {
      void githubClient.fetchActivityFeed(state.settings.linkedRepos).then(setGithubActivity).catch(() => setGithubActivity([]));
    }
  }, [githubStatus, githubClient, state.settings.linkedRepos]);

  const todaysGithubActivity = (githubActivity ?? []).filter((item) => item.date.slice(0, 10) === today);
  const commitCount = todaysGithubActivity.filter((item) => item.type === 'commit').length;
  const prCount = todaysGithubActivity.filter((item) => item.type === 'pull_request').length;
  const githubSummary = [
    commitCount > 0 ? `${commitCount} commit${commitCount === 1 ? '' : 's'}` : null,
    prCount > 0 ? `${prCount} PR${prCount === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(', ');

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
              allTasks={state.tasks}
              onToggle={(id, done) => toggleTaskWithSync(t, done)}
              onDelete={(id) => store.deleteTask(id)}
              onAddSubtask={(taskId, subtaskText) => store.addSubtask(taskId, subtaskText)}
              onToggleSubtask={(taskId, subtaskId, done) => store.toggleSubtask(taskId, subtaskId, done)}
              onDeleteSubtask={(taskId, subtaskId) => store.deleteSubtask(taskId, subtaskId)}
              onSetRecurrence={setTaskRecurrence}
              onAddBlocker={addBlocker}
              onRemoveBlocker={removeBlocker}
            />
          ))}
        </ul>
      </div>

      {githubReady && (
        <div className="card">
          <h3>GitHub activity</h3>
          <p className="empty" style={{ marginTop: 0 }}>
            {githubSummary ? `${githubSummary} today` : 'No activity yet today'}
          </p>
          <ul className="list">
            {todaysGithubActivity.slice(0, 5).map((item) => (
              <li key={`${item.type}-${item.id}`} className="row">
                <span className={`pill ${item.state ?? 'open'}`}>{item.type === 'commit' ? 'commit' : item.state ?? 'pr'}</span>
                <span className="row-text">{item.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
