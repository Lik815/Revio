import React, { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOW, isSameDay, computeDayPeriods } from '../utils/app-utils';
import { TimelineSlotRow } from './TimelineSlotRow';

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

const TIME_COL_WIDTH = 48;
const DOT_COL_WIDTH = 24;
const LINE_WIDTH = 2;

// Formatiert eine Zeitdauer in Minuten als lesbaren String.
function formatDuration(startsAt, endsAt) {
  const mins = Math.round((new Date(endsAt) - new Date(startsAt)) / 60_000);
  if (mins < 60) return `${mins} Min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} Std` : `${h} Std ${m} Min`;
}

// Tagesansicht: zeigt die gesamte Arbeitszeit als Timeline, mit Buchungen,
// Blockzeiten und freien Lücken darin.
export function TherapistDayTimeline({
  c, selectedDate, incomingBookings, workingHoursRules, blockedTimes,
  incomingBookingsLoading, incomingBookingsLastLoadedAt,
  onOpenBooking,
}) {
  const periods = useMemo(
    () => computeDayPeriods(workingHoursRules, blockedTimes, incomingBookings, selectedDate),
    [workingHoursRules, blockedTimes, incomingBookings, selectedDate],
  );

  const dayHeading = useMemo(
    () => selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [selectedDate],
  );

  const showLoading = shouldShowSectionLoading(incomingBookingsLoading, incomingBookingsLastLoadedAt);

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: 16, ...SHADOW.card }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: c.text, marginBottom: 14 }}>
        {dayHeading}
      </Text>

      {showLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : periods.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Ionicons name="calendar-outline" size={28} color={c.muted} style={{ marginBottom: 8 }} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, textAlign: 'center' }}>
            Keine Arbeitszeit an diesem Tag
          </Text>
          <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
            Lege Arbeitszeiten im Profil fest.
          </Text>
        </View>
      ) : (
        <View style={{ position: 'relative' }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: TIME_COL_WIDTH + DOT_COL_WIDTH / 2 - LINE_WIDTH / 2,
              top: 14,
              bottom: 14,
              width: LINE_WIDTH,
              backgroundColor: c.border,
            }}
          />
          {periods.map((period, idx) => {
            const time = new Date(period.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const duration = formatDuration(period.startsAt, period.endsAt);

            if (period.kind === 'free') {
              return (
                <TimelineSlotRow
                  key={`free-${idx}`}
                  c={c}
                  time={time}
                  kind="free"
                  title="Frei"
                  durationMin={Math.round((new Date(period.endsAt) - new Date(period.startsAt)) / 60_000)}
                />
              );
            }

            if (period.kind === 'blocked') {
              return (
                <TimelineSlotRow
                  key={`blocked-${idx}`}
                  c={c}
                  time={time}
                  kind="blocked"
                  title={period.blockedTime?.title ?? 'Blockiert'}
                  durationMin={Math.round((new Date(period.endsAt) - new Date(period.startsAt)) / 60_000)}
                />
              );
            }

            // booked / requested
            const title = period.kind === 'requested'
              ? 'Neue Anfrage'
              : (period.booking?.patientName ?? 'Gebucht');
            return (
              <TimelineSlotRow
                key={period.booking?.id ?? `booking-${idx}`}
                c={c}
                time={time}
                kind={period.kind}
                title={title}
                durationMin={Math.round((new Date(period.endsAt) - new Date(period.startsAt)) / 60_000)}
                onPress={() => onOpenBooking?.(period.booking)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}
