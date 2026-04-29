import { Text, View } from 'react-native';

import type { PracticeItem } from '@/data/italpro';

type PracticeRowProps = {
  item: PracticeItem;
};

const costColors: Record<PracticeItem['cost'], string> = {
  gratuit: '#16a34a',
  faible: '#0284c7',
  premium: '#a855f7',
};

export function PracticeRow({ item }: PracticeRowProps) {
  return (
    <View
      accessibilityLabel={`${item.title}, ${item.duration}, cout ${item.cost}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderRadius: 22,
        borderCurve: 'continuous',
        backgroundColor: '#ffffff',
        padding: 14,
      }}>
      <View
        style={{
          height: 48,
          width: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 18,
          backgroundColor: '#0f172a',
        }}>
        <Text selectable style={{ color: '#ffffff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' }}>
          {item.type.slice(0, 2)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text selectable style={{ color: '#0f172a', fontSize: 15, fontWeight: '900' }}>
          {item.title}
        </Text>
        <Text selectable style={{ color: '#64748b', fontSize: 13, lineHeight: 18 }}>
          {item.subtitle}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text selectable style={{ color: '#0f172a', fontSize: 13, fontWeight: '800' }}>
          {item.duration}
        </Text>
        <Text selectable style={{ color: costColors[item.cost], fontSize: 12, fontWeight: '900' }}>
          {item.cost}
        </Text>
      </View>
    </View>
  );
}
