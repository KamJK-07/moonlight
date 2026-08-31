import { contextBridge, ipcRenderer } from 'electron';
import type { WorklightState } from '@moonlight/core';

export type SecretName = 'github' | 'anthropic';

/**
 * The only surface the renderer gets. contextIsolation is on and
 * nodeIntegration is off (see main/index.ts), so this is the entire API
 * available to app code — no direct Node or Electron access leaks through.
 *
 * Note what's deliberately absent: there is no `getSecret('anthropic')`
 * path that would hand the raw Anthropic key to the renderer. Riffing
 * goes through `riffIdea`, which stays entirely in the main process.
 */
const moonlightBridge = {
  loadState: (): Promise<WorklightState | null> => ipcRenderer.invoke('state:load'),
  saveState: (state: WorklightState): Promise<void> => ipcRenderer.invoke('state:save', state),

  getSecret: (name: SecretName): Promise<string | null> => ipcRenderer.invoke('secret:get', name),
  setSecret: (name: SecretName, value: string): Promise<void> => ipcRenderer.invoke('secret:set', name, value),
  clearSecret: (name: SecretName): Promise<void> => ipcRenderer.invoke('secret:clear', name),
  hasSecret: (name: SecretName): Promise<boolean> => ipcRenderer.invoke('secret:has', name),

  riffIdea: (ideaText: string, tag: string | null): Promise<string> =>
    ipcRenderer.invoke('ai:riff', ideaText, tag),

  exportData: (json: string): Promise<{ saved: boolean; filePath?: string }> =>
    ipcRenderer.invoke('data:export', json),
  importData: (): Promise<{ loaded: boolean; json?: string }> => ipcRenderer.invoke('data:import'),

  platform: process.platform,
};

export type MoonlightBridge = typeof moonlightBridge;

contextBridge.exposeInMainWorld('moonlight', moonlightBridge);
