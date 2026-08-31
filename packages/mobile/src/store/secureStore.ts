import * as SecureStore from 'expo-secure-store';
import type { SecureTokenStore } from '@moonlight/core';

/**
 * iOS Keychain-backed secret storage via expo-secure-store. Unlike the
 * desktop build, there's no separate "main process" boundary here — the
 * app's JS is not running inside a web page, so there's no renderer/CORS
 * split to defend against. Both the GitHub token and the Anthropic key
 * live behind this same interface, one instance per secret.
 */
export class SecureStoreTokenStore implements SecureTokenStore {
  constructor(private key: string) {}

  async get(): Promise<string | null> {
    return SecureStore.getItemAsync(this.key);
  }

  async set(token: string): Promise<void> {
    await SecureStore.setItemAsync(this.key, token);
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(this.key);
  }

  async has(): Promise<boolean> {
    return (await this.get()) !== null;
  }
}

export const githubSecretStore = new SecureStoreTokenStore('moonlight_github_token');
export const anthropicSecretStore = new SecureStoreTokenStore('moonlight_anthropic_token');
