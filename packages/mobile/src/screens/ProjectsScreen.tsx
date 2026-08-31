import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { projectProgress } from '@moonlight/core';
import type { ProjectStatus } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import Card from '../components/Card';
import Pill from '../components/Pill';

const STATUSES: ProjectStatus[] = ['active', 'paused', 'done'];
const STATUS_TONE: Record<ProjectStatus, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  paused: 'warning',
  done: 'neutral',
};

export default function ProjectsScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');

  function submit() {
    if (!name.trim()) return;
    store.addProject({ name, status });
    setName('');
    setStatus('active');
  }

  const visible = state.projects.filter((p) => !p.archived);

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      <Card>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
          placeholder="Project name"
          placeholderTextColor={theme.inkFaint}
          value={name}
          onChangeText={setName}
        />
        <View style={styles.chipsRow}>
          {STATUSES.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setStatus(s)}
              style={[styles.chip, { borderColor: theme.border, backgroundColor: status === s ? theme.accentSoft : 'transparent' }]}
            >
              <Text style={{ color: theme.ink, fontSize: 12 }}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.accent }]} onPress={submit}>
          <Text style={{ color: theme.accentInk, fontWeight: '600' }}>Add project</Text>
        </TouchableOpacity>
      </Card>

      {visible.length === 0 && <Text style={{ color: theme.inkFaint, paddingHorizontal: 4 }}>No projects yet. Add one above.</Text>}

      {visible.map((p) => {
        const progress = projectProgress(state.tasks, p);
        return (
          <Card key={p.id}>
            <View style={styles.headRow}>
              <Text style={[styles.name, { color: theme.ink }]}>{p.name}</Text>
              <TouchableOpacity onPress={() => store.deleteProject(p.id)} hitSlop={8}>
                <Text style={{ color: theme.inkFaint, fontSize: 18 }}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              <Pill label={p.status} tone={STATUS_TONE[p.status]} />
              {p.githubRepo && <Pill label={p.githubRepo} />}
            </View>
            {progress.total > 0 ? (
              <View>
                <View style={[styles.track, { backgroundColor: theme.surface2 }]}>
                  <View style={[styles.fill, { backgroundColor: theme.accent, width: `${progress.pct}%` }]} />
                </View>
                <Text style={{ color: theme.inkSoft, fontSize: 11, marginTop: 4 }}>
                  {progress.done}/{progress.total} tasks · {progress.pct}%
                </Text>
              </View>
            ) : (
              <Text style={{ color: theme.inkFaint, fontSize: 11 }}>No tasks linked yet</Text>
            )}
            <TextInput
              style={[styles.notes, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
              placeholder="Notes…"
              placeholderTextColor={theme.inkFaint}
              defaultValue={p.notes}
              multiline
              onEndEditing={(e) => {
                if (e.nativeEvent.text !== p.notes) store.updateProject(p.id, { notes: e.nativeEvent.text });
              }}
            />
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, marginBottom: 10 },
  chipsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  button: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  name: { fontSize: 16, fontWeight: '600' },
  track: { height: 6, borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%' },
  notes: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, minHeight: 50, marginTop: 8, fontSize: 13, textAlignVertical: 'top' },
});
