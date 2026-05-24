import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACE, TYPE } from '../mobile-utils';

const styles = {
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingBottom: SPACE.xs,
    width: '100%',
    minHeight: 48,
    alignSelf: 'stretch',
  },
  logoMark: { width: 40, height: 40, borderRadius: RADIUS.md },
  title: { ...TYPE.lg },
  sub: { ...TYPE.meta, marginTop: 1 },
  wordmark: { ...TYPE.lg, marginLeft: 4, letterSpacing: 0.4 },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
};

/**
 * Shared tab header with logo, optional title/subtitle, and optional notification bell.
 *
 * Props:
 *   c              — COLORS[scheme] theme object (required)
 *   title          — screen title string; omit for wordmark-only mode
 *   sub            — optional subtitle string below title
 *   wordmark       — if true, renders "evio" wordmark instead of title
 *   onBellPress    — if provided, renders the notification bell button
 *   hasBadge       — if true, shows the red badge dot on the bell
 */
export function TabHeader({ c, title, sub, wordmark = false, onBellPress, hasBadge = false }) {
  return (
    <View style={[styles.wrapper, { backgroundColor: c.background }]}>
      <View style={styles.row}>
        <Image source={require('../../assets/icon.png')} style={styles.logoMark} />

        {wordmark ? (
          <Text style={[styles.wordmark, { color: c.text }]}>evio</Text>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]}>{title}</Text>
            {sub ? <Text style={[styles.sub, { color: c.muted }]}>{sub}</Text> : null}
          </View>
        )}

        {onBellPress ? (
          <Pressable
            onPress={onBellPress}
            style={[styles.bellButton, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <Ionicons name="notifications-outline" size={18} color={c.text} />
            {hasBadge && <View style={[styles.badge, { backgroundColor: c.error }]} />}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
