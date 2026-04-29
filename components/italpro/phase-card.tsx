import { Text, View } from 'react-native';

import type { LearningPhase } from '@/data/italpro';

type PhaseCardProps = {
  phase: LearningPhase;
};

export function PhaseCard({ phase }: PhaseCardProps) {
  const percent = Math.round(phase.progress * 100);

  return (
    <View
      accessibilityLabel={`${phase.title}, progression ${percent} pour cent`}
      style={{
        gap: 14,
        borderRadius: 28,
        borderCurve: 'continuous',
        backgroundColor: '#ffffff',
        padding: 18,
        boxShadow: '0 16px 40px rgba(15, 23, 42, 0.10)',
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text selectable style={{ color: '#64748b', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>
            {phase.weeks}
          </Text>
          <Text selectable style={{ color: '#0f172a', fontSize: 20, fontWeight: '900' }}>
            {phase.title}
          </Text>
        </View>
        <Text selectable style={{ color: phase.accentColor, fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
          {percent}%
        </Text>
      </View>
      <Text selectable style={{ color: '#475569', fontSize: 14, lineHeight: 20 }}>
        {phase.goal}
      </Text>
      <View style={{ height: 8, overflow: 'hidden', borderRadius: 99, backgroundColor: '#e2e8f0' }}>
        <View style={{ width: `${percent}%`, height: '100%', borderRadius: 99, backgroundColor: phase.accentColor }} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {phase.lessons.map((lesson) => (
          <Text
            key={lesson}
            selectable
            style={{
              borderRadius: 999,
              overflow: 'hidden',
              backgroundColor: '#f1f5f9',
              paddingHorizontal: 10,
              paddingVertical: 6,
              color: '#334155',
              fontSize: 12,
              fontWeight: '700',
            }}>
            {lesson}
          </Text>
        ))}
      </View>
    </View>
  );
}
