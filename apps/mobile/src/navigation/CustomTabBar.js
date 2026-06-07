import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/use-theme';
import { RADIUS, SHADOW, SPACE } from '../utils/app-utils';
import { TAB_ICON_BY_ROUTE, TAB_TRANSLATION_KEYS } from './tab-config';
import { translations } from '../i18n/translations';

export function CustomTabBar({ state, descriptors, navigation }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const t = translations.de;

  return (
    <View style={{ backgroundColor: c.background, paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: insets.bottom + SPACE.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: c.nav,
          borderRadius: RADIUS.lg,
          paddingVertical: SPACE.sm,
          paddingHorizontal: SPACE.sm,
          ...SHADOW.modal,
        }}
      >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const baseIcon = TAB_ICON_BY_ROUTE[route.name] ?? 'ellipse';
        const iconName = focused ? baseIcon : `${baseIcon}-outline`;
        const label = options.title ?? t[TAB_TRANSLATION_KEYS[route.name]] ?? route.name;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={onPress}
            style={{ flex: 1, alignItems: 'center' }}
          >
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: RADIUS.full,
                paddingVertical: focused ? SPACE.sm : SPACE.xs,
                paddingHorizontal: focused ? SPACE.md : SPACE.xs,
                backgroundColor: focused ? c.primary : 'transparent',
              }}
            >
              <Ionicons name={iconName} size={20} color={focused ? '#FFFFFF' : (c.textMuted ?? c.muted)} />
            </View>
            {!focused && (
              <Text numberOfLines={1} style={{ fontSize: 11, color: c.textMuted ?? c.muted, marginTop: SPACE.xs / 2 }}>{label}</Text>
            )}
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}
