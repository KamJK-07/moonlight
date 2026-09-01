import React, { useState } from 'react';
import { sortIdeasByRecency } from '@moonlight/core';
import type { Idea, IdeaStatus } from '@moonlight/core';
import { useWorklight, useAnthropicSecrets } from '../store/WorklightContext';

const STATUSES: IdeaStatus[] = ['raw', 'exploring', 'parked', 'shipped'];
const STATUS_LABEL: Record<IdeaStatus, string> = {
  raw: 'Raw',
  exploring: 'Exploring',
  parked: 'Parked',
  shipped: 'Shipped',
};

export default function IdeasScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const anthropic = useAnthropicSecrets();
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const [riffing, setRiffing] = useState<string | null>(null);
  const [riffError, setRiffError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  React.useEffect(() => {
    void anthropic.has().then(setHasKey);
  }, [anthropic]);

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

  const sorted = sortIdeasByRecency(state.ideas);

  function renderIdea(idea: Idea) {
    return (
      <div key={idea.id} className="card">
        <div className="row" style={{ border: 'none', padding: 0 }}>
          <span className="row-text">{idea.text}</span>
          {idea.tag && <span className="tag">{idea.tag}</span>}
          <button className="btn-plain" onClick={() => store.deleteIdea(idea.id)} aria-label="Delete idea">
            ×
          </button>
        </div>
        <select
          value={idea.status}
          onChange={(e) => store.setIdeaStatus(idea.id, e.target.value as IdeaStatus)}
          style={{ marginTop: '0.5rem' }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {idea.riff && (
          <div className="idea-riff" style={{ marginTop: '0.5rem' }}>
            <span className="l">Claude riffed</span>
            {idea.riff}
          </div>
        )}
        {riffing === idea.id ? null : hasKey ? (
          <div style={{ marginTop: '0.5rem' }}>
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
          <div style={{ marginTop: '0.5rem' }}>
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
            />
            <button className="btn-accent" type="submit">
              Add idea
            </button>
          </div>
        </form>
      </div>

      {sorted.length === 0 && <p className="empty">No ideas yet. Drop one above.</p>}

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
    </div>
  );
}
