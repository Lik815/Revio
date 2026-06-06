import React from 'react';
import { Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/app-utils';

const DEFAULT_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

export function HeartButton({
  isSaved,
  onToggle,
  size = 22,
  savedColor = COLORS.light.saved,
  unsavedColor = COLORS.light.muted,
  hitSlop = DEFAULT_HIT_SLOP,
  style = undefined,
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    const willSave = !isSaved;
    onToggle();
    if (willSave) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.45, useNativeDriver: true, speed: 40, bounciness: 12 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }),
      ]).start();
    }
  };

  return (
    <Pressable onPress={handlePress} hitSlop={hitSlop} style={style}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={isSaved ? 'heart' : 'heart-outline'}
          size={size}
          color={isSaved ? savedColor : unsavedColor}
        />
      </Animated.View>
    </Pressable>
  );
}
