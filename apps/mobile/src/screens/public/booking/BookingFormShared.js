// Gemeinsame UI-Bausteine für BookingRequestForm und InquiryRequestForm.
// Beide Formulare sind 4-Schritte-Stepper mit identischem Rahmen (Header,
// Fortschrittsbalken, Chips, Fehlerbanner, Consent, Erfolgs-Screen) — nur die
// Schritt-Inhalte unterscheiden sich.
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACE, TYPE } from '../../../utils/app-utils';
import { formatTime } from './booking-form-utils';

export function ProgressBar({ step, totalSteps = 4, c }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginBottom: SPACE.lg }}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < step ? c.primary : c.border }}
        />
      ))}
    </View>
  );
}

export function ChipRow({ options, selected, onSelect, c }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const active = selected === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingVertical: 8, paddingHorizontal: 14,
              borderRadius: RADIUS.lg, borderWidth: 1.5,
              borderColor: active ? c.primary : c.border,
              backgroundColor: active ? c.primaryBg : c.mutedBg,
            }}
          >
            {active && <Ionicons name="checkmark" size={14} color={c.primary} />}
            <Text style={{ fontSize: 13, color: active ? c.primary : c.muted, fontWeight: active ? '600' : '400' }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Kopfzeile: Zurück-/Schließen-Icon, Titel, aktueller Schritt-Name.
// `minStep` steuert, ab wann der Pfeil zum X wird (Booking überspringt
// Schritt 1, wenn die Kassenart bereits bekannt ist).
export function FormHeader({ title, stepLabel, step, minStep, onBack, c }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      padding: SPACE.lg, paddingBottom: SPACE.sm,
      backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border,
    }}>
      <Pressable onPress={onBack} style={{ marginRight: 12, padding: 4 }} hitSlop={12}>
        <Ionicons name={step <= minStep ? 'close' : 'arrow-back'} size={24} color={c.muted} />
      </Pressable>
      <Text style={{ ...TYPE.h2, color: c.text, flex: 1 }}>{title}</Text>
      <Text style={{ fontSize: 13, color: c.muted }}>{stepLabel}</Text>
    </View>
  );
}

export function ErrorBanner({ error, c }) {
  if (!error) return null;
  return (
    <View style={{ backgroundColor: c.errorBg, borderRadius: RADIUS.sm, padding: 12, marginVertical: SPACE.sm, flexDirection: 'row', gap: 8 }}>
      <Ionicons name="alert-circle-outline" size={16} color={c.error} />
      <Text style={{ ...TYPE.small, color: c.error, flex: 1 }}>{error}</Text>
    </View>
  );
}

export function ConsentCheckbox({ consent, onToggle, c }) {
  return (
    <Pressable
      onPress={onToggle}
      style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACE.md, gap: 10 }}
    >
      <View style={{
        width: 22, height: 22, borderRadius: 4,
        borderWidth: 1.5, borderColor: consent ? c.primary : c.border,
        backgroundColor: consent ? c.primary : 'transparent',
        alignItems: 'center', justifyContent: 'center', marginTop: 1,
      }}>
        {consent && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <Text style={{ ...TYPE.small, color: c.muted, flex: 1, lineHeight: 20 }}>
        Ich stimme zu, dass meine Kontaktdaten zur Terminvermittlung verwendet werden.
      </Text>
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, disabled = false, loading = false, c }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        backgroundColor: disabled || loading ? c.border : c.primary,
        borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center',
      }}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={{ ...TYPE.label, color: '#fff', fontSize: 16 }}>{label}</Text>}
    </Pressable>
  );
}

// Erfolgs-Screen nach dem Absenden. `highlight` ist die optional hervorgehobene
// Zeile (z. B. der gebuchte Termin), `body` der erklärende Text darunter.
export function SuccessScreen({ title, therapistName, highlight, body, buttonLabel, onDone, c }) {
  return (
    <View style={{ flex: 1, padding: SPACE.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
      <Ionicons name="checkmark-circle" size={64} color={c.success ?? '#1A7A40'} />
      <Text style={{ ...TYPE.h2, color: c.text, marginTop: SPACE.md, textAlign: 'center' }}>{title}</Text>
      {therapistName ? (
        <Text style={{ ...TYPE.body, color: c.text, marginTop: SPACE.sm, textAlign: 'center', fontWeight: '600' }}>
          {therapistName}
        </Text>
      ) : null}
      {highlight ? (
        <Text style={{ ...TYPE.body, color: c.primary, marginTop: 4, textAlign: 'center' }}>{highlight}</Text>
      ) : null}
      <Text style={{ ...TYPE.body, color: c.muted, marginTop: SPACE.sm, textAlign: 'center' }}>{body}</Text>
      <Pressable
        onPress={onDone}
        style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 14, paddingHorizontal: 32, marginTop: SPACE.lg }}
      >
        <Text style={{ ...TYPE.label, color: '#fff' }}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

// Aufklappbare Tageskarte mit Uhrzeit-Chips (max. 6 sichtbar, dann "MEHR").
// Wird vom einfachen 14-Tage-Picker (BookingRequestForm) und vom
// Wochen-SlotPicker (InquiryRequestForm) gleichermaßen genutzt.
export function SlotDayGroup({
  group, isOpen, onToggleOpen, showAll, onShowAll,
  isSlotActive, isSlotDisabled, onPressSlot, c,
}) {
  const visibleSlots = showAll ? group.slots : group.slots.slice(0, 6);
  const hasMore = group.slots.length > 6 && !showAll;
  const groupHasSelected = group.slots.some((slot) => isSlotActive(slot));

  return (
    <View style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
      <Pressable
        onPress={onToggleOpen}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: c.card }}
      >
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: c.text }}>{group.label}</Text>
        {groupHasSelected && !isOpen && (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginRight: 8 }} />
        )}
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
      </Pressable>

      {isOpen && (
        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {visibleSlots.map((slot) => {
              const active = isSlotActive(slot);
              const disabled = isSlotDisabled ? isSlotDisabled(slot) : false;
              return (
                <Pressable
                  key={slot.startsAt}
                  onPress={() => { if (!disabled) onPressSlot(slot); }}
                  style={{
                    paddingVertical: 10, paddingHorizontal: 14,
                    borderRadius: RADIUS.sm, borderWidth: 1.5,
                    borderColor: active ? c.primary : c.border,
                    backgroundColor: active ? c.primaryBg : disabled ? c.mutedBg : c.card,
                    minWidth: 72, alignItems: 'center',
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? c.primary : c.text }}>
                    {formatTime(slot.startsAt)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {hasMore && (
            <Pressable onPress={onShowAll} style={{ marginTop: 10, alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary, letterSpacing: 0.4 }}>MEHR</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
