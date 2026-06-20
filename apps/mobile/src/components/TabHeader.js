import React from 'react';
import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACE, TYPE } from '../utils/app-utils';

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
};

/**
 * Shared tab header with logo and optional title/subtitle.
 *
 * Props:
 *   c              — COLORS[scheme] theme object (required)
 *   title          — screen title string; omit for wordmark-only mode
 *   sub            — optional subtitle string below title
 *   wordmark       — if true, renders "evio" wordmark instead of title
 */
export function TabHeader({ c, title, sub, wordmark = false }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { backgroundColor: c.background, paddingTop: insets.top + 8 }]}>
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

      </View>
    </View>
  );
}
