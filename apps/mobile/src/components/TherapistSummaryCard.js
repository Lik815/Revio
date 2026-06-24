import React from 'react';
import { Pressable, Text, View } from 'react-native';

function StatBlock({ c, value, label, valueColor, onPress, style }) {
  return (
    <Pressable onPress={onPress} style={[{ flex: 1 }, style]}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: valueColor ?? c.text }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TherapistSummaryCard({
  c, freeCount, confirmedCount, pendingCount, onPressFree, onPressBooked, onPressPending,
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12 }}>
      <StatBlock
        c={c}
        value={freeCount}
        label="Frei"
        valueColor={c.success ?? '#5A9E8E'}
        style={{ paddingRight: 12, borderRightWidth: 1, borderRightColor: c.border }}
        onPress={onPressFree}
      />
      <StatBlock
        c={c}
        value={confirmedCount}
        label="Gebucht"
        style={{ paddingHorizontal: 12, borderRightWidth: 1, borderRightColor: c.border }}
        onPress={onPressBooked}
      />
      <StatBlock
        c={c}
        value={pendingCount}
        label="Anfragen"
        valueColor={c.warning ?? '#B78700'}
        style={{ paddingLeft: 12 }}
        onPress={onPressPending}
      />
    </View>
  );
}
