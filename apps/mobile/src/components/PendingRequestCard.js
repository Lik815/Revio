import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { kassenartOptions } from '../utils/app-utils';
import { useConfigOptions } from '../hooks/use-config-options';
import { DeclineBookingModal } from '../modals/DeclineBookingModal';

function resolveKassenartLabel(key) {
  if (!key) return null;
  return kassenartOptions.find((opt) => opt.key === key)?.label ?? null;
}

function initialsOf(name) {
  return (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatRequestCreatedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return `Heute, ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Gestern, ${time}`;

  return `${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}, ${time}`;
}

function formatRequestSlot(slot, booking) {
  const slotDate = slot?.startsAt ?? booking?.confirmedSlotAt ?? null;
  if (!slotDate) return 'Terminzeit offen';
  const date = new Date(slotDate);
  if (Number.isNaN(date.getTime())) return 'Terminzeit offen';
  const day = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time} Uhr · ${slot?.durationMin ?? 20} Min`;
}

export function PendingRequestCard({ c, slot, booking, onRespond }) {
  const { heilmittelOptions } = useConfigOptions();
  const [loading, setLoading] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [error, setError] = useState('');
  const patientName = booking?.patientName || 'Patient';
  const contact = booking?.patientPhone || booking?.patientEmail || '';
  const requestTime = formatRequestCreatedAt(booking?.createdAt);
  const slotLabel = formatRequestSlot(slot, booking);
  const heilmittelLabel = heilmittelOptions.find((opt) => opt.key === booking?.heilmittel)?.label ?? null;
  const kassenartLabel = resolveKassenartLabel(booking?.kassenart);
  const treatmentLabel = [heilmittelLabel, kassenartLabel].filter(Boolean).join(' · ');

  const handleRespond = async (action, declinedReason) => {
    if (!onRespond || !booking) return;
    setError('');
    setLoading(true);
    try {
      const body = action === 'CONFIRM'
        ? { action: 'CONFIRM' }
        : { action: 'DECLINE', declinedReason: declinedReason?.trim() || undefined };
      await onRespond(booking.id, body);
      if (action === 'DECLINE') setShowDeclineModal(false);
    } catch (e) {
      setError(e?.message ?? 'Fehler beim Speichern.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F2D79B',
        padding: 12,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ backgroundColor: c.warningBg ?? '#FEF5DC', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: c.warning ?? '#8A6000', textTransform: 'uppercase' }}>Neue Anfrage</Text>
        </View>
        {requestTime ? (
          <Text style={{ fontSize: 12, fontWeight: '500', color: c.muted }}>{requestTime}</Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.primary }}>{initialsOf(patientName)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }} numberOfLines={1}>{patientName}</Text>
          {contact ? (
            <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }} numberOfLines={1}>{contact}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <Ionicons name="calendar-outline" size={13} color={c.muted} />
            <Text style={{ flex: 1, fontSize: 13, color: c.text, fontWeight: '600' }} numberOfLines={1}>{slotLabel}</Text>
          </View>
          {treatmentLabel ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
              <Ionicons name="medkit-outline" size={13} color={c.muted} />
              <Text style={{ flex: 1, fontSize: 13, color: c.text, fontWeight: '600' }} numberOfLines={1}>{treatmentLabel}</Text>
            </View>
          ) : null}
          {booking?.message ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 5 }}>
              <Ionicons name="chatbubble-outline" size={13} color={c.muted} />
              <Text style={{ flex: 1, fontSize: 12, color: c.muted, fontStyle: 'italic' }}>„{booking.message}"</Text>
            </View>
          ) : null}
        </View>
      </View>

      {!!error && !showDeclineModal ? (
        <Text style={{ fontSize: 12, color: c.error ?? '#DC2626', marginTop: 8 }}>{error}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Pressable
          onPress={() => setShowDeclineModal(true)}
          disabled={loading}
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: loading ? 0.65 : 1,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.muted }}>Ablehnen</Text>
        </Pressable>
        <Pressable
          onPress={() => handleRespond('CONFIRM')}
          disabled={loading}
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: c.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Bestätigen</Text>
          )}
        </Pressable>
      </View>

      <DeclineBookingModal
        visible={showDeclineModal}
        onClose={() => { setShowDeclineModal(false); setError(''); }}
        onConfirm={(reason) => handleRespond('DECLINE', reason)}
        booking={booking}
        loading={loading}
        error={error}
        c={c}
      />
    </View>
  );
}
