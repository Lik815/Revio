import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { deleteAccountRequest, getBaseUrl, RADIUS, SHADOW, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { DeleteAccountModal } from '../../modals/DeleteAccountModal';
import { useAuth } from '../../context/AuthContext';

export function PatientDashboardScreen({
  c, loggedInPatient, styles, t, authToken, onProfileSaved, onAccountDeleted,
  favorites = [], myAppointments = [], onOpenTherapist,
}) {
  const { setLoggedInPatient } = useAuth();

  const firstName = loggedInPatient?.firstName ?? '';
  const lastName = loggedInPatient?.lastName ?? '';
  const email = loggedInPatient?.email ?? '';
  const phone = loggedInPatient?.phone ?? null;
  const createdAt = loggedInPatient?.createdAt ?? null;
  const initials = ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase() || '?';

  const profileComplete = !!(firstName && lastName && phone);
  const memberSince = createdAt ? new Date(createdAt).getFullYear() : null;

  const activeApts = myAppointments.filter(a => ['PENDING', 'CONFIRMED'].includes(a.status));
  const confirmedPast = myAppointments
    .filter(a => a.status === 'CONFIRMED' && new Date(a.startsAt ?? a.slot?.startsAt ?? a.confirmedSlotAt ?? 0) < new Date())
    .sort((a, b) => new Date(b.startsAt ?? b.slot?.startsAt ?? b.confirmedSlotAt ?? 0) - new Date(a.startsAt ?? a.slot?.startsAt ?? a.confirmedSlotAt ?? 0));
  const lastTherapy = confirmedPast[0] ?? null;
  const lastTherapyDate = lastTherapy
    ? new Date(lastTherapy.startsAt ?? lastTherapy.slot?.startsAt ?? lastTherapy.confirmedSlotAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  const [editing, setEditing] = useState(false);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const openEdit = () => {
    setEditFirst(firstName);
    setEditLast(lastName);
    setEditPhone(phone ?? '');
    setSaveError('');
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setSaveError(''); };

  const saveEdit = async () => {
    if (!editFirst.trim()) { setSaveError(t('firstNameRequired')); return; }
    if (!editLast.trim()) { setSaveError(t('lastNameRequired')); return; }
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ firstName: editFirst.trim(), lastName: editLast.trim(), phone: editPhone.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(data.message ?? 'Fehler beim Speichern.'); return; }
      // Update AuthContext directly (same pattern as the therapist dashboard) —
      // AuthBridge then keeps the zustand store in sync automatically, instead of
      // each screen mutating the store on its own and drifting out of sync.
      setLoggedInPatient((prev) => ({ ...prev, firstName: data.firstName, lastName: data.lastName, phone: data.phone ?? null }));
      onProfileSaved();
      setEditing(false);
    } catch {
      setSaveError('Verbindungsfehler.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccountConfirmed = async () => {
    if (isDeletingAccount) return;
    setIsDeletingAccount(true);
    try {
      const result = await deleteAccountRequest(authToken);
      if (!result.ok) {
        Alert.alert('Konto konnte nicht gelöscht werden', result.message);
        return;
      }
      onAccountDeleted?.();
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profilkopf ──────────────────────────────────────────────── */}
      <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
          {/* Avatar */}
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>{initials}</Text>
          </View>

          {/* Name + Rolle + Badges */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }} numberOfLines={1}>
              {firstName} {lastName}
            </Text>
            <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>{t('patientRoleLabel') ?? 'Patient:in'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {profileComplete && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: (c.successBg ?? '#f0fdf4'), borderRadius: 20, paddingVertical: 3, paddingHorizontal: 8 }}>
                  <Ionicons name="checkmark-circle" size={11} color={c.success ?? '#22c55e'} />
                  <Text style={{ fontSize: 11, color: c.success ?? '#22c55e', fontWeight: '600' }}>Profil vollständig</Text>
                </View>
              )}
              {memberSince && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.mutedBg ?? '#f3f4f6', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 8 }}>
                  <Ionicons name="calendar-outline" size={11} color={c.muted} />
                  <Text style={{ fontSize: 11, color: c.muted, fontWeight: '500' }}>Seit {memberSince}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Edit-Button */}
          <Pressable
            onPress={editing ? cancelEdit : openEdit}
            style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
            hitSlop={8}
          >
            <Ionicons name={editing ? 'close-outline' : 'pencil-outline'} size={16} color={c.text} />
          </Pressable>
        </View>
      </View>

      {/* ── Edit-Formular ───────────────────────────────────────────── */}
      {editing && (
        <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md, gap: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{t('editProfileAction')}</Text>
          <TextInput
            value={editFirst}
            onChangeText={setEditFirst}
            placeholder={t('firstNamePlaceholder')}
            placeholderTextColor={c.muted}
            style={[styles.regInput, { backgroundColor: c.mutedBg, borderColor: c.border, color: c.text }]}
          />
          <TextInput
            value={editLast}
            onChangeText={setEditLast}
            placeholder={t('lastNamePlaceholder') ?? t('lastName')}
            placeholderTextColor={c.muted}
            style={[styles.regInput, { backgroundColor: c.mutedBg, borderColor: c.border, color: c.text }]}
          />
          <TextInput
            value={editPhone}
            onChangeText={setEditPhone}
            placeholder={t('phonePlaceholder') ?? '+49 …'}
            placeholderTextColor={c.muted}
            keyboardType="phone-pad"
            style={[styles.regInput, { backgroundColor: c.mutedBg, borderColor: c.border, color: c.text }]}
          />
          {!!saveError && <Text style={{ color: c.error, fontSize: 13 }}>{saveError}</Text>}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={cancelEdit}
              style={{ flex: 1, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted }}>{t('cancelBtn')}</Text>
            </Pressable>
            <Pressable
              onPress={saveEdit}
              disabled={saving}
              style={{ flex: 1, borderRadius: RADIUS.md, backgroundColor: saving ? c.border : c.primary, paddingVertical: 12, alignItems: 'center' }}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{t('saveBtn')}</Text>
              }
            </Pressable>
          </View>

          <Pressable
            onPress={() => setShowDeleteAccount(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 6, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.error }}
          >
            <Ionicons name="trash-outline" size={16} color={c.error} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.error }}>{t('deleteAccount')}</Text>
          </Pressable>
        </View>
      )}

      <DeleteAccountModal
        visible={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        onConfirmed={handleDeleteAccountConfirmed}
        loggedInPatient={loggedInPatient}
        c={c} t={t}
      />

      {/* ── Kontakt ─────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginBottom: SPACE.md }}>Kontakt</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
          <Ionicons name="call-outline" size={18} color={c.muted} />
          <Text style={{ flex: 1, fontSize: 15, color: phone ? c.text : c.muted }}>
            {phone ?? (t('phonePlaceholder') ?? '+49 …')}
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: c.border, marginVertical: SPACE.md }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
          <Ionicons name="mail-outline" size={18} color={c.muted} />
          <Text style={{ flex: 1, fontSize: 15, color: c.text }}>{email}</Text>
        </View>
      </View>

      {/* ── Therapie-Übersicht ───────────────────────────────────────── */}
      <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginBottom: SPACE.md }}>Therapie</Text>

        <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
          {/* Gespeicherte Therapeuten */}
          <View style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.md, padding: SPACE.md, alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: c.primary }}>{favorites.length}</Text>
            <Text style={{ fontSize: 11, color: c.muted, textAlign: 'center' }}>Gespeicherte{'\n'}Therapeuten</Text>
          </View>

          {/* Aktive Termine */}
          <View style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.md, padding: SPACE.md, alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: activeApts.length > 0 ? c.primary : c.muted }}>
              {activeApts.length}
            </Text>
            <Text style={{ fontSize: 11, color: c.muted, textAlign: 'center' }}>Aktive{'\n'}Termine</Text>
          </View>

          {/* Letzte Therapie */}
          <View style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.md, padding: SPACE.md, alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: lastTherapyDate ? 13 : 22, fontWeight: '800', color: lastTherapyDate ? c.text : c.muted }} numberOfLines={2}>
              {lastTherapyDate ?? '—'}
            </Text>
            <Text style={{ fontSize: 11, color: c.muted, textAlign: 'center' }}>Letzte{'\n'}Therapie</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
