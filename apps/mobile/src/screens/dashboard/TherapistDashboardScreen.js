import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image, Pressable, RefreshControl, ScrollView, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTherapyData } from '../../context/TherapyContext';
import { useTherapistScheduleData } from '../../hooks/use-therapist-schedule-data';
import { useTherapistServices } from '../../hooks/use-therapist-services';
import { useTheme } from '../../hooks/use-theme';
import { TAB_ROUTES } from '../../navigation/route-names';
import { getBaseUrl, RADIUS } from '../../utils/app-utils';
import {
  getDayAgendaItems,
  getCurrentAgendaState,
  getNextFreeGap,
  getTotalBookedMinutes,
  getBookingStart,
  getBookingEnd,
  getBookingProgress,
  getBookingRemainingMs,
  formatDuration,
  formatTimeRange,
} from '../../utils/therapist-dashboard';

// ─── Farb-Hilfe ──────────────────────────────────────────────────────────────

function hexLightBg(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.13)`;
}

// ─── Formatierungshilfen ──────────────────────────────────────────────────────

function fmtTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateMeta(date) {
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const dayStr = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  return isToday ? `Heute, ${dayStr}` : dayStr;
}

function formatTotalHours(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  if (h === 0) return `${m} Min`;
  if (m === 0) return `${h} Std`;
  return `${h}:${String(m).padStart(2, '0')} Std`;
}

function getNextInLabel(nextStartsAt, now) {
  const diffMs = nextStartsAt.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const min = Math.ceil(diffMs / 60_000);
  if (min < 60) return `Nächster Termin in ${min} Min`;
  return `Nächster Termin um ${fmtTime(nextStartsAt)} Uhr`;
}

function resolvePhotoUri(photo) {
  if (!photo) return null;
  return photo.startsWith('http') ? photo : `${getBaseUrl()}${photo}`;
}

function initialsFromName(name) {
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || null;
}

// ─── DashboardHeader ─────────────────────────────────────────────────────────

const AVATAR_SIZE = 48;

function DashboardHeader({ name, photo, selectedDate, bookingCount, totalMin, c, insets, onPressAvatar }) {
  const initials = photo ? null : initialsFromName(name);
  const metaParts = [fmtDateMeta(selectedDate)];
  if (bookingCount > 0) metaParts.push(`${bookingCount} ${bookingCount === 1 ? 'Termin' : 'Termine'}`);
  if (totalMin > 0) metaParts.push(formatTotalHours(totalMin));

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16,
      paddingTop: insets.top + 14,
      paddingBottom: 14,
      backgroundColor: c.background,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    }}>
      <Pressable onPress={onPressAvatar} hitSlop={10}>
        <View style={{
          width: AVATAR_SIZE, height: AVATAR_SIZE,
          borderRadius: AVATAR_SIZE / 2,
          backgroundColor: c.primaryBg,
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {photo
            ? <Image source={{ uri: photo }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }} />
            : <Text style={{ fontSize: 16, fontWeight: '700', color: c.primary }}>{initials ?? '?'}</Text>
          }
        </View>
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: c.text }} numberOfLines={1}>{name}</Text>
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>Mein Tag</Text>
        {metaParts.length > 0 && (
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{metaParts.join(' · ')}</Text>
        )}
      </View>
    </View>
  );
}

// ─── StatusIcon ──────────────────────────────────────────────────────────────

function StatusIcon({ variant, c }) {
  if (variant === 'active') {
    return (
      <View style={{
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: c.primaryBg ?? '#E8F0FF',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="play-circle" size={28} color={c.primary} />
      </View>
    );
  }
  return (
    <View style={{
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: (c.successBg ?? '#E6F9F0'),
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Ionicons name="checkmark-circle-outline" size={28} color={c.success ?? '#2AAE6E'} />
    </View>
  );
}

// ─── FreeGapRow ──────────────────────────────────────────────────────────────

function FreeGapRow({ gap, c }) {
  const gapMin = Math.round((gap.endsAt.getTime() - gap.startsAt.getTime()) / 60_000);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
      <Ionicons name="calendar-outline" size={14} color={c.muted} />
      <Text style={{ fontSize: 12, color: c.muted }}>
        {'Nächste Lücke: '}
        <Text style={{ color: c.success ?? '#2AAE6E', fontWeight: '600' }}>
          {formatTimeRange(gap.startsAt, gap.endsAt)}
        </Text>
        {` · ${gapMin} Min frei`}
      </Text>
    </View>
  );
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ progress, color, c }) {
  return (
    <View style={{ height: 4, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden', marginTop: 8 }}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: color ?? c.primary, width: `${Math.round(progress * 100)}%` }} />
    </View>
  );
}

// ─── StatusCard ──────────────────────────────────────────────────────────────

function StatusCard({ agendaState, nextFreeGap, now, servicesByKey = {}, c }) {
  const { activeItem, nextItem, isFree } = agendaState;
  const successColor = c.success ?? '#2AAE6E';

  const hasContent = activeItem || nextItem || nextFreeGap;
  if (!hasContent) {
    return (
      <View style={[cardStyle(c), { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }]}>
        <StatusIcon variant="free" c={c} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: successColor }}>Jetzt frei</Text>
          <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>Heute kein weiterer Termin</Text>
        </View>
      </View>
    );
  }

  if (!isFree && activeItem) {
    // Termin läuft gerade
    const start = activeItem.startsAt;
    const end = activeItem.endsAt;
    const progress = getBookingProgress({ startsAt: start.toISOString(), endsAt: end.toISOString() }, now);
    const remainingMs = getBookingRemainingMs({ endsAt: end.toISOString() }, now);
    const b = activeItem.booking;
    const durationMin = Math.round((end.getTime() - start.getTime()) / 60_000);
    const activeServiceColor = b?.heilmittel ? (servicesByKey[b.heilmittel]?.colorHex ?? null) : null;
    const activeAccent = activeServiceColor ?? c.primary;

    return (
      <View style={[cardStyle(c), { padding: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
          <StatusIcon variant="active" c={c} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: activeAccent }}>Läuft gerade</Text>
            <Text style={{ fontSize: 13, color: c.text, marginTop: 4 }} numberOfLines={1}>
              {`${fmtTime(start)} · ${b?.patientName ?? 'Patient'} · ${b?.heilmittel ?? ''} · ${durationMin} Min`}
            </Text>
            <ProgressBar progress={progress} color={activeAccent} c={c} />
            <Text style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>
              Noch {formatDuration(remainingMs)}
            </Text>
          </View>
        </View>
        {nextFreeGap && (
          <>
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 10 }} />
            <FreeGapRow gap={nextFreeGap} c={c} />
          </>
        )}
      </View>
    );
  }

  // Jetzt frei — nächster Termin vorhanden oder nur Lücke
  const nextInLabel = nextItem ? getNextInLabel(nextItem.startsAt, now) : null;
  const b = nextItem?.booking;
  const nextDuration = nextItem
    ? Math.round((nextItem.endsAt.getTime() - nextItem.startsAt.getTime()) / 60_000)
    : null;

  return (
    <View style={[cardStyle(c), { padding: 16 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
        <StatusIcon variant="free" c={c} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: successColor }}>Jetzt frei</Text>
          {nextInLabel && (
            <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>{nextInLabel}</Text>
          )}
          {nextItem && b && (
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary, marginTop: 4 }} numberOfLines={1}>
              {`${fmtTime(nextItem.startsAt)} · ${b.patientName ?? 'Patient'} · ${b.heilmittel ?? ''} · ${nextDuration} Min`}
            </Text>
          )}
          {!nextItem && (
            <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>Heute kein weiterer Termin</Text>
          )}
        </View>
      </View>
      {nextFreeGap && (
        <>
          <View style={{ height: 1, backgroundColor: c.border, marginVertical: 10 }} />
          <FreeGapRow gap={nextFreeGap} c={c} />
        </>
      )}
    </View>
  );
}

// ─── AgendaRow ───────────────────────────────────────────────────────────────

function AgendaBookingRow({ item, isHighlighted, onPress, servicesByKey = {}, c }) {
  const { booking: b, startsAt, endsAt, status } = item;
  const isPending = status === 'PENDING';
  const durationMin = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  const serviceColor = b?.heilmittel ? (servicesByKey[b.heilmittel]?.colorHex ?? null) : null;
  const accentColor = isPending ? (c.warning ?? '#B78700') : (serviceColor ?? c.primary);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 11, paddingHorizontal: 14,
        backgroundColor: pressed ? c.mutedBg : 'transparent',
      })}
    >
      {isHighlighted && (
        <View style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, backgroundColor: accentColor }} />
      )}
      <Text style={{ width: 46, fontSize: 14, fontWeight: isHighlighted ? '700' : '500', color: isHighlighted ? accentColor : c.muted }}>
        {fmtTime(startsAt)}
      </Text>
      <View style={{ flex: 1, paddingLeft: 6 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }} numberOfLines={1}>
          {b?.patientName ?? 'Patient'}
        </Text>
        {b?.heilmittel ? (
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }} numberOfLines={1}>{b.heilmittel}</Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {isPending && (
          <View style={{ backgroundColor: c.warningBg ?? '#FFF9E6', borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: c.warning ?? '#B78700' }}>Anfrage</Text>
          </View>
        )}
        <Text style={{ fontSize: 12, color: c.muted }}>{durationMin} Min</Text>
        <Ionicons name="chevron-forward" size={14} color={c.muted} />
      </View>
    </Pressable>
  );
}

function AgendaFreeRow({ item, c }) {
  const { startsAt, endsAt } = item;
  const freeMin = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  const successColor = c.success ?? '#2AAE6E';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14 }}>
      <Text style={{ width: 46, fontSize: 13, fontWeight: '600', color: successColor }}>
        {fmtTime(startsAt)}
      </Text>
      <View style={{ flex: 1, paddingLeft: 6 }}>
        <Text style={{ fontSize: 13, color: successColor }}>{formatTimeRange(startsAt, endsAt)}</Text>
        <Text style={{ fontSize: 12, color: successColor, marginTop: 1 }}>Freie Zeit</Text>
      </View>
      <Text style={{ fontSize: 12, color: successColor, fontWeight: '600' }}>{freeMin} Min</Text>
    </View>
  );
}

function AgendaCard({ items, agendaState, onPressBooking, onPressAll, servicesByKey = {}, c }) {
  const MAX_VISIBLE = 5;
  const displayItems = items.slice(0, MAX_VISIBLE);
  const bookingCount = items.filter((i) => i.type === 'booking').length;
  const freeCount = items.filter((i) => i.type === 'free').length;

  let badgeText = '';
  if (bookingCount > 0 && freeCount > 0) badgeText = `${bookingCount} Termine + ${freeCount} ${freeCount === 1 ? 'Lücke' : 'Lücken'}`;
  else if (bookingCount > 0) badgeText = `${bookingCount} ${bookingCount === 1 ? 'Termin' : 'Termine'}`;
  else if (freeCount > 0) badgeText = `${freeCount} ${freeCount === 1 ? 'Lücke' : 'Lücken'}`;

  if (items.length === 0) return null;

  return (
    <View style={cardStyle(c)}>
      {/* Kopfzeile */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>Nächste Termine</Text>
        {badgeText ? (
          <View style={{ backgroundColor: c.mutedBg ?? c.border, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, color: c.muted, fontWeight: '600' }}>{badgeText}</Text>
          </View>
        ) : null}
      </View>

      {/* Zeilen */}
      {displayItems.map((item, idx) => {
        const isLast = idx === displayItems.length - 1;
        const isHighlighted = item.type === 'booking' && (
          agendaState.activeItem === item || agendaState.nextItem === item
        );
        return (
          <View key={`${item.type}-${item.startsAt.getTime()}`}>
            {idx > 0 && <View style={{ height: 1, backgroundColor: c.border, marginHorizontal: 14 }} />}
            {item.type === 'booking' ? (
              <AgendaBookingRow
                item={item}
                isHighlighted={isHighlighted}
                onPress={() => onPressBooking(item.booking)}
                servicesByKey={servicesByKey}
                c={c}
              />
            ) : (
              <AgendaFreeRow item={item} c={c} />
            )}
          </View>
        );
      })}

      {/* Alle Termine anzeigen */}
      <View style={{ height: 1, backgroundColor: c.border, marginHorizontal: 14 }} />
      <Pressable
        onPress={onPressAll}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingHorizontal: 14, paddingVertical: 13,
          backgroundColor: pressed ? c.mutedBg : 'transparent',
        })}
      >
        <Ionicons name="calendar-outline" size={16} color={c.primary} />
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: c.primary }}>Alle Termine anzeigen</Text>
        <Ionicons name="chevron-forward" size={14} color={c.primary} />
      </Pressable>
    </View>
  );
}

// ─── Placeholder-Cards ───────────────────────────────────────────────────────

function IconLinkCard({ iconName, title, subtitle, c }) {
  return (
    <View style={[cardStyle(c), { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 }]}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.mutedBg ?? c.border, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={iconName} size={20} color={c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{title}</Text>
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }} numberOfLines={2}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.muted} />
    </View>
  );
}

// ─── EmptyDayCard ────────────────────────────────────────────────────────────

function EmptyDayCard({ c }) {
  return (
    <View style={[cardStyle(c), { padding: 24, alignItems: 'center' }]}>
      <Ionicons name="calendar-outline" size={32} color={c.muted} style={{ marginBottom: 10 }} />
      <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 4 }}>Kein Arbeitstag</Text>
      <Text style={{ fontSize: 12, color: c.muted, textAlign: 'center' }}>
        Für diesen Tag sind keine Arbeitszeiten eingetragen.
      </Text>
    </View>
  );
}

// ─── Stil-Hilfe ──────────────────────────────────────────────────────────────

function cardStyle(c) {
  return {
    backgroundColor: c.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
    marginBottom: 12,
  };
}

// ─── Hauptscreen ─────────────────────────────────────────────────────────────

export function TherapistDashboardScreen() {
  const { c } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { authToken, loggedInTherapist, accountType } = useAuth();

  const {
    incomingBookings,
    incomingBookingsLoading,
    therapyRefreshing,
    handleTherapyRefresh,
    refreshTherapyTab,
  } = useTherapyData();

  const { workingHoursRules, blockedTimes, refreshScheduleData } = useTherapistScheduleData({ authToken });
  const { servicesByKey } = useTherapistServices({ authToken });

  const [selectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (authToken) {
        refreshTherapyTab(authToken, accountType, loggedInTherapist, { force: true });
        refreshScheduleData();
      }
    }, [authToken, accountType, loggedInTherapist, refreshTherapyTab, refreshScheduleData]),
  );

  const agendaItems = useMemo(
    () => getDayAgendaItems({ bookings: incomingBookings, workingHoursRules, blockedTimes, date: selectedDate }),
    [incomingBookings, workingHoursRules, blockedTimes, selectedDate],
  );

  const agendaState = useMemo(() => getCurrentAgendaState(agendaItems, now), [agendaItems, now]);
  const nextFreeGap = useMemo(() => getNextFreeGap(agendaItems, now), [agendaItems, now]);

  const bookingCount = useMemo(
    () => agendaItems.filter((i) => i.type === 'booking').length,
    [agendaItems],
  );
  const totalMin = useMemo(
    () => getTotalBookedMinutes(incomingBookings, selectedDate),
    [incomingBookings, selectedDate],
  );

  const noWorkingHours = agendaItems.length === 0;

  const name = loggedInTherapist?.fullName ?? 'Mein Konto';
  const photo = resolvePhotoUri(loggedInTherapist?.photo);

  const openBooking = useCallback(
    (booking) => {
      if (!booking) return;
      navigation.navigate(TAB_ROUTES.THERAPY, { openBookingId: booking.id });
    },
    [navigation],
  );

  const openAllBookings = useCallback(
    () => navigation.navigate(TAB_ROUTES.THERAPY),
    [navigation],
  );

  const isRefreshing = therapyRefreshing || incomingBookingsLoading;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <DashboardHeader
        name={name}
        photo={photo}
        selectedDate={selectedDate}
        bookingCount={bookingCount}
        totalMin={totalMin}
        c={c}
        insets={insets}
        onPressAvatar={() => {}}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              handleTherapyRefresh(authToken, accountType, loggedInTherapist);
              refreshScheduleData();
            }}
            tintColor={c.primary}
          />
        }
      >
        {noWorkingHours ? (
          <EmptyDayCard c={c} />
        ) : (
          <StatusCard agendaState={agendaState} nextFreeGap={nextFreeGap} now={now} servicesByKey={servicesByKey} c={c} />
        )}

        <AgendaCard
          items={agendaItems}
          agendaState={agendaState}
          onPressBooking={openBooking}
          onPressAll={openAllBookings}
          servicesByKey={servicesByKey}
          c={c}
        />

        <IconLinkCard
          iconName="clipboard-outline"
          title="Offene Aufgaben"
          subtitle="2 Dokumentationen · 1 Bestätigung ausstehend"
          c={c}
        />

        <IconLinkCard
          iconName="megaphone-outline"
          title="Neuigkeiten"
          subtitle="Neue Funktionen für Therapeuten verfügbar"
          c={c}
        />
      </ScrollView>
    </View>
  );
}
