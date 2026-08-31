import type { StorageAdapter, SecureTokenStore, WorklightState } from '@moonlight/core';

// Mirrors preload/index.ts's SecretName — duplicated rather than
// imported so the renderer's tsconfig (web/DOM) never has to resolve
// through the preload package's tsconfig (node/Electron).
type SecretName = 'github' | 'anthropic';

/**
 * Thin forwarders to the main process over IPC. All real file I/O,
 * encryption, and (for the Anthropic key) the API call itself happen in
 * the main process — the renderer never touches the filesystem or
 * safeStorage directly (contextIsolation is on).
 */
export class IpcStorageAdapter implements StorageAdapter {
  async load(): Promise<WorklightState | null> {
    return window.moonlight.loadState();
  }
  async save(state: WorklightState): Promise<void> {
    return window.moonlight.saveState(state);
  }
}

/**
 * One instance per secret (`new IpcSecretStore('github')`,
 * `new IpcSecretStore('anthropic')`). `get()` only actually succeeds for
 * 'github' — the main process refuses to hand back the Anthropic key —
 * so Settings uses `has()` to show connection status for that one instead.
 */
export class IpcSecretStore implements SecureTokenStore {
  constructor(private name: SecretName) {}

  async get(): Promise<string | null> {
    return window.moonlight.getSecret(this.name);
  }
  async set(token: string): Promise<void> {
    return window.moonlight.setSecret(this.name, token);
  }
  async clear(): Promise<void> {
    return window.moonlight.clearSecret(this.name);
  }
  async has(): Promise<boolean> {
    return window.moonlight.hasSecret(this.name);
  }
}
