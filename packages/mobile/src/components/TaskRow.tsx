import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Task, Project } from '@moonlight/core';
import { todayKey } from '@moonlight/core';
import { useTheme } from '../store/WorklightContext';
import Pill from './Pill';

interface Props {
  task: Task;
  project: Project | undefined;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}

function fmtShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function TaskRow({ task, project, onToggle, onDelete }: Props): React.ReactElement {
  const theme = useTheme();
  const today = todayKey();
  let dueTone: 'accent' | 'danger' | 'neutral' = 'neutral';
  if (task.due && !task.done) {
    if (task.due < today) dueTone = 'danger';
    else if (task.due === today) dueTone = 'accent';
  }

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <TouchableOpacity
        onPress={() => onToggle(task.id, !task.done)}
        style={[
          styles.checkbox,
          { borderColor: task.done ? theme.accent : theme.border, backgroundColor: task.done ? theme.accent : 'transparent' },
        ]}
      />
      <Text
        style={[styles.text, { color: task.done ? theme.inkFaint : theme.ink, textDecorationLine: task.done ? 'line-through' : 'none' }]}
        numberOfLines={2}
      >
        {task.text}
      </Text>
      <View style={styles.tags}>
        {task.priority === 'high' && !task.done && <Pill label="high" tone="danger" />}
        {project && <Pill label={project.name} />}
        {task.due && <Pill label={fmtShort(task.due)} tone={dueTone} />}
      </View>
      <TouchableOpacity onPress={() => onDelete(task.id)} hitSlop={8}>
        <Text style={[styles.delete, { color: theme.inkFaint }]}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5 },
  text: { flex: 1, fontSize: 14 },
  tags: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', maxWidth: 140, justifyContent: 'flex-end' },
  delete: { fontSize: 18, paddingHorizontal: 4 },
});
