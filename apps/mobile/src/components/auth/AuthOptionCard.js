import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

const SCALES = {
  sm: { circle: 36, glyph: 18, gap: 14, paddingVertical: 12, paddingHorizontal: 14, titleSize: 14, titleWeight: '600', bodySize: 12, bodyMarginTop: 1 },
  md: { circle: 44, glyph: 22, gap: 14, paddingVertical: 18, paddingHorizontal: 18, titleSize: 16, titleWeight: '700', bodySize: 13, bodyMarginTop: 2 },
  lg: { circle: 48, glyph: 24, gap: 16, paddingVertical: 20, paddingHorizontal: 20, titleSize: 16, titleWeight: '700', bodySize: 13, bodyMarginTop: 2 },
};

/**
 * Icon-circle + title + body row used across the landing screen, the
 * role-select step, and the employment step. Pass `onPress` to render it as
 * a pressable card with a trailing chevron; omit it for a static row.
 */
export function AuthOptionCard({ icon, title, body, onPress, showChevron, scale = 'md', variant = 'card', c, style }) {
  const filled = variant === 'filled';
  const chevron = showChevron ?? Boolean(onPress);
  const s = SCALES[scale];

  const baseStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.gap,
    backgroundColor: filled ? c.primary : c.card,
    borderRadius: 16,
    borderWidth: filled ? 0 : 1,
    borderColor: c.border,
    paddingVertical: s.paddingVertical,
    paddingHorizontal: s.paddingHorizontal,
  };

  const content = (
    <>
      <View
        style={{
          width: s.circle,
          height: s.circle,
          borderRadius: s.circle / 2,
          backgroundColor: filled ? 'rgba(255,255,255,0.15)' : c.primaryBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={s.glyph} color={filled ? '#FFFFFF' : c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: s.titleSize, fontWeight: s.titleWeight, color: filled ? '#FFFFFF' : c.text }}>
          {title}
        </Text>
        {body ? (
          <Text
            style={{
              fontSize: s.bodySize,
              color: filled ? 'rgba(255,255,255,0.75)' : c.muted,
              marginTop: s.bodyMarginTop,
              lineHeight: s.bodySize + 5,
            }}
          >
            {body}
          </Text>
        ) : null}
      </View>
      {chevron ? <Ionicons name="chevron-forward" size={20} color={filled ? 'rgba(255,255,255,0.75)' : c.muted} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={[baseStyle, style]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [baseStyle, { opacity: pressed ? (filled ? 0.8 : 0.7) : 1 }, style]}
    >
      {content}
    </Pressable>
  );
}
