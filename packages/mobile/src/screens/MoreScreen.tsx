import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useWorklight, useTheme } from '../store/WorklightContext';
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
});
