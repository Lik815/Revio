import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { RADIUS } from '../../utils/app-utils';

export function TherapistLandingScreen(props) {
  const {
    c,
    setShowLogin,
    setShowSignup,
    styles,
    t,
  } = props;
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: 'center', paddingBottom: 16 }}>

      {/* Headline */}
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: c.text, marginBottom: 8, textAlign: 'center' }}>{t('landingTitle')}</Text>
        <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
          {t('landingSub')}
        </Text>
      </View>

      {/* Feature cards */}
      <View style={{ gap: 10, marginBottom: 28 }}>
        {[
          { icon: 'search-outline', title: t('landingFeature1Title'), body: t('landingFeature1Body') },
          { icon: 'person-outline', title: t('landingFeature2Title'), body: t('landingFeature2Body') },
          { icon: 'shield-checkmark-outline', title: t('landingFeature3Title'), body: t('landingFeature3Body') },
        ].map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, paddingVertical: 12, paddingHorizontal: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={item.icon} size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{item.title}</Text>
              <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{item.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.registerBtn, { backgroundColor: c.primary }]}
        onPress={() => setShowSignup(true)}
      >
        <Text style={styles.registerBtnText}>{t('registerBtn')}</Text>
      </Pressable>

      <Pressable
        style={[styles.registerBtn, { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, marginTop: 8 }]}
        onPress={() => setShowLogin(true)}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{t('loginAction')}</Text>
      </Pressable>
    </View>
  );
}
