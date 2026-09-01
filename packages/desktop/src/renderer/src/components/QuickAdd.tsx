import React, { useState } from 'react';
import { todayKey } from '@moonlight/core';
import { useWorklight } from '../store/WorklightContext';

type QuickAddType = 'task' | 'event' | 'log' | 'idea';

const TYPES: Array<{ id: QuickAddType; label: string }> = [
  { id: 'task', label: 'Task' },
  { id: 'event', label: 'Event' },
  { id: 'log', label: 'Log entry' },
  { id: 'idea', label: 'Idea' },
];

const PLACEHOLDERS: Record<QuickAddType, string> = {
  task: 'What needs doing?',
  event: 'Event title',
  log: 'What did you do?',
  idea: 'Capture the idea…',
};

export default function QuickAdd(): React.ReactElement {
  const { store } = useWorklight();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<QuickAddType | null>(null);
  const [text, setText] = useState('');

  function close(): void {
    setOpen(false);
    setType(null);
    setText('');
  }

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    if (!type || !text.trim()) return;
    if (type === 'task') store.addTask({ text });
    else if (type === 'event') store.addEvent({ date: todayKey(), title: text });
    else if (type === 'log') store.addLogEntry({ text });
    else if (type === 'idea') store.addIdea({ text });
    close();
  }

  return (
    <>
      <button className="quick-add-fab btn-accent" onClick={() => setOpen(true)} aria-label="Quick add">
        +
      </button>
      {open && (
        <div className="quick-add-backdrop" onClick={close}>
          <div className="card quick-add-modal" onClick={(e) => e.stopPropagation()}>
            {!type ? (
              <>
                <h3>Quick add</h3>
                <div className="quick-add-types">
                  {TYPES.map((t) => (
                    <button key={t.id} className="btn-plain" onClick={() => setType(t.id)}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <button className="btn-plain" onClick={close}>
                  Cancel
                </button>
              </>
            ) : (
              <form onSubmit={submit}>
                <h3>{TYPES.find((t) => t.id === type)?.label}</h3>
                <input
                  type="text"
                  autoFocus
                  placeholder={PLACEHOLDERS[type]}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  style={{ width: '100%', marginBottom: '0.7rem' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-accent" type="submit">
                    Add
                  </button>
                  <button className="btn-plain" type="button" onClick={() => setType(null)}>
                    Back
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
