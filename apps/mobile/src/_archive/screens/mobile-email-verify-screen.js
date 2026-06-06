import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { softenErrorMessage } from '../../utils/app-utils';

export function EmailVerifyScreen({ status, error, onCancel, c, t, styles: sharedStyles }) {
  return (
    <ScrollView contentContainerStyle={[sharedStyles.scrollContent, { paddingBottom: 20 }]}>
      <View style={[sharedStyles.infoCard, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center', paddingVertical: 48 }]}>
        {status === 'verifying' && (
          <>
            <Text style={{ fontSize: 40, marginBottom: 16 }}>⏳</Text>
            <Text style={[sharedStyles.infoTitle, { color: c.text, textAlign: 'center' }]}>{t('emailBeingVerified')}</Text>
            <Text style={[sharedStyles.infoBody, { color: c.muted, textAlign: 'center', marginTop: 8 }]}>{t('pleaseWait')}</Text>
            <Pressable style={{ marginTop: 24, padding: 12 }} onPress={onCancel}>
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center' }}>{t('cancelBtn')}</Text>
            </Pressable>
          </>
        )}
        {status === 'success' && (
          <>
            <Ionicons name="checkmark-circle" size={52} color={c.success ?? '#22c55e'} style={{ marginBottom: 16 }} />
            <Text style={[sharedStyles.infoTitle, { color: c.text, textAlign: 'center' }]}>{t('emailVerified')}</Text>
            <Text style={[sharedStyles.infoBody, { color: c.muted, textAlign: 'center', marginTop: 8 }]}>{t('autoLogin')}</Text>
          </>
        )}
        {status === 'error' && (
          <>
            <Ionicons name="close-circle" size={52} color={c.error ?? '#ef4444'} style={{ marginBottom: 16 }} />
            <Text style={[sharedStyles.infoTitle, { color: c.text, textAlign: 'center' }]}>{t('confirmFailed')}</Text>
            <Text style={[sharedStyles.infoBody, { color: c.muted, textAlign: 'center', marginTop: 8 }]}>{softenErrorMessage(error)}</Text>
            <Pressable style={[sharedStyles.registerBtn, { backgroundColor: c.primary, marginTop: 24, paddingHorizontal: 32 }]} onPress={onCancel}>
              <Text style={sharedStyles.registerBtnText}>{t('backBtn')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}
