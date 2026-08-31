import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { sortLogEntries } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import Card from '../components/Card';
import Pill from '../components/Pill';

function fmtShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function LogScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const theme = useTheme();
  const [text, setText] = useState('');

  function submit() {
    if (!text.trim()) return;
    store.addLogEntry({ text });
    setText('');
  }

  const sorted = sortLogEntries(state.logEntries);

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      <Card>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
          placeholder="What moved forward?"
          placeholderTextColor={theme.inkFaint}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.accent }]} onPress={submit}>
          <Text style={{ color: theme.accentInk, fontWeight: '600' }}>Add entry</Text>
        </TouchableOpacity>
      </Card>

      {sorted.length === 0 && <Text style={{ color: theme.inkFaint, paddingHorizontal: 4 }}>No entries yet.</Text>}

      {sorted.length > 0 && (
        <Card>
          {sorted.map((e) => (
            <View key={e.id} style={[styles.row, { borderBottomColor: theme.border }]}>
              <Pill label={fmtShort(e.date)} />
              <Text style={{ color: theme.ink, flex: 1, marginLeft: 8 }}>{e.text}</Text>
              {e.source === 'github' && <Pill label="github" />}
              <TouchableOpacity onPress={() => store.deleteLogEntry(e.id)} hitSlop={8}>
                <Text style={{ color: theme.inkFaint, fontSize: 16, marginLeft: 6 }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, minHeight: 60, marginBottom: 10, textAlignVertical: 'top' },
  button: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
