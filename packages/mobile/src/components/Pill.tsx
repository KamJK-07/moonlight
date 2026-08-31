import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../store/WorklightContext';

type Tone = 'success' | 'warning' | 'neutral' | 'accent' | 'danger';

export default function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }): React.ReactElement {
  const theme = useTheme();
  const toneColors: Record<Tone, { bg: string; fg: string }> = {
    success: { bg: theme.successSoft, fg: theme.success },
    warning: { bg: theme.warningSoft, fg: theme.warning },
    danger: { bg: theme.dangerSoft, fg: theme.danger },
    accent: { bg: theme.accentSoft, fg: theme.ink },
    neutral: { bg: theme.surface2, fg: theme.inkSoft },
  };
  const c = toneColors[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.label, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
});
