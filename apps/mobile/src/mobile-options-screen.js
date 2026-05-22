import React from 'react';
import { Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACE } from './mobile-utils';

export function OptionsScreen({
  loggedInTherapist, loggedInPatient, accountType,
  themeMode, setThemeMode,
  appLanguage, setAppLanguage,
  notifications, dismissedNotifIds,
  onShowNotifications, onShowLogin, onShowRegister,
  onShowFeedback, onShowChangePassword, onDeleteAccount,
  onNavigateToProfile,
  c, t, styles,
}) {
const renderOptions = () => {
  const SectionHeader = ({ title }) => (
    <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 20, marginBottom: 6, paddingHorizontal: 4 }}>{title}</Text>
  );
  const OptionRow = ({ label, value, onPress, icon, valueColor, last }) => (
    <Pressable
      onPress={onPress}
      style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border, marginBottom: last ? 0 : 1, borderRadius: 0 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {icon ? <Ionicons name={icon} size={18} color={c.muted} /> : null}
        <Text style={[styles.optionLabel, { color: c.text }]}>{label}</Text>
      </View>
      <Text style={[styles.optionValue, { color: valueColor ?? c.muted }]}>{value} ›</Text>
    </Pressable>
  );
  const OptionGroup = ({ children }) => (
    <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>{children}</View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: c.background }}>
        <View style={[styles.header, { marginBottom: 0 }]}>
          <Image source={require('../../assets/icon.png')} style={styles.logoMark} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>{t('optionsTitle')}</Text>
            <Text style={[styles.headerSub, { color: c.muted }]}>{t('optionsSubtitle')}</Text>
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 32, paddingTop: SPACE.sm }]} showsVerticalScrollIndicator={false}>

        {/* ── Mein Profil ── */}
        {loggedInTherapist && (
          <>
            <SectionHeader title="Mein Profil" />
            <OptionGroup>
              <Pressable onPress={() => setActiveTab('therapist')} style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: c.mutedBg, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                    {loggedInTherapist.photo
                      ? <Image source={{ uri: loggedInTherapist.photo.startsWith('http') ? loggedInTherapist.photo : `${getBaseUrl()}${loggedInTherapist.photo}` }} style={{ width: 44, height: 44, borderRadius: 999 }} />
                      : <Text style={{ fontSize: 18, fontWeight: '700', color: c.muted }}>{(loggedInTherapist.fullName ?? '?')[0].toUpperCase()}</Text>
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{loggedInTherapist.fullName ?? '—'}</Text>
                    <Text style={{ fontSize: 12, color: loggedInTherapist.isVisible && loggedInTherapist.reviewStatus === 'APPROVED' ? c.success : c.muted }}>
                      {loggedInTherapist.isVisible && loggedInTherapist.reviewStatus === 'APPROVED' ? t('publiclyVisible') : t('notYetPublic')}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </Pressable>
            </OptionGroup>
          </>
        )}

        {loggedInPatient && (
          <>
            <SectionHeader title="Mein Profil" />
            <OptionGroup>
              <Pressable onPress={() => setActiveTab('therapist')} style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{((loggedInPatient.firstName?.[0] ?? '') + (loggedInPatient.lastName?.[0] ?? '')).toUpperCase() || '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{loggedInPatient.firstName} {loggedInPatient.lastName}</Text>
                    <Text style={{ fontSize: 12, color: c.muted }}>{t('patientRoleLabel')}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </Pressable>
            </OptionGroup>
          </>
        )}

        {!loggedInTherapist && !loggedInPatient && (
          <>
            <SectionHeader title="Mein Profil" />
            <OptionGroup>
              <Pressable onPress={() => { onNavigateToProfile(); onShowLogin(); }} style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent' }]}>
                <Text style={[styles.optionLabel, { color: c.muted }]}>{t('notLoggedIn')}</Text>
                <Text style={[styles.optionValue, { color: c.primary }]}>{t('loginAction')} ›</Text>
              </Pressable>
            </OptionGroup>
          </>
        )}

        {/* ── App-Einstellungen ── */}
        <SectionHeader title="App-Einstellungen" />
        <OptionGroup>
          <View style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="language-outline" size={18} color={c.muted} />
              <Text style={[styles.optionLabel, { color: c.text }]}>{t('languageOption')}</Text>
            </View>
            <View style={styles.themeToggleRow}>
              {[{ key: 'de', label: 'DE' }, { key: 'en', label: 'EN' }].map(({ key, label }) => (
                <Pressable key={key} onPress={() => { setAppLanguage(key); AsyncStorage.setItem('appLanguage', key); }}
                  style={[styles.themeBtn, appLanguage === key ? { backgroundColor: c.primary, borderColor: c.primary } : { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                  <Text style={[styles.themeBtnText, { color: appLanguage === key ? '#FFFFFF' : c.muted }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable onPress={() => onShowNotifications()} style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent', borderTopWidth: 1, borderTopColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="notifications-outline" size={18} color={c.muted} />
              <Text style={[styles.optionLabel, { color: c.text }]}>{t('notificationsOption')}</Text>
            </View>
            <Text style={[styles.optionValue, { color: notifications.filter((n) => !dismissedNotifIds.has(n.id)).length > 0 ? c.primary : c.muted }]}>
              {notifications.filter((n) => !dismissedNotifIds.has(n.id)).length > 0 ? `${notifications.filter((n) => !dismissedNotifIds.has(n.id)).length} ›` : '›'}
            </Text>
          </Pressable>
          <Pressable onPress={() => Linking.openSettings()} style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent', borderTopWidth: 1, borderTopColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="phone-portrait-outline" size={18} color={c.muted} />
              <Text style={[styles.optionLabel, { color: c.text }]}>{t('deviceSettings')}</Text>
            </View>
            <Text style={[styles.optionValue, { color: c.muted }]}>›</Text>
          </Pressable>
          <View style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent', borderTopWidth: 1, borderTopColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="contrast-outline" size={18} color={c.muted} />
              <Text style={[styles.optionLabel, { color: c.text }]}>{t('appearanceOption')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
              <Text style={[styles.optionValue, { color: c.muted }]}>{themeMode === 'dark' ? t('themeDark') : t('themeLight')}</Text>
              <Switch value={themeMode === 'dark'} onValueChange={(v) => { const m = v ? 'dark' : 'light'; setThemeMode(m); AsyncStorage.setItem('themeMode', m); }}
                trackColor={{ false: c.border, true: c.primary }} ios_backgroundColor={c.border} thumbColor="#FFFFFF" />
            </View>
          </View>
        </OptionGroup>

        {/* ── Hilfe & Support ── */}
        <SectionHeader title={t('helpSupportSection')} />
        <OptionGroup>
          <Pressable style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="help-circle-outline" size={18} color={c.muted} />
              <Text style={[styles.optionLabel, { color: c.text }]}>{t('faqOption')}</Text>
            </View>
            <Text style={[styles.optionValue, { color: c.muted }]}>{t('comingSoon')} ›</Text>
          </Pressable>
          <Pressable onPress={openFeedbackModal} style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent', borderTopWidth: 1, borderTopColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="chatbubble-outline" size={18} color={c.muted} />
              <Text style={[styles.optionLabel, { color: c.text }]}>{t('appFeedback')}</Text>
            </View>
            <Text style={[styles.optionValue, { color: c.primary }]}>›</Text>
          </Pressable>
        </OptionGroup>

        {/* ── Rechtliches ── */}
        <SectionHeader title={t('legalSection')} />
        <OptionGroup>
          <Pressable style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="document-text-outline" size={18} color={c.muted} />
              <Text style={[styles.optionLabel, { color: c.text }]}>{t('termsLabel')}</Text>
            </View>
            <Text style={[styles.optionValue, { color: c.muted }]}>›</Text>
          </Pressable>
          <Pressable style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent', borderTopWidth: 1, borderTopColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="shield-outline" size={18} color={c.muted} />
              <Text style={[styles.optionLabel, { color: c.text }]}>{t('privacyLabel')}</Text>
            </View>
            <Text style={[styles.optionValue, { color: c.muted }]}>›</Text>
          </Pressable>
        </OptionGroup>

        {/* ── App-Version & Logout ── */}
        <Text style={{ fontSize: 12, color: c.muted, textAlign: 'center', marginTop: 20 }}>Version 0.1.0 MVP</Text>

        {(loggedInTherapist || loggedInPatient) && (
          <View style={{ gap: 10, marginTop: 16 }}>
            <Pressable
              onPress={() => { setChangePasswordError(''); setChangePasswordSuccess(''); onShowChangePassword(); }}
              style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.card }}>
              <Ionicons name="key-outline" size={18} color={c.muted} />
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{t('changePassword')}</Text>
            </Pressable>
            <Pressable onPress={handleLogout}
              style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: c.border, backgroundColor: c.card }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{t('logoutBtn')}</Text>
            </Pressable>
            <Pressable onPress={handleDeleteAccount} style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: c.muted, fontSize: 14 }}>{t('deleteAccount')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
