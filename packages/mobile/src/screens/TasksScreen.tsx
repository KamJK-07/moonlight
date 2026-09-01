import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { groupTasks } from '@moonlight/core';
import type { Task, TaskPriority } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import Card from '../components/Card';
import Chip from '../components/Chip';
import TaskRow from '../components/TaskRow';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];

export default function TasksScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const theme = useTheme();
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);

  function projectOf(id: string | null) {
    return id ? state.projects.find((p) => p.id === id) : undefined;
  }

  function submit() {
    if (!text.trim()) return;
    store.addTask({ text, priority, projectId });
    setText('');
    setPriority('medium');
    setProjectId(null);
  }

  const filteredTasks = state.tasks.filter((t) => {
    if (search.trim() && !t.text.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (filterProjectId && t.projectId !== filterProjectId) return false;
    return true;
  });

  const groups = groupTasks(filteredTasks);
  const sections: Array<[string, Task[]]> = [
    ['Overdue', groups.overdue],
    ['Today', groups.dueToday],
    ['Upcoming', groups.upcoming],
    ['No date', groups.noDate],
  ].filter(([, arr]) => arr.length > 0) as Array<[string, Task[]]>;

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      <Card>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
          placeholder="What needs doing?"
          placeholderTextColor={theme.inkFaint}
          value={text}
          onChangeText={setText}
        />
        <View style={styles.chipsRow}>
          {PRIORITIES.map((p) => (
            <Chip key={p} label={p} selected={priority === p} onPress={() => setPriority(p)} />
          ))}
        </View>
        {state.projects.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            <Chip label="No project" selected={projectId === null} onPress={() => setProjectId(null)} />
            {state.projects.map((p) => (
              <Chip key={p.id} label={p.name} selected={projectId === p.id} onPress={() => setProjectId(p.id)} />
            ))}
          </ScrollView>
        )}
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.accent }]} onPress={submit}>
          <Text style={{ color: theme.accentInk, fontWeight: '600' }}>Add task</Text>
        </TouchableOpacity>
      </Card>

      <Card>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
          placeholder="Search tasks…"
          placeholderTextColor={theme.inkFaint}
          value={search}
          onChangeText={setSearch}
        />
        {state.projects.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            <Chip label="All projects" selected={filterProjectId === null} onPress={() => setFilterProjectId(null)} />
            {state.projects.map((p) => (
              <Chip key={p.id} label={p.name} selected={filterProjectId === p.id} onPress={() => setFilterProjectId(p.id)} />
            ))}
          </ScrollView>
        )}
      </Card>

      <Card>
        {sections.length === 0 && <Text style={{ color: theme.inkFaint }}>No open tasks. Add one above.</Text>}
        {sections.map(([label, tasks]) => (
          <View key={label}>
            <Text style={[styles.groupLabel, { color: theme.inkFaint }]}>{label.toUpperCase()}</Text>
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                project={projectOf(t.projectId)}
                onToggle={(id, done) => store.toggleTask(id, done)}
                onDelete={(id) => store.deleteTask(id)}
                onAddSubtask={(taskId, subtaskText) => store.addSubtask(taskId, subtaskText)}
                onToggleSubtask={(taskId, subtaskId, done) => store.toggleSubtask(taskId, subtaskId, done)}
                onDeleteSubtask={(taskId, subtaskId) => store.deleteSubtask(taskId, subtaskId)}
              />
            ))}
          </View>
        ))}
      </Card>

      {groups.done.length > 0 && (
        <Card>
          <Text style={[styles.groupLabel, { color: theme.inkFaint }]}>DONE</Text>
          {groups.done.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              project={projectOf(t.projectId)}
              onToggle={(id, done) => store.toggleTask(id, done)}
              onDelete={(id) => store.deleteTask(id)}
              onAddSubtask={(taskId, subtaskText) => store.addSubtask(taskId, subtaskText)}
              onToggleSubtask={(taskId, subtaskId, done) => store.toggleSubtask(taskId, subtaskId, done)}
              onDeleteSubtask={(taskId, subtaskId) => store.deleteSubtask(taskId, subtaskId)}
            />
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, marginBottom: 10 },
  chipsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  chipsScroll: { marginBottom: 10 },
  button: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  groupLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginTop: 10, marginBottom: 4 },
});
