import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Share, Platform } from 'react-native';
import { serializeState, deserializeState, InvalidStateError } from '@moonlight/core';
import type { ThemeMode, AccentTheme } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import { anthropicSecretStore } from '../store/secureStore';
import Card from '../components/Card';
import Pill from '../components/Pill';

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
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    void anthropicSecretStore.has().then(setHasKey);
  }, []);

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
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10 },
  smallButton: { borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
});
