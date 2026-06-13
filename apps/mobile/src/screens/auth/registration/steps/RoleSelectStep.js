import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '../../../../components/BackButton';

// Step 1 — choose patient vs therapist. The role is kept locally in
// RegistrationFlow until an account is actually created.
export function RoleSelectStep({ onSelectRole, onBack, c, t }) {
  const selectRole = onSelectRole;
  return (
    <View style={{ flex: 1, paddingHorizontal: 20 }}>
      <BackButton c={c} label={t('backBtn')} onPress={onBack} />
      <View style={{ paddingTop: 8, paddingBottom: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>{t('registerRoleTitle')}</Text>
        <Text style={{ fontSize: 14, color: c.muted, marginTop: 4 }}>{t('registerRoleBody')}</Text>
      </View>

      <View style={{ gap: 12 }}>
        <Pressable
          onPress={() => selectRole('patient')}
          style={({ pressed }) => [{
            backgroundColor: c.primary,
            borderRadius: 16,
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            opacity: pressed ? 0.8 : 1,
          }]}
        >
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="heart-outline" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>{t('registerRolePatient')}</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{t('registerRolePatientSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.75)" />
        </Pressable>

        <Pressable
          onPress={() => selectRole('therapist')}
          style={({ pressed }) => [{
            backgroundColor: c.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: c.border,
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            opacity: pressed ? 0.7 : 1,
          }]}
        >
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person-outline" size={24} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{t('registerRoleTherapist')}</Text>
            <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>{t('registerRoleTherapistSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.muted} />
        </Pressable>
      </View>
    </View>
  );
}
