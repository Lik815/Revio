import React from 'react';
import { Pressable, Text, View } from 'react-native';

function StatBlock({ c, value, label, valueColor, onPress, style, children }) {
  const content = children ?? (
    <>
      <Text style={{ fontSize: 24, fontWeight: '800', color: valueColor ?? c.text }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>
        {label}
      </Text>
    </>
  );

  return (
    <Pressable onPress={onPress} style={[{ flex: 1 }, style]}>
      {content}
    </Pressable>
  );
}

export function TherapistSummaryCard({ c, freeCount, confirmedCount, nextSlotLabel, onPressFree, onPressBooked }) {
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
      <View style={{ flex: 1.3, paddingLeft: 12 }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Nächster Slot</Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          style={{ fontSize: 16, fontWeight: '800', color: c.text, marginTop: 6 }}
        >
          {nextSlotLabel}
        </Text>
      </View>
    </View>
  );
}
