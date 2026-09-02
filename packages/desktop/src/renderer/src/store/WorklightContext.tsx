import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { WorklightStore, createInitialState, type WorklightState } from '@moonlight/core';
import { IpcStorageAdapter, IpcSecretStore } from './ipcAdapters';

interface WorklightContextValue {
  store: WorklightStore;
  githubSecrets: IpcSecretStore;
  anthropicSecrets: IpcSecretStore;
}

const WorklightReactContext = createContext<WorklightContextValue | null>(null);

export function WorklightProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [value, setValue] = useState<WorklightContextValue | null>(null);

  useEffect(() => {
    let cancelled = false;
    const adapter = new IpcStorageAdapter();
    void adapter.load().then((loaded) => {
      if (cancelled) return;
      const store = new WorklightStore(loaded ?? createInitialState(), adapter);
      setValue({
        store,
        githubSecrets: new IpcSecretStore('github'),
        anthropicSecrets: new IpcSecretStore('anthropic'),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!value) {
    return (
      <div className="boot-splash">
        <span className="boot-mark" />
        <span>Loading Moonlight…</span>
      </div>
    );
  }

  return <WorklightReactContext.Provider value={value}>{children}</WorklightReactContext.Provider>;
}

function useWorklightContext(): WorklightContextValue {
  const ctx = useContext(WorklightReactContext);
  if (!ctx) throw new Error('useWorklight must be used inside <WorklightProvider>.');
  return ctx;
}

/** Live app state plus the store instance for calling mutation methods. */
export function useWorklight(): { state: WorklightState; store: WorklightStore } {
  const { store } = useWorklightContext();
  const state = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getState(),
  );
  return { state, store };
}

export function useGithubSecrets(): IpcSecretStore {
  return useWorklightContext().githubSecrets;
}

export function useAnthropicSecrets(): IpcSecretStore {
  return useWorklightContext().anthropicSecrets;
}
