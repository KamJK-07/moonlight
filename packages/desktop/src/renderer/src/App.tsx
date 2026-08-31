import React, { useEffect, useState } from 'react';
import { WorklightProvider, useWorklight } from './store/WorklightContext';
import TodayScreen from './screens/Today';
import CalendarScreen from './screens/Calendar';
import TasksScreen from './screens/Tasks';
import ProjectsScreen from './screens/Projects';
import LogScreen from './screens/Log';
import IdeasScreen from './screens/Ideas';
import GithubScreen from './screens/GithubScreen';
import SettingsScreen from './screens/Settings';

export type ViewId = 'today' | 'calendar' | 'tasks' | 'projects' | 'log' | 'ideas' | 'github' | 'settings';

const VIEWS: Array<{ id: ViewId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'projects', label: 'Projects' },
  { id: 'log', label: 'Progress log' },
  { id: 'ideas', label: 'Creative hub' },
  { id: 'github', label: 'GitHub' },
  { id: 'settings', label: 'Settings' },
];

const ACCENTS: Array<{ id: 'amber' | 'violet' | 'teal'; hex: string; label: string }> = [
  { id: 'amber', hex: '#E07B1E', label: 'Amber' },
  { id: 'violet', hex: '#7C5CE0', label: 'Violet' },
  { id: 'teal', hex: '#1E8F82', label: 'Teal' },
];

export default function App(): React.ReactElement {
  return (
    <WorklightProvider>
      <Shell />
    </WorklightProvider>
  );
}

function Shell(): React.ReactElement {
  const { state, store } = useWorklight();
  const [view, setView] = useState<ViewId>('today');

  useEffect(() => {
    document.body.dataset.accent = state.settings.accent;
    const root = document.documentElement;
    if (state.settings.themeMode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.settings.themeMode);
  }, [state.settings.accent, state.settings.themeMode]);

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
              <span>{v.label}</span>
              {counts[v.id] ? <span className="nav-count">{counts[v.id]}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="theme-row">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                className={`swatch${state.settings.accent === a.id ? ' active' : ''}`}
                title={a.label}
                style={{ background: a.hex }}
                onClick={() => store.setAccent(a.id)}
              />
            ))}
          </div>
        </div>
      </aside>
      <main className="main">
        <Topbar viewLabel={VIEWS.find((v) => v.id === view)?.label ?? ''} />
        {view === 'today' && <TodayScreen onNavigate={setView} />}
        {view === 'calendar' && <CalendarScreen />}
        {view === 'tasks' && <TasksScreen />}
        {view === 'projects' && <ProjectsScreen />}
        {view === 'log' && <LogScreen />}
        {view === 'ideas' && <IdeasScreen />}
        {view === 'github' && <GithubScreen />}
        {view === 'settings' && <SettingsScreen />}
      </main>
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
