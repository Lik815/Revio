import React from 'react';
import { Pressable, Text, View, useColorScheme } from 'react-native';
import { COLORS, RADIUS, SHADOW, SPACE, TYPE } from '../../mobile-utils';
import { translations } from '../../mobile-translations';
import { appStoreSelectors, useAppStore } from '../../store/useStore';

function usePalette() {
  const systemScheme = useColorScheme();
  const themePreference = useAppStore(appStoreSelectors.themePreference);
  const mode = themePreference === 'system' ? systemScheme : themePreference;
  return COLORS[mode === 'dark' ? 'dark' : 'light'];
}

export function ScaffoldScreen({
  ctaLabel,
  description,
  onPress,
  title,
}) {
  const palette = usePalette();
  const locale = useAppStore(appStoreSelectors.locale);
  const t = translations[locale] ?? translations.de;

  return (
    <View
      style={{
        flex: 1,
        padding: SPACE.xl,
        justifyContent: 'center',
        backgroundColor: palette.background,
      }}
    >
      <View
        style={{
          borderRadius: RADIUS.lg,
          padding: SPACE.xl,
          gap: SPACE.md,
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.border,
          ...SHADOW.card,
        }}
      >
        <Text style={{ ...TYPE.xl, color: palette.text }}>{title}</Text>
        <Text style={{ ...TYPE.body, color: palette.textMuted ?? palette.muted }}>
          {description}
        </Text>
        <Text style={{ ...TYPE.meta, color: palette.primary }}>
          {t.comingSoon}
        </Text>
        {onPress ? (
          <Pressable
            onPress={onPress}
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: SPACE.lg,
              paddingVertical: SPACE.md,
              borderRadius: RADIUS.full,
              backgroundColor: palette.primary,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
              {ctaLabel ?? t.doneBtn}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
