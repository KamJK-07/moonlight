import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { Task, Project } from '@moonlight/core';
import { todayKey } from '@moonlight/core';
import { useTheme } from '../store/WorklightContext';
import Pill from './Pill';

interface Props {
  task: Task;
  project: Project | undefined;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string, done: boolean) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
  onCreateIssue?: (taskId: string) => void;
}

function fmtShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function TaskRow({
  task,
  project,
  onToggle,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onCreateIssue,
}: Props): React.ReactElement {
  const theme = useTheme();
  const today = todayKey();
  const [expanded, setExpanded] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');
  const subtasks = task.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.done).length;
  const swipeableRef = useRef<Swipeable>(null);

  function renderCompleteAction(): React.ReactElement {
    return (
      <TouchableOpacity
        style={[styles.action, { backgroundColor: theme.success }]}
        onPress={() => {
          swipeableRef.current?.close();
          onToggle(task.id, !task.done);
        }}
      >
        <Text style={styles.actionText}>{task.done ? 'Undo' : 'Complete'}</Text>
      </TouchableOpacity>
    );
  }

  function renderDeleteAction(): React.ReactElement {
    return (
      <TouchableOpacity
        style={[styles.action, { backgroundColor: theme.danger }]}
        onPress={() => {
          swipeableRef.current?.close();
          onDelete(task.id);
        }}
      >
        <Text style={styles.actionText}>Delete</Text>
      </TouchableOpacity>
    );
  }

  let dueTone: 'accent' | 'danger' | 'neutral' = 'neutral';
  if (task.due && !task.done) {
    if (task.due < today) dueTone = 'danger';
    else if (task.due === today) dueTone = 'accent';
  }

  function submitSubtask(): void {
    if (!subtaskText.trim()) return;
    onAddSubtask(task.id, subtaskText);
    setSubtaskText('');
  }

  return (
    <View style={[styles.container, { borderBottomColor: theme.border }]}>
      <Swipeable
        ref={swipeableRef}
        renderLeftActions={renderCompleteAction}
        renderRightActions={renderDeleteAction}
        onSwipeableOpen={(direction) => {
          swipeableRef.current?.close();
          if (direction === 'left') onToggle(task.id, !task.done);
          else onDelete(task.id);
        }}
      >
        <View style={[styles.row, { backgroundColor: theme.surface }]}>
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
            {subtasks.length > 0 && <Pill label={`${doneCount}/${subtasks.length}`} tone={doneCount === subtasks.length ? 'success' : 'neutral'} />}
            {task.priority === 'high' && !task.done && <Pill label="high" tone="danger" />}
            {project && <Pill label={project.name} />}
            {task.due && <Pill label={fmtShort(task.due)} tone={dueTone} />}
          </View>
          <TouchableOpacity onPress={() => setExpanded((e) => !e)} hitSlop={8}>
            <Text style={[styles.chevron, { color: theme.inkFaint }]}>{expanded ? '▾' : '▸'}</Text>
          </TouchableOpacity>
          {onCreateIssue && !task.githubIssue && (
            <TouchableOpacity onPress={() => onCreateIssue(task.id)} hitSlop={8}>
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>→ Issue</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onDelete(task.id)} hitSlop={8}>
            <Text style={[styles.delete, { color: theme.inkFaint }]}>×</Text>
          </TouchableOpacity>
        </View>
      </Swipeable>

      {expanded && (
        <View style={styles.subtasks}>
          {subtasks.map((s) => (
            <Swipeable
              key={s.id}
              renderRightActions={() => (
                <TouchableOpacity
                  style={[styles.action, { backgroundColor: theme.danger }]}
                  onPress={() => onDeleteSubtask(task.id, s.id)}
                >
                  <Text style={styles.actionText}>Delete</Text>
                </TouchableOpacity>
              )}
              onSwipeableOpen={() => onDeleteSubtask(task.id, s.id)}
            >
              <View style={[styles.subtaskRow, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
                <TouchableOpacity
                  onPress={() => onToggleSubtask(task.id, s.id, !s.done)}
                  style={[
                    styles.subtaskCheckbox,
                    { borderColor: s.done ? theme.accent : theme.border, backgroundColor: s.done ? theme.accent : 'transparent' },
                  ]}
                />
                <Text
                  style={[
                    styles.subtaskText,
                    { color: s.done ? theme.inkFaint : theme.ink, textDecorationLine: s.done ? 'line-through' : 'none' },
                  ]}
                  numberOfLines={2}
                >
                  {s.text}
                </Text>
                <TouchableOpacity onPress={() => onDeleteSubtask(task.id, s.id)} hitSlop={8}>
                  <Text style={[styles.delete, { color: theme.inkFaint }]}>×</Text>
                </TouchableOpacity>
              </View>
            </Swipeable>
          ))}
          <TextInput
            style={[styles.subtaskInput, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
            placeholder="Add a subtask…"
            placeholderTextColor={theme.inkFaint}
            value={subtaskText}
            onChangeText={setSubtaskText}
            onSubmitEditing={submitSubtask}
            returnKeyType="done"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5 },
  text: { flex: 1, fontSize: 14 },
  tags: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', maxWidth: 140, justifyContent: 'flex-end' },
  chevron: { fontSize: 13, paddingHorizontal: 2 },
  delete: { fontSize: 18, paddingHorizontal: 4 },
  subtasks: { paddingLeft: 28, paddingBottom: 8, gap: 2 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  subtaskCheckbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5 },
  subtaskText: { flex: 1, fontSize: 13 },
  subtaskInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, marginTop: 6 },
  action: { width: 76, justifyContent: 'center', alignItems: 'center' },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
