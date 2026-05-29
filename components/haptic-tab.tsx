import { Pressable, type GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';

type HapticTabProps = {
  onPress?: ((e: GestureResponderEvent) => void) | null;
  onPressIn?: ((e: GestureResponderEvent) => void) | null;
  children?: React.ReactNode;
  style?: unknown;
  [key: string]: unknown;
};

export function HapticTab({ onPress, onPressIn, children, style, ...rest }: HapticTabProps) {
  return (
    <Pressable
      {...rest}
      style={style as object}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}
      onPress={onPress ?? undefined}>
      {children}
    </Pressable>
  );
}
