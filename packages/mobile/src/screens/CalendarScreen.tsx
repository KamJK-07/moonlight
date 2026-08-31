import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import {
  todayKey,
  dateKeyFrom,
  daysInMonth,
  firstWeekdayOfMonth,
  yearMonthOf,
  eventsForDate,
} from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import Card from '../components/Card';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL_WIDTH = `${100 / 7}%`;

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function fmtLong(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function CalendarScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const theme = useTheme();
  const today = todayKey();
  const [month, setMonth] = useState(yearMonthOf(today));
  const [selected, setSelected] = useState(today);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');

  const [y, m] = month.split('-').map(Number);
  const year = y ?? 2026;
  const monthNum = m ?? 1;
  const startDow = firstWeekdayOfMonth(year, monthNum);
  const total = daysInMonth(year, monthNum);

  function shiftMonth(delta: number) {
    let newMonth = monthNum + delta;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    if (newMonth > 12) { newMonth = 1; newYear += 1; }
    setMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  }

  function submitEvent() {
    if (!title.trim()) return;
    store.addEvent({ date: selected, title, time: time || null });
    setTitle('');
    setTime('');
  }

  const cells: React.ReactElement[] = [];
  for (let i = 0; i < startDow; i++) cells.push(<View key={`e${i}`} style={{ width: CELL_WIDTH, aspectRatio: 1 }} />);
  for (let d = 1; d <= total; d++) {
    const key = dateKeyFrom(year, monthNum, d);
    const has = (state.events[key]?.length ?? 0) > 0;
    const isToday = key === today;
    const isSelected = key === selected;
    cells.push(
      <TouchableOpacity
        key={key}
        style={{ width: CELL_WIDTH, aspectRatio: 1, padding: 2 }}
        onPress={() => { setSelected(key); setMonth(yearMonthOf(key)); }}
      >
        <View
          style={[
            styles.cell,
            { backgroundColor: isSelected ? theme.accentSoft : theme.surface2, borderColor: isToday ? theme.accent : 'transparent' },
          ]}
        >
          <Text style={{ color: isToday ? theme.accent : theme.inkSoft, fontSize: 12, fontWeight: isToday ? '700' : '400' }}>{d}</Text>
          {has && <View style={[styles.dot, { backgroundColor: theme.accent }]} />}
        </View>
      </TouchableOpacity>,
    );
  }

  const selectedEvents = eventsForDate(state.events, selected);

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.calHead}>
          <TouchableOpacity onPress={() => shiftMonth(-1)}><Text style={{ color: theme.inkSoft }}>← Prev</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => { setSelected(today); setMonth(yearMonthOf(today)); }}>
            <Text style={{ color: theme.ink, fontWeight: '600' }}>{monthLabel(month)}</Text>
            {month !== yearMonthOf(today) && <Text style={{ color: theme.accent, fontSize: 11, textAlign: 'center' }}>Jump to today</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shiftMonth(1)}><Text style={{ color: theme.inkSoft }}>Next →</Text></TouchableOpacity>
        </View>
        <View style={styles.dowRow}>
          {DOW.map((d, i) => (
            <Text key={i} style={[styles.dow, { color: theme.inkFaint, width: CELL_WIDTH }]}>{d}</Text>
          ))}
        </View>
        <View style={styles.grid}>{cells}</View>
      </Card>

      <Card>
        <Text style={{ color: theme.inkSoft, fontSize: 12, marginBottom: 8 }}>{fmtLong(selected)}</Text>
        {selectedEvents.length === 0 && <Text style={{ color: theme.inkFaint }}>No events yet.</Text>}
        {selectedEvents.map((ev) => (
          <View key={ev.id} style={[styles.eventRow, { borderBottomColor: theme.border }]}>
            <Text style={{ color: theme.ink, flex: 1 }}>{ev.title}</Text>
            {ev.time && <Text style={{ color: theme.inkFaint, fontSize: 12, marginRight: 8 }}>{ev.time}</Text>}
            <TouchableOpacity onPress={() => store.deleteEvent(selected, ev.id)} hitSlop={8}>
              <Text style={{ color: theme.inkFaint, fontSize: 16 }}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { flex: 2, borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
            placeholder="Add an event…"
            placeholderTextColor={theme.inkFaint}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, { flex: 1, borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
            placeholder="HH:MM"
            placeholderTextColor={theme.inkFaint}
            value={time}
            onChangeText={setTime}
          />
          <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.accent }]} onPress={submitEvent}>
            <Text style={{ color: theme.accentInk, fontWeight: '600' }}>Add</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  calHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dowRow: { flexDirection: 'row' },
  dow: { textAlign: 'center', fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { flex: 1, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', margin: 1 },
  dot: { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: 3 },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  addRow: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 8 },
  addButton: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
});
