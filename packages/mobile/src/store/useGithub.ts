import { useCallback, useEffect, useMemo, useState } from 'react';
import { GithubClient } from '@moonlight/core';
import { githubSecretStore } from './secureStore';

export type GithubStatus = 'checking' | 'disconnected' | 'connected' | 'error';

export function useGithub(): {
  status: GithubStatus;
  login: string | null;
  error: string | null;
  client: GithubClient | null;
  connect: (token: string) => Promise<void>;
  disconnect: () => Promise<void>;
} {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<GithubStatus>('checking');
  const [login, setLogin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void githubSecretStore.get().then(async (stored) => {
      if (cancelled) return;
      if (!stored) {
        setStatus('disconnected');
        return;
      }
      try {
        const viewerLogin = await new GithubClient(stored).getViewerLogin();
        if (cancelled) return;
        setToken(stored);
        setLogin(viewerLogin);
        setStatus('connected');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async (newToken: string) => {
    setStatus('checking');
    setError(null);
    try {
      const viewerLogin = await new GithubClient(newToken).getViewerLogin();
      await githubSecretStore.set(newToken);
      setToken(newToken);
      setLogin(viewerLogin);
      setStatus('connected');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Could not verify that token with GitHub.');
      throw e;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await githubSecretStore.clear();
    setToken(null);
    setLogin(null);
    setStatus('disconnected');
  }, []);

  const client = useMemo(() => (token ? new GithubClient(token) : null), [token]);

  return { status, login, error, client, connect, disconnect };
}
