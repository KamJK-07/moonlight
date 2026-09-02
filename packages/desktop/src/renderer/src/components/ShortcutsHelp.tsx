import React from 'react';

const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: 'Ctrl/Cmd + S', label: 'Search / command palette' },
  { keys: 'Ctrl/Cmd + N', label: 'Quick add' },
  { keys: 'Ctrl/Cmd + Shift + Space', label: 'Quick add — works even when Moonlight isn’t focused' },
  { keys: 'Ctrl/Cmd + 1 – 6', label: 'Jump to Today / Calendar / Tasks / Projects / Log / Ideas' },
  { keys: '?', label: 'Show this shortcut list' },
  { keys: 'Esc', label: 'Close the open panel' },
];

export default function ShortcutsHelp({ onClose }: { onClose: () => void }): React.ReactElement {
  return (
    <div className="settings-popout-backdrop" onClick={onClose}>
      <div className="card settings-popout shortcuts-popout" onClick={(e) => e.stopPropagation()}>
        <button className="btn-plain settings-popout-close" onClick={onClose} aria-label="Close shortcuts">
          ×
        </button>
        <h2 style={{ marginBottom: '1rem' }}>Keyboard shortcuts</h2>
        <ul className="list">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="row shortcut-row">
              <span className="tag mono shortcut-keys">{s.keys}</span>
              <span className="row-text">{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
