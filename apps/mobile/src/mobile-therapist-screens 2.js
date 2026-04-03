import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  RADIUS,
  regSpecOptions,
  softenErrorMessage,
  TYPE,
} from './mobile-utils';

export function LoginScreen(props) {
  const {
    c,
    handleLogin,
    loginEmail,
    loginError,
    loginLoading,
    loginPassword,
    setLoginEmail,
    setLoginPassword,
    setShowLogin,
    styles,
    t,
  } = props;
  const [showPassword, setShowPassword] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => setShowLogin(false)} style={styles.backBtn}>
        <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
      </Pressable>

      {/* Headline */}
      <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 28 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: c.text, marginBottom: 6 }}>Willkommen zurück</Text>
        <Pressable onPress={() => setShowInfo(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 13, color: c.muted }}>Mehr erfahren</Text>
          <Ionicons name={showInfo ? 'chevron-up' : 'chevron-down'} size={13} color={c.muted} />
        </Pressable>
        {showInfo && (
          <View style={{ backgroundColor: c.mutedBg, borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ fontSize: 13, color: c.muted, lineHeight: 20, textAlign: 'center' }}>
              Mit deinem Revio-Konto verwaltest du als Physiotherapeut:in dein Profil und erreichst Patienten in deiner Nähe. Ein Konto — alle Funktionen.
            </Text>
          </View>
        )}
      </View>

      {/* Inputs */}
      <View style={{ gap: 14 }}>
        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, marginBottom: 7, letterSpacing: 0.8, textTransform: 'uppercase' }}>E-Mail</Text>
          <TextInput
            style={[styles.regInput, { color: c.text, borderColor: loginEmail.length > 0 ? c.primary : c.border, backgroundColor: c.card }]}
            value={loginEmail}
            onChangeText={setLoginEmail}
            placeholder="deine@email.de"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, marginBottom: 7, letterSpacing: 0.8, textTransform: 'uppercase' }}>Passwort</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={[styles.regInput, { color: c.text, borderColor: loginPassword.length > 0 ? c.primary : c.border, backgroundColor: c.card, paddingRight: 44 }]}
              value={loginPassword}
              onChangeText={setLoginPassword}
              placeholder="••••••••"
              placeholderTextColor={c.muted}
              secureTextEntry={!showPassword}
            />
            <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
            </Pressable>
          </View>
        </View>
      </View>

      {loginError ? (
        <View style={[styles.noticeBox, { backgroundColor: c.errorBg, borderColor: c.error, marginTop: 12 }]}>
          <Text style={{ color: c.error, flex: 1 }}>{softenErrorMessage(loginError)}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.registerBtn, { backgroundColor: loginLoading ? c.border : c.primary, marginTop: 24 }]}
        onPress={handleLogin}
        disabled={loginLoading}
      >
        <Text style={styles.registerBtnText}>{loginLoading ? 'Anmelden…' : 'Anmelden'}</Text>
      </Pressable>
    </ScrollView>
  );
}

export function TherapistLandingScreen(props) {
  const {
    __DEV__,
    c,
    setRegStep,
    setRegSubmitted,
    setShowManagerReg,
    setShowLogin,
    setShowRegister,
    styles,
  } = props;
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: 'center', paddingBottom: 16 }}>

      {/* Headline */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, marginBottom: 4 }}>Für Therapeuten</Text>
        <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', paddingHorizontal: 16, marginBottom: 6 }}>
          Erstelle dein Profil und werde von Patienten gefunden.
        </Text>
        <Pressable onPress={() => setShowInfo(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 12, color: c.muted }}>Mehr erfahren</Text>
          <Ionicons name={showInfo ? 'chevron-up' : 'chevron-down'} size={12} color={c.muted} />
        </Pressable>
        {showInfo && (
          <View style={{ backgroundColor: c.mutedBg, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ fontSize: 12, color: c.muted, lineHeight: 18, textAlign: 'center' }}>
              Nur für zugelassene Physiotherapeuten. Dein Profil wird vor der Veröffentlichung manuell geprüft — in der Regel innerhalb von 48 Stunden.{__DEV__ ? '\n\nEntwicklungsmodus: sofort freigegeben.' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Steps */}
      <View style={{ gap: 7, marginBottom: 20 }}>
        {[
          { icon: 'mail-outline', title: 'Konto anlegen', body: 'E-Mail und Passwort' },
          { icon: 'person-outline', title: 'Profil ausfüllen', body: 'Spezialisierungen, Sprachen, Praxis' },
          { icon: 'checkmark-circle-outline', title: 'Einreichen & prüfen lassen', body: 'Manuell freigegeben' },
          { icon: 'search-outline', title: 'Öffentlich sichtbar', body: 'Patienten finden dich in der Suche' },
        ].map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, paddingVertical: 8, paddingHorizontal: 12 }}>
            <View style={{ width: 30, height: 30, borderRadius: RADIUS.full, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={step.icon} size={15} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>{step.title}</Text>
              <Text style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{step.body}</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: c.primary }}>{i + 1}</Text>
          </View>
        ))}
      </View>

      <Pressable style={[styles.registerBtn, { backgroundColor: c.primary }]} onPress={() => { setRegStep(1); setRegSubmitted(false); setShowRegister(true); }}>
        <Text style={styles.registerBtnText}>Jetzt registrieren</Text>
      </Pressable>

      <Pressable
        style={[styles.registerBtn, { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, marginTop: 8 }]}
        onPress={() => setShowLogin(true)}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>Anmelden</Text>
      </Pressable>

      <Pressable onPress={() => setShowManagerReg(true)} style={{ alignSelf: 'center', paddingVertical: 8, marginTop: 4 }}>
        <Text style={{ fontSize: 12, color: c.muted }}>Praxis als Manager registrieren</Text>
      </Pressable>
    </View>
  );
}

export function CreatePracticeScreen(props) {
  const {
    c,
    createPracticeAddress,
    createPracticeCity,
    createPracticeLoading,
    createPracticeName,
    createPracticePhone,
    handleCreatePractice,
    setCreatePracticeAddress,
    setCreatePracticeCity,
    setCreatePracticeName,
    setCreatePracticePhone,
    setShowCreatePractice,
    styles,
    t,
  } = props;

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => setShowCreatePractice(false)} style={styles.backBtn}>
        <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
      </Pressable>
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>Neue Praxis</Text>
          <Text style={[styles.headerSub, { color: c.muted }]}>Erstelle und verwalte deine Praxis</Text>
        </View>
      </View>

      <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Praxisname *</Text>
        <TextInput style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} value={createPracticeName} onChangeText={setCreatePracticeName} placeholder="z. B. Physio am Markt" placeholderTextColor={c.muted} />
        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Stadt *</Text>
        <TextInput style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} value={createPracticeCity} onChangeText={setCreatePracticeCity} placeholder="z. B. Köln" placeholderTextColor={c.muted} />
        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Adresse</Text>
        <TextInput style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} value={createPracticeAddress} onChangeText={setCreatePracticeAddress} placeholder="Straße und Hausnummer" placeholderTextColor={c.muted} />
        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Telefon</Text>
        <TextInput style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} value={createPracticePhone} onChangeText={setCreatePracticePhone} placeholder="+49 221 …" placeholderTextColor={c.muted} keyboardType="phone-pad" />
      </View>

      <Pressable style={[styles.registerBtn, { backgroundColor: createPracticeLoading ? c.border : c.primary }]} onPress={handleCreatePractice} disabled={createPracticeLoading}>
        <Text style={styles.registerBtnText}>{createPracticeLoading ? 'Wird erstellt…' : 'Praxis erstellen'}</Text>
      </Pressable>
    </ScrollView>
  );
}

export function PracticeSearchScreen(props) {
  const {
    c,
    handleConnectToPractice,
    handleSearchPractices,
    practiceSearchLoading,
    practiceSearchQuery,
    practiceSearchResults,
    setPracticeSearchQuery,
    setShowPracticeSearch,
    styles,
    t,
  } = props;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => setShowPracticeSearch(false)} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
        </Pressable>
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>Praxis vernetzen</Text>
            <Text style={[styles.headerSub, { color: c.muted }]}>Finde deine Praxis und sende eine Anfrage</Text>
          </View>
        </View>

        <View style={[styles.searchBox, { backgroundColor: c.card, borderColor: c.border }]}>
          <TextInput
            style={[{ flex: 1, color: c.text, fontSize: 16 }]}
            value={practiceSearchQuery}
            onChangeText={setPracticeSearchQuery}
            onSubmitEditing={handleSearchPractices}
            placeholder="Praxisname oder Stadt…"
            placeholderTextColor={c.muted}
            returnKeyType="search"
          />
          <Pressable onPress={handleSearchPractices} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ fontSize: 20, color: c.primary }}>⌕</Text>
          </Pressable>
        </View>

        {practiceSearchLoading && (
          <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center' }]}>Suche…</Text>
        )}

        {practiceSearchResults.map((practice) => (
          <View key={practice.id} style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 8 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.practiceInitial, { backgroundColor: c.border }]}>
                <Text style={[styles.practiceInitialText, { color: c.muted }]}>{practice.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.practiceName, { color: c.text }]}>{practice.name}</Text>
                <Text style={[styles.practiceCity, { color: c.muted }]}>{practice.city}{practice.address ? ` · ${practice.address}` : ''}</Text>
                <Text style={[{ fontSize: 12, color: c.muted }]}>{practice.links?.length ?? 0} Therapeuten</Text>
              </View>
            </View>
            <Pressable onPress={() => handleConnectToPractice(practice.id)} style={[styles.kassenartBtn, { backgroundColor: c.primary, borderColor: c.primary, alignSelf: 'flex-start' }]}>
              <Text style={[styles.kassenartText, { color: '#fff' }]}>Anfrage senden</Text>
            </Pressable>
          </View>
        ))}

        {!practiceSearchLoading && practiceSearchResults.length === 0 && practiceSearchQuery.length > 0 && (
          <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={styles.emptyIcon}>🏥</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>Keine Praxis gefunden</Text>
            <Text style={[styles.emptyBody, { color: c.muted }]}>Erstelle eine neue Praxis in den Optionen.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export function InvitePageScreen(props) {
  const [specializationSearch, setSpecializationSearch] = useState('');
  const [certificationSearch, setCertificationSearch] = useState('');
  const {
    c,
    certificationOptions,
    createTherapistAvailability,
    createTherapistBio,
    createTherapistCity,
    createTherapistEmail,
    createTherapistError,
    createTherapistCerts,
    createTherapistHomeVisit,
    createTherapistKassenart,
    createTherapistLoading,
    createTherapistName,
    createTherapistSpecs,
    createTherapistTitle,
    getInviteLink,
    handleCreateTherapist,
    handleLoadInviteToken,
    handleShareInviteLink,
    invitePageTab,
    inviteToken,
    inviteTokenLoading,
    setCreateTherapistAvailability,
    setCreateTherapistBio,
    setCreateTherapistCerts,
    setCreateTherapistCity,
    setCreateTherapistEmail,
    setCreateTherapistHomeVisit,
    setCreateTherapistKassenart,
    setCreateTherapistName,
    setCreateTherapistSpecs,
    setCreateTherapistTitle,
    setInvitePageTab,
    setShowInvitePage,
    styles,
    t,
  } = props;

  const specializationSuggestions = specializationSearch.trim().length > 0
    ? regSpecOptions
        .filter((specialization) =>
          specialization.toLowerCase().includes(specializationSearch.trim().toLowerCase()) &&
          !createTherapistSpecs.includes(specialization)
        )
        .slice(0, 6)
    : [];

  const certificationSuggestions = certificationSearch.trim().length > 0
    ? certificationOptions
        .filter((option) =>
          option.label.toLowerCase().includes(certificationSearch.trim().toLowerCase()) &&
          !createTherapistCerts.includes(option.key)
        )
        .slice(0, 6)
    : [];

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => setShowInvitePage(false)} style={styles.backBtn}>
        <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
      </Pressable>
      <Text style={[styles.profileName, { color: c.text, marginBottom: 16 }]}>Therapeuten einladen</Text>

      <View style={{ flexDirection: 'row', backgroundColor: c.mutedBg, borderRadius: RADIUS.md, padding: 3, marginBottom: 20 }}>
        {[{ key: 'new', label: 'Neuer Therapeut' }, { key: 'link', label: 'Einladungslink' }].map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setInvitePageTab(tab.key)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center', backgroundColor: invitePageTab === tab.key ? c.card : 'transparent', minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ ...TYPE.meta, fontWeight: invitePageTab === tab.key ? '700' : '500', color: invitePageTab === tab.key ? c.text : c.muted }}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {invitePageTab === 'new' ? (
        <View style={{ gap: 12 }}>
          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>GRUNDDATEN</Text>
            {[
              { label: 'Name *', value: createTherapistName, setter: setCreateTherapistName, placeholder: 'Max Mustermann' },
              { label: 'E-Mail *', value: createTherapistEmail, setter: setCreateTherapistEmail, placeholder: 'therapeut@email.de', keyboard: 'email-address', lower: true },
              { label: 'Berufsbezeichnung *', value: createTherapistTitle, setter: setCreateTherapistTitle, placeholder: 'Physiotherapeut/in' },
              { label: 'Stadt', value: createTherapistCity, setter: setCreateTherapistCity, placeholder: 'Berlin' },
              { label: 'Verfügbarkeit', value: createTherapistAvailability, setter: setCreateTherapistAvailability, placeholder: 'Mo–Fr 8–18 Uhr' },
            ].map(({ label, value, setter, placeholder, keyboard = 'default', lower }) => (
              <View key={label}>
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{label}</Text>
                <TextInput
                  style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
                  value={value}
                  onChangeText={setter}
                  placeholder={placeholder}
                  placeholderTextColor={c.muted}
                  keyboardType={keyboard}
                  autoCapitalize={lower ? 'none' : 'words'}
                />
              </View>
            ))}
            <View>
              <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Bio</Text>
              <TextInput
                style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, minHeight: 80, textAlignVertical: 'top' }]}
                value={createTherapistBio}
                onChangeText={setCreateTherapistBio}
                placeholder="Kurze Vorstellung…"
                placeholderTextColor={c.muted}
                multiline
              />
            </View>
          </View>

          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Spezialisierungen</Text>
            <Text style={{ color: c.muted, fontSize: 12, marginTop: -4 }}>Mehrfachauswahl · optional</Text>
            <TextInput
              value={specializationSearch}
              onChangeText={setSpecializationSearch}
              placeholder="Spezialisierung suchen…"
              placeholderTextColor={c.muted}
              style={[styles.regInput, { backgroundColor: c.mutedBg, borderColor: c.border, color: c.text }]}
            />
            {specializationSuggestions.length > 0 && (
              <View style={{ borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, marginTop: -2, overflow: 'hidden', backgroundColor: c.mutedBg }}>
                {specializationSuggestions.map((specialization, index) => (
                  <Pressable
                    key={specialization}
                    onPress={() => {
                      setCreateTherapistSpecs((prev) => [...prev, specialization]);
                      setSpecializationSearch('');
                    }}
                    style={{ padding: 12, borderTopWidth: index > 0 ? 1 : 0, borderColor: c.border }}
                  >
                    <Text style={{ color: c.text, fontSize: 14 }}>{specialization}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {createTherapistSpecs.length > 0 && (
              <View style={styles.tagRow}>
                {createTherapistSpecs.map((specialization) => (
                  <Pressable
                    key={specialization}
                    onPress={() => setCreateTherapistSpecs((prev) => prev.filter((value) => value !== specialization))}
                    style={[styles.chip, { backgroundColor: c.primary, borderColor: c.primary }]}
                  >
                    <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{specialization} ×</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Fortbildungen</Text>
            <Text style={{ color: c.muted, fontSize: 12, marginTop: -4 }}>Mehrfachauswahl · optional</Text>
            <TextInput
              value={certificationSearch}
              onChangeText={setCertificationSearch}
              placeholder="Fortbildung suchen…"
              placeholderTextColor={c.muted}
              style={[styles.regInput, { backgroundColor: c.mutedBg, borderColor: c.border, color: c.text }]}
            />
            {certificationSuggestions.length > 0 && (
              <View style={{ borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, marginTop: -2, overflow: 'hidden', backgroundColor: c.mutedBg }}>
                {certificationSuggestions.map((option, index) => (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      setCreateTherapistCerts((prev) => [...prev, option.key]);
                      setCertificationSearch('');
                    }}
                    style={{ padding: 12, borderTopWidth: index > 0 ? 1 : 0, borderColor: c.border }}
                  >
                    <Text style={{ color: c.text, fontSize: 14 }}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {createTherapistCerts.length > 0 && (
              <View style={styles.tagRow}>
                {createTherapistCerts.map((certificationKey) => {
                  const option = certificationOptions.find((entry) => entry.key === certificationKey);
                  const label = option?.label ?? certificationKey;
                  return (
                    <Pressable
                      key={certificationKey}
                      onPress={() => setCreateTherapistCerts((prev) => prev.filter((value) => value !== certificationKey))}
                      style={[styles.chip, { backgroundColor: c.primary, borderColor: c.primary }]}
                    >
                      <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{label} ×</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>KASSENART</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['gesetzlich', 'privat', 'selbstzahler'].map((value) => {
                const active = createTherapistKassenart === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setCreateTherapistKassenart(active ? '' : value)}
                    style={[styles.kassenartBtn, { backgroundColor: active ? c.primary : c.mutedBg, borderColor: active ? c.primary : c.border, flex: 1, justifyContent: 'center' }]}
                  >
                    <Text style={[styles.kassenartText, { color: active ? '#fff' : c.text, textAlign: 'center' }]}>{value}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: c.text, fontSize: 15 }}>Hausbesuche</Text>
              <Switch value={createTherapistHomeVisit} onValueChange={setCreateTherapistHomeVisit} trackColor={{ true: c.success }} />
            </View>
          </View>

          {!!createTherapistError && (
            <Text style={{ color: c.error, fontSize: 13, marginHorizontal: 4 }}>{softenErrorMessage(createTherapistError)}</Text>
          )}
          <Pressable onPress={handleCreateTherapist} disabled={createTherapistLoading} style={{ backgroundColor: createTherapistLoading ? c.border : c.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
              {createTherapistLoading ? 'Wird erstellt…' : 'Profil erstellen & einladen'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {inviteTokenLoading ? (
            <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center' }]}>Link wird erstellt…</Text>
          ) : inviteToken ? (
            <>
              <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 8 }]}>
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Einladungslink</Text>
                <Text selectable style={{ color: c.text, fontSize: 13, fontFamily: 'monospace', backgroundColor: c.mutedBg, padding: 10, borderRadius: 8 }}>
                  {getInviteLink(inviteToken.token)}
                </Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  Teile diesen Link mit Therapeuten. Sie können damit eine Beitrittsanfrage an deine Praxis senden.
                </Text>
              </View>
              <Pressable onPress={handleShareInviteLink} style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Link teilen</Text>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={handleLoadInviteToken} style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Link erstellen</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}
