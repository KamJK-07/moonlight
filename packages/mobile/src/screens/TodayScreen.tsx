import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { onDeck, computeStreak, activeProjectCount, todayKey, eventsForDate } from '@moonlight/core';
import type { GithubActivityItem } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import { useGithub } from '../store/useGithub';
import Card from '../components/Card';
import Pill from '../components/Pill';
import TaskRow from '../components/TaskRow';

function Stat({ n, l, warn }: { n: number; l: string; warn?: boolean }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={[stat.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[stat.n, { color: warn && n > 0 ? theme.warning : theme.ink }]}>{n}</Text>
      <Text style={[stat.l, { color: theme.inkSoft }]}>{l}</Text>
    </View>
  );
}
const stat = StyleSheet.create({
  box: { flex: 1, minWidth: 90, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  n: { fontSize: 22, fontWeight: '600' },
  l: { fontSize: 11, marginTop: 2 },
});

export default function TodayScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const theme = useTheme();
  const { status: githubStatus, client: githubClient } = useGithub();
  const [logText, setLogText] = useState('');
  const [githubActivity, setGithubActivity] = useState<GithubActivityItem[] | null>(null);

  const today = todayKey();
  const deck = onDeck(state.tasks, today);
  const streak = computeStreak(state.logEntries, today);
  const todaysEvents = eventsForDate(state.events, today);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const githubReady = githubStatus === 'connected' && state.settings.linkedRepos.length > 0;

  useEffect(() => {
    if (githubStatus === 'connected' && githubClient && state.settings.linkedRepos.length > 0) {
      void githubClient.fetchActivityFeed(state.settings.linkedRepos).then(setGithubActivity).catch(() => setGithubActivity([]));
    }
  }, [githubStatus, githubClient, state.settings.linkedRepos]);

  const todaysGithubActivity = (githubActivity ?? []).filter((item) => item.date.slice(0, 10) === today);
  const commitCount = todaysGithubActivity.filter((item) => item.type === 'commit').length;
  const prCount = todaysGithubActivity.filter((item) => item.type === 'pull_request').length;
  const githubSummary = [
    commitCount > 0 ? `${commitCount} commit${commitCount === 1 ? '' : 's'}` : null,
    prCount > 0 ? `${prCount} PR${prCount === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  function projectOf(id: string | null) {
    return id ? state.projects.find((p) => p.id === id) : undefined;
  }

  function submitLog() {
    if (!logText.trim()) return;
    store.addLogEntry({ text: logText });
    setLogText('');
  }

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.greeting, { color: theme.ink }]}>{greeting}, Kameron.</Text>

      <View style={styles.statRow}>
        <Stat n={deck.filter((t) => t.due === today).length} l="Due today" />
        <Stat n={deck.filter((t) => t.due && t.due < today).length} l="Overdue" warn />
        <Stat n={activeProjectCount(state.projects)} l="Active projects" />
        <Stat n={streak} l="Day streak" />
      </View>

      <Card>
        <Text style={[styles.cardTitle, { color: theme.ink }]}>On deck</Text>
        {deck.length === 0 && <Text style={{ color: theme.inkFaint }}>Nothing due today. Clear runway.</Text>}
        {deck.map((t) => (
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

      {githubReady && (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>GitHub activity</Text>
          <Text style={{ color: theme.inkSoft, marginBottom: todaysGithubActivity.length ? 8 : 0 }}>
            {githubSummary ? `${githubSummary} today` : 'No activity yet today'}
          </Text>
          {todaysGithubActivity.slice(0, 5).map((item) => (
            <View key={`${item.type}-${item.id}`} style={styles.eventRow}>
              <Pill label={item.type === 'commit' ? 'commit' : item.state ?? 'pr'} />
              <Text style={{ color: theme.ink, flex: 1, marginLeft: 8 }} numberOfLines={1}>{item.title}</Text>
            </View>
          ))}
        </Card>
      )}

      {todaysEvents.length > 0 && (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>Today on the calendar</Text>
          {todaysEvents.map((ev) => (
            <View key={ev.id} style={styles.eventRow}>
              <Text style={{ color: theme.ink, flex: 1 }}>{ev.title}</Text>
              {ev.time && <Text style={{ color: theme.inkFaint, fontSize: 12 }}>{ev.time}</Text>}
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Text style={[styles.cardTitle, { color: theme.ink }]}>Log today&rsquo;s progress</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
          placeholder="What did you move forward today?"
          placeholderTextColor={theme.inkFaint}
          value={logText}
          onChangeText={setLogText}
          multiline
        />
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={submitLog}
        >
          <Text style={{ color: theme.accentInk, fontWeight: '600' }}>Add to log</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  greeting: { fontSize: 22, fontWeight: '600', marginBottom: 14 },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  eventRow: { flexDirection: 'row', paddingVertical: 6 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, minHeight: 60, marginBottom: 10, textAlignVertical: 'top' },
  button: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
});
