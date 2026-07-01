import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { RADIUS } from '../utils/app-utils';

export const TimelineSlotRow = React.memo(function TimelineSlotRow({
  c, time, kind, title, durationMin, onPress, onDelete, isDeleting,
}) {
  const dotColor = kind === 'requested' ? (c.warning ?? '#F2A900')
    : kind === 'blocked' ? (c.muted ?? '#9CA3AF')
    : (c.success ?? '#5A9E8E');
  const dotFilled = kind !== 'free';

  const cardBg = kind === 'booked' ? (c.successBg ?? '#EAF4F1')
    : kind === 'requested' ? (c.warningBg ?? '#FEF5DC')
    : kind === 'blocked' ? (c.mutedBg ?? '#F3F4F6')
    : c.card;

  const cardContent = (
    <>
      <View>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{title}</Text>
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{durationMin} Min</Text>
      </View>
      {kind === 'requested' ? (
        <View style={{ backgroundColor: c.warning ?? '#8A6000', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>NEU</Text>
        </View>
      ) : null}
    </>
  );

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
      {kind === 'free' || kind === 'blocked' ? (
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: cardBg,
            borderRadius: RADIUS.sm,
            borderWidth: 1,
            borderColor: c.border,
            paddingVertical: 12,
            paddingHorizontal: 14,
          }}
        >
          {cardContent}
          {onDelete ? (
            isDeleting ? (
              <ActivityIndicator size="small" color={c.muted} />
            ) : (
              <Pressable onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={20} color={c.muted} />
              </Pressable>
            )
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={onPress}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: cardBg,
            borderRadius: RADIUS.sm,
            paddingVertical: 12,
            paddingHorizontal: 14,
          }}
        >
          {cardContent}
        </Pressable>
      )}
    </View>
  );
});
