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
import MapView from './screens/MapView';
import QuickAdd from './components/QuickAdd';
import GlobalSearch from './components/GlobalSearch';

export type ViewId = 'today' | 'calendar' | 'tasks' | 'projects' | 'log' | 'ideas';

const VIEWS: Array<{ id: ViewId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'projects', label: 'Projects' },
  { id: 'log', label: 'Progress log' },
  { id: 'ideas', label: 'Creative hub' },
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
  const [showAccount, setShowAccount] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { status: githubStatus, client: githubClient, login: githubLogin } = useGithub();
  const [githubActivity, setGithubActivity] = useState<GithubActivityItem[] | null>(null);
  useReminderPoller();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setShowSearch(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function openProject(id: string): void {
    setView('projects');
    setSelectedProjectId(id);
    setShowMap(false);
    setShowSearch(false);
  }

  function goTo(v: ViewId): void {
    setView(v);
    setShowMap(false);
    setShowSearch(false);
  }

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
          <button
            className="map-button"
            onClick={() => setShowSearch(true)}
            aria-label="Search"
            title="Search (Ctrl/Cmd+S)"
          >
            🔍
          </button>
          <button className="map-button" onClick={() => setShowMap(true)} aria-label="Open project map" title="Project map">
            🗺
          </button>
        </div>
        <nav className="nav">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`nav-item${view === v.id ? ' active' : ''}`}
              onClick={() => setView(v.id)}
            >
              <span>{v.label}</span>
              {counts[v.id] ? <span className="nav-count">{counts[v.id]}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button
            className="account-button"
            onClick={() => setShowAccount(true)}
            title={githubStatus === 'connected' ? `Connected as ${githubLogin}` : 'Connect GitHub'}
          >
            <span className={`gh-dot${githubStatus === 'connected' ? ' connected' : ''}`} />
            <span className="account-label">{githubStatus === 'connected' ? githubLogin : 'Account'}</span>
            {hasNewGithubActivity && <span className="account-unread" />}
          </button>
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
      {showAccount && (
        <div className="settings-popout-backdrop" onClick={() => setShowAccount(false)}>
          <div className="card settings-popout" onClick={(e) => e.stopPropagation()}>
            <button className="btn-plain settings-popout-close" onClick={() => setShowAccount(false)} aria-label="Close account">
              ×
            </button>
            <h2 style={{ marginBottom: '1rem' }}>Account</h2>
            <GithubScreen />
          </div>
        </div>
      )}
      {showMap && (
        <MapView onClose={() => setShowMap(false)} onOpenProject={openProject} onOpenTasks={() => goTo('tasks')} />
      )}
      {showSearch && (
        <GlobalSearch onClose={() => setShowSearch(false)} onOpenProject={openProject} onGoTo={goTo} />
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
