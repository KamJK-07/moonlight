import React, { useEffect, useState } from 'react';
import type { GithubActivityItem, TextScale } from '@moonlight/core';
import { WorklightProvider, useWorklight } from './store/WorklightContext';
import { useGithub } from './store/useGithub';
import { useReminderPoller } from './store/reminders';
import TodayScreen from './screens/Today';
import CalendarScreen from './screens/Calendar';
import TasksScreen from './screens/Tasks';
import ProjectsScreen from './screens/Projects';
import ProjectDetail from './screens/ProjectDetail';
import LogScreen from './screens/Log';
import IdeasScreen from './screens/Ideas';
import GithubScreen from './screens/GithubScreen';
import SettingsScreen from './screens/Settings';
import QuickAdd from './components/QuickAdd';

export type ViewId = 'today' | 'calendar' | 'tasks' | 'projects' | 'log' | 'ideas' | 'github';

const VIEWS: Array<{ id: ViewId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'projects', label: 'Projects' },
  { id: 'log', label: 'Progress log' },
  { id: 'ideas', label: 'Creative hub' },
  { id: 'github', label: 'GitHub' },
];

const TEXT_SCALE_PX: Record<TextScale, string> = {
  small: '14px',
  normal: '16px',
  large: '18px',
  xlarge: '20px',
};

export default function App(): React.ReactElement {
  return (
    <WorklightProvider>
      <Shell />
    </WorklightProvider>
  );
}

function Shell(): React.ReactElement {
  const { state } = useWorklight();
  const [view, setView] = useState<ViewId>('today');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { status: githubStatus, client: githubClient } = useGithub();
  const [githubActivity, setGithubActivity] = useState<GithubActivityItem[] | null>(null);
  useReminderPoller();

  useEffect(() => {
    document.body.dataset.accent = state.settings.accent;
    const root = document.documentElement;
    if (state.settings.themeMode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.settings.themeMode);
    root.style.fontSize = TEXT_SCALE_PX[state.settings.textScale];
  }, [state.settings.accent, state.settings.themeMode, state.settings.textScale]);

  useEffect(() => {
    if (view !== 'projects') setSelectedProjectId(null);
  }, [view]);

  useEffect(() => {
    if (githubStatus === 'connected' && githubClient && state.settings.linkedRepos.length > 0) {
      void githubClient
        .fetchActivityFeed(state.settings.linkedRepos)
        .then(setGithubActivity)
        .catch(() => setGithubActivity([]));
    }
  }, [githubStatus, githubClient, state.settings.linkedRepos]);

  const hasNewGithubActivity =
    githubStatus === 'connected' &&
    state.settings.linkedRepos.length > 0 &&
    (githubActivity ?? []).some(
      (item) => state.settings.githubActivitySeenAt === null || item.date > state.settings.githubActivitySeenAt,
    );

  const openTasks = state.tasks.filter((t) => !t.done).length;
  const activeProjects = state.projects.filter((p) => p.status === 'active' && !p.archived).length;
  const counts: Partial<Record<ViewId, number>> = { tasks: openTasks, projects: activeProjects };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" />
          <h1>Moonlight</h1>
        </div>
        <nav className="nav">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`nav-item${view === v.id ? ' active' : ''}`}
              onClick={() => setView(v.id)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {v.label}
                {v.id === 'github' && hasNewGithubActivity ? (
                  <span
                    style={{
                      width: '0.4rem',
                      height: '0.4rem',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      flexShrink: 0,
                    }}
                  />
                ) : null}
              </span>
              {counts[v.id] ? <span className="nav-count">{counts[v.id]}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="settings-gear" onClick={() => setShowSettings(true)} aria-label="Settings" title="Settings">
            ⚙
          </button>
        </div>
      </aside>
      <main className="main">
        <Topbar viewLabel={VIEWS.find((v) => v.id === view)?.label ?? ''} />
        {view === 'today' && <TodayScreen onNavigate={setView} />}
        {view === 'calendar' && <CalendarScreen />}
        {view === 'tasks' && <TasksScreen />}
        {view === 'projects' &&
          (selectedProjectId ? (
            <ProjectDetail projectId={selectedProjectId} onBack={() => setSelectedProjectId(null)} />
          ) : (
            <ProjectsScreen onSelectProject={setSelectedProjectId} />
          ))}
        {view === 'log' && <LogScreen />}
        {view === 'ideas' && <IdeasScreen />}
        {view === 'github' && <GithubScreen />}
      </main>
      <QuickAdd />
      {showSettings && (
        <div className="settings-popout-backdrop" onClick={() => setShowSettings(false)}>
          <div className="card settings-popout" onClick={(e) => e.stopPropagation()}>
            <button className="btn-plain settings-popout-close" onClick={() => setShowSettings(false)} aria-label="Close settings">
              ×
            </button>
            <h2 style={{ marginBottom: '1rem' }}>Settings</h2>
            <SettingsScreen />
          </div>
        </div>
      )}
    </div>
  );
}

function Topbar({ viewLabel }: { viewLabel: string }): React.ReactElement {
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return (
    <div className="topbar">
      <h2>{viewLabel}</h2>
      <span className="date mono">{dateLabel}</span>
    </div>
  );
}
