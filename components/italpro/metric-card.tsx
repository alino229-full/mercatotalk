import { Text, View } from 'react-native';

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  tint: string;
};

export function MetricCard({ label, value, detail, tint }: MetricCardProps) {
  return (
    <View
      accessibilityRole="summary"
      style={{
        flex: 1,
        minWidth: 148,
        gap: 8,
        borderRadius: 24,
        borderCurve: 'continuous',
        backgroundColor: '#111827',
        padding: 16,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.18)',
      }}>
      <Text selectable style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text selectable style={{ color: tint, fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text selectable style={{ color: '#d1d5db', fontSize: 13, lineHeight: 18 }}>
        {detail}
      </Text>
    </View>
  );
}
