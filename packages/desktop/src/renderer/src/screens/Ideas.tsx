import React, { useState } from 'react';
import { sortIdeasByRecency } from '@moonlight/core';
import type { Idea, IdeaStatus } from '@moonlight/core';
import { useWorklight, useAnthropicSecrets } from '../store/WorklightContext';
import { useGithub } from '../store/useGithub';

const STATUSES: IdeaStatus[] = ['raw', 'exploring', 'parked', 'shipped'];
const STATUS_LABEL: Record<IdeaStatus, string> = {
  raw: 'Raw',
  exploring: 'Exploring',
  parked: 'Parked',
  shipped: 'Shipped',
};

function IdeaLinks({
  links,
  onAdd,
  onRemove,
}: {
  links: string[];
  onAdd: (url: string) => void;
  onRemove: (url: string) => void;
}): React.ReactElement {
  const [url, setUrl] = useState('');

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    if (!url.trim()) return;
    onAdd(url);
    setUrl('');
  }

  return (
    <div className="idea-links">
      {links.length > 0 && (
        <ul className="list idea-link-list">
          {links.map((link, i) => (
            <li key={`${link}-${i}`} className="row idea-link-row">
              <a href={link} target="_blank" rel="noreferrer" className="row-text idea-link">
                {link}
              </a>
              <button className="btn-plain" onClick={() => onRemove(link)} aria-label="Remove link">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="idea-link-add" onSubmit={submit}>
        <input
          type="url"
          placeholder="Add a reference link…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="btn-plain" type="submit">
          Add
        </button>
      </form>
    </div>
  );
}

function IdeaImages({
  images,
  onAdd,
  onRemove,
}: {
  images: string[];
  onAdd: (filename: string) => void;
  onRemove: (filename: string) => void;
}): React.ReactElement {
  const [preview, setPreview] = useState<string | null>(null);

  async function attach(): Promise<void> {
    const filename = await window.moonlight.addIdeaImage();
    if (filename) onAdd(filename);
  }

  function remove(filename: string): void {
    void window.moonlight.removeIdeaImage(filename);
    onRemove(filename);
  }

  return (
    <div className="idea-images">
      {images.length > 0 && (
        <div className="idea-image-grid">
          {images.map((filename) => (
            <div key={filename} className="idea-image-thumb" onClick={() => setPreview(filename)}>
              <img src={`moonlight-image://${filename}`} alt="" />
              <button
                className="btn-plain idea-image-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(filename);
                }}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="btn-plain" onClick={() => void attach()}>
        + Attach image
      </button>
      {preview && (
        <div className="image-preview-backdrop" onClick={() => setPreview(null)}>
          <img src={`moonlight-image://${preview}`} alt="" className="image-preview-full" />
          <button className="btn-plain image-preview-close" onClick={() => setPreview(null)} aria-label="Close preview">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

interface IssueDraft {
  ideaId: string;
  repo: string;
  title: string;
  body: string;
}

export default function IdeasScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const anthropic = useAnthropicSecrets();
  const { status: githubStatus, client: githubClient } = useGithub();
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const [riffing, setRiffing] = useState<string | null>(null);
  const [riffError, setRiffError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [tagQuery, setTagQuery] = useState('');
  const [draftingIssueFor, setDraftingIssueFor] = useState<string | null>(null);
  const [issueDraft, setIssueDraft] = useState<IssueDraft | null>(null);
  const [issueDraftError, setIssueDraftError] = useState<string | null>(null);
  const [creatingIssue, setCreatingIssue] = useState(false);

  React.useEffect(() => {
    void anthropic.has().then(setHasKey);
  }, [anthropic]);

  async function draftIssue(idea: Idea): Promise<void> {
    setDraftingIssueFor(idea.id);
    setIssueDraftError(null);
    try {
      const body = await window.moonlight.draftIssueBody(idea.text, idea.tag, idea.riff);
      setIssueDraft({ ideaId: idea.id, repo: state.settings.linkedRepos[0] ?? '', title: idea.text, body });
    } catch (err) {
      setIssueDraftError(err instanceof Error ? err.message : 'Could not reach Claude right now.');
    } finally {
      setDraftingIssueFor(null);
    }
  }

  async function createDraftedIssue(): Promise<void> {
    if (!issueDraft || !githubClient || !issueDraft.repo) return;
    setCreatingIssue(true);
    try {
      await githubClient.createIssue(issueDraft.repo, issueDraft.title, issueDraft.body);
      store.setIdeaStatus(issueDraft.ideaId, 'shipped');
      setIssueDraft(null);
    } catch (err) {
      setIssueDraftError(err instanceof Error ? err.message : 'Could not create the issue.');
    } finally {
      setCreatingIssue(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    store.addIdea({ text, tag: tag || null });
    setText('');
    setTag('');
  }

  async function riff(ideaId: string) {
    const idea = state.ideas.find((i) => i.id === ideaId);
    if (!idea) return;
    setRiffing(ideaId);
    setRiffError(null);
    try {
      const result = await window.moonlight.riffIdea(idea.text, idea.tag);
      store.setIdeaRiff(ideaId, result);
    } catch (err) {
      setRiffError(err instanceof Error ? err.message : 'Could not reach Claude right now.');
    } finally {
      setRiffing(null);
    }
  }

  const active = state.ideas.filter((idea) => !idea.archived);
  const archived = state.ideas.filter((idea) => idea.archived);
  const uniqueTags = Array.from(new Set(active.map((i) => i.tag).filter((t): t is string => !!t))).sort();

  const sorted = sortIdeasByRecency(active)
    .filter((idea) => !tagQuery.trim() || (idea.tag ?? '').toLowerCase().includes(tagQuery.trim().toLowerCase()))
    .sort((a, b) => Number(b.starred) - Number(a.starred));

  function convertToTask(idea: Idea) {
    store.addTask({ text: idea.text });
    store.setIdeaStatus(idea.id, 'shipped');
  }

  function convertToProject(idea: Idea) {
    store.addProject({ name: idea.text });
    store.setIdeaStatus(idea.id, 'shipped');
  }

  function deleteIdeaAndImages(idea: Idea) {
    for (const filename of idea.images ?? []) void window.moonlight.removeIdeaImage(filename);
    store.deleteIdea(idea.id);
  }

  function renderIdea(idea: Idea) {
    return (
      <div key={idea.id} className="card idea-card">
        <div className="idea-card-text">
          <button
            className="btn-plain"
            onClick={() => store.toggleIdeaStar(idea.id)}
            aria-label={idea.starred ? 'Unstar idea' : 'Star idea'}
            style={{ color: idea.starred ? 'var(--accent)' : 'var(--ink-faint)' }}
          >
            {idea.starred ? '★' : '☆'}
          </button>
          <span className="row-text">{idea.text}</span>
        </div>
        <div className="idea-card-actions">
          {idea.tag && <span className="tag">{idea.tag}</span>}
          <button className="btn-plain" onClick={() => store.setIdeaArchived(idea.id, true)} aria-label="Archive idea">
            Archive
          </button>
          <button className="btn-plain" onClick={() => deleteIdeaAndImages(idea)} aria-label="Delete idea">
            ×
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn-plain" onClick={() => convertToTask(idea)}>
            → Task
          </button>
          <button className="btn-plain" onClick={() => convertToProject(idea)}>
            → Project
          </button>
          {hasKey && githubStatus === 'connected' && state.settings.linkedRepos.length > 0 && (
            <button className="btn-plain" onClick={() => void draftIssue(idea)} disabled={draftingIssueFor === idea.id}>
              {draftingIssueFor === idea.id ? 'Drafting…' : '→ Issue (AI-drafted)'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <select
            value={idea.status}
            onChange={(e) => store.setIdeaStatus(idea.id, e.target.value as IdeaStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {idea.status !== 'shipped' && (
            <button className="btn-plain" onClick={() => store.setIdeaStatus(idea.id, 'shipped')}>
              Ship it
            </button>
          )}
        </div>
        <IdeaLinks
          links={idea.links ?? []}
          onAdd={(url) => store.addIdeaLink(idea.id, url)}
          onRemove={(url) => store.removeIdeaLink(idea.id, url)}
        />
        <IdeaImages
          images={idea.images ?? []}
          onAdd={(filename) => store.addIdeaImage(idea.id, filename)}
          onRemove={(filename) => store.removeIdeaImage(idea.id, filename)}
        />
        {idea.riff && (
          <div className="idea-riff">
            <span className="l">Claude riffed</span>
            {idea.riff}
          </div>
        )}
        {issueDraft && issueDraft.ideaId === idea.id && (
          <div className="idea-issue-draft">
            <span className="l">Draft GitHub issue</span>
            <select value={issueDraft.repo} onChange={(e) => setIssueDraft({ ...issueDraft, repo: e.target.value })}>
              {state.settings.linkedRepos.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={issueDraft.title}
              onChange={(e) => setIssueDraft({ ...issueDraft, title: e.target.value })}
              style={{ width: '100%', marginTop: '0.4rem' }}
            />
            <textarea
              rows={6}
              value={issueDraft.body}
              onChange={(e) => setIssueDraft({ ...issueDraft, body: e.target.value })}
              style={{ width: '100%', marginTop: '0.4rem' }}
            />
            {issueDraftError && <p style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{issueDraftError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
              <button className="btn-accent" onClick={() => void createDraftedIssue()} disabled={creatingIssue}>
                {creatingIssue ? 'Creating…' : 'Create issue'}
              </button>
              <button className="btn-plain" onClick={() => setIssueDraft(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {riffing === idea.id ? null : hasKey ? (
          <div>
            <button className="btn-plain" onClick={() => riff(idea.id)}>
              {idea.riff ? 'Riff again' : 'Ask Claude to riff'}
            </button>
            {riffError && riffing === null && (
              <span className="tag" style={{ marginLeft: '0.5rem', color: 'var(--danger)' }}>
                {riffError}
              </span>
            )}
          </div>
        ) : null}
        {riffing === idea.id && (
          <div>
            <button className="btn-plain" disabled>
              Thinking…
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {hasKey === false && (
        <div className="card" style={{ borderColor: 'var(--warning)' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
            Connect an Anthropic API key in <strong>Settings</strong> to enable &ldquo;Ask Claude to
            riff&rdquo; on your ideas.
          </p>
        </div>
      )}

      <div className="card">
        <form onSubmit={submit}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <textarea
              rows={2}
              placeholder="Capture the idea…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Tag (optional)"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              style={{ flex: '0 1 140px' }}
              list="idea-tag-suggestions"
            />
            <datalist id="idea-tag-suggestions">
              {uniqueTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <button className="btn-accent" type="submit">
              Add idea
            </button>
          </div>
        </form>
      </div>

      {active.length > 0 && (
        <input
          type="text"
          placeholder="Search by tag…"
          value={tagQuery}
          onChange={(e) => setTagQuery(e.target.value)}
          style={{ marginBottom: uniqueTags.length > 0 ? '0.5rem' : '1rem' }}
        />
      )}
      {uniqueTags.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {uniqueTags.map((t) => (
            <button
              key={t}
              className={`btn-plain${tagQuery === t ? ' active' : ''}`}
              onClick={() => setTagQuery(tagQuery === t ? '' : t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {sorted.length === 0 && (
        <p className="empty">{active.length === 0 ? 'No ideas yet. Drop one above.' : 'No ideas match your search.'}</p>
      )}

      {sorted.length > 0 && (
        <div className="idea-board">
          {STATUSES.map((s) => {
            const ideas = sorted.filter((idea) => idea.status === s);
            return (
              <div key={s} className="idea-column">
                <div className="group-label">
                  {STATUS_LABEL[s]} ({ideas.length})
                </div>
                {ideas.map(renderIdea)}
              </div>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <div>
          <div className="group-label">Archived ({archived.length})</div>
          <ul className="list">
            {archived.map((idea) => (
              <li key={idea.id} className="row">
                <span className="row-text">{idea.text}</span>
                <button className="btn-plain" onClick={() => store.setIdeaArchived(idea.id, false)}>
                  Restore
                </button>
                <button className="btn-plain" onClick={() => deleteIdeaAndImages(idea)} aria-label="Delete idea">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
