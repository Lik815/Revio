import React from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACE } from '../../utils/app-utils';
import { AccountHeader } from '../../components/AccountHeader';

export function OptionsContent({
  loggedInTherapist, loggedInPatient, loggedInPractice,
  themeMode, setThemeMode,
  onOpenProfile,
  onShowLogin, onShowRegister,
  onShowFeedback, onShowChangePassword, onLogout,
  onShowDebug,
  c, t, styles,
}) {
  const [debugTapCount, setDebugTapCount] = React.useState(0);
const renderOptions = () => {
  const isLoggedIn = Boolean(loggedInTherapist || loggedInPatient || loggedInPractice);

  const SectionHeader = ({ title }) => (
    <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 24, marginBottom: 8, paddingHorizontal: 4 }}>{title}</Text>
  );
  const OptionRow = ({ label, value, onPress, icon, valueColor, subtitle, tint = 'default', disabled = false, last = false }) => {
    const destructive = tint === 'destructive';
    const iconColor = destructive ? c.error : c.muted;
    const labelColor = disabled ? c.muted : destructive ? c.error : c.text;
    const subtitleColor = disabled ? c.muted : destructive ? c.error : c.muted;
    const trailingColor = disabled ? c.muted : (valueColor ?? (destructive ? c.error : c.muted));

    return (
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.optionRow,
          {
            backgroundColor: destructive ? c.errorBg : c.card,
            borderColor: c.border,
            marginBottom: last ? 0 : 1,
            borderRadius: 0,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 12 }}>
          {icon ? <Ionicons name={icon} size={18} color={iconColor} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionLabel, { color: labelColor }]}>{label}</Text>
            {subtitle ? (
              <Text style={{ fontSize: 12, lineHeight: 17, color: subtitleColor, marginTop: 2 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <Text style={[styles.optionValue, { color: trailingColor }]}>{value ? `${value} ›` : '›'}</Text>
      </Pressable>
    );
  };
  const OptionGroup = ({ children }) => (
    <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>{children}</View>
  );

  return (
    <View style={{ flex: 1 }}>
      <AccountHeader c={c} subtitle={t('optionsSubtitle')} showEdit />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 32, paddingTop: SPACE.sm }]} showsVerticalScrollIndicator={false}>

        {/* ── App-Einstellungen ── */}
        <SectionHeader title="App-Einstellungen" />
        <OptionGroup>
          <View style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="contrast-outline" size={18} color={c.muted} />
              <Text style={[styles.optionLabel, { color: c.text }]}>{t('appearanceOption')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
              <Text style={[styles.optionValue, { color: c.muted }]}>{themeMode === 'dark' ? t('themeDark') : t('themeLight')}</Text>
              <Switch value={themeMode === 'dark'} onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')}
                trackColor={{ false: c.border, true: c.primary }} ios_backgroundColor={c.border} thumbColor="#FFFFFF" />
            </View>
          </View>
        </OptionGroup>

        {loggedInPractice && (
          <>
            <SectionHeader title={t('practiceLabel')} />
            <OptionGroup>
              <OptionRow
                label={t('practiceEditAction')}
                subtitle={t('practiceSettingsHint')}
                icon="business-outline"
                onPress={onOpenProfile}
                valueColor={c.primary}
                last
              />
            </OptionGroup>
          </>
        )}

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
          <Pressable onPress={onShowFeedback} style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent', borderTopWidth: 1, borderTopColor: c.border }]}>
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
          <OptionRow label={t('termsLabel')} icon="document-text-outline" />
          <OptionRow label={t('privacyLabel')} icon="shield-outline" last />
        </OptionGroup>

        {!isLoggedIn && (
          <>
            <SectionHeader title={t('accountSection')} />
            <OptionGroup>
              <OptionRow
                label={t('loginAction')}
                subtitle={t('notLoggedIn')}
                icon="log-in-outline"
                onPress={onShowLogin}
                valueColor={c.primary}
              />
              <OptionRow
                label={t('registerBtn')}
                subtitle={t('patientRegSubtitle')}
                icon="person-add-outline"
                onPress={onShowRegister}
                valueColor={c.primary}
                last
              />
            </OptionGroup>
          </>
        )}

        {isLoggedIn && (
          <>
            <SectionHeader title={t('accountSection')} />
            <OptionGroup>
              <OptionRow
                label={t('changePassword')}
                subtitle={t('changePasswordHint')}
                icon="key-outline"
                onPress={onShowChangePassword}
                valueColor={c.primary}
              />
              <OptionRow
                label={t('logoutBtn')}
                subtitle={t('logoutHint')}
                icon="log-out-outline"
                onPress={onLogout}
                last
              />
            </OptionGroup>
          </>
        )}

        <Pressable
          onPress={() => {
            const next = debugTapCount + 1;
            setDebugTapCount(next);
            if (next >= 5) {
              setDebugTapCount(0);
              if (typeof onShowDebug === 'function') onShowDebug();
            }
          }}
          hitSlop={12}
        >
          <Text style={{ fontSize: 12, color: c.muted, textAlign: 'center', marginTop: 28 }}>
            Version 0.1.0 MVP{debugTapCount > 0 && debugTapCount < 5 ? ` (${debugTapCount}/5)` : ''}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};
  return renderOptions();
}
