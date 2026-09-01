import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { groupLogEntriesByWeek, startOfWeek, todayKey, addDays } from '@moonlight/core';
import type { DateKey } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import Card from '../components/Card';
import Chip from '../components/Chip';
import Pill from '../components/Pill';

function fmtShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function weekLabel(weekStart: DateKey, weekEnd: DateKey): string {
  const thisWeekStart = startOfWeek(todayKey());
  if (weekStart === thisWeekStart) return 'This week';
  if (weekStart === addDays(thisWeekStart, -7)) return 'Last week';
  return `${fmtShort(weekStart)} – ${fmtShort(weekEnd)}`;
}

export default function LogScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const theme = useTheme();
  const [text, setText] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);

  function submit() {
    if (!text.trim()) return;
    store.addLogEntry({ text, projectId });
    setText('');
    setProjectId(null);
  }

  function projectOf(id: string | null | undefined) {
    return id ? state.projects.find((p) => p.id === id) : undefined;
  }

  const weekGroups = groupLogEntriesByWeek(state.logEntries);

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
        {state.projects.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            <Chip label="No project" selected={projectId === null} onPress={() => setProjectId(null)} />
            {state.projects.map((p) => (
              <Chip key={p.id} label={p.name} selected={projectId === p.id} onPress={() => setProjectId(p.id)} />
            ))}
          </ScrollView>
        )}
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.accent }]} onPress={submit}>
          <Text style={{ color: theme.accentInk, fontWeight: '600' }}>Add entry</Text>
        </TouchableOpacity>
      </Card>

      {weekGroups.length === 0 && <Text style={{ color: theme.inkFaint, paddingHorizontal: 4 }}>No entries yet.</Text>}

      {weekGroups.length > 0 && (
        <Card>
          {weekGroups.map((g) => (
            <View key={g.weekStart}>
              <Text style={[styles.groupLabel, { color: theme.inkFaint }]}>
                {weekLabel(g.weekStart, g.weekEnd).toUpperCase()} ({g.entries.length})
              </Text>
              {g.entries.map((e) => {
                const project = projectOf(e.projectId);
                return (
                  <View key={e.id} style={[styles.row, { borderBottomColor: theme.border }]}>
                    <Pill label={fmtShort(e.date)} />
                    <Text style={{ color: theme.ink, flex: 1, marginLeft: 8 }}>{e.text}</Text>
                    {project && <Pill label={project.name} />}
                    {e.source === 'github' && <Pill label="github" />}
                    <TouchableOpacity onPress={() => store.deleteLogEntry(e.id)} hitSlop={8}>
                      <Text style={{ color: theme.inkFaint, fontSize: 16, marginLeft: 6 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
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
  chipsScroll: { marginBottom: 10 },
  button: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  groupLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginTop: 10, marginBottom: 4 },
});
