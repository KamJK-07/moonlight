import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import type { GithubActivityItem, GithubIssueSummary, GithubRepoSummary } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import { useGithub } from '../store/useGithub';
import Card from '../components/Card';
import Pill from '../components/Pill';

export default function GithubScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const theme = useTheme();
  const { status, login, error, client, connect, disconnect } = useGithub();
  const [tokenInput, setTokenInput] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [repos, setRepos] = useState<GithubRepoSummary[] | null>(null);
  const [activity, setActivity] = useState<GithubActivityItem[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [openIssues, setOpenIssues] = useState<GithubIssueSummary[] | null>(null);
  const [issueRepo, setIssueRepo] = useState('');
  const [issueTitle, setIssueTitle] = useState('');
  const [creatingIssue, setCreatingIssue] = useState(false);

  useEffect(() => {
    if (status === 'connected' && client) {
      void client.listRepos().then(setRepos).catch(() => setRepos([]));
    }
  }, [status, client]);

  useEffect(() => {
    if (state.settings.linkedRepos.length && !issueRepo) setIssueRepo(state.settings.linkedRepos[0] ?? '');
  }, [state.settings.linkedRepos, issueRepo]);

  async function handleConnect() {
    setConnectError(null);
    try {
      await connect(tokenInput.trim());
      setTokenInput('');
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Could not connect.');
    }
  }

  function toggleRepo(fullName: string) {
    const linked = state.settings.linkedRepos;
    store.setLinkedRepos(linked.includes(fullName) ? linked.filter((r) => r !== fullName) : [...linked, fullName]);
  }

  async function refreshActivity() {
    if (!client || state.settings.linkedRepos.length === 0) return;
    setActivityLoading(true);
    try {
      setActivity(await client.fetchActivityFeed(state.settings.linkedRepos));
    } finally {
      setActivityLoading(false);
    }
  }

  async function loadOpenIssues(repo: string) {
    if (!client) return;
    setOpenIssues(await client.listIssues(repo, 'open'));
  }

  async function createIssue() {
    if (!client || !issueRepo || !issueTitle.trim()) return;
    setCreatingIssue(true);
    try {
      await client.createIssue(issueRepo, issueTitle.trim());
      setIssueTitle('');
      void loadOpenIssues(issueRepo);
    } finally {
      setCreatingIssue(false);
    }
  }

  function importIssue(repo: string, issue: GithubIssueSummary) {
    const [owner, repoName] = repo.split('/');
    const created = store.addTask({ text: issue.title });
    if (owner && repoName) {
      store.updateTask(created.id, {
        githubIssue: { owner, repo: repoName, number: issue.number, url: issue.url, state: issue.state },
      });
    }
  }

  if (status === 'checking') {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.inkFaint }}>Checking GitHub connection…</Text>
      </View>
    );
  }

  if (status !== 'connected') {
    return (
      <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
        <Card>
          <Text style={[styles.title, { color: theme.ink }]}>Connect GitHub</Text>
          <Text style={{ color: theme.inkSoft, fontSize: 13, marginBottom: 10 }}>
            Paste a personal access token (fine-grained, with repo Contents + Issues read/write, or a
            classic token with the repo scope). It stays on this device.
          </Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
            placeholder="ghp_…"
            placeholderTextColor={theme.inkFaint}
            value={tokenInput}
            onChangeText={setTokenInput}
            secureTextEntry
            autoCapitalize="none"
          />
          <TouchableOpacity style={[styles.button, { backgroundColor: theme.accent }]} onPress={handleConnect}>
            <Text style={{ color: theme.accentInk, fontWeight: '600' }}>Connect</Text>
          </TouchableOpacity>
          {(connectError || error) && <Text style={{ color: theme.danger, fontSize: 12, marginTop: 8 }}>{connectError ?? error}</Text>}
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: theme.success }]} />
        <Text style={{ color: theme.ink }}>
          Connected as <Text style={{ fontWeight: '700' }}>{login}</Text>
        </Text>
        <TouchableOpacity onPress={() => void disconnect()} style={{ marginLeft: 'auto' }}>
          <Text style={{ color: theme.inkFaint }}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      <Card>
        <Text style={[styles.title, { color: theme.ink }]}>Linked repositories</Text>
        {repos === null && <Text style={{ color: theme.inkFaint }}>Loading…</Text>}
        {(repos ?? []).slice(0, 20).map((r) => (
          <View key={r.fullName} style={[styles.row, { borderBottomColor: theme.border }]}>
            <Text style={{ color: theme.ink, flex: 1 }} numberOfLines={1}>{r.fullName}</Text>
            <Switch value={state.settings.linkedRepos.includes(r.fullName)} onValueChange={() => toggleRepo(r.fullName)} />
          </View>
        ))}
      </Card>

      <Card>
        <Text style={[styles.title, { color: theme.ink }]}>Recent activity</Text>
        <TouchableOpacity onPress={() => void refreshActivity()} disabled={activityLoading}>
          <Text style={{ color: theme.accent, fontWeight: '600' }}>{activityLoading ? 'Loading…' : 'Refresh activity'}</Text>
        </TouchableOpacity>
        {activity?.slice(0, 15).map((item) => (
          <View key={`${item.type}-${item.id}`} style={[styles.row, { borderBottomColor: theme.border }]}>
            <Pill label={item.type === 'commit' ? 'commit' : item.state ?? 'pr'} />
            <Text style={{ color: theme.ink, flex: 1, marginLeft: 8 }} numberOfLines={1}>{item.title}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={[styles.title, { color: theme.ink }]}>Create an issue</Text>
        <Text style={{ color: theme.inkFaint, fontSize: 12, marginBottom: 8 }}>
          In {issueRepo || 'no linked repo selected'}
        </Text>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.smallInput, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
            placeholder="Issue title"
            placeholderTextColor={theme.inkFaint}
            value={issueTitle}
            onChangeText={setIssueTitle}
          />
          <TouchableOpacity
            onPress={() => void createIssue()}
            disabled={!issueRepo || creatingIssue}
            style={[styles.createButton, { backgroundColor: theme.accent, opacity: !issueRepo || creatingIssue ? 0.5 : 1 }]}
          >
            <Text style={{ color: theme.accentInk, fontWeight: '600' }}>{creatingIssue ? '…' : 'Create'}</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Card>
        <Text style={[styles.title, { color: theme.ink }]}>Open issues → import as tasks</Text>
        <TouchableOpacity onPress={() => issueRepo && void loadOpenIssues(issueRepo)}>
          <Text style={{ color: theme.accent, fontWeight: '600' }}>Load open issues for {issueRepo || 'linked repo'}</Text>
        </TouchableOpacity>
        {openIssues?.map((issue) => (
          <View key={issue.number} style={[styles.row, { borderBottomColor: theme.border }]}>
            <Text style={{ color: theme.ink, flex: 1 }} numberOfLines={1}>#{issue.number} {issue.title}</Text>
            <TouchableOpacity onPress={() => importIssue(issueRepo, issue)}>
              <Text style={{ color: theme.accent, fontSize: 12 }}>Import</Text>
            </TouchableOpacity>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, marginBottom: 10 },
  button: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  addRow: { flexDirection: 'row', gap: 8 },
  smallInput: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10 },
  createButton: { borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
});
