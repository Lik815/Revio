import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTherapyData } from '../../context/TherapyContext';
import { useTheme } from '../../hooks/use-theme';
import { translations } from '../../i18n/translations';
import { TAB_ROUTES } from '../../navigation/route-names';
import { RADIUS } from '../../utils/app-utils';
import {
  getTodayBookings,
  getBookingStart,
  getBookingEnd,
  isBookingActive,
  getBookingProgress,
  getBookingRemainingMs,
  formatDuration,
  getNextDayBookingAfter,
} from '../../utils/therapist-dashboard';
import { AccountHeader } from '../../components/AccountHeader';

const t = (key) => translations.de[key] ?? key;

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateLabel(date) {
  const today = new Date();
  if (isSameDay(date, today)) return 'Heute';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(date, tomorrow)) return 'Morgen';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Gestern';
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function DateNavRow({ selectedDate, onPrev, onNext, pendingCount, c }) {
  const isToday = isSameDay(selectedDate, new Date());
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: c.border,
      backgroundColor: c.background,
    }}>
      <Pressable onPress={onPrev} hitSlop={12} style={{ padding: 4 }}>
        <Ionicons name="chevron-back" size={22} color={c.text} />
      </Pressable>

      <View style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: isToday ? c.primary : c.text }}>
          {fmtDateLabel(selectedDate)}
        </Text>
        {pendingCount > 0 && (
          <View style={{
            backgroundColor: c.warning ?? '#B78700',
            borderRadius: RADIUS.full,
            minWidth: 20, height: 20,
            paddingHorizontal: 6,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{pendingCount}</Text>
          </View>
        )}
      </View>

      <Pressable onPress={onNext} hitSlop={12} style={{ padding: 4 }}>
        <Ionicons name="chevron-forward" size={22} color={c.text} />
      </Pressable>
    </View>
  );
}

function ProgressBar({ progress, c }) {
  return (
    <View style={{ height: 4, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden', marginTop: 8 }}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.primary, width: `${Math.round(progress * 100)}%` }} />
    </View>
  );
}

function DashboardAppointmentCard({ booking, dayBookings, now, onPress, c }) {
  const start = getBookingStart(booking);
  const end = getBookingEnd(booking);
  const isPending = booking.status === 'PENDING';
  const active = isBookingActive(booking, now);
  const progress = active ? getBookingProgress(booking, now) : 0;
  const remainingMs = active ? getBookingRemainingMs(booking, now) : 0;
  const accentColor = isPending ? (c.warning ?? '#B78700') : c.primary;

  const durationMin = start && end
    ? Math.round((end.getTime() - start.getTime()) / 60_000)
    : null;

  const nextBooking = getNextDayBookingAfter(dayBookings, booking);
  const nextStart = nextBooking ? getBookingStart(nextBooking) : null;
  const nextInMs = nextStart && start ? nextStart.getTime() - (end?.getTime() ?? start.getTime()) : null;

  let nextLabel = null;
  if (nextStart) {
    nextLabel = `Nächster Termin: ${fmtTime(nextStart)} Uhr`;
  } else if (!isPending) {
    nextLabel = 'Kein weiterer Termin';
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        backgroundColor: pressed ? c.mutedBg : c.card,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: active ? accentColor + '55' : c.border,
        marginBottom: 10,
        overflow: 'hidden',
      })}
    >
      {/* Left accent bar */}
      <View style={{ width: 4, backgroundColor: accentColor }} />

      {/* Time column */}
      <View style={{ width: 52, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingLeft: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: accentColor }}>{fmtTime(start)}</Text>
        {end && (
          <Text style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{fmtTime(end)}</Text>
        )}
        {durationMin != null && (
          <Text style={{ fontSize: 10, color: c.muted, marginTop: 2 }}>{durationMin} Min</Text>
        )}
      </View>

      {/* Main content */}
      <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, flex: 1 }} numberOfLines={1}>
            {booking.patientName ?? 'Patient'}
          </Text>
          {isPending ? (
            <View style={{
              backgroundColor: (c.warningBg ?? '#FFF9E6'),
              borderRadius: RADIUS.sm,
              paddingHorizontal: 7, paddingVertical: 2,
              marginLeft: 8,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.warning ?? '#B78700' }}>Anfrage</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={15} color={c.muted} style={{ marginLeft: 8 }} />
          )}
        </View>

        {booking.heilmittel ? (
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }} numberOfLines={1}>{booking.heilmittel}</Text>
        ) : null}

        {active && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.primary }}>Läuft gerade</Text>
              </View>
              <Text style={{ fontSize: 11, color: c.muted }}>Noch {formatDuration(remainingMs)}</Text>
            </View>
            <ProgressBar progress={progress} c={c} />
          </>
        )}

        {nextLabel && (
          <Text style={{ fontSize: 11, color: c.muted, marginTop: 6 }}>{nextLabel}</Text>
        )}
      </View>
    </Pressable>
  );
}

function EmptyDayCard({ c }) {
  return (
    <View style={{
      backgroundColor: c.card, borderRadius: RADIUS.md,
      padding: 24, alignItems: 'center',
      borderWidth: 1, borderColor: c.border,
    }}>
      <Ionicons name="calendar-outline" size={32} color={c.muted} style={{ marginBottom: 10 }} />
      <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 4 }}>Keine Termine</Text>
      <Text style={{ fontSize: 12, color: c.muted, textAlign: 'center' }}>
        An diesem Tag sind keine Termine eingetragen.
      </Text>
    </View>
  );
}

function NewsCard({ c }) {
  return (
    <View style={{
      backgroundColor: c.card, borderRadius: RADIUS.md,
      padding: 16, borderWidth: 1, borderColor: c.border,
      marginTop: 8,
    }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>
        Neuigkeiten
      </Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 4 }}>
        Neuigkeiten fur Therapeuten
      </Text>
      <Text style={{ fontSize: 13, color: c.muted }}>
        Wir haben neue Funktionen und Verbesserungen fur dich.
      </Text>
    </View>
  );
}

export function TherapistDashboardScreen() {
  const { c } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { authToken, loggedInTherapist, accountType } = useAuth();

  const {
    incomingBookings, incomingBookingsLoading,
    therapyRefreshing, handleTherapyRefresh, refreshTherapyTab,
  } = useTherapyData();

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Tick every 30s so progress bars and Restzeit stay fresh
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (authToken) refreshTherapyTab(authToken, accountType, loggedInTherapist, { force: true });
    }, [authToken, accountType, loggedInTherapist, refreshTherapyTab]),
  );

  const dayBookings = useMemo(() => {
    const list = getTodayBookings(incomingBookings, selectedDate);
    return list.sort((a, b) => (getBookingStart(a) ?? 0) - (getBookingStart(b) ?? 0));
  }, [incomingBookings, selectedDate]);

  const pendingCount = useMemo(
    () => dayBookings.filter((b) => b.status === 'PENDING').length,
    [dayBookings],
  );

  const openBooking = useCallback((booking) => {
    navigation.navigate(TAB_ROUTES.THERAPY, { openBookingId: booking.id });
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <AccountHeader c={c} subtitle="Mein Tag" />

      <DateNavRow
        selectedDate={selectedDate}
        onPrev={() => setSelectedDate((d) => addDays(d, -1))}
        onNext={() => setSelectedDate((d) => addDays(d, 1))}
        pendingCount={pendingCount}
        c={c}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={therapyRefreshing || incomingBookingsLoading}
            onRefresh={() => handleTherapyRefresh(authToken, accountType, loggedInTherapist)}
            tintColor={c.primary}
          />
        }
      >
        {dayBookings.length === 0 ? (
          <EmptyDayCard c={c} />
        ) : (
          dayBookings.map((b) => (
            <DashboardAppointmentCard
              key={b.id}
              booking={b}
              dayBookings={dayBookings}
              now={now}
              onPress={() => openBooking(b)}
              c={c}
            />
          ))
        )}

        <NewsCard c={c} />
      </ScrollView>
    </View>
  );
}
