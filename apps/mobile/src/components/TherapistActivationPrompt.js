import React from 'react';
import { Pressable, Text, View } from 'react-native';

export function TherapistActivationPrompt({ reviewApproved, activationLoading, activationError, onActivate, c, styles }) {
  return (
    <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 20 }]}>
        <Text style={[styles.emptyTitle, { color: c.text }]}>Terminanfragen sind noch nicht aktiviert.</Text>
        <Text style={[styles.emptyBody, { color: c.muted }]}>
          {reviewApproved
            ? 'Du kannst Terminanfragen jetzt direkt hier aktivieren und danach sofort Slots anlegen.'
            : 'Dein Profil wird noch geprüft. Sobald es freigegeben ist, kannst du Terminanfragen hier aktivieren.'}
        </Text>
        <Pressable
          onPress={onActivate}
          disabled={!reviewApproved || activationLoading}
          style={{
            marginTop: 16,
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 18,
            alignItems: 'center',
            backgroundColor: reviewApproved ? c.primary : c.border,
          }}
        >
          <Text style={{ color: reviewApproved ? '#fff' : c.muted, fontSize: 14, fontWeight: '700' }}>
            {activationLoading
              ? 'Wird aktiviert…'
              : reviewApproved
              ? 'Terminanfragen aktivieren'
              : 'Wartet auf Profilprüfung'}
          </Text>
        </Pressable>
        {!!activationError && (
          <Text style={{ marginTop: 10, fontSize: 13, color: c.error, textAlign: 'center' }}>
            {activationError}
          </Text>
        )}
      </View>
    </View>
  );
}
