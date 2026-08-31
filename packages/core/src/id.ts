import type { ID } from './types';

/**
 * ID generation without pulling in a UUID dependency. Uses the Web Crypto
 * API (available in Node 18+, React Native via the Hermes/Expo polyfill,
 * and Electron's renderer) when present, and falls back to a
 * timestamp+random scheme otherwise so this never throws.
 */
export function generateId(): ID {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) {
    return g.crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
