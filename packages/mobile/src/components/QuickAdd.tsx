import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { todayKey } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';

type QuickAddType = 'task' | 'event' | 'log' | 'idea';

const TYPES: Array<{ id: QuickAddType; label: string }> = [
  { id: 'task', label: 'Task' },
  { id: 'event', label: 'Event' },
  { id: 'log', label: 'Log entry' },
  { id: 'idea', label: 'Idea' },
];

const PLACEHOLDERS: Record<QuickAddType, string> = {
  task: 'What needs doing?',
  event: 'Event title',
  log: 'What did you do?',
  idea: 'Capture the idea…',
};

export default function QuickAdd(): React.ReactElement {
  const { store } = useWorklight();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<QuickAddType | null>(null);
  const [text, setText] = useState('');

  function close() {
    setOpen(false);
    setType(null);
    setText('');
  }

  function submit() {
    if (!type || !text.trim()) return;
    if (type === 'task') store.addTask({ text });
    else if (type === 'event') store.addEvent({ date: todayKey(), title: text });
    else if (type === 'log') store.addLogEntry({ text });
    else if (type === 'idea') store.addIdea({ text });
    close();
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.accent }]}
        onPress={() => setOpen(true)}
        accessibilityLabel="Quick add"
      >
        <Text style={[styles.fabPlus, { color: theme.accentInk }]}>+</Text>
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {!type ? (
              <>
                <Text style={[styles.title, { color: theme.ink }]}>Quick add</Text>
                {TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeButton, { borderColor: theme.border, backgroundColor: theme.surface2 }]}
                    onPress={() => setType(t.id)}
                  >
                    <Text style={{ color: theme.ink, fontWeight: '600' }}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.cancel} onPress={close}>
                  <Text style={{ color: theme.inkFaint }}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.title, { color: theme.ink }]}>{TYPES.find((t) => t.id === type)?.label}</Text>
                <TextInput
                  autoFocus
                  style={[styles.input, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
                  placeholder={PLACEHOLDERS[type]}
                  placeholderTextColor={theme.inkFaint}
                  value={text}
                  onChangeText={setText}
                  onSubmitEditing={submit}
                />
                <TouchableOpacity style={[styles.button, { backgroundColor: theme.accent }]} onPress={submit}>
                  <Text style={{ color: theme.accentInk, fontWeight: '600' }}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancel} onPress={() => setType(null)}>
                  <Text style={{ color: theme.inkFaint }}>Back</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabPlus: { fontSize: 28, fontWeight: '600', lineHeight: 30 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    paddingBottom: 36,
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  typeButton: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, marginBottom: 10 },
  button: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 8 },
  cancel: { alignItems: 'center', paddingVertical: 6 },
});
