import { Text, View } from 'react-native';

import type { CostTier } from '@/data/italpro';

type CostStackCardProps = {
  tier: CostTier;
};

export function CostStackCard({ tier }: CostStackCardProps) {
  return (
    <View
      accessibilityLabel={`${tier.label}, ${tier.monthlyEstimate}`}
      style={{
        gap: 8,
        borderRadius: 22,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: '#dbeafe',
        backgroundColor: '#eff6ff',
        padding: 16,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text selectable style={{ color: '#1e3a8a', fontSize: 16, fontWeight: '900' }}>
          {tier.priority}. {tier.label}
        </Text>
        <Text selectable style={{ color: '#0369a1', fontSize: 12, fontWeight: '900' }}>
          {tier.monthlyEstimate}
        </Text>
      </View>
      <Text selectable style={{ color: '#0f172a', fontSize: 13, fontWeight: '800' }}>
        {tier.provider}
      </Text>
      <Text selectable style={{ color: '#475569', fontSize: 13, lineHeight: 19 }}>
        {tier.usage}
      </Text>
    </View>
  );
}
