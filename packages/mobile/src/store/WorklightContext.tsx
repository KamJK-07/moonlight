import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useColorScheme, View, Text, StyleSheet } from 'react-native';
import { WorklightStore, createInitialState, type WorklightState } from '@moonlight/core';
import { AsyncStorageAdapter } from './storageAdapter';
import { resolveTheme, normalizeSystemScheme, type ResolvedTheme } from '../theme';

interface WorklightContextValue {
  store: WorklightStore;
}

const WorklightReactContext = createContext<WorklightContextValue | null>(null);
const ThemeContext = createContext<ResolvedTheme | null>(null);

export function WorklightProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [value, setValue] = useState<WorklightContextValue | null>(null);

  useEffect(() => {
    let cancelled = false;
    const adapter = new AsyncStorageAdapter();
    void adapter.load().then((loaded) => {
      if (cancelled) return;
      setValue({ store: new WorklightStore(loaded ?? createInitialState(), adapter) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!value) {
    return (
      <View style={styles.boot}>
        <Text style={styles.bootText}>Loading Moonlight…</Text>
      </View>
    );
  }

  return (
    <WorklightReactContext.Provider value={value}>
      <ThemedTree>{children}</ThemedTree>
    </WorklightReactContext.Provider>
  );
}

function ThemedTree({ children }: { children: React.ReactNode }): React.ReactElement {
  const { state } = useWorklight();
  const systemScheme = normalizeSystemScheme(useColorScheme());
  const theme = resolveTheme(state.settings.themeMode, systemScheme, state.settings.accent);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

function useWorklightContext(): WorklightContextValue {
  const ctx = useContext(WorklightReactContext);
  if (!ctx) throw new Error('useWorklight must be used inside <WorklightProvider>.');
  return ctx;
}

export function useWorklight(): { state: WorklightState; store: WorklightStore } {
  const { store } = useWorklightContext();
  const state = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getState(),
  );
  return { state, store };
}

export function useTheme(): ResolvedTheme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <WorklightProvider>.');
  return theme;
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#131C18' },
  bootText: { color: '#A6B4A9', fontFamily: 'monospace', fontSize: 13 },
});
