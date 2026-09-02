import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ThemeMode } from '@moonlight/core';
import type { ViewId } from '../App';
import { useWorklight } from '../store/WorklightContext';

type ResultKind = 'task' | 'project' | 'idea' | 'log' | 'event' | 'action';

interface SearchResult {
  kind: ResultKind;
  id: string;
  label: string;
  meta: string;
  run?: () => void;
}

const KIND_LABEL: Record<ResultKind, string> = {
  task: 'Task',
  project: 'Project',
  idea: 'Idea',
  log: 'Log',
  event: 'Event',
  action: 'Action',
};

const MAX_PER_KIND = 8;
const NEXT_THEME: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };

export default function GlobalSearch({
  onClose,
  onOpenProject,
  onGoTo,
  onOpenSettings,
  onOpenMap,
  onOpenAccount,
  onQuickAdd,
  onOpenShortcuts,
}: {
  onClose: () => void;
  onOpenProject: (id: string) => void;
  onGoTo: (view: ViewId) => void;
  onOpenSettings: () => void;
  onOpenMap: () => void;
  onOpenAccount: () => void;
  onQuickAdd: () => void;
  onOpenShortcuts: () => void;
}): React.ReactElement {
  const { state, store } = useWorklight();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    const out: SearchResult[] = [];

    const actions: Array<{ id: string; label: string; run: () => void }> = [
      { id: 'quickadd', label: 'New… (quick add)', run: onQuickAdd },
      { id: 'theme', label: `Switch to ${NEXT_THEME[state.settings.themeMode]} theme`, run: () => store.setThemeMode(NEXT_THEME[state.settings.themeMode]) },
      { id: 'settings', label: 'Open Settings', run: onOpenSettings },
      { id: 'map', label: 'Open project map', run: onOpenMap },
      { id: 'account', label: 'Open Account / GitHub', run: onOpenAccount },
      { id: 'shortcuts', label: 'Keyboard shortcuts', run: onOpenShortcuts },
    ];
    for (const a of actions) {
      if (!q || a.label.toLowerCase().includes(q)) {
        out.push({ kind: 'action', id: a.id, label: a.label, meta: '', run: a.run });
      }
    }

    if (!q) return out;

    for (const t of state.tasks) {
      if (out.filter((r) => r.kind === 'task').length >= MAX_PER_KIND) break;
      if (t.text.toLowerCase().includes(q)) {
        out.push({ kind: 'task', id: t.id, label: t.text, meta: t.done ? 'Done' : t.due ?? 'No date' });
      }
    }
    for (const p of state.projects) {
      if (out.filter((r) => r.kind === 'project').length >= MAX_PER_KIND) break;
      if (p.name.toLowerCase().includes(q) || (p.githubRepo ?? '').toLowerCase().includes(q)) {
        out.push({ kind: 'project', id: p.id, label: p.name, meta: p.status });
      }
    }
    for (const idea of state.ideas) {
      if (out.filter((r) => r.kind === 'idea').length >= MAX_PER_KIND) break;
      if (idea.text.toLowerCase().includes(q) || (idea.tag ?? '').toLowerCase().includes(q)) {
        out.push({ kind: 'idea', id: idea.id, label: idea.text, meta: idea.tag ?? idea.status });
      }
    }
    for (const entry of state.logEntries) {
      if (out.filter((r) => r.kind === 'log').length >= MAX_PER_KIND) break;
      if (entry.text.toLowerCase().includes(q)) {
        out.push({ kind: 'log', id: entry.id, label: entry.text, meta: entry.date });
      }
    }
    for (const dateKey of Object.keys(state.events)) {
      if (out.filter((r) => r.kind === 'event').length >= MAX_PER_KIND) break;
      for (const ev of state.events[dateKey] ?? []) {
        if (ev.title.toLowerCase().includes(q)) {
          out.push({ kind: 'event', id: ev.id, label: ev.title, meta: dateKey });
        }
      }
    }
    return out;
  }, [query, state, store, onQuickAdd, onOpenSettings, onOpenMap, onOpenAccount, onOpenShortcuts]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function activate(result: SearchResult) {
    if (result.run) {
      result.run();
      onClose();
      return;
    }
    switch (result.kind) {
      case 'task':
        onGoTo('tasks');
        break;
      case 'project':
        onOpenProject(result.id);
        return;
      case 'idea':
        onGoTo('ideas');
        break;
      case 'log':
        onGoTo('log');
        break;
      case 'event':
        onGoTo('calendar');
        break;
    }
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      activate(results[activeIndex]);
    }
  }

  return (
    <div className="settings-popout-backdrop" onClick={onClose}>
      <div className="card search-popout" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search tasks, projects, ideas, log, events…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <ul className="search-results">
          {results.length === 0 && <li className="empty">No matches.</li>}
          {results.map((r, i) => (
            <li
              key={`${r.kind}-${r.id}`}
              className={`search-result${i === activeIndex ? ' active' : ''}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => activate(r)}
            >
              <span className="tag search-kind">{KIND_LABEL[r.kind]}</span>
              <span className="row-text">{r.label}</span>
              {r.meta && <span className="search-meta mono">{r.meta}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
