import React, { useEffect, useState } from 'react';
import { serializeState, deserializeState, InvalidStateError, planSync } from '@moonlight/core';
import type { ThemeMode, AccentTheme, TextScale, WorklightState } from '@moonlight/core';
import { useWorklight, useAnthropicSecrets } from '../store/WorklightContext';
import { useGithub } from '../store/useGithub';

const SYNC_PATH = 'moonlight-data.json';

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

const TEXT_SCALES: Array<{ id: TextScale; label: string }> = [
  { id: 'small', label: 'Small' },
  { id: 'normal', label: 'Normal' },
  { id: 'large', label: 'Large' },
  { id: 'xlarge', label: 'Extra large' },
];

export default function SettingsScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const anthropic = useAnthropicSecrets();
  const { status: githubStatus, client: githubClient } = useGithub();
  const [hasAnthropicKey, setHasAnthropicKey] = useState<boolean | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [minutesInput, setMinutesInput] = useState(String(state.settings.reminderMinutesBefore));
  const [syncRepoInput, setSyncRepoInput] = useState(state.settings.syncRepo ?? '');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    void anthropic.has().then(setHasAnthropicKey);
  }, [anthropic]);

  useEffect(() => {
    setMinutesInput(String(state.settings.reminderMinutesBefore));
  }, [state.settings.reminderMinutesBefore]);

  useEffect(() => {
    setSyncRepoInput(state.settings.syncRepo ?? '');
  }, [state.settings.syncRepo]);

  function commitMinutes() {
    const parsed = Number(minutesInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setMinutesInput(String(state.settings.reminderMinutesBefore));
      return;
    }
    store.setReminderMinutesBefore(Math.round(parsed));
  }

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

  function commitSyncRepo() {
    const trimmed = syncRepoInput.trim();
    store.setSyncRepo(trimmed || null);
    setSyncRepoInput(trimmed);
  }

  async function syncNow() {
    const repo = state.settings.syncRepo;
    if (!githubClient || !repo) return;
    setSyncing(true);
    setSyncStatus(null);
    try {
      const remoteFile = await githubClient.getFileContent(repo, SYNC_PATH);
      let remoteState: WorklightState | null = null;
      if (remoteFile) {
        try {
          remoteState = deserializeState(remoteFile.content);
        } catch (err) {
          setSyncStatus(
            err instanceof InvalidStateError
              ? `Remote data isn't valid Moonlight data: ${err.message}`
              : 'Remote data could not be read.',
          );
          return;
        }
      }
      const action = planSync(state, remoteState);
      if (action === 'noop') {
        setSyncStatus('Already in sync.');
        return;
      }
      if (action === 'push') {
        const confirmed = window.confirm(
          `This will push your local data to ${repo}, overwriting what's stored there. Continue?`,
        );
        if (!confirmed) return;
        await githubClient.putFileContent(repo, SYNC_PATH, serializeState(state), remoteFile?.sha, 'Sync from Moonlight');
        setSyncStatus('Pushed local data.');
        return;
      }
      if (action === 'pull' && remoteState) {
        const confirmed = window.confirm('Remote data is newer. Pull it? This replaces everything on this device.');
        if (!confirmed) return;
        store.replaceState(remoteState);
        setSyncStatus('Pulled remote data.');
      }
    } catch (err) {
      setSyncStatus(err instanceof Error ? `Sync failed: ${err.message}` : 'Sync failed.');
    } finally {
      setSyncing(false);
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
        <div className="form-row" style={{ marginBottom: '0.8rem' }}>
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
        <div className="group-label">Text size</div>
        <div className="form-row" style={{ marginBottom: 0 }}>
          {TEXT_SCALES.map((t) => (
            <button
              key={t.id}
              className={state.settings.textScale === t.id ? 'btn-accent' : ''}
              onClick={() => store.setTextScale(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Reminders</h3>
        <div className="form-row" style={{ alignItems: 'center', marginBottom: state.settings.remindersEnabled ? '0.8rem' : 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={state.settings.remindersEnabled}
              onChange={(e) => store.setRemindersEnabled(e.target.checked)}
            />
            Local reminder notifications
          </label>
        </div>
        {state.settings.remindersEnabled && (
          <div className="form-row" style={{ alignItems: 'center', marginBottom: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Minutes before calendar events
              <input
                type="number"
                min={0}
                value={minutesInput}
                onChange={(e) => setMinutesInput(e.target.value)}
                onBlur={commitMinutes}
                style={{ width: '5rem' }}
              />
            </label>
          </div>
        )}
        <p style={{ fontSize: '0.8rem', color: 'var(--ink-faint)', marginTop: '0.6rem', marginBottom: 0 }}>
          Tasks with a due date remind at 9am on the day they&rsquo;re due. Notifications only fire while
          Moonlight is running.
        </p>
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
        <h3>Cross-device sync</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: 0 }}>
          Store a copy of your data in a GitHub repo you control, then sync it to your other devices.
          Use a dedicated (ideally private) repo just for this data file — not a repo you host source
          code in.
        </p>
        <div className="form-row" style={{ marginBottom: '0.6rem' }}>
          <input
            type="text"
            placeholder="owner/repo"
            value={syncRepoInput}
            onChange={(e) => setSyncRepoInput(e.target.value)}
            onBlur={commitSyncRepo}
            style={{ flex: '2 1 260px' }}
          />
        </div>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <button
            className="btn-accent"
            onClick={() => void syncNow()}
            disabled={githubStatus !== 'connected' || !state.settings.syncRepo || syncing}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        {githubStatus !== 'connected' && (
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-faint)' }}>Connect GitHub to enable sync.</p>
        )}
        {syncStatus && <p style={{ fontSize: '0.8rem', color: 'var(--ink-faint)' }}>{syncStatus}</p>}
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
