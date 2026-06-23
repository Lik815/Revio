import React from 'react';
import { Pressable, Text, View } from 'react-native';

const TABS = [
  { key: 'list', label: 'Liste' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'calendar', label: 'Kalender' },
  { key: 'requested', label: 'Angefragt' },
];

export function ScheduleModeTabs({ c, value, onChange, pendingCount = 0 }) {
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: 16 }}>
      {TABS.map(({ key, label }) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: active ? (c.success ?? '#5A9E8E') : 'transparent' }}
          >
            <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? c.text : c.muted }}>{label}</Text>
            {key === 'requested' && pendingCount > 0 && (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.warning ?? '#8A6000', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{pendingCount}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
