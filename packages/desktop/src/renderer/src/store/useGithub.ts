import { useCallback, useEffect, useMemo, useState } from 'react';
import { GithubClient } from '@moonlight/core';
import { useGithubSecrets } from './WorklightContext';

export type GithubStatus = 'checking' | 'disconnected' | 'connected' | 'error';

export function useGithub(): {
  status: GithubStatus;
  login: string | null;
  error: string | null;
  client: GithubClient | null;
  connect: (token: string) => Promise<void>;
  disconnect: () => Promise<void>;
} {
  const tokenStore = useGithubSecrets();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<GithubStatus>('checking');
  const [login, setLogin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void tokenStore.get().then(async (stored) => {
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
  }, [tokenStore]);

  const connect = useCallback(
    async (newToken: string) => {
      setStatus('checking');
      setError(null);
      try {
        const viewerLogin = await new GithubClient(newToken).getViewerLogin();
        await tokenStore.set(newToken);
        setToken(newToken);
        setLogin(viewerLogin);
        setStatus('connected');
      } catch (e) {
        setStatus('error');
        setError(
          e instanceof Error
            ? e.message
            : 'Could not verify that token with GitHub.',
        );
        throw e;
      }
    },
    [tokenStore],
  );

  const disconnect = useCallback(async () => {
    await tokenStore.clear();
    setToken(null);
    setLogin(null);
    setStatus('disconnected');
  }, [tokenStore]);

  const client = useMemo(() => (token ? new GithubClient(token) : null), [token]);

  return { status, login, error, client, connect, disconnect };
}
