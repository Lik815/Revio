import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/use-theme';
import { RADIUS, SHADOW, SPACE } from '../utils/app-utils';
import { TAB_ICON_BY_ROUTE, TAB_TRANSLATION_KEYS } from './tab-config';
import { translations } from '../i18n/translations';

const PILL_SIZE = 44;

export function CustomTabBar({ state, descriptors, navigation }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const t = translations.de;

  const [rowWidth, setRowWidth] = useState(0);
  const itemWidth = rowWidth / state.routes.length;
  const pillX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!itemWidth) return;
    const toValue = state.index * itemWidth + (itemWidth - PILL_SIZE) / 2;
    Animated.spring(pillX, {
      toValue,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [state.index, itemWidth]);

  return (
    <View style={{ backgroundColor: c.background, paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: insets.bottom + SPACE.sm }}>
      <View
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.nav,
          borderRadius: RADIUS.lg,
          paddingVertical: SPACE.sm,
          ...SHADOW.modal,
        }}
      >
        {rowWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '50%',
              marginTop: -PILL_SIZE / 2,
              left: 0,
              width: PILL_SIZE,
              height: PILL_SIZE,
              borderRadius: RADIUS.md,
              backgroundColor: c.primary,
              transform: [{ translateX: pillX }],
            }}
          />
        )}

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
              <View style={{ width: PILL_SIZE, height: PILL_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={iconName} size={focused ? 24 : 20} color={focused ? '#FFFFFF' : (c.textMuted ?? c.muted)} />
              </View>
              {!focused && (
                <Text numberOfLines={1} style={{ fontSize: 11, color: c.textMuted ?? c.muted, marginTop: -SPACE.xs }}>{label}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
