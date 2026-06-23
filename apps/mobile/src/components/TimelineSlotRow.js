import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { RADIUS } from '../utils/app-utils';

export const TimelineSlotRow = React.memo(function TimelineSlotRow({ c, time, kind, title, durationMin, onPress }) {
  const dotColor = kind === 'requested' ? (c.warning ?? '#F2A900') : (c.success ?? '#5A9E8E');
  const dotFilled = kind !== 'free';

  const cardBg = kind === 'booked' ? (c.successBg ?? '#EAF4F1')
    : kind === 'requested' ? (c.warningBg ?? '#FEF5DC')
    : c.card;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
      <View style={{ width: 48 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: c.muted }}>{time}</Text>
      </View>
      <View style={{ width: 24, alignItems: 'center' }}>
        <View style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: dotFilled ? dotColor : 'transparent',
          borderWidth: dotFilled ? 0 : 2,
          borderColor: dotColor,
        }} />
      </View>
      <Pressable
        onPress={onPress}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: cardBg,
          borderRadius: RADIUS.sm,
          borderWidth: kind === 'free' ? 1 : 0,
          borderColor: c.border,
          paddingVertical: 12,
          paddingHorizontal: 14,
        }}
      >
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{title}</Text>
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{durationMin} Min</Text>
        </View>
        {kind === 'free' ? (
          <Ionicons name="add-circle-outline" size={22} color={c.success ?? '#5A9E8E'} />
        ) : kind === 'requested' ? (
          <View style={{ backgroundColor: c.warning ?? '#8A6000', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>NEU</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
});
