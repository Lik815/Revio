import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SHADOW } from '../utils/app-utils';

function getDate(a) {
  return new Date(a.startsAt ?? a.slot?.startsAt ?? a.confirmedSlotAt ?? 0);
}

function formatBannerDate(date) {
  const weekday = date.toLocaleDateString('de-DE', { weekday: 'short' });
  const day = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${weekday}, ${day} · ${time} Uhr`;
}

function Initials({ name, c }) {
  const parts = (name ?? '').trim().split(/\s+/);
  const letters = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name ?? '?').slice(0, 2).toUpperCase();
  return (
    <View style={{
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.primaryBg ?? `${c.primary}20`,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: c.primary }}>{letters}</Text>
    </View>
  );
}

// BANNER_HEIGHT is exported so callers can offset their scroll content.
export const NEXT_APPOINTMENT_BANNER_HEIGHT = 72;

export function NextAppointmentBanner({ appointment, onPress, c }) {
  const insets = useSafeAreaInsets();

  if (!appointment) return null;

  const date = getDate(appointment);
  const therapistName = appointment.therapist?.fullName ?? appointment.therapistName ?? null;
  const isPending = appointment.status === 'PENDING';

  return (
    <View style={{
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: insets.bottom + 92,
      zIndex: 50,
    }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: c.card,
          borderRadius: RADIUS.lg,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: c.border,
          opacity: pressed ? 0.85 : 1,
          ...SHADOW.modal,
        })}
      >
        <Initials name={therapistName} c={c} />

        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Nächster Termin
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: c.text }} numberOfLines={1}>
            {formatBannerDate(date)}
          </Text>
          {therapistName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 12, color: c.muted, fontWeight: '500' }} numberOfLines={1}>
                {`bei ${therapistName}`}
              </Text>
              {isPending && (
                <View style={{ backgroundColor: c.warning ?? '#B78700', borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>Angefragt</Text>
                </View>
              )}
            </View>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={18} color={c.muted} />
      </Pressable>
    </View>
  );
}
