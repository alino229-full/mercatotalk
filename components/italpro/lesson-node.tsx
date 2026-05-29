import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { NodeState } from '@/data/curriculum';

const SIZE = 76;
const DEPTH = 9; // épaisseur 3D (face inférieure)

export type LessonNodeProps = {
  icon: string;
  state: NodeState;
  accentColor: string;
  /** checkpoint = forme losange/coffre, lesson = pastille ronde */
  variant?: 'lesson' | 'checkpoint';
  /** décalage horizontal du chemin sinueux (-1..1) */
  offset?: number;
  showStartBubble?: boolean;
  onPress?: () => void;
};

function shade(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.round(r + (amount < 0 ? r * amount : (255 - r) * amount))));
  g = Math.max(0, Math.min(255, Math.round(g + (amount < 0 ? g * amount : (255 - g) * amount))));
  b = Math.max(0, Math.min(255, Math.round(b + (amount < 0 ? b * amount : (255 - b) * amount))));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function LessonNodeBase({
  icon,
  state,
  accentColor,
  variant = 'lesson',
  offset = 0,
  showStartBubble = false,
  onPress,
}: LessonNodeProps) {
  const press = useSharedValue(0);
  const bob = useSharedValue(0);
  const enter = useSharedValue(0);

  const locked = state === 'locked';
  const completed = state === 'completed';
  const current = state === 'current';

  useEffect(() => {
    enter.value = withSpring(1, { damping: 12, stiffness: 140 });
  }, [enter]);

  useEffect(() => {
    if (current) {
      bob.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      bob.value = withTiming(0, { duration: 200 });
    }
  }, [current, bob]);

  // couleurs selon l'état
  const top = locked ? '#D0D4DC' : completed ? shade(accentColor, 0.12) : accentColor;
  const side = locked ? '#A8ADB8' : shade(accentColor, -0.32);

  const faceStyle = useAnimatedStyle(() => {
    const translateY = interpolate(press.value, [0, 1], [0, DEPTH]) + interpolate(bob.value, [0, 1], [0, -6]);
    return {
      transform: [{ translateY }],
      shadowOpacity: interpolate(press.value, [0, 1], [0.28, 0.1]),
    };
  });

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { scale: interpolate(enter.value, [0, 1], [0.6, 1]) },
      { translateX: offset * 64 },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bob.value, [0, 1], [0.35, 0.9]),
    transform: [{ scale: interpolate(bob.value, [0, 1], [1, 1.12]) }],
  }));

  const radius = variant === 'checkpoint' ? 18 : SIZE / 2;

  return (
    <Animated.View style={[styles.wrap, wrapStyle]}>
      {showStartBubble && current ? <StartBubble color={accentColor} /> : null}

      <View style={styles.stack}>
        {/* halo animé pour le nœud courant */}
        {current ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              { borderColor: accentColor, borderRadius: radius + 12 },
              ringStyle,
            ]}
          />
        ) : null}

        {/* face inférieure (épaisseur 3D) */}
        <View
          style={[
            styles.side,
            { backgroundColor: side, borderRadius: radius },
            variant === 'checkpoint' && styles.checkpointShape,
          ]}
        />

        {/* face supérieure cliquable */}
        <Pressable
          disabled={locked}
          onPressIn={() => {
            press.value = withTiming(1, { duration: 70 });
          }}
          onPressOut={() => {
            press.value = withSpring(0, { damping: 14, stiffness: 320 });
          }}
          onPress={onPress}>
          <Animated.View
            style={[
              styles.face,
              { backgroundColor: top, borderRadius: radius },
              variant === 'checkpoint' && styles.checkpointShape,
              faceStyle,
            ]}>
            <Text style={[styles.icon, locked && styles.iconLocked]}>
              {locked ? '🔒' : completed ? '⭐' : variant === 'checkpoint' ? '🏆' : icon}
            </Text>
          </Animated.View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function StartBubble({ color }: { color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [v]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(v.value, [0, 1], [0, -4]) }],
  }));
  return (
    <Animated.View style={[styles.bubble, style]}>
      <Text style={[styles.bubbleText, { color }]}>COMMENCER</Text>
      <View style={styles.bubbleTail} />
    </Animated.View>
  );
}

export const LessonNode = memo(LessonNodeBase);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    width: SIZE,
    height: SIZE + DEPTH,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  ring: {
    position: 'absolute',
    top: -12,
    left: -12,
    right: -12,
    width: SIZE + 24,
    height: SIZE + 24,
    borderWidth: 4,
  },
  side: {
    position: 'absolute',
    top: DEPTH,
    width: SIZE,
    height: SIZE,
  },
  face: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 8,
    elevation: 6,
  },
  checkpointShape: {
    width: SIZE,
    height: SIZE,
  },
  icon: {
    fontSize: 30,
  },
  iconLocked: {
    fontSize: 24,
    opacity: 0.8,
  },
  bubble: {
    position: 'absolute',
    top: -34,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 4,
  },
  bubbleText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -6,
    width: 12,
    height: 12,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
});
