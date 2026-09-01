import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { projectProgress, PROJECT_COLORS } from '@moonlight/core';
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
  const archived = state.projects.filter((p) => p.archived);
  const repos = state.settings.linkedRepos;

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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 }}>
                {p.color && <View style={[styles.colorDot, { backgroundColor: p.color }]} />}
                <Text style={[styles.name, { color: theme.ink }]}>{p.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <TouchableOpacity onPress={() => store.updateProject(p.id, { archived: true })} hitSlop={8}>
                  <Text style={{ color: theme.inkFaint, fontSize: 12 }}>Archive</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => store.deleteProject(p.id)} hitSlop={8}>
                  <Text style={{ color: theme.inkFaint, fontSize: 18 }}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              <Pill label={p.status} tone={STATUS_TONE[p.status]} />
              {p.githubRepo && <Pill label={p.githubRepo} />}
            </View>
            <View style={styles.colorRow}>
              <TouchableOpacity
                onPress={() => store.updateProject(p.id, { color: null })}
                style={[styles.colorSwatch, styles.colorSwatchEmpty, { borderColor: theme.border }, !p.color && { borderColor: theme.ink }]}
              />
              {PROJECT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => store.updateProject(p.id, { color: c })}
                  style={[styles.colorSwatch, { backgroundColor: c }, p.color === c && { borderColor: theme.ink }]}
                />
              ))}
            </View>
            {repos.length > 0 && (
              <View style={styles.chipsRow}>
                <TouchableOpacity
                  onPress={() => store.updateProject(p.id, { githubRepo: null })}
                  style={[styles.chip, { borderColor: theme.border, backgroundColor: !p.githubRepo ? theme.accentSoft : 'transparent' }]}
                >
                  <Text style={{ color: theme.ink, fontSize: 12 }}>No repo</Text>
                </TouchableOpacity>
                {repos.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => store.updateProject(p.id, { githubRepo: r })}
                    style={[styles.chip, { borderColor: theme.border, backgroundColor: p.githubRepo === r ? theme.accentSoft : 'transparent' }]}
                  >
                    <Text style={{ color: theme.ink, fontSize: 12 }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
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

      {archived.length > 0 && (
        <View style={styles.archivedSection}>
          <Text style={[styles.archivedLabel, { color: theme.inkFaint }]}>Archived ({archived.length})</Text>
          {archived.map((p) => (
            <View key={p.id} style={[styles.archivedRow, { borderColor: theme.border }]}>
              <Text style={{ color: theme.inkSoft, flex: 1 }}>{p.name}</Text>
              <TouchableOpacity onPress={() => store.updateProject(p.id, { archived: false })} hitSlop={8}>
                <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>Restore</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => store.deleteProject(p.id)} hitSlop={8} style={{ marginLeft: 14 }}>
                <Text style={{ color: theme.inkFaint, fontSize: 16 }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
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
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  colorRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  colorSwatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchEmpty: { backgroundColor: 'transparent' },
  archivedSection: { marginTop: 8 },
  archivedLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, paddingHorizontal: 4 },
  archivedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
});
