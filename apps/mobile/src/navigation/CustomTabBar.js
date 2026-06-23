import React, { useEffect, useRef, useState } from 'react';
import { StackActions } from '@react-navigation/native';
import { Animated, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/use-theme';
import { RADIUS, SHADOW, SPACE } from '../utils/app-utils';
import { TAB_ROUTES } from './route-names';
import { TAB_HOME_ROUTES, TAB_ICON_BY_ROUTE, TAB_TRANSLATION_KEYS } from './tab-config';
import { translations } from '../i18n/translations';

const PILL_SIZE = 44;

export function CustomTabBar({ state, descriptors, navigation, badgeCounts = {} }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const t = translations.de;
  const isGuestTabBar = state.routes.length === 2;
  const guestTabBarWidth = Math.min(360, Math.max(300, width * 0.43));

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
    <View
      style={{
        alignItems: isGuestTabBar ? 'center' : 'stretch',
        backgroundColor: c.background,
        paddingHorizontal: isGuestTabBar ? 0 : SPACE.lg,
        paddingTop: SPACE.sm,
        paddingBottom: insets.bottom + SPACE.sm,
      }}
    >
      <View
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: isGuestTabBar ? 'center' : 'stretch',
          backgroundColor: c.nav,
          borderRadius: RADIUS.lg,
          paddingVertical: SPACE.sm,
          width: isGuestTabBar ? guestTabBarWidth : undefined,
          ...SHADOW.modal,
        }}
      >
        {rowWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: PILL_SIZE,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ translateX: pillX }],
            }}
          >
            <View style={{ width: PILL_SIZE, height: PILL_SIZE, borderRadius: RADIUS.md, backgroundColor: c.primary }} />
          </Animated.View>
        )}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const baseIcon = TAB_ICON_BY_ROUTE[route.name] ?? 'ellipse';
          const iconName = focused ? baseIcon : `${baseIcon}-outline`;
          const label = options.title ?? t[TAB_TRANSLATION_KEYS[route.name]] ?? route.name;
          const nestedState = route.state;
          const badgeCount = Number(badgeCounts[route.name] ?? 0);
          const showLabel = !focused || state.routes.length <= 2;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (event.defaultPrevented) return;
            const homeRoute = TAB_HOME_ROUTES[route.name];
            if (!focused) {
              navigation.navigate(route.name, homeRoute ? { screen: homeRoute } : undefined);
            } else if (homeRoute) {
              if (nestedState?.key) {
                navigation.dispatch({ ...StackActions.popToTop(), target: nestedState.key });
              }
              if (route.name === TAB_ROUTES.DISCOVER) {
                navigation.navigate(route.name, {
                  screen: homeRoute,
                  params: { resetToHomeAt: Date.now() },
                });
              }
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={{ width: PILL_SIZE, height: PILL_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons
                  name={iconName}
                  size={focused ? 27 : 20}
                  color={focused ? '#FFFFFF' : (c.textMuted ?? c.muted)}
                  style={{ includeFontPadding: false, textAlignVertical: 'center', textAlign: 'center' }}
                />
                {badgeCount > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 4,
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: badgeCount > 9 ? 4 : 0,
                      borderRadius: 8,
                      backgroundColor: focused ? '#FFFFFF' : c.error,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: focused ? c.primary : '#FFFFFF',
                      }}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              {showLabel && (
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 11,
                    fontWeight: focused ? '700' : '400',
                    color: focused ? c.primary : (c.textMuted ?? c.muted),
                    marginTop: -SPACE.xs,
                  }}
                >
                  {label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
