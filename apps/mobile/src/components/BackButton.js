import React from 'react';
import { Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TYPE } from '../utils/app-utils';

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * Shared back/cancel control for screens that render their own header
 * (i.e. outside React Navigation's header bar) and therefore need to
 * account for the status bar / notch themselves.
 *
 * By default it applies its own safe-area top offset, so the
 * surrounding container must NOT also add `insets.top` padding —
 * pick exactly one of the two. If the button shares a row with other
 * controls (e.g. favorite/share icons) that need to align with it,
 * pass `topInset={false}` and apply `paddingTop: insets.top + 12` to
 * that row's container instead, so every control shifts down together.
 *
 * Props:
 *   c         — COLORS[scheme] theme object (required)
 *   label     — button text, e.g. 'Zurück' or 'Abbrechen' (required)
 *   onPress   — press handler (required)
 *   topInset  — whether to add the safe-area top offset itself (default true)
 */
export function BackButton({ c, label, onPress, style, topInset = true }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      style={[
        { paddingTop: (topInset ? insets.top : 0) + 12, paddingBottom: 8, paddingHorizontal: 4, alignSelf: 'flex-start' },
        style,
      ]}
    >
      <Text style={[TYPE.body, { fontWeight: '600', color: c.primary }]}>‹ {label}</Text>
    </Pressable>
  );
}
