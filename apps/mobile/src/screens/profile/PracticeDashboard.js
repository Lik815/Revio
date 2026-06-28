import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, RADIUS, resolveMediaUrl, TUNNEL_HEADERS } from '../../utils/app-utils';
import { PracticeLogoAvatar } from '../../components/PracticeLogoAvatar';

const REVIEW_STATUS = {
  PENDING_REVIEW: { key: 'pending', label: 'In Prüfung' },
  APPROVED: { key: 'approved', label: 'Freigegeben' },
  CHANGES_REQUESTED: { key: 'changes', label: 'Änderungen erforderlich' },
  REJECTED: { key: 'rejected', label: 'Abgelehnt' },
  DRAFT: { key: 'draft', label: 'Entwurf' },
  SUSPENDED: { key: 'suspended', label: 'Pausiert' },
};

const splitCsv = (value) => value.split(',').map((s) => s.trim()).filter(Boolean);

const toForm = (p) => ({
  name: p?.name ?? '',
  postalCode: p?.postalCode ?? '',
  city: p?.city ?? '',
  address: p?.address ?? '',
  phone: p?.phone ?? '',
  email: p?.email ?? '',
  website: p?.website ?? '',
  description: p?.description ?? '',
  services: Array.isArray(p?.services) ? p.services.join(', ') : '',
});

export function PracticeDashboardScreen({
  c, t, styles, authToken, practice: initialPractice,
  specializationOptions, onProfileSaved, onAccountDeleted,
}) {
  const [practice, setPractice] = useState(initialPractice);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(initialPractice));
  const [selSpecs, setSelSpecs] = useState(Array.isArray(initialPractice?.specialties) ? initialPractice.specialties : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/practice/me`, { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          setPractice(data.practice);
          setTeam(Array.isArray(data.team) ? data.team : []);
          setForm(toForm(data.practice));
          setSelSpecs(Array.isArray(data.practice?.specialties) ? data.practice.specialties : []);
        }
      } catch {
        // keep the initial practice from props
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setField = (field, rawValue) => {
    let value = rawValue;
    if (field === 'postalCode') value = rawValue.replace(/\D/g, '').slice(0, 5);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSpec = (label) =>
    setSelSpecs((prev) => (prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]));

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) { setError('Bitte gib den Praxisnamen an.'); return; }
    if (!form.city.trim()) { setError('Bitte gib die Stadt an.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/practice/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          name: form.name.trim(),
          city: form.city.trim(),
          postalCode: form.postalCode.trim() || undefined,
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          website: form.website.trim() || undefined,
          description: form.description.trim() || undefined,
          specialties: selSpecs,
          services: splitCsv(form.services),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.message ?? t('alertConnectionError')); return; }
      setPractice(data.practice);
      setEditing(false);
      onProfileSaved?.(data.practice);
    } catch {
      setError(t('alertConnectionError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('deleteAccountTitle') ?? 'Konto löschen', t('deleteAccountConfirm') ?? 'Möchtest du dein Konto wirklich löschen?', [
      { text: t('cancelBtn') ?? 'Abbrechen', style: 'cancel' },
      {
        text: t('deleteBtn') ?? 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${getBaseUrl()}/auth/me`, { method: 'DELETE', headers: authHeaders });
            if (res.ok) onAccountDeleted?.();
            else Alert.alert(t('alertError') ?? 'Fehler', (await res.json().catch(() => ({}))).message ?? '');
          } catch {
            Alert.alert(t('alertError') ?? 'Fehler', t('alertConnectionError') ?? '');
          }
        },
      },
    ]);
  };

  const mutedText = c.textMuted ?? c.muted;
  const status = REVIEW_STATUS[practice?.reviewStatus] ?? null;
  const specialties = Array.isArray(practice?.specialties) ? practice.specialties.filter(Boolean) : [];
  const services = Array.isArray(practice?.services) ? practice.services.filter(Boolean) : [];

  if (loading && !practice) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  // ── Edit form ──────────────────────────────────────────────────────────────
  if (editing) {
    const input = (field, placeholder, extra = {}) => (
      <TextInput
        style={[styles.regInput, { color: c.text, borderColor: form[field] ? c.primary : c.border, backgroundColor: c.mutedBg }, extra.style]}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        value={form[field]}
        onChangeText={(v) => setField(field, v)}
        {...extra.props}
      />
    );
    return (
      <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 20, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, marginBottom: 16 }}>{t('practiceEditTitle')}</Text>
        <View style={{ gap: 12 }}>
          {input('name', t('practiceNameLabel'), { props: { autoCapitalize: 'words' } })}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>{input('postalCode', t('postalCodeLabel'), { props: { keyboardType: 'number-pad', maxLength: 5 } })}</View>
            <View style={{ flex: 2 }}>{input('city', t('cityLabel'), { props: { autoCapitalize: 'words' } })}</View>
          </View>
          {input('address', t('practiceAddressLabel'))}
          {input('phone', t('practicePhoneLabel'), { props: { keyboardType: 'phone-pad' } })}
          {input('email', t('practiceEmailLabel'), { props: { keyboardType: 'email-address', autoCapitalize: 'none' } })}
          {input('website', t('practiceWebsiteLabel'), { props: { autoCapitalize: 'none' } })}

          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 4 }]}>{t('practiceSpecialtiesLabel')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(specializationOptions ?? []).map((option) => {
              const isOn = selSpecs.includes(option.label);
              return (
                <Pressable
                  key={option.label}
                  onPress={() => toggleSpec(option.label)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: isOn ? c.primary : c.border, backgroundColor: isOn ? c.primaryBg : c.card }}
                >
                  {isOn && <Ionicons name="checkmark" size={14} color={c.primary} />}
                  <Text style={{ fontSize: 13, color: isOn ? c.primary : c.text, fontWeight: isOn ? '600' : '400' }}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 4 }]}>{t('practiceServicesLabel')}</Text>
          {input('services', t('practiceServicesPlaceholder'))}

          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 4 }]}>{t('practiceDescriptionLabel')}</Text>
          <TextInput
            style={[styles.regInput, { color: c.text, borderColor: form.description ? c.primary : c.border, backgroundColor: c.mutedBg, height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
            placeholder={t('practiceDescriptionPlaceholder')}
            placeholderTextColor={c.muted}
            value={form.description}
            onChangeText={(v) => setField('description', v)}
            multiline
          />
        </View>

        {!!error && (
          <View style={[styles.noticeBox, { backgroundColor: c.errorBg, borderColor: c.error, marginTop: 16 }]}>
            <Ionicons name="alert-circle-outline" size={18} color={c.error} />
            <Text style={{ fontSize: 14, color: c.error, flex: 1 }}>{error}</Text>
          </View>
        )}

        <Pressable style={[styles.registerBtn, { backgroundColor: saving ? c.border : c.primary, marginTop: 20 }]} onPress={handleSave} disabled={saving}>
          <Text style={styles.registerBtnText}>{saving ? '…' : t('saveBtn')}</Text>
        </Pressable>
        <Pressable style={{ marginTop: 14, alignItems: 'center', paddingVertical: 10 }} onPress={() => { setEditing(false); setError(''); }} disabled={saving}>
          <Text style={{ fontSize: 14, color: c.muted }}>{t('cancelBtn')}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── View mode ──────────────────────────────────────────────────────────────
  const contactRows = [
    practice?.address && { icon: 'location-outline', label: practice.address, onPress: () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(practice.address)}`) },
    practice?.phone && { icon: 'call-outline', label: practice.phone, onPress: () => Linking.openURL(`tel:${practice.phone}`) },
    practice?.email && { icon: 'mail-outline', label: practice.email, onPress: () => Linking.openURL(`mailto:${practice.email}`) },
    practice?.website && { icon: 'globe-outline', label: practice.website, onPress: () => Linking.openURL(/^https?:\/\//.test(practice.website) ? practice.website : `https://${practice.website}`) },
  ].filter(Boolean);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 }]}>
      <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border }]}>
        <PracticeLogoAvatar
          uri={practice?.logo ? resolveMediaUrl(practice.logo) : undefined}
          name={practice?.name}
          c={c}
          style={[styles.practiceLogoLarge, { borderRadius: RADIUS.md }]}
        />
        <Text style={[styles.practiceHeaderName, { color: c.text }]}>{practice?.name ?? 'Praxis'}</Text>
        <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{practice?.city ?? ''}</Text>
        {status && (
          <View style={{ marginTop: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: status.key === 'approved' ? c.successBg : c.mutedBg, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: status.key === 'approved' ? c.success : c.muted }} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: status.key === 'approved' ? c.success : c.muted }}>{status.label}</Text>
          </View>
        )}
      </View>

      <Pressable style={[styles.ctaBtn, { backgroundColor: c.primary, marginTop: 8 }]} onPress={() => { setForm(toForm(practice)); setSelSpecs(specialties); setEditing(true); }}>
        <Text style={styles.ctaBtnText}>{t('practiceEditAction')}</Text>
      </Pressable>

      {contactRows.map((row) => (
        <Pressable key={row.label} onPress={row.onPress} style={[styles.detailRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name={row.icon} size={18} color={c.primary} />
          <Text style={[styles.detailText, { color: c.primary }]}>{row.label}</Text>
        </Pressable>
      ))}

      {(specialties.length > 0 || services.length > 0) && (
        <View style={{ marginHorizontal: 16, marginTop: 8, gap: 12 }}>
          {specialties.length > 0 && (
            <View>
              <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 6 }]}>{t('practiceSpecialtiesLabel')}</Text>
              <View style={styles.tagRow}>
                {specialties.map((s) => (
                  <View key={`spec-${s}`} style={[styles.tag, { backgroundColor: c.primaryBg }]}><Text style={[styles.tagText, { color: c.primary }]}>{s}</Text></View>
                ))}
              </View>
            </View>
          )}
          {services.length > 0 && (
            <View>
              <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 6 }]}>{t('practiceServicesLabel')}</Text>
              <View style={styles.tagRow}>
                {services.map((s) => (
                  <View key={`svc-${s}`} style={[styles.tag, { backgroundColor: c.mutedBg }]}><Text style={[styles.tagText, { color: c.text }]}>{s}</Text></View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {!!practice?.description && (
        <View style={{ marginHorizontal: 16, marginTop: 12, padding: 14, backgroundColor: c.card, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ fontSize: 14, color: c.text, lineHeight: 20 }}>{practice.description}</Text>
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: c.text, marginTop: 16 }]}>{t('teamLabel')} ({team.length})</Text>
      {team.length === 0 ? (
        <View style={[styles.emptyInlineState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{t('practiceNoTeamTitle')}</Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 4 }}>{t('practiceNoTeamBody')}</Text>
        </View>
      ) : (
        team.map((member) => (
          <View key={member.id} style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.miniAvatar, { backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.primary }}>
                {(member.fullName ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: c.text }]}>{member.fullName}</Text>
              <Text style={[styles.cardTitle, { color: c.muted }]}>{member.professionalTitle ?? ''}</Text>
            </View>
          </View>
        ))
      )}

      <Pressable onPress={handleDeleteAccount} style={{ marginTop: 28, alignItems: 'center', paddingVertical: 12 }}>
        <Text style={{ fontSize: 14, color: c.error }}>{t('deleteAccountAction') ?? 'Konto löschen'}</Text>
      </Pressable>
    </ScrollView>
  );
}
