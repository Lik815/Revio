import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, SPACE, TUNNEL_HEADERS } from '../utils/app-utils';

function StarRow({ rating, size = 14, color }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color={color} />
      ))}
    </View>
  );
}

function ReviewCard({ c, review }) {
  const date = new Date(review.createdAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{review.patientName}</Text>
        <StarRow rating={review.rating} color={c.success ?? '#5A9E8E'} />
      </View>
      {review.comment ? (
        <Text style={{ fontSize: 13, color: c.muted, lineHeight: 19 }}>{review.comment}</Text>
      ) : null}
      <Text style={{ fontSize: 11, color: c.muted }}>{date}</Text>
    </View>
  );
}

export function ReviewsSection({ c, t, styles, therapistId, authToken }) {
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!authToken || !therapistId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${getBaseUrl()}/therapists/${therapistId}/reviews`, {
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setReviews(data.reviews ?? []);
        setSummary(data.summary ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authToken, therapistId]);

  return (
    <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 0 }]}>{t('reviewsTitle')}</Text>
        {summary?.count > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <StarRow rating={summary.avgRating ?? 0} color={c.success ?? '#5A9E8E'} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: c.text }}>
              {summary.avgRating?.toFixed(1)} {t('reviewsAvgLabel')}
            </Text>
          </View>
        ) : null}
      </View>

      {!authToken ? (
        <Text style={{ fontSize: 13, color: c.muted, marginTop: SPACE.sm, lineHeight: 19 }}>{t('reviewsLoginRequired')}</Text>
      ) : loading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: SPACE.sm }} />
      ) : reviews.length === 0 ? (
        <Text style={{ fontSize: 13, color: c.muted, marginTop: SPACE.sm }}>{t('reviewsEmpty')}</Text>
      ) : (
        <View>
          {reviews.map((review) => <ReviewCard key={review.id} c={c} review={review} />)}
        </View>
      )}
    </View>
  );
}
