import { app, safeStorage } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { StorageAdapter, SecureTokenStore, WorklightState } from '@moonlight/core';

const STATE_FILE = 'moonlight-state.json';

function userDataPath(filename: string): string {
  return join(app.getPath('userData'), filename);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Persists app state as a JSON file under Electron's per-user data
 * directory (`%APPDATA%\Moonlight` on Windows). Writes go through a
 * temp-file-then-rename so a crash mid-write can never leave a
 * half-written, corrupt state file behind.
 */
export class FileStorageAdapter implements StorageAdapter {
  async load(): Promise<WorklightState | null> {
    const path = userDataPath(STATE_FILE);
    if (!(await fileExists(path))) return null;
    try {
      const raw = await fs.readFile(path, 'utf-8');
      return JSON.parse(raw) as WorklightState;
    } catch (err) {
      console.error('[moonlight] Failed to read state file, starting fresh:', err);
      return null;
    }
  }

  async save(state: WorklightState): Promise<void> {
    const path = userDataPath(STATE_FILE);
    const tmpPath = `${path}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tmpPath, path);
  }
}

/**
 * Encrypts a secret with Electron's `safeStorage` (DPAPI on Windows,
 * Keychain on macOS, libsecret on Linux) before it ever touches disk.
 * The renderer never sees the raw file — for the GitHub token it gets
 * the decrypted string per-request over IPC; for the Anthropic key it
 * never leaves the main process at all (see `ai:riff` in index.ts).
 *
 * One instance per secret, each with its own filename — this is how
 * the GitHub PAT and the Anthropic API key stay independently
 * connect/disconnect-able.
 */
export class SafeStorageTokenStore implements SecureTokenStore {
  constructor(private filename: string) {}

  private path(): string {
    return userDataPath(this.filename);
  }

  async get(): Promise<string | null> {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const path = this.path();
    if (!(await fileExists(path))) return null;
    try {
      const encrypted = await fs.readFile(path);
      return safeStorage.decryptString(encrypted);
    } catch (err) {
      console.error(`[moonlight] Failed to decrypt ${this.filename}:`, err);
      return null;
    }
  }

  async set(token: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure storage is unavailable on this machine.');
    }
    const encrypted = safeStorage.encryptString(token);
    await fs.writeFile(this.path(), encrypted);
  }

  async clear(): Promise<void> {
    const path = this.path();
    if (await fileExists(path)) {
      await fs.unlink(path);
    }
  }
}
