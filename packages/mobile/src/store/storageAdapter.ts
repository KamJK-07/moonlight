import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorageAdapter, WorklightState } from '@moonlight/core';

const STATE_KEY = 'moonlight:state';

/** AsyncStorage-backed persistence — the mobile equivalent of desktop's JSON file adapter. */
export class AsyncStorageAdapter implements StorageAdapter {
  async load(): Promise<WorklightState | null> {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as WorklightState;
    } catch (err) {
      console.error('[moonlight] Failed to parse stored state, starting fresh:', err);
      return null;
    }
  }

  async save(state: WorklightState): Promise<void> {
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
  }
}
