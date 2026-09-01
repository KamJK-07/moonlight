import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GithubActivityItem } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import { useGithub } from '../store/useGithub';
import type { MoreStackParamList } from '../navigation/RootNavigator';

const ITEMS: Array<{ route: keyof MoreStackParamList; label: string; hint: string }> = [
  { route: 'Log', label: 'Progress log', hint: 'Your dated running journal' },
  { route: 'Ideas', label: 'Creative hub', hint: 'Capture ideas, ask Claude to riff' },
  { route: 'Github', label: 'GitHub', hint: 'Activity feed, issue sync' },
  { route: 'Settings', label: 'Settings', hint: 'Theme, Claude key, backups' },
];

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>;

export default function MoreScreen({ navigation }: Props): React.ReactElement {
  const theme = useTheme();
  const { state } = useWorklight();
  const { status: githubStatus, client: githubClient } = useGithub();
  const [githubActivity, setGithubActivity] = useState<GithubActivityItem[] | null>(null);

  useEffect(() => {
    if (githubStatus === 'connected' && githubClient && state.settings.linkedRepos.length > 0) {
      void githubClient
        .fetchActivityFeed(state.settings.linkedRepos)
        .then(setGithubActivity)
        .catch(() => setGithubActivity([]));
    }
  }, [githubStatus, githubClient, state.settings.linkedRepos]);

  const hasNewGithubActivity =
    githubStatus === 'connected' &&
    state.settings.linkedRepos.length > 0 &&
    (githubActivity ?? []).some(
      (item) => state.settings.githubActivitySeenAt === null || item.date > state.settings.githubActivitySeenAt,
    );

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      {ITEMS.map((item) => (
        <TouchableOpacity
          key={item.route}
          onPress={() => navigation.navigate(item.route)}
          style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: theme.ink }]}>{item.label}</Text>
            <Text style={{ color: theme.inkFaint, fontSize: 12 }}>{item.hint}</Text>
          </View>
          {item.route === 'Ideas' && state.ideas.length > 0 && (
            <Text style={{ color: theme.inkFaint, fontSize: 12 }}>{state.ideas.length}</Text>
          )}
          {item.route === 'Github' && hasNewGithubActivity && (
            <View style={[styles.dot, { backgroundColor: theme.accent }]} />
          )}
          <Text style={{ color: theme.inkFaint, marginLeft: 8 }}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
