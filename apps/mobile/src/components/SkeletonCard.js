import React from 'react';
import { View } from 'react-native';
import { RADIUS } from '../utils/app-utils';

export function SkeletonCard({ C }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: RADIUS.lg,
        padding: 18,
        gap: 14,
        backgroundColor: C.card,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: RADIUS.full, backgroundColor: C.mutedBg }} />
        <View style={{ gap: 8, flex: 1 }}>
          <View style={{ height: 16, borderRadius: RADIUS.sm, backgroundColor: C.mutedBg, width: '55%' }} />
          <View style={{ height: 12, borderRadius: RADIUS.sm, backgroundColor: C.mutedBg, width: '35%' }} />
        </View>
      </View>
      <View style={{ height: 12, borderRadius: RADIUS.sm, backgroundColor: C.mutedBg }} />
      <View style={{ height: 12, borderRadius: RADIUS.sm, backgroundColor: C.mutedBg, width: '70%' }} />
      <View style={{ height: 42, borderRadius: RADIUS.md, backgroundColor: C.mutedBg }} />
    </View>
  );
}
