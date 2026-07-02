import React, { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTherapyData } from '../../context/TherapyContext';
import { useTheme } from '../../hooks/use-theme';
import { useTherapistScheduleData } from '../../hooks/use-therapist-schedule-data';
import { translations } from '../../i18n/translations';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { RADIUS } from '../../utils/app-utils';
import {
  computeTherapistDashboardStats,
  getBookingStart,
  getBookingEnd,
} from '../../utils/therapist-dashboard';
import { AccountHeader } from '../../components/AccountHeader';

const t = (key) => translations.de[key] ?? key;

function fmtTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(date) {
  if (!date) return '';
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function SectionTitle({ label, c }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: c.muted, textTransform: 'uppercase', marginBottom: 8 }}>
      {label}
    </Text>
  );
}

function StatCard({ icon, value, label, color, bgColor, c }) {
  return (
    <View style={{ flex: 1, backgroundColor: bgColor ?? c.card, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: c.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, marginTop: 2 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: c.muted, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function BookingRow({ booking, onPress, c }) {
  const start = getBookingStart(booking);
  const end = getBookingEnd(booking);
  const isPending = booking.status === 'PENDING';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: pressed ? c.mutedBg : c.card,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: isPending ? c.warning + '66' : c.border,
        marginBottom: 8,
      })}
    >
      <View style={{ width: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.primary }}>{fmtTime(start)}</Text>
        {end ? <Text style={{ fontSize: 11, color: c.muted }}>{fmtTime(end)}</Text> : null}
      </View>
      <View style={{ width: 1, height: 36, backgroundColor: isPending ? c.warning : c.primary, opacity: 0.5 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }} numberOfLines={1}>
          {booking.patientName ?? 'Patient'}
        </Text>
        {booking.heilmittel ? (
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }} numberOfLines={1}>{booking.heilmittel}</Text>
        ) : null}
      </View>
      {isPending ? (
        <View style={{ backgroundColor: c.warningBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: c.warning }}>Anfrage</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={c.muted} />
      )}
    </Pressable>
  );
}

function NextBookingCard({ booking, onPress, c }) {
  const start = getBookingStart(booking);
  if (!start) return null;
  const isToday = new Date().toDateString() === start.toDateString();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        backgroundColor: pressed ? c.primaryBg : c.card,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: c.border,
      })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="calendar-outline" size={20} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: c.muted, marginBottom: 2 }}>
          {isToday ? 'Heute' : fmtDate(start)}
        </Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>
          {fmtTime(start)} Uhr — {booking.patientName ?? 'Patient'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.muted} />
    </Pressable>
  );
}

function UtilizationBar({ percent, c }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const color = clamped >= 80 ? c.success : clamped >= 40 ? c.primary : c.muted;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 13, color: c.muted }}>Auslastung heute</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color }}>{clamped}%</Text>
      </View>
      <View style={{ height: 6, backgroundColor: c.border, borderRadius: 3 }}>
        <View style={{ height: 6, width: `${clamped}%`, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

export function TherapistDashboardScreen() {
  const { c } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { authToken, loggedInTherapist } = useAuth();

  const {
    incomingBookings, incomingBookingsLoading,
    therapyRefreshing, handleTherapyRefresh, refreshTherapyTab,
  } = useTherapyData();
  const { accountType } = useAuth();

  const { workingHoursRules, blockedTimes } = useTherapistScheduleData({ authToken });

  useFocusEffect(
    useCallback(() => {
      if (authToken) refreshTherapyTab(authToken, accountType, loggedInTherapist, { force: true });
    }, [authToken, accountType, loggedInTherapist, refreshTherapyTab]),
  );

  const stats = useMemo(() => computeTherapistDashboardStats({
    bookings: incomingBookings,
    workingHoursRules,
    blockedTimes,
  }), [incomingBookings, workingHoursRules, blockedTimes]);

  const { confirmedToday, pendingToday, nextBooking, utilizationPercent } = stats;
  const todayAll = [...confirmedToday, ...pendingToday].sort(
    (a, b) => (getBookingStart(a) ?? 0) - (getBookingStart(b) ?? 0),
  );

  const isNextBookingToday = nextBooking
    ? new Date().toDateString() === (getBookingStart(nextBooking) ?? new Date()).toDateString()
    : false;
  const showNextCard = nextBooking && !isNextBookingToday;

  const openBooking = useCallback((booking) => {
    navigation.navigate(TAB_ROUTES.THERAPY, { openBookingId: booking.id });
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <AccountHeader c={c} subtitle="Mein Tag" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={therapyRefreshing || incomingBookingsLoading}
            onRefresh={() => handleTherapyRefresh(authToken, accountType, loggedInTherapist)}
            tintColor={c.primary}
          />
        }
      >
        {/* Stats row */}
        <View>
          <SectionTitle label="Heute" c={c} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard
              icon="checkmark-circle-outline"
              value={confirmedToday.length}
              label="Bestätigt"
              color={c.success}
              c={c}
            />
            <StatCard
              icon="time-outline"
              value={pendingToday.length}
              label="Anfragen"
              color={c.warning}
              c={c}
            />
            <StatCard
              icon="calendar-outline"
              value={confirmedToday.length + pendingToday.length}
              label="Gesamt"
              color={c.primary}
              c={c}
            />
          </View>
        </View>

        {/* Utilization */}
        {workingHoursRules.length > 0 ? (
          <View style={{ backgroundColor: c.card, borderRadius: RADIUS.md, padding: 16, borderWidth: 1, borderColor: c.border }}>
            <UtilizationBar percent={utilizationPercent} c={c} />
          </View>
        ) : null}

        {/* Today's bookings */}
        <View>
          <SectionTitle label="Termine heute" c={c} />
          {todayAll.length === 0 ? (
            <View style={{ backgroundColor: c.card, borderRadius: RADIUS.md, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: c.border }}>
              <Ionicons name="calendar-outline" size={32} color={c.muted} style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center' }}>Keine Termine heute</Text>
            </View>
          ) : (
            todayAll.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                onPress={() => openBooking(b)}
                c={c}
              />
            ))
          )}
        </View>

        {/* Next booking (outside today) */}
        {showNextCard ? (
          <View>
            <SectionTitle label="Nächster Termin" c={c} />
            <NextBookingCard
              booking={nextBooking}
              onPress={() => openBooking(nextBooking)}
              c={c}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
