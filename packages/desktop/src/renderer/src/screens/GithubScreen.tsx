import React, { useEffect, useState } from 'react';
import type { GithubActivityItem, GithubIssueSummary, GithubRepoSummary } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';
import { useGithub } from '../store/useGithub';

export default function GithubScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const { status, login, error, client, connect, disconnect } = useGithub();
  const [tokenInput, setTokenInput] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [repos, setRepos] = useState<GithubRepoSummary[] | null>(null);
  const [activity, setActivity] = useState<GithubActivityItem[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [issueRepo, setIssueRepo] = useState('');
  const [issueTitle, setIssueTitle] = useState('');
  const [openIssues, setOpenIssues] = useState<GithubIssueSummary[] | null>(null);

  useEffect(() => {
    if (status !== 'connected' || !client) return;
    void client.listRepos().then(setRepos).catch(() => setRepos([]));
  }, [status, client]);

  useEffect(() => {
    if (state.settings.linkedRepos.length && !issueRepo) {
      setIssueRepo(state.settings.linkedRepos[0] ?? '');
    }
  }, [state.settings.linkedRepos, issueRepo]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnectError(null);
    try {
      await connect(tokenInput.trim());
      setTokenInput('');
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Could not connect.');
    }
  }

  function toggleRepo(fullName: string) {
    const linked = state.settings.linkedRepos;
    store.setLinkedRepos(
      linked.includes(fullName) ? linked.filter((r) => r !== fullName) : [...linked, fullName],
    );
  }

  async function refreshActivity() {
    if (!client || state.settings.linkedRepos.length === 0) return;
    setActivityLoading(true);
    try {
      setActivity(await client.fetchActivityFeed(state.settings.linkedRepos));
    } finally {
      setActivityLoading(false);
    }
  }

  async function loadOpenIssues(repo: string) {
    if (!client) return;
    setOpenIssues(await client.listIssues(repo, 'open'));
  }

  async function createIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!client || !issueRepo || !issueTitle.trim()) return;
    await client.createIssue(issueRepo, issueTitle.trim());
    setIssueTitle('');
    void loadOpenIssues(issueRepo);
  }

  function importIssue(repo: string, issue: GithubIssueSummary) {
    const [owner, repoName] = repo.split('/');
    const created = store.addTask({ text: issue.title });
    if (owner && repoName) {
      store.updateTask(created.id, {
        githubIssue: { owner, repo: repoName, number: issue.number, url: issue.url, state: issue.state },
      });
    }
  }

  if (status === 'checking') {
    return <p className="empty">Checking GitHub connection…</p>;
  }

  if (status !== 'connected') {
    return (
      <div className="card">
        <h3>Connect GitHub</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: 0 }}>
          Paste a personal access token (fine-grained, with repo Contents + Issues read/write, or a
          classic token with the <code>repo</code> scope). It&rsquo;s encrypted on this device and never
          leaves it except to talk to api.github.com directly.
        </p>
        <form onSubmit={handleConnect}>
          <div className="form-row">
            <input
              type="password"
              placeholder="ghp_…"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              style={{ flex: '2 1 260px' }}
              required
            />
            <button className="btn-accent" type="submit">
              Connect
            </button>
          </div>
        </form>
        {(connectError || error) && (
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{connectError ?? error}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="gh-status">
        <span className="gh-dot connected" />
        <span>
          Connected as <strong>{login}</strong>
        </span>
        <button className="btn-plain" onClick={() => void disconnect()} style={{ marginLeft: 'auto' }}>
          Disconnect
        </button>
      </div>

      <div className="card">
        <h3>Linked repositories</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: 0 }}>
          These feed the activity feed and issue tools below.
        </p>
        {repos === null && <p className="empty">Loading your repositories…</p>}
        {repos !== null && repos.length === 0 && <p className="empty">No repositories found.</p>}
        <ul className="list">
          {(repos ?? []).slice(0, 20).map((r) => (
            <li key={r.fullName} className="row">
              <input
                type="checkbox"
                checked={state.settings.linkedRepos.includes(r.fullName)}
                onChange={() => toggleRepo(r.fullName)}
              />
              <span className="row-text mono">{r.fullName}</span>
              {r.private && <span className="tag">private</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Recent activity</h3>
        <button className="btn-plain" onClick={() => void refreshActivity()} disabled={activityLoading}>
          {activityLoading ? 'Loading…' : 'Refresh activity'}
        </button>
        {activity && (
          <ul className="list" style={{ marginTop: '0.6rem' }}>
            {activity.length === 0 && <li className="empty">No recent activity on linked repos.</li>}
            {activity.slice(0, 15).map((item) => (
              <li key={`${item.type}-${item.id}`} className="row">
                <span className={`pill ${item.state ?? (item.type === 'commit' ? 'open' : 'open')}`}>
                  {item.type === 'commit' ? 'commit' : item.state ?? 'pr'}
                </span>
                <span className="row-text">{item.title}</span>
                <span className="tag mono">{item.repo.split('/')[1]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Create an issue</h3>
        <form onSubmit={createIssue}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <select value={issueRepo} onChange={(e) => setIssueRepo(e.target.value)}>
              <option value="">Choose a repo…</option>
              {state.settings.linkedRepos.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Issue title"
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
              required
            />
            <button className="btn-accent" type="submit" disabled={!issueRepo}>
              Create
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Open issues → import as tasks</h3>
        <div className="form-row">
          <select value={issueRepo} onChange={(e) => { setIssueRepo(e.target.value); void loadOpenIssues(e.target.value); }}>
            <option value="">Choose a repo…</option>
            {state.settings.linkedRepos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button className="btn-plain" onClick={() => issueRepo && void loadOpenIssues(issueRepo)}>
            Load open issues
          </button>
        </div>
        <ul className="list">
          {(openIssues ?? []).map((issue) => (
            <li key={issue.number} className="row">
              <span className="row-text">
                #{issue.number} {issue.title}
              </span>
              <button className="btn-plain" onClick={() => importIssue(issueRepo, issue)}>
                Import as task
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
