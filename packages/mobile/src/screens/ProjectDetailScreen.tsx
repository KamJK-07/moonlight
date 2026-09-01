import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { groupTasks, sortLogEntries, tasksForProject, projectProgress } from '@moonlight/core';
import type { GithubActivityItem, ProjectStatus, Task } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import { useGithub } from '../store/useGithub';
import type { ProjectsStackParamList } from '../navigation/RootNavigator';
import Card from '../components/Card';
import Pill from '../components/Pill';
import TaskRow from '../components/TaskRow';

const STATUS_TONE: Record<ProjectStatus, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  paused: 'warning',
  done: 'neutral',
};

function fmtShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type Props = NativeStackScreenProps<ProjectsStackParamList, 'ProjectDetail'>;

export default function ProjectDetailScreen({ route, navigation }: Props): React.ReactElement {
  const { projectId } = route.params;
  const { state, store } = useWorklight();
  const theme = useTheme();
  const { status: githubStatus, client: githubClient } = useGithub();
  const [githubActivity, setGithubActivity] = useState<GithubActivityItem[] | null>(null);
  const [openPrs, setOpenPrs] = useState<GithubActivityItem[] | null>(null);

  const project = state.projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (project) navigation.setOptions({ title: project.name });
  }, [project, navigation]);

  useEffect(() => {
    if (githubStatus === 'connected' && githubClient && project?.githubRepo) {
      const repo = project.githubRepo;
      void githubClient.fetchActivityFeed([repo]).then(setGithubActivity).catch(() => setGithubActivity([]));
      void githubClient.listPullRequests(repo, 'open').then(setOpenPrs).catch(() => setOpenPrs([]));
    }
  }, [githubStatus, githubClient, project?.githubRepo]);

  if (!project) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.inkFaint }}>Project not found.</Text>
      </View>
    );
  }

  const progress = projectProgress(state.tasks, project);
  const projectTasks = tasksForProject(state.tasks, project.id);
  const groups = groupTasks(projectTasks);
  const sections: Array<[string, Task[]]> = [
    ['Overdue', groups.overdue],
    ['Today', groups.dueToday],
    ['Upcoming', groups.upcoming],
    ['No date', groups.noDate],
  ].filter(([, arr]) => arr.length > 0) as Array<[string, Task[]]>;

  const logEntries = sortLogEntries(state.logEntries.filter((e) => e.projectId === project.id));
  const githubReady = githubStatus === 'connected' && !!project.githubRepo;

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.headRow}>
          {project.color && <View style={[styles.colorDot, { backgroundColor: project.color }]} />}
          <Text style={[styles.name, { color: theme.ink }]}>{project.name}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          <Pill label={project.status} tone={STATUS_TONE[project.status]} />
          {project.githubRepo && <Pill label={project.githubRepo} />}
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
        {project.notes ? <Text style={{ color: theme.inkSoft, fontSize: 13, marginTop: 8 }}>{project.notes}</Text> : null}
      </Card>

      {githubReady && (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>Open pull requests</Text>
          {openPrs === null && <Text style={{ color: theme.inkFaint }}>Loading…</Text>}
          {openPrs !== null && openPrs.length === 0 && <Text style={{ color: theme.inkFaint }}>No open PRs.</Text>}
          {openPrs !== null && openPrs.length > 0 && (
            <>
              <Text style={{ color: theme.inkSoft, fontSize: 12, marginBottom: 6 }}>
                {openPrs.length} open PR{openPrs.length === 1 ? '' : 's'}
              </Text>
              {openPrs.map((pr) => (
                <View key={pr.id} style={styles.eventRow}>
                  <Pill label="open" />
                  <Text style={{ color: theme.ink, flex: 1, marginLeft: 8 }} numberOfLines={1}>
                    {pr.title}
                  </Text>
                </View>
              ))}
            </>
          )}
        </Card>
      )}

      {githubReady && (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>GitHub activity</Text>
          {githubActivity === null && <Text style={{ color: theme.inkFaint }}>Loading…</Text>}
          {githubActivity !== null && githubActivity.length === 0 && <Text style={{ color: theme.inkFaint }}>No recent activity.</Text>}
          {(githubActivity ?? []).slice(0, 10).map((item) => (
            <View key={`${item.type}-${item.id}`} style={styles.eventRow}>
              <Pill label={item.type === 'commit' ? 'commit' : item.state ?? 'pr'} />
              <Text style={{ color: theme.ink, flex: 1, marginLeft: 8 }} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Text style={[styles.cardTitle, { color: theme.ink }]}>Tasks</Text>
        {sections.length === 0 && groups.done.length === 0 && (
          <Text style={{ color: theme.inkFaint }}>No tasks for this project.</Text>
        )}
        {sections.map(([label, tasks]) => (
          <View key={label}>
            <Text style={[styles.groupLabel, { color: theme.inkFaint }]}>{label.toUpperCase()}</Text>
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                project={undefined}
                onToggle={(id, done) => store.toggleTask(id, done)}
                onDelete={(id) => store.deleteTask(id)}
                onAddSubtask={(taskId, subtaskText) => store.addSubtask(taskId, subtaskText)}
                onToggleSubtask={(taskId, subtaskId, done) => store.toggleSubtask(taskId, subtaskId, done)}
                onDeleteSubtask={(taskId, subtaskId) => store.deleteSubtask(taskId, subtaskId)}
              />
            ))}
          </View>
        ))}
        {groups.done.length > 0 && (
          <View>
            <Text style={[styles.groupLabel, { color: theme.inkFaint }]}>DONE</Text>
            {groups.done.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                project={undefined}
                onToggle={(id, done) => store.toggleTask(id, done)}
                onDelete={(id) => store.deleteTask(id)}
                onAddSubtask={(taskId, subtaskText) => store.addSubtask(taskId, subtaskText)}
                onToggleSubtask={(taskId, subtaskId, done) => store.toggleSubtask(taskId, subtaskId, done)}
                onDeleteSubtask={(taskId, subtaskId) => store.deleteSubtask(taskId, subtaskId)}
              />
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: theme.ink }]}>Progress log</Text>
        {logEntries.length === 0 && <Text style={{ color: theme.inkFaint }}>No log entries for this project.</Text>}
        {logEntries.map((e) => (
          <View key={e.id} style={[styles.row, { borderBottomColor: theme.border }]}>
            <Pill label={fmtShort(e.date)} />
            <Text style={{ color: theme.ink, flex: 1, marginLeft: 8 }}>{e.text}</Text>
            {e.source === 'github' && <Pill label="github" />}
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  name: { fontSize: 18, fontWeight: '600' },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  track: { height: 6, borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%' },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  eventRow: { flexDirection: 'row', paddingVertical: 6 },
  groupLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginTop: 10, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
