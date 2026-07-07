import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable, RefreshControl,
  Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccountHeader } from '../../components/AccountHeader';
import { PatientAppointmentCard, PatientNextAppointmentCard } from './AppointmentCards';
import { getAppointmentDate, getNextPatientAppointment, getBaseUrl, RADIUS, TUNNEL_HEADERS } from '../../utils/app-utils';

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

const INQUIRY_STATUS_LABEL = {
  SENT: 'Gesendet', SEEN: 'Gesehen', COUNTER_PROPOSED: 'Gegenvorschlag',
  CONFIRMED: 'Bestätigt', DECLINED: 'Abgelehnt', DECLINED_BY_PATIENT: 'Abgelehnt',
  WITHDRAWN: 'Zurückgezogen', AUTO_CLOSED: 'Anderweitig', EXPIRED: 'Abgelaufen', CANCELLED: 'Abgesagt',
};

function PatientRequestCard({ request, authToken, onWithdrawn, c }) {
  const [withdrawing, setWithdrawing] = useState(false);
  const inquiries = request.inquiries ?? [];
  const active = inquiries.filter((q) => !['WITHDRAWN', 'AUTO_CLOSED', 'DECLINED', 'DECLINED_BY_PATIENT', 'EXPIRED', 'CANCELLED'].includes(q.status));
  const confirmed = inquiries.find((q) => q.status === 'CONFIRMED');
  const canWithdraw = !confirmed && active.length > 0;

  const handleWithdraw = () => {
    Alert.alert('Anfrage zurueckziehen', 'Alle offenen Anfragen an Praxen werden zurueckgezogen.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Zurueckziehen', style: 'destructive', onPress: async () => {
          setWithdrawing(true);
          try {
            await Promise.all(
              active.map((q) => fetch(`${getBaseUrl()}/inquiry/${q.id}/withdraw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
              }))
            );
            onWithdrawn?.(request.id);
          } catch {} finally { setWithdrawing(false); }
        },
      },
    ]);
  };

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
          {request.heilmittel}
          {' · '}
          {request.suchtyp === 'EINZELTERMIN'
            ? 'Einzeltermin'
            : request.frequenz === 'X1' ? '1×/Woche' : request.frequenz === 'X2' ? '2×/Woche' : '3×/Woche'}
        </Text>
        <View style={{ backgroundColor: confirmed ? '#D1FAE5' : '#FEF3C7', borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: confirmed ? '#065F46' : '#92400E' }}>
            {confirmed ? 'Bestätigt' : `${active.length} offen`}
          </Text>
        </View>
      </View>
      {inquiries.length > 0 && (
        <View style={{ gap: 4, marginBottom: canWithdraw ? 10 : 0 }}>
          {inquiries.map((q) => (
            <View key={q.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: q.status === 'CONFIRMED' ? '#10B981' : q.status === 'SEEN' ? '#3B82F6' : '#F59E0B' }} />
              <Text style={{ fontSize: 12, color: c.muted }}>
                {q.therapistName ?? 'Praxis'} · {INQUIRY_STATUS_LABEL[q.status] ?? q.status}
              </Text>
            </View>
          ))}
        </View>
      )}
      {canWithdraw && (
        <Pressable onPress={handleWithdraw} disabled={withdrawing} style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, alignItems: 'center' }}>
          {withdrawing
            ? <ActivityIndicator size="small" color={c.muted} />
            : <Text style={{ fontSize: 13, color: c.muted, fontWeight: '600' }}>Alle Anfragen zurueckziehen</Text>}
        </Pressable>
      )}
    </View>
  );
}

export function TherapyTabPatient({
  myAppointments, myAppointmentsLoading,
  therapyRefreshing, appointmentsLastLoadedAt,
  myInquiries, myInquiriesLoading,
  onInquiryWithdrawn,
  onRefresh, onOpenTherapistById, onSelectAppointment,
  authToken,
  c, t, styles,
}) {
  // Tapping the next-appointment card's Kommend/Vergangen counters swaps
  // which list renders below — not an inline expansion, so only one list
  // is ever on screen at a time, in the same spot.
  const [activeView, setActiveView] = useState('kommend');

  const { kommend, vergangen } = useMemo(() => {
    const now = new Date();
    const upcoming = [...myAppointments]
      .filter(a => ['CONFIRMED', 'PENDING'].includes(a.status) && getAppointmentDate(a) >= now)
      .sort((a, b) => getAppointmentDate(a) - getAppointmentDate(b));
    const past = [...myAppointments]
      .filter(a =>
        ['CANCELLED', 'DECLINED', 'EXPIRED'].includes(a.status) ||
        (a.status === 'CONFIRMED' && getAppointmentDate(a) < now)
      )
      .sort((a, b) => getAppointmentDate(b) - getAppointmentDate(a));
    return { kommend: upcoming, vergangen: past };
  }, [myAppointments]);

  const nextApt = getNextPatientAppointment(myAppointments);
  const isPastView = activeView === 'vergangen';
  const activeList = isPastView ? vergangen : kommend;

  const openTherapist = (th) => {
    if (th?.id) onOpenTherapistById(th.id, th);
  };

  const rows = useMemo(() => {
    if (activeList.length === 0) return [{ type: 'empty', key: 'empty' }];
    return activeList.map((appointment, index) => ({
      type: 'appointment', key: appointment.id, appointment,
      isPast: isPastView,
      isFirst: index === 0, isLast: index === activeList.length - 1,
    }));
  }, [activeList, isPastView]);

  const showLoading = shouldShowSectionLoading(myAppointmentsLoading, appointmentsLastLoadedAt);
  const heading = isPastView ? 'Vergangene Termine' : 'Deine Termine';

  if (showLoading) {
    return (
      <View style={{ flex: 1 }}>
        <AccountHeader c={c} subtitle="Termine" />
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 20, marginHorizontal: 16 }]}>
          <ActivityIndicator color={c.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AccountHeader c={c} subtitle="Termine" />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item }) => {
          if (item.type === 'empty') {
            if (!isPastView) {
              const trulyEmpty = myAppointments.length === 0;
              return (
                <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: trulyEmpty ? 32 : 24, paddingHorizontal: 20, alignItems: 'center', marginBottom: 12 }}>
                  {trulyEmpty ? (
                    <>
                      <Ionicons name="calendar-outline" size={36} color={c.muted} style={{ marginBottom: 12 }} />
                      <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, textAlign: 'center' }}>Noch keine Termine</Text>
                      <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                        Suche einen Therapeuten und buche deinen ersten Termin.
                      </Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>Keine kommenden Termine</Text>
                  )}
                </View>
              );
            }
            return (
              <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>Keine vergangenen Termine</Text>
              </View>
            );
          }

          return (
            <PatientAppointmentCard
              c={c}
              appointment={item.appointment}
              isPast={item.isPast}
              isFirst={item.isFirst}
              isLast={item.isLast}
              onOpenDetail={() => onSelectAppointment(item.appointment)}
            />
          );
        }}
        ListHeaderComponent={(
          <>
            <PatientNextAppointmentCard
              c={c}
              appointment={nextApt}
              kommendCount={kommend.length}
              vergangenCount={vergangen.length}
              onOpenDetail={() => nextApt && onSelectAppointment(nextApt)}
              onViewTherapist={() => nextApt && openTherapist(nextApt.therapist)}
              activeView={activeView}
              onSelectKommend={() => setActiveView('kommend')}
              onSelectVergangen={() => setActiveView('vergangen')}
            />
            {/* Offene Anfragen (Phase 2 Inquiry-System) */}
            {Array.isArray(myInquiries) && myInquiries.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: c.text, marginBottom: 10 }}>Offene Anfragen</Text>
                {myInquiries
                  .filter((r) => (r.inquiries ?? []).some((q) => !['WITHDRAWN', 'EXPIRED', 'CANCELLED', 'AUTO_CLOSED'].includes(q.status)))
                  .map((request) => (
                    <PatientRequestCard
                      key={request.id}
                      request={request}
                      authToken={authToken}
                      onWithdrawn={onInquiryWithdrawn}
                      c={c}
                    />
                  ))}
              </View>
            )}
            <Text style={{ fontSize: 16, fontWeight: '800', color: c.text, marginBottom: 12 }}>{heading}</Text>
          </>
        )}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32, paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      />
    </View>
  );
}
