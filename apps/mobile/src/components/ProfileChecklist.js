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
  document: 'Nachweis',
  phone: 'Telefonnummer',
  certifications: 'Fortbildungen',
  kassenart: 'Kassenart',
  homeVisitRadius: 'Hausbesuche und Radius',
  address: 'Genaue Adresse',
  bio: 'Über mich',
};

const CHECKLIST_ORDER = [
  'name', 'city', 'specializations', 'languages',
  'photo', 'document', 'phone', 'certifications', 'kassenart', 'homeVisitRadius', 'address', 'bio',
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
export function ProfileChecklist({ th, authToken, onSubmitted, onOpenWizard, c, t, styles }) {
  const completion = th?.profileCompletion;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!completion) return null;

  const completed = new Set(completion.completedItems ?? []);
  const completedCount = CHECKLIST_ORDER.filter((key) => completed.has(key)).length;
  const percentage = Math.round((completedCount / CHECKLIST_ORDER.length) * 100);
  const reviewStatus = th.reviewStatus;
  const canSubmit = (reviewStatus === 'DRAFT' || reviewStatus === 'CHANGES_REQUESTED')
    && completion.readyForReview;
  const inReview = reviewStatus === 'PENDING_REVIEW';
  const isApproved = reviewStatus === 'APPROVED';
  const showRows = percentage < 100;

  if (isApproved) return null;

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

      {showRows && CHECKLIST_ORDER.map((key) => (
        <Row key={key} done={completed.has(key)} label={CHECKLIST_LABELS[key]} c={c} />
      ))}

      {!!error && (
        <Text style={{ fontSize: 13, color: c.error, marginTop: 10 }}>{error}</Text>
      )}

      {inReview && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <Ionicons name="hourglass-outline" size={16} color={c.muted} />
          <Text style={{ fontSize: 13, color: c.muted }}>Dein Profil wird gerade geprüft.</Text>
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

      {!canSubmit && !inReview && !completion.readyForReview && (
        <>
          <Pressable
            onPress={onOpenWizard}
            style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 14 }]}
          >
            <Text style={styles.registerBtnText}>Profil vervollständigen</Text>
          </Pressable>
          <Text style={{ fontSize: 13, color: c.muted, marginTop: 10, textAlign: 'center' }}>
            Vervollständige alle Angaben (100%), um dein Profil zur Prüfung einzureichen.
          </Text>
        </>
      )}
    </View>
  );
}
