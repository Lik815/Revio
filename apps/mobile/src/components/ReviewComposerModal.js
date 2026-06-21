import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, TUNNEL_HEADERS } from '../utils/app-utils';

export function ReviewComposerModal({ visible, onClose, c, t, authToken, bookingId, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${getBaseUrl()}/bookings/${bookingId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      if (res.ok) {
        const review = await res.json();
        onSubmitted?.(review);
        setRating(0);
        setComment('');
      }
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 18 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: c.text, textAlign: 'center' }}>
              {t('reviewModalTitle')}
            </Text>

            <View style={{ gap: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.muted }}>{t('ratingLabel')}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                    <Ionicons
                      name={n <= rating ? 'star' : 'star-outline'}
                      size={32}
                      color={n <= rating ? (c.success ?? '#5A9E8E') : c.muted}
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={t('reviewCommentPlaceholder')}
              placeholderTextColor={c.muted}
              multiline
              numberOfLines={3}
              style={{
                borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12,
                minHeight: 80, fontSize: 14, color: c.text, textAlignVertical: 'top',
              }}
            />

            <View style={{ gap: 10 }}>
              <Pressable
                style={{
                  backgroundColor: rating ? (c.success ?? '#5A9E8E') : c.mutedBg,
                  borderRadius: 14, paddingVertical: 14, alignItems: 'center',
                }}
                onPress={handleSubmit}
                disabled={!rating || submitting}
              >
                <Text style={{ color: rating ? '#fff' : c.muted, fontSize: 16, fontWeight: '700' }}>
                  {t('submitReviewCta')}
                </Text>
              </Pressable>
              <Pressable
                style={{ backgroundColor: c.mutedBg, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                onPress={onClose}
              >
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{t('cancelBtn')}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
