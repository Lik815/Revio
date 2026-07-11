import React, { useEffect, useRef, useState } from 'react';
import { StackActions } from '@react-navigation/native';
import { Animated, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/use-theme';
import { RADIUS, SHADOW, SPACE } from '../utils/app-utils';
import { TAB_ROUTES } from './route-names';
import { TAB_HOME_ROUTES, TAB_ICON_BY_ROUTE, TAB_TRANSLATION_KEYS } from './tab-config';
import { translations } from '../i18n/translations';

const PILL_SIZE = 44;

function TabIcon({ baseIcon, focused, color, routeName }) {
  if (routeName === TAB_ROUTES.OPTIONS) {
    return (
      <MaterialCommunityIcons
        name={focused ? 'account-cog' : 'account-cog-outline'}
        size={focused ? 31 : 25}
        color={color}
        style={{ includeFontPadding: false, textAlignVertical: 'center', textAlign: 'center' }}
      />
    );
  }

  return (
    <Ionicons
      name={focused ? baseIcon : `${baseIcon}-outline`}
      size={focused ? 27 : 20}
      color={color}
      style={{ includeFontPadding: false, textAlignVertical: 'center', textAlign: 'center' }}
    />
  );
}

export function CustomTabBar({ state, descriptors, navigation, badgeCounts = {} }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const t = translations.de;
  const isGuestTabBar = state.routes.length === 2;
  const compactWidth = Math.min(240, Math.max(196, width * 0.5));

  // Outer padding is constant across guest/logged-in so the measured
  // container width doesn't itself jump when isGuestTabBar flips — only the
  // inner nav's animated width changes. Falls back to the window width
  // (matches how compactWidth is derived) until the first onLayout lands,
  // so we never animate from/to a bogus 0.
  const [containerWidth, setContainerWidth] = useState(0);
  const fullWidth = containerWidth > 0 ? containerWidth - SPACE.lg * 2 : Math.max(0, width - SPACE.lg * 2);
  const targetNavWidth = isGuestTabBar ? compactWidth : fullWidth;
  const contentWidth = targetNavWidth;

  const [rowWidth, setRowWidth] = useState(0);
  const itemWidth = rowWidth / state.routes.length;
  const pillX = useRef(new Animated.Value(0)).current;
  const navWidth = useRef(new Animated.Value(targetNavWidth)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const prevIsGuestTabBarRef = useRef(isGuestTabBar);

  // Snap pill to correct position whenever tab or layout changes.
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

  // Only the guest<->logged-in transition itself should spring-animate the
  // width; layout-only changes (e.g. the container's first measurement,
  // or a rotation) snap straight to the new target so there's no
  // unintended bounce on mount or resize.
  useEffect(() => {
    const loginStateChanged = prevIsGuestTabBarRef.current !== isGuestTabBar;
    prevIsGuestTabBarRef.current = isGuestTabBar;

    if (loginStateChanged) {
      contentOpacity.setValue(0);
      Animated.timing(navWidth, {
        toValue: targetNavWidth,
        duration: 200,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }).start();
        }
      });
    } else {
      navWidth.setValue(targetNavWidth);
      contentOpacity.setValue(1);
    }
  }, [targetNavWidth, isGuestTabBar]);

  // Gast-Ansicht: beide Tabs (Suche + Anmelden) immer sichtbar als kompakte Pill-Nav
  if (isGuestTabBar) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: c.background,
          paddingHorizontal: SPACE.lg,
          paddingTop: SPACE.sm,
          paddingBottom: insets.bottom + SPACE.sm,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: c.nav,
            borderRadius: RADIUS.lg,
            paddingVertical: SPACE.sm,
            paddingHorizontal: SPACE.sm,
            gap: 4,
            alignSelf: 'stretch',
            ...SHADOW.modal,
          }}
        >
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const isAuth = route.name === TAB_ROUTES.AUTH;
            const icon = isAuth ? 'log-in' : 'search';
            const label = isAuth ? 'Anmelden' : 'Suche';

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!event.defaultPrevented) navigation.navigate(route.name);
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  paddingVertical: 10,
                  paddingHorizontal: 18,
                  borderRadius: RADIUS.md,
                  backgroundColor: focused ? c.primary : 'transparent',
                }}
              >
                <Ionicons
                  name={focused ? icon : `${icon}-outline`}
                  size={18}
                  color={focused ? '#fff' : (c.textMuted ?? c.muted)}
                />
                <Text style={{ fontSize: 14, fontWeight: '700', color: focused ? '#fff' : (c.textMuted ?? c.muted) }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={{
        alignItems: 'center',
        backgroundColor: c.background,
        paddingHorizontal: SPACE.lg,
        paddingTop: SPACE.sm,
        paddingBottom: insets.bottom + SPACE.sm,
      }}
    >
      <Animated.View
        style={{
          alignSelf: 'center',
          backgroundColor: c.nav,
          borderRadius: RADIUS.lg,
          overflow: 'hidden',
          paddingTop: SPACE.sm,
          paddingBottom: SPACE.sm,
          width: navWidth,
          ...SHADOW.modal,
        }}
      >
        <Animated.View
          onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            opacity: contentOpacity,
            width: contentWidth,
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
            const label = options.title ?? t[TAB_TRANSLATION_KEYS[route.name]] ?? route.name;
            const nestedState = route.state;
            const badgeCount = Number(badgeCounts[route.name] ?? 0);
            const showLabel = !focused;

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
                  <TabIcon
                    baseIcon={baseIcon}
                    focused={focused}
                    color={focused ? '#FFFFFF' : (c.textMuted ?? c.muted)}
                    routeName={route.name}
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
        </Animated.View>
      </Animated.View>
    </View>
  );
}
