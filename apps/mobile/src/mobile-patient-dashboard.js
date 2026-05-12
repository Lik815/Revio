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
import { getBaseUrl, RADIUS, SHADOW, SPACE, TUNNEL_HEADERS, TYPE } from './mobile-utils';

const PRIVACY_NOTICE = 'Deine Daten sind sicher und nur für dich sichtbar. Du kannst sie jederzeit bearbeiten.';

export function PatientDashboardScreen({ c, loggedInPatient, styles, t, authToken, onProfileSaved }) {
  const firstName = loggedInPatient?.firstName ?? '';
  const lastName = loggedInPatient?.lastName ?? '';
  const email = loggedInPatient?.email ?? '';
  const phone = loggedInPatient?.phone ?? null;
  const initials = ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase() || '?';

  const [editing, setEditing] = useState(false);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const openEdit = () => {
    setEditFirst(firstName);
    setEditLast(lastName);
    setEditPhone(phone ?? '');
    setSaveError('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setSaveError('');
  };

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
      onProfileSaved({ firstName: data.firstName, lastName: data.lastName, phone: data.phone ?? null });
      setEditing(false);
    } catch {
      setSaveError('Verbindungsfehler.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, paddingTop: 8 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profilkopf ─────────────────────────────────────────────── */}
      <View style={{ position: 'relative', alignItems: 'center', paddingTop: 28, paddingBottom: 24 }}>
        {/* Runder Edit-Shortcut oben rechts */}
        {!editing && (
          <Pressable
            onPress={openEdit}
            style={{ position: 'absolute', top: 16, right: 0, width: 38, height: 38, borderRadius: 19, backgroundColor: c.mutedBg, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="pencil-outline" size={17} color={c.text} />
          </Pressable>
        )}

        {/* Avatar */}
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14, ...SHADOW.card }}>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{initials}</Text>
        </View>

        {/* Name + Rolle */}
        <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, textAlign: 'center' }}>
          {firstName} {lastName}
        </Text>
        <Text style={{ fontSize: 14, color: c.muted, marginTop: 4, textAlign: 'center' }}>
          {t('patientRoleLabel')}
        </Text>
      </View>

      {/* ── Info-Card ──────────────────────────────────────────────── */}
      {!editing && (
        <>
          <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, overflow: 'hidden', marginBottom: 12 }}>
            {/* E-Mail Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 14 }}>
              <Ionicons name="mail-outline" size={18} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{t('emailLabel')}</Text>
                <Text style={{ fontSize: 14, color: c.text, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>{email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={c.muted} />
            </View>

            {/* Trennlinie */}
            <View style={{ height: 1, backgroundColor: c.border, marginHorizontal: 16 }} />

            {/* Telefon Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 14 }}>
              <Ionicons name="call-outline" size={18} color={phone ? c.primary : c.muted} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{t('phoneLabel') ?? 'Telefon'}</Text>
                <Text style={{ fontSize: 14, color: phone ? c.text : c.muted, fontWeight: phone ? '500' : '400', marginTop: 2 }} numberOfLines={1}>
                  {phone ?? (t('phonePlaceholder') ?? '+49 …')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={c.muted} />
            </View>
          </View>

          {/* Datenschutzhinweis */}
          <Text style={{ fontSize: 12, color: c.muted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8, marginBottom: 4 }}>
            {PRIVACY_NOTICE}
          </Text>
        </>
      )}

      {/* ── Edit-Modus ─────────────────────────────────────────────── */}
      {editing && (
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 4 }}>{t('editProfileAction')}</Text>

          <TextInput
            value={editFirst}
            onChangeText={setEditFirst}
            placeholder={t('firstNamePlaceholder')}
            placeholderTextColor={c.muted}
            style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          />
          <TextInput
            value={editLast}
            onChangeText={setEditLast}
            placeholder={t('lastNamePlaceholder') ?? t('lastName')}
            placeholderTextColor={c.muted}
            style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          />
          <TextInput
            value={editPhone}
            onChangeText={setEditPhone}
            placeholder={t('phonePlaceholder') ?? '+49 …'}
            placeholderTextColor={c.muted}
            keyboardType="phone-pad"
            style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          />

          {!!saveError && <Text style={{ color: c.error, fontSize: 13 }}>{saveError}</Text>}

          <Pressable
            onPress={saveEdit}
            disabled={saving}
            style={[styles.registerBtn, { backgroundColor: saving ? c.border : c.primary, opacity: saving ? 0.7 : 1, marginTop: 4 }]}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.registerBtnText}>{t('saveBtn')}</Text>
            }
          </Pressable>
          <Pressable onPress={cancelEdit} style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ color: c.muted, fontSize: 14 }}>{t('cancelBtn')}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
