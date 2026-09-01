import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { sortIdeasByRecency, AnthropicClient, AnthropicApiError, buildRiffPrompt } from '@moonlight/core';
import type { Idea, IdeaStatus } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import { anthropicSecretStore } from '../store/secureStore';
import Card from '../components/Card';
import Chip from '../components/Chip';

const STATUSES: IdeaStatus[] = ['raw', 'exploring', 'parked', 'shipped'];
const FILTERS: Array<IdeaStatus | 'all'> = ['all', ...STATUSES];

function IdeaLinks({
  links,
  onAdd,
  onRemove,
}: {
  links: string[];
  onAdd: (url: string) => void;
  onRemove: (url: string) => void;
}): React.ReactElement {
  const theme = useTheme();
  const [url, setUrl] = useState('');

  function submit(): void {
    if (!url.trim()) return;
    onAdd(url);
    setUrl('');
  }

  return (
    <View style={styles.links}>
      {links.map((link, i) => (
        <View key={`${link}-${i}`} style={styles.linkRow}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => void Linking.openURL(link).catch(() => {})}>
            <Text style={{ color: theme.accent, fontSize: 11 }} numberOfLines={1}>
              {link}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onRemove(link)} hitSlop={8}>
            <Text style={{ color: theme.inkFaint, fontSize: 13 }}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
      <View style={styles.linkAddRow}>
        <TextInput
          style={[styles.linkInput, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
          placeholder="Add a reference link…"
          placeholderTextColor={theme.inkFaint}
          value={url}
          onChangeText={setUrl}
          onSubmitEditing={submit}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
        />
        <TouchableOpacity onPress={submit} hitSlop={8}>
          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function IdeasScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const theme = useTheme();
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const [riffing, setRiffing] = useState<string | null>(null);
  const [riffError, setRiffError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<IdeaStatus | 'all'>('all');
  const [tagQuery, setTagQuery] = useState('');

  useEffect(() => {
    void anthropicSecretStore.has().then(setHasKey);
  }, []);

  function submit() {
    if (!text.trim()) return;
    store.addIdea({ text, tag: tag || null });
    setText('');
    setTag('');
  }

  async function riff(ideaId: string) {
    const idea = state.ideas.find((i) => i.id === ideaId);
    if (!idea) return;
    setRiffing(ideaId);
    setRiffError(null);
    try {
      const apiKey = await anthropicSecretStore.get();
      if (!apiKey) throw new Error('No Anthropic API key connected.');
      const client = new AnthropicClient(apiKey);
      const result = await client.complete(buildRiffPrompt(idea.text, idea.tag));
      store.setIdeaRiff(ideaId, result.trim());
    } catch (err) {
      if (err instanceof AnthropicApiError && err.status === 401) {
        setRiffError('That Anthropic API key was rejected. Check it in Settings.');
      } else {
        setRiffError(err instanceof Error ? err.message : 'Could not reach Claude right now.');
      }
    } finally {
      setRiffing(null);
    }
  }

  const active = state.ideas.filter((idea) => !idea.archived);
  const archived = state.ideas.filter((idea) => idea.archived);

  const sorted = sortIdeasByRecency(active)
    .filter(
      (idea) =>
        (filter === 'all' || idea.status === filter) &&
        (!tagQuery.trim() || (idea.tag ?? '').toLowerCase().includes(tagQuery.trim().toLowerCase()))
    )
    .sort((a, b) => Number(b.starred) - Number(a.starred));

  function convertToTask(idea: Idea) {
    store.addTask({ text: idea.text });
    store.setIdeaStatus(idea.id, 'shipped');
  }

  function convertToProject(idea: Idea) {
    store.addProject({ name: idea.text });
    store.setIdeaStatus(idea.id, 'shipped');
  }

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      {hasKey === false && (
        <Card style={{ borderColor: theme.warning }}>
          <Text style={{ color: theme.inkSoft, fontSize: 13 }}>
            Connect an Anthropic API key in Settings to enable &ldquo;Ask Claude to riff&rdquo; on your ideas.
          </Text>
        </Card>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
        {FILTERS.map((f) => (
          <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>

      <TextInput
        style={[styles.tagInput, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
        placeholder="Search by tag…"
        placeholderTextColor={theme.inkFaint}
        value={tagQuery}
        onChangeText={setTagQuery}
      />

      <Card>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
          placeholder="Capture the idea…"
          placeholderTextColor={theme.inkFaint}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TextInput
          style={[styles.tagInput, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface2 }]}
          placeholder="Tag (optional)"
          placeholderTextColor={theme.inkFaint}
          value={tag}
          onChangeText={setTag}
        />
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.accent }]} onPress={submit}>
          <Text style={{ color: theme.accentInk, fontWeight: '600' }}>Add idea</Text>
        </TouchableOpacity>
      </Card>

      {sorted.length === 0 && (
        <Text style={{ color: theme.inkFaint, paddingHorizontal: 4 }}>
          {active.length === 0 ? 'No ideas yet. Drop one above.' : 'No ideas match your filters.'}
        </Text>
      )}

      {sorted.map((idea) => (
        <Card key={idea.id}>
          <View style={styles.ideaHead}>
            <TouchableOpacity onPress={() => store.toggleIdeaStar(idea.id)} hitSlop={8}>
              <Text style={{ color: idea.starred ? theme.accent : theme.inkFaint, fontSize: 16, marginRight: 6 }}>
                {idea.starred ? '★' : '☆'}
              </Text>
            </TouchableOpacity>
            <Text style={{ color: theme.ink, flex: 1 }}>{idea.text}</Text>
            <TouchableOpacity onPress={() => store.setIdeaArchived(idea.id, true)} hitSlop={8} style={{ marginRight: 14 }}>
              <Text style={{ color: theme.inkFaint, fontSize: 12 }}>Archive</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => store.deleteIdea(idea.id)} hitSlop={8}>
              <Text style={{ color: theme.inkFaint, fontSize: 18 }}>×</Text>
            </TouchableOpacity>
          </View>
          {idea.tag && <Text style={{ color: theme.inkFaint, fontSize: 11, marginBottom: 4 }}>{idea.tag}</Text>}
          <View style={styles.chipsRow}>
            {STATUSES.map((s) => (
              <Chip key={s} label={s} selected={idea.status === s} onPress={() => store.setIdeaStatus(idea.id, s)} />
            ))}
          </View>
          <View style={styles.chipsRow}>
            <TouchableOpacity onPress={() => convertToTask(idea)}>
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>→ Task</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => convertToProject(idea)} style={{ marginLeft: 14 }}>
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>→ Project</Text>
            </TouchableOpacity>
          </View>
          <IdeaLinks
            links={idea.links ?? []}
            onAdd={(url) => store.addIdeaLink(idea.id, url)}
            onRemove={(url) => store.removeIdeaLink(idea.id, url)}
          />
          {idea.riff && (
            <View style={[styles.riff, { backgroundColor: theme.surface2, borderColor: theme.accent }]}>
              <Text style={{ color: theme.inkFaint, fontSize: 10, marginBottom: 3, letterSpacing: 0.4 }}>CLAUDE RIFFED</Text>
              <Text style={{ color: theme.inkSoft, fontSize: 13 }}>{idea.riff}</Text>
            </View>
          )}
          {hasKey && (
            <TouchableOpacity onPress={() => riff(idea.id)} disabled={riffing === idea.id} style={{ marginTop: 8 }}>
              <Text style={{ color: theme.accent, fontWeight: '600', fontSize: 13 }}>
                {riffing === idea.id ? 'Thinking…' : idea.riff ? 'Riff again' : 'Ask Claude to riff'}
              </Text>
            </TouchableOpacity>
          )}
          {riffError && riffing === null && (
            <Text style={{ color: theme.danger, fontSize: 12, marginTop: 4 }}>{riffError}</Text>
          )}
        </Card>
      ))}

      {archived.length > 0 && (
        <View style={styles.archivedSection}>
          <Text style={[styles.archivedLabel, { color: theme.inkFaint }]}>Archived ({archived.length})</Text>
          {archived.map((idea) => (
            <View key={idea.id} style={[styles.archivedRow, { borderColor: theme.border }]}>
              <Text style={{ color: theme.inkSoft, flex: 1 }}>{idea.text}</Text>
              <TouchableOpacity onPress={() => store.setIdeaArchived(idea.id, false)} hitSlop={8}>
                <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>Restore</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => store.deleteIdea(idea.id)} hitSlop={8} style={{ marginLeft: 14 }}>
                <Text style={{ color: theme.inkFaint, fontSize: 16 }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, minHeight: 60, marginBottom: 8, textAlignVertical: 'top' },
  tagInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, marginBottom: 10 },
  button: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  ideaHead: { flexDirection: 'row', alignItems: 'flex-start' },
  riff: { borderRadius: 8, borderLeftWidth: 2, padding: 10, marginTop: 6 },
  links: { gap: 3, marginTop: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkAddRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkInput: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12 },
  chipsScroll: { marginBottom: 10 },
  chipsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  archivedSection: { marginTop: 8 },
  archivedLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, paddingHorizontal: 4 },
  archivedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
});
