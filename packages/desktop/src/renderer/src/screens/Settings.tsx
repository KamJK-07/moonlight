import React, { useEffect, useState } from 'react';
import { serializeState, deserializeState, InvalidStateError } from '@moonlight/core';
import type { ThemeMode, AccentTheme } from '@moonlight/core';
import { useWorklight, useAnthropicSecrets } from '../store/WorklightContext';

const MODES: Array<{ id: ThemeMode; label: string }> = [
  { id: 'system', label: 'Match system' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

const ACCENTS: Array<{ id: AccentTheme; label: string }> = [
  { id: 'amber', label: 'Amber' },
  { id: 'violet', label: 'Violet' },
  { id: 'teal', label: 'Teal' },
];

export default function SettingsScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const anthropic = useAnthropicSecrets();
  const [hasAnthropicKey, setHasAnthropicKey] = useState<boolean | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    void anthropic.has().then(setHasAnthropicKey);
  }, [anthropic]);

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    await anthropic.set(keyInput.trim());
    setKeyInput('');
    setHasAnthropicKey(true);
    setKeyStatus('Saved.');
  }

  async function clearKey() {
    await anthropic.clear();
    setHasAnthropicKey(false);
    setKeyStatus('Removed.');
  }

  async function exportData() {
    const result = await window.moonlight.exportData(serializeState(state));
    setImportStatus(result.saved ? `Exported to ${result.filePath}` : null);
  }

  async function importData() {
    const result = await window.moonlight.importData();
    if (!result.loaded || !result.json) return;
    try {
      const imported = deserializeState(result.json);
      store.replaceState(imported);
      setImportStatus('Backup imported.');
    } catch (err) {
      setImportStatus(err instanceof InvalidStateError ? `Import failed: ${err.message}` : 'Import failed.');
    }
  }

  return (
    <div>
      <div className="card">
        <h3>Appearance</h3>
        <div className="group-label" style={{ marginTop: 0 }}>
          Theme
        </div>
        <div className="form-row" style={{ marginBottom: '0.8rem' }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              className={state.settings.themeMode === m.id ? 'btn-accent' : ''}
              onClick={() => store.setThemeMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="group-label">Accent</div>
        <div className="form-row" style={{ marginBottom: 0 }}>
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              className={state.settings.accent === a.id ? 'btn-accent' : ''}
              onClick={() => store.setAccent(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Claude (Creative Hub riffing)</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: 0 }}>
          Uses the Anthropic API directly — paste an API key from{' '}
          <span className="mono">console.anthropic.com</span>. It&rsquo;s encrypted on this device and used
          only by the main process to answer riff requests; the renderer never sees it.
        </p>
        {hasAnthropicKey ? (
          <div className="form-row" style={{ alignItems: 'center', marginBottom: 0 }}>
            <span className="pill active">Connected</span>
            <button className="btn-plain" onClick={() => void clearKey()}>
              Remove key
            </button>
          </div>
        ) : (
          <form onSubmit={saveKey}>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <input
                type="password"
                placeholder="sk-ant-…"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                style={{ flex: '2 1 260px' }}
                required
              />
              <button className="btn-accent" type="submit">
                Save
              </button>
            </div>
          </form>
        )}
        {keyStatus && <p style={{ fontSize: '0.8rem', color: 'var(--ink-faint)' }}>{keyStatus}</p>}
      </div>

      <div className="card">
        <h3>Your data</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: 0 }}>
          Everything lives locally on this machine (see About below). Export a JSON backup, or import
          one to restore or move to another install.
        </p>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <button onClick={() => void exportData()}>Export backup…</button>
          <button onClick={() => void importData()}>Import backup…</button>
        </div>
        {importStatus && <p style={{ fontSize: '0.8rem', color: 'var(--ink-faint)' }}>{importStatus}</p>}
      </div>

      <div className="card">
        <h3>About</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', margin: 0 }}>
          Moonlight 0.1.0 · data stored at your OS&rsquo;s per-user app-data folder for Moonlight ·{' '}
          <span className="mono">{window.moonlight.platform}</span>
        </p>
      </div>
    </div>
  );
}
