import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, RADIUS, SPACE, TUNNEL_HEADERS } from '../utils/app-utils';

// German labels for the backend profileCompletion checklist keys.
const CHECKLIST_LABELS = {
  name: 'Name',
  city: 'Stadt',
  specializations: 'Spezialisierungen',
  languages: 'Sprachen',
  photo: 'Profilfoto',
  certifications: 'Berufsurkunde / Fortbildungen',
  kassenart: 'Kassenart',
  homeVisitRadius: 'Hausbesuche und Radius',
  address: 'Genaue Adresse',
  employmentStatus: 'Beruflicher Status',
};

const CHECKLIST_ORDER = [
  'name', 'city', 'specializations', 'languages',
  'photo', 'certifications', 'kassenart', 'homeVisitRadius', 'address', 'employmentStatus',
];

function Row({ done, label, c }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={done ? c.success : c.muted}
      />
      <Text style={{ fontSize: 14, color: done ? c.text : c.muted, flex: 1 }}>{label}</Text>
    </View>
  );
}

// Dashboard checklist + explicit "submit for review" action. Reads the
// profileCompletion block from GET /auth/me and posts to the dedicated submit
// endpoint — the only path that moves DRAFT/CHANGES_REQUESTED -> PENDING_REVIEW.
export function ProfileChecklist({ th, authToken, onSubmitted, c, t, styles }) {
  const completion = th?.profileCompletion;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!completion) return null;

  const completed = new Set(completion.completedItems ?? []);
  const percentage = completion.percentage ?? 0;
  const reviewStatus = th.reviewStatus;
  const isPreparing = th.employmentStatus === 'PREPARING';
  const canSubmit = (reviewStatus === 'DRAFT' || reviewStatus === 'CHANGES_REQUESTED')
    && completion.readyForReview && !isPreparing;
  const inReview = reviewStatus === 'PENDING_REVIEW';
  const isApproved = reviewStatus === 'APPROVED';

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${getBaseUrl()}/therapists/me/submit-for-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        // Fastify rejects an application/json POST with an empty body.
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.message ?? t('alertConnectionError')); return; }
      onSubmitted?.(data.reviewStatus);
    } catch {
      setError(t('alertConnectionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>Profil vervollständigen</Text>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>{percentage}%</Text>
      </View>

      <View style={{ height: 8, borderRadius: 4, backgroundColor: c.mutedBg, overflow: 'hidden', marginBottom: 8 }}>
        <View style={{ width: `${percentage}%`, height: '100%', backgroundColor: c.primary }} />
      </View>

      {CHECKLIST_ORDER.map((key) => (
        <Row key={key} done={completed.has(key)} label={CHECKLIST_LABELS[key]} c={c} />
      ))}

      {isPreparing && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, padding: 12, borderRadius: RADIUS.md, backgroundColor: c.primaryBg }}>
          <Ionicons name="information-circle-outline" size={18} color={c.primary} />
          <Text style={{ fontSize: 13, color: c.text, flex: 1, lineHeight: 18 }}>
            Profil wird erst sichtbar, wenn du auf "Selbstständig" wechselst.
          </Text>
        </View>
      )}

      {!!error && (
        <Text style={{ fontSize: 13, color: c.error, marginTop: 10 }}>{error}</Text>
      )}

      {inReview && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <Ionicons name="hourglass-outline" size={16} color={c.muted} />
          <Text style={{ fontSize: 13, color: c.muted }}>Dein Profil wird gerade geprüft.</Text>
        </View>
      )}

      {isApproved && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <Ionicons name="checkmark-circle" size={16} color={c.success} />
          <Text style={{ fontSize: 13, color: c.success }}>Dein Profil ist freigegeben und sichtbar.</Text>
        </View>
      )}

      {canSubmit && (
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={[styles.registerBtn, { backgroundColor: loading ? c.border : c.primary, marginTop: 14 }]}
        >
          <Text style={styles.registerBtnText}>{loading ? '…' : 'Profil zur Prüfung einreichen'}</Text>
        </Pressable>
      )}

      {!canSubmit && !inReview && !isApproved && !completion.readyForReview && !isPreparing && (
        <Text style={{ fontSize: 13, color: c.muted, marginTop: 12 }}>
          Vervollständige alle Angaben (100%), um dein Profil zur Prüfung einzureichen.
        </Text>
      )}
    </View>
  );
}
