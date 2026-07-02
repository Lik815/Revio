import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { RADIUS } from '../utils/app-utils';

function StatChip({ c, value, label, dotColor, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: RADIUS.full,
        paddingVertical: 10,
        paddingHorizontal: 10,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
      <Text style={{ fontSize: 15, fontWeight: '800', color: c.text }}>{value}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>{label}</Text>
    </Pressable>
  );
}

export function TherapistSummaryCard({
  c, confirmedCount, pendingCount, onPressBooked, onPressPending,
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <StatChip c={c} value={confirmedCount} label="Gebucht" dotColor={c.primary} onPress={onPressBooked} />
      <StatChip c={c} value={pendingCount} label="Anfragen" dotColor={c.warning ?? '#B78700'} onPress={onPressPending} />
    </View>
  );
}
