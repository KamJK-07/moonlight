import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { sortIdeasByRecency, AnthropicClient, AnthropicApiError, buildRiffPrompt } from '@moonlight/core';
import { useWorklight, useTheme } from '../store/WorklightContext';
import { anthropicSecretStore } from '../store/secureStore';
import Card from '../components/Card';

export default function IdeasScreen(): React.ReactElement {
  const { state, store } = useWorklight();
  const theme = useTheme();
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const [riffing, setRiffing] = useState<string | null>(null);
  const [riffError, setRiffError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

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

  const sorted = sortIdeasByRecency(state.ideas);

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      {hasKey === false && (
        <Card style={{ borderColor: theme.warning }}>
          <Text style={{ color: theme.inkSoft, fontSize: 13 }}>
            Connect an Anthropic API key in Settings to enable &ldquo;Ask Claude to riff&rdquo; on your ideas.
          </Text>
        </Card>
      )}

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

      {sorted.length === 0 && <Text style={{ color: theme.inkFaint, paddingHorizontal: 4 }}>No ideas yet. Drop one above.</Text>}

      {sorted.map((idea) => (
        <Card key={idea.id}>
          <View style={styles.ideaHead}>
            <Text style={{ color: theme.ink, flex: 1 }}>{idea.text}</Text>
            <TouchableOpacity onPress={() => store.deleteIdea(idea.id)} hitSlop={8}>
              <Text style={{ color: theme.inkFaint, fontSize: 18 }}>×</Text>
            </TouchableOpacity>
          </View>
          {idea.tag && <Text style={{ color: theme.inkFaint, fontSize: 11, marginBottom: 4 }}>{idea.tag}</Text>}
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
});
