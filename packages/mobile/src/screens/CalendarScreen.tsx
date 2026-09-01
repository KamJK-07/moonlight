import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import {
  todayKey,
  dateKeyFrom,
  daysInMonth,
  firstWeekdayOfMonth,
  yearMonthOf,
  addDays,
  weekDates,
  occurrencesInRange,
} from '@moonlight/core';
import type { GithubMilestone, EventRecurrence, Task } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import { useGithub } from '../store/useGithub';
import Card from '../components/Card';
import Chip from '../components/Chip';
import Pill from '../components/Pill';

const DOW_MONTH = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DOW_WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CELL_WIDTH = `${100 / 7}%`;
const RECURRENCE_OPTIONS: EventRecurrence[] = ['none', 'daily', 'weekly', 'monthly'];

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function fmtShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function weekLabel(dates: string[]): string {
  return `${fmtShort(dates[0] ?? '')} – ${fmtShort(dates[6] ?? '')}`;
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
  const { status: githubStatus, client: githubClient } = useGithub();
  const today = todayKey();
  const [month, setMonth] = useState(yearMonthOf(today));
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState<'month' | 'week'>('month');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<EventRecurrence>('none');
  const [milestonesByRepo, setMilestonesByRepo] = useState<Record<string, GithubMilestone[]>>({});

  function projectOf(id: string | null) {
    return id ? state.projects.find((p) => p.id === id) : undefined;
  }

  const reposWithGithub = useMemo(
    () => Array.from(new Set(state.projects.map((p) => p.githubRepo).filter((r): r is string => !!r))),
    [state.projects],
  );

  useEffect(() => {
    if (githubStatus !== 'connected' || !githubClient || reposWithGithub.length === 0) return;
    let cancelled = false;
    void Promise.all(
      reposWithGithub.map((repo) =>
        githubClient
          .listMilestones(repo, 'open')
          .then((ms) => [repo, ms] as const)
          .catch(() => [repo, []] as const),
      ),
    ).then((pairs) => {
      if (!cancelled) setMilestonesByRepo(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [githubStatus, githubClient, reposWithGithub]);

  const milestonesByDate = useMemo(() => {
    const map: Record<string, GithubMilestone[]> = {};
    for (const list of Object.values(milestonesByRepo)) {
      for (const m of list) {
        if (!m.dueOn) continue;
        const key = m.dueOn.slice(0, 10);
        (map[key] ??= []).push(m);
      }
    }
    return map;
  }, [milestonesByRepo]);

  const tasksByDueDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of state.tasks) {
      if (t.done || !t.due) continue;
      (map[t.due] ??= []).push(t);
    }
    return map;
  }, [state.tasks]);

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

  function shiftWeek(delta: number) {
    const next = addDays(selected, delta * 7);
    setSelected(next);
    setMonth(yearMonthOf(next));
  }

  function submitEvent() {
    if (!title.trim()) return;
    store.addEvent({ date: selected, title, time: time || null, projectId, recurrence });
    setTitle('');
    setTime('');
    setProjectId(null);
    setRecurrence('none');
  }

  const rangeStart = view === 'week' ? weekDates(selected)[0]! : dateKeyFrom(year, monthNum, 1);
  const rangeEnd = view === 'week' ? weekDates(selected)[6]! : dateKeyFrom(year, monthNum, total);
  const expandedEvents = useMemo(
    () => occurrencesInRange(state.events, rangeStart, rangeEnd),
    [state.events, rangeStart, rangeEnd],
  );

  function dayCell(key: string, label: number) {
    const has = (expandedEvents[key]?.length ?? 0) > 0;
    const hasMilestone = (milestonesByDate[key]?.length ?? 0) > 0;
    const hasTask = (tasksByDueDate[key]?.length ?? 0) > 0;
    const isToday = key === today;
    const isSelected = key === selected;
    return (
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
          <Text style={{ color: isToday ? theme.accent : theme.inkSoft, fontSize: 12, fontWeight: isToday ? '700' : '400' }}>{label}</Text>
          <View style={styles.dotsRow}>
            {has && <View style={[styles.dot, { backgroundColor: theme.accent }]} />}
            {hasMilestone && <View style={[styles.dot, { backgroundColor: theme.warning }]} />}
            {hasTask && <View style={[styles.dot, styles.dotTask, { backgroundColor: theme.danger }]} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const cells: React.ReactElement[] = [];
  if (view === 'week') {
    for (const key of weekDates(selected)) cells.push(dayCell(key, Number(key.slice(-2))));
  } else {
    for (let i = 0; i < startDow; i++) cells.push(<View key={`e${i}`} style={{ width: CELL_WIDTH, aspectRatio: 1 }} />);
    for (let d = 1; d <= total; d++) cells.push(dayCell(dateKeyFrom(year, monthNum, d), d));
  }

  const selectedEvents = expandedEvents[selected] ?? [];
  const selectedMilestones = milestonesByDate[selected] ?? [];
  const selectedTasks = tasksByDueDate[selected] ?? [];

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.viewToggle}>
          <Chip label="Month" selected={view === 'month'} onPress={() => setView('month')} />
          <Chip label="Week" selected={view === 'week'} onPress={() => setView('week')} />
        </View>
        <View style={styles.calHead}>
          <TouchableOpacity onPress={() => (view === 'week' ? shiftWeek(-1) : shiftMonth(-1))}><Text style={{ color: theme.inkSoft }}>← Prev</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => { setSelected(today); setMonth(yearMonthOf(today)); }}>
            <Text style={{ color: theme.ink, fontWeight: '600' }}>{view === 'week' ? weekLabel(weekDates(selected)) : monthLabel(month)}</Text>
            {month !== yearMonthOf(today) && <Text style={{ color: theme.accent, fontSize: 11, textAlign: 'center' }}>Jump to today</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => (view === 'week' ? shiftWeek(1) : shiftMonth(1))}><Text style={{ color: theme.inkSoft }}>Next →</Text></TouchableOpacity>
        </View>
        <View style={styles.dowRow}>
          {(view === 'week' ? DOW_WEEK : DOW_MONTH).map((d, i) => (
            <Text key={i} style={[styles.dow, { color: theme.inkFaint, width: CELL_WIDTH }]}>{d}</Text>
          ))}
        </View>
        <View style={styles.grid}>{cells}</View>
      </Card>

      <Card>
        <Text style={{ color: theme.inkSoft, fontSize: 12, marginBottom: 8 }}>{fmtLong(selected)}</Text>
        {selectedMilestones.map((m) => (
          <View key={m.id} style={[styles.eventRow, { borderBottomColor: theme.border }]}>
            <Text style={{ color: theme.ink, flex: 1 }}>🎯 {m.title}</Text>
            <Pill label="milestone" tone="warning" />
          </View>
        ))}
        {selectedTasks.map((t) => (
          <View key={t.id} style={[styles.eventRow, { borderBottomColor: theme.border }]}>
            <Text style={{ color: theme.ink, flex: 1 }}>{t.text}</Text>
            <Pill label="task" tone="danger" />
          </View>
        ))}
        {selectedEvents.length === 0 && selectedMilestones.length === 0 && selectedTasks.length === 0 && (
          <Text style={{ color: theme.inkFaint }}>No events yet.</Text>
        )}
        {selectedEvents.map((ev) => {
          const evProject = projectOf(ev.projectId);
          return (
            <View key={ev.id} style={[styles.eventRow, { borderBottomColor: theme.border }]}>
              <Text style={{ color: theme.ink, flex: 1 }}>{ev.title}</Text>
              {ev.recurrence !== 'none' && <Pill label={ev.recurrence} tone="accent" />}
              {evProject && <Pill label={evProject.name} />}
              {ev.time && <Text style={{ color: theme.inkFaint, fontSize: 12, marginHorizontal: 8 }}>{ev.time}</Text>}
              <TouchableOpacity onPress={() => store.deleteEvent(ev.originalDate, ev.id)} hitSlop={8}>
                <Text style={{ color: theme.inkFaint, fontSize: 16 }}>×</Text>
              </TouchableOpacity>
            </View>
          );
        })}
        {state.projects.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            <Chip label="No project" selected={projectId === null} onPress={() => setProjectId(null)} />
            {state.projects.map((p) => (
              <Chip key={p.id} label={p.name} selected={projectId === p.id} onPress={() => setProjectId(p.id)} />
            ))}
          </ScrollView>
        )}
        <View style={[styles.viewToggle, { marginTop: 8 }]}>
          {RECURRENCE_OPTIONS.map((opt) => (
            <Chip key={opt} label={opt === 'none' ? 'None' : opt[0]!.toUpperCase() + opt.slice(1)} selected={recurrence === opt} onPress={() => setRecurrence(opt)} />
          ))}
        </View>
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
  viewToggle: { flexDirection: 'row', marginBottom: 10 },
  calHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dowRow: { flexDirection: 'row' },
  dow: { textAlign: 'center', fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { flex: 1, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', margin: 1 },
  dotsRow: { position: 'absolute', bottom: 3, flexDirection: 'row', gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotTask: { width: 6, height: 6, borderRadius: 3 },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  addRow: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 8 },
  addButton: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  chipsScroll: { marginTop: 8 },
});
