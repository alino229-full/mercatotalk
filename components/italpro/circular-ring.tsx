import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

interface CircularRingProps {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  trackColor?: string;
  centerColor?: string;
  animDelay?: number;
  children?: React.ReactNode;
}

export function CircularRing({
  size,
  stroke,
  progress,
  color,
  trackColor = '#E5E5E5',
  centerColor = '#FFFFFF',
  animDelay = 100,
  children,
}: CircularRingProps) {
  const anim = useSharedValue(0);
  const half = size / 2;
  const innerSize = size - stroke * 2;
  const innerHalf = innerSize / 2;

  useEffect(() => {
    anim.value = withDelay(
      animDelay,
      withTiming(Math.min(Math.max(progress, 0), 1), { duration: 800 }),
    );
  }, [progress, anim, animDelay]);

  // Right half-disk: rotates from -180° (hidden) to 0° (full) as progress goes 0 → 50%
  const rightStyle = useAnimatedStyle(() => {
    const deg = (Math.min(anim.value * 2, 1) - 1) * 180;
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  // Left half-disk: rotates from -180° (hidden) to 0° (full) as progress goes 50 → 100%
  const leftStyle = useAnimatedStyle(() => {
    const deg = (Math.max(anim.value * 2 - 1, 0) - 1) * 180;
    return {
      transform: [{ rotate: `${deg}deg` }],
      opacity: anim.value >= 0.5 ? 1 : 0,
    };
  });

  return (
    <View style={{ width: size, height: size }}>
      {/* Track: full filled disk in track color (will be hidden behind donut hole except where progress doesn't reach) */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: trackColor, borderRadius: half },
        ]}
      />

      {/* Right half clip — reveals progress 0 → 50% */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: half,
          width: half,
          height: size,
          overflow: 'hidden',
        }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: -half,
              width: size,
              height: size,
              borderRadius: half,
              backgroundColor: color,
            },
            rightStyle,
          ]}
        />
      </View>

      {/* Left half clip — reveals progress 50 → 100% */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: half,
          height: size,
          overflow: 'hidden',
        }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              width: size,
              height: size,
              borderRadius: half,
              backgroundColor: color,
            },
            leftStyle,
          ]}
        />
      </View>

      {/* Inner disk turns the pie into a donut */}
      <View
        style={{
          position: 'absolute',
          top: stroke,
          left: stroke,
          width: innerSize,
          height: innerSize,
          borderRadius: innerHalf,
          backgroundColor: centerColor,
        }}
      />

      {/* Center content */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { alignItems: 'center', justifyContent: 'center' },
        ]}>
        {children}
      </View>
    </View>
  );
}
