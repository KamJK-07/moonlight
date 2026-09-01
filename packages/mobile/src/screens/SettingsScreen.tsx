import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Share, Platform, Switch, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { serializeState, deserializeState, InvalidStateError, planSync } from '@moonlight/core';
import type { ThemeMode, AccentTheme, WorklightState } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import { anthropicSecretStore } from '../store/secureStore';
import { useGithub } from '../store/useGithub';
import Card from '../components/Card';
import Pill from '../components/Pill';

const SYNC_PATH = 'moonlight-data.json';

const MODES: Array<{ id: ThemeMode; label: string }> = [
  { id: 'system', label: 'Match system' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];
const ACCENTS: Array<{ id: AccentTheme; label: string }> = [
  { id: 'amber', label: 'Amber' },
  { id: 'violet', label: 'Violet' },
  { id: 'teal', label: 'Teal' },
];

export default function SettingsScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const theme = useTheme();
  const { status: githubStatus, client: githubClient } = useGithub();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [minutesInput, setMinutesInput] = useState(String(state.settings.reminderMinutesBefore));
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  const [syncRepoInput, setSyncRepoInput] = useState(state.settings.syncRepo ?? '');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    void anthropicSecretStore.has().then(setHasKey);
  }, []);

  useEffect(() => {
    setMinutesInput(String(state.settings.reminderMinutesBefore));
  }, [state.settings.reminderMinutesBefore]);

  useEffect(() => {
    setSyncRepoInput(state.settings.syncRepo ?? '');
  }, [state.settings.syncRepo]);

  async function toggleReminders(next: boolean) {
    if (!next) {
      store.setRemindersEnabled(false);
      setReminderStatus(null);
      return;
    }
    const { granted } = await Notifications.requestPermissionsAsync();
    if (!granted) {
      setReminderStatus('Notification permission denied — enable it in system settings to use reminders.');
      return;
    }
    setReminderStatus(null);
    store.setRemindersEnabled(true);
  }

  function commitMinutes() {
    const parsed = Number(minutesInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setMinutesInput(String(state.settings.reminderMinutesBefore));
      return;
    }
    store.setReminderMinutesBefore(Math.round(parsed));
  }

  async function saveKey() {
    if (!keyInput.trim()) return;
    await anthropicSecretStore.set(keyInput.trim());
    setKeyInput('');
    setHasKey(true);
  }

  async function clearKey() {
    await anthropicSecretStore.clear();
    setHasKey(false);
  }

  async function exportData() {
    await Share.share({
      title: 'Moonlight backup',
      message: serializeState(state),
    });
  }

  function importData() {
    if (!importText.trim()) return;
    try {
      const imported = deserializeState(importText);
      store.replaceState(imported);
      setImportStatus('Backup imported.');
      setImportText('');
      setShowImport(false);
    } catch (err) {
      setImportStatus(err instanceof InvalidStateError ? `Import failed: ${err.message}` : 'Import failed.');
    }
  }

  function commitSyncRepo() {
    const trimmed = syncRepoInput.trim();
    store.setSyncRepo(trimmed || null);
    setSyncRepoInput(trimmed);
  }

  async function syncNow() {
    const repo = state.settings.syncRepo;
    if (!githubClient || !repo) return;
    setSyncing(true);
    setSyncStatus(null);
    try {
      const remoteFile = await githubClient.getFileContent(repo, SYNC_PATH);
      let remoteState: WorklightState | null = null;
      if (remoteFile) {
        try {
          remoteState = deserializeState(remoteFile.content);
        } catch (err) {
          setSyncStatus(
            err instanceof InvalidStateError
              ? `Remote data isn't valid Moonlight data: ${err.message}`
              : 'Remote data could not be read.',
          );
          setSyncing(false);
          return;
        }
      }
      const action = planSync(state, remoteState);
      if (action === 'noop') {
        setSyncStatus('Already in sync.');
        setSyncing(false);
        return;
      }
      if (action === 'push') {
        Alert.alert(
          'Push local data?',
          `This will push your local data to ${repo}, overwriting what's stored there. Continue?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setSyncing(false) },
            {
              text: 'Push',
              style: 'destructive',
              onPress: () => void pushNow(repo, remoteFile?.sha),
            },
          ],
        );
        return;
      }
      if (action === 'pull' && remoteState) {
        Alert.alert(
          'Pull remote data?',
          'Remote data is newer. Pull it? This replaces everything on this device.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setSyncing(false) },
            {
              text: 'Pull',
              style: 'destructive',
              onPress: () => {
                store.replaceState(remoteState as WorklightState);
                setSyncStatus('Pulled remote data.');
                setSyncing(false);
              },
            },
          ],
        );
        return;
      }
      setSyncing(false);
    } catch (err) {
      setSyncStatus(err instanceof Error ? `Sync failed: ${err.message}` : 'Sync failed.');
      setSyncing(false);
    }
  }

  async function pushNow(repo: string, remoteSha: string | undefined) {
    if (!githubClient) return;
    try {
      await githubClient.putFileContent(repo, SYNC_PATH, serializeState(state), remoteSha, 'Sync from Moonlight');
      setSyncStatus('Pushed local data.');
    } catch (err) {
      setSyncStatus(err instanceof Error ? `Sync failed: ${err.message}` : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      <Card>
        <Text style={[styles.title, { color: theme.ink }]}>Appearance</Text>
        <Text style={[styles.label, { color: theme.inkFaint }]}>THEME</Text>
        <View style={styles.chipsRow}>
          {MODES.map((m) => (
            <TouchableOpacity
              key={m.id}
              onPress={() => store.setThemeMode(m.id)}
              style={[styles.chip, { borderColor: theme.border, backgroundColor: state.settings.themeMode === m.id ? theme.accent : 'transparent' }]}
            >
              <Text style={{ color: state.settings.themeMode === m.id ? theme.accentInk : theme.ink, fontSize: 13 }}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.label, { color: theme.inkFaint }]}>ACCENT</Text>
        <View style={styles.chipsRow}>
          {ACCENTS.map((a) => (
            <TouchableOpacity
              key={a.id}
              onPress={() => store.setAccent(a.id)}
              style={[styles.chip, { borderColor: theme.border, backgroundColor: state.settings.accent === a.id ? theme.accent : 'transparent' }]}
            >
              <Text style={{ color: state.settings.accent === a.id ? theme.accentInk : theme.ink, fontSize: 13 }}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={[styles.title, { color: theme.ink }]}>Reminders</Text>
        <View style={styles.reminderRow}>
          <Text style={{ color: theme.ink, flex: 1 }}>Local reminder notifications</Text>
          <Switch value={state.settings.remindersEnabled} onValueChange={(v) => void toggleReminders(v)} />
        </View>
        {state.settings.remindersEnabled && (
          <View style={styles.reminderRow}>
            <Text style={{ color: theme.ink, flex: 1 }}>Minutes before calendar events</Text>
            <TextInput
              style={[styles.input, { width: 60, textAlign: 'center', borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
              value={minutesInput}
              onChangeText={setMinutesInput}
              onBlur={commitMinutes}
              keyboardType="number-pad"
            />
          </View>
        )}
        <Text style={{ color: theme.inkFaint, fontSize: 12, marginTop: 4 }}>
          Tasks with a due date remind at 9am on the day they&rsquo;re due.
        </Text>
        {reminderStatus && <Text style={{ color: theme.danger, fontSize: 12, marginTop: 8 }}>{reminderStatus}</Text>}
      </Card>

      <Card>
        <Text style={[styles.title, { color: theme.ink }]}>Claude (Creative Hub riffing)</Text>
        <Text style={{ color: theme.inkSoft, fontSize: 13, marginBottom: 10 }}>
          Uses the Anthropic API directly with a key from console.anthropic.com. Stored in the iOS
          Keychain on this device.
        </Text>
        {hasKey ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pill label="Connected" tone="success" />
            <TouchableOpacity onPress={() => void clearKey()}>
              <Text style={{ color: theme.inkFaint }}>Remove key</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { flex: 1, borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
              placeholder="sk-ant-…"
              placeholderTextColor={theme.inkFaint}
              value={keyInput}
              onChangeText={setKeyInput}
              secureTextEntry
              autoCapitalize="none"
            />
            <TouchableOpacity style={[styles.smallButton, { backgroundColor: theme.accent }]} onPress={saveKey}>
              <Text style={{ color: theme.accentInk, fontWeight: '600' }}>Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>

      <Card>
        <Text style={[styles.title, { color: theme.ink }]}>Your data</Text>
        <Text style={{ color: theme.inkSoft, fontSize: 13, marginBottom: 10 }}>
          Everything lives on this device. Export a JSON backup via the share sheet, or paste one
          back in to restore it.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: showImport ? 10 : 0 }}>
          <TouchableOpacity onPress={() => void exportData()}>
            <Text style={{ color: theme.accent, fontWeight: '600' }}>Export backup</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowImport((v) => !v)}>
            <Text style={{ color: theme.accent, fontWeight: '600' }}>{showImport ? 'Cancel' : 'Import backup'}</Text>
          </TouchableOpacity>
        </View>
        {showImport && (
          <View>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2, minHeight: 90 }]}
              placeholder="Paste exported JSON here…"
              placeholderTextColor={theme.inkFaint}
              value={importText}
              onChangeText={setImportText}
              multiline
              autoCapitalize="none"
            />
            <TouchableOpacity style={[styles.smallButton, { backgroundColor: theme.accent, alignSelf: 'flex-start', marginTop: 8 }]} onPress={importData}>
              <Text style={{ color: theme.accentInk, fontWeight: '600' }}>Import</Text>
            </TouchableOpacity>
          </View>
        )}
        {importStatus && <Text style={{ color: theme.inkFaint, fontSize: 12, marginTop: 8 }}>{importStatus}</Text>}
      </Card>

      <Card>
        <Text style={[styles.title, { color: theme.ink }]}>Cross-device sync</Text>
        <Text style={{ color: theme.inkSoft, fontSize: 13, marginBottom: 10 }}>
          Store a copy of your data in a GitHub repo you control, then sync it to your other devices.
          Use a dedicated (ideally private) repo just for this data file — not a repo you host source
          code in.
        </Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2, marginBottom: 10 }]}
          placeholder="owner/repo"
          placeholderTextColor={theme.inkFaint}
          value={syncRepoInput}
          onChangeText={setSyncRepoInput}
          onBlur={commitSyncRepo}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.smallButton, { backgroundColor: theme.accent, alignSelf: 'flex-start', opacity: githubStatus !== 'connected' || !state.settings.syncRepo || syncing ? 0.5 : 1 }]}
          onPress={() => void syncNow()}
          disabled={githubStatus !== 'connected' || !state.settings.syncRepo || syncing}
        >
          <Text style={{ color: theme.accentInk, fontWeight: '600' }}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
        </TouchableOpacity>
        {githubStatus !== 'connected' && (
          <Text style={{ color: theme.inkFaint, fontSize: 12, marginTop: 8 }}>Connect GitHub to enable sync.</Text>
        )}
        {syncStatus && <Text style={{ color: theme.inkFaint, fontSize: 12, marginTop: 8 }}>{syncStatus}</Text>}
      </Card>

      <Card>
        <Text style={[styles.title, { color: theme.ink }]}>About</Text>
        <Text style={{ color: theme.inkSoft, fontSize: 13 }}>Moonlight 0.1.0 · {Platform.OS}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  chipsRow: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  addRow: { flexDirection: 'row', gap: 8 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10 },
  smallButton: { borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
});
