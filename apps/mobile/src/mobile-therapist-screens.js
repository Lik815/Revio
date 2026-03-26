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
  regSpecOptions,
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

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20, flexGrow: 1 }]}>
      <Pressable onPress={() => setShowLogin(false)} style={styles.backBtn}>
        <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
      </Pressable>
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>Anmelden</Text>
          <Text style={[styles.headerSub, { color: c.muted }]}>Ein Login für alle Konten</Text>
        </View>
      </View>

      <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.filterSectionTitle, { color: c.muted }]}>E-Mail</Text>
        <TextInput
          style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
          value={loginEmail}
          onChangeText={setLoginEmail}
          placeholder="deine@email.de"
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Passwort</Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, paddingRight: 44 }]}
            value={loginPassword}
            onChangeText={setLoginPassword}
            placeholder="••••••••"
            placeholderTextColor={c.muted}
            secureTextEntry={!showPassword}
          />
          <Pressable onPress={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
          </Pressable>
        </View>
      </View>

      {loginError ? (
        <View style={[styles.noticeBox, { backgroundColor: '#FDECEA', borderColor: '#E74C3C', marginBottom: 8 }]}>
          <Text style={{ color: '#E74C3C', flex: 1 }}>{loginError}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.registerBtn, { backgroundColor: loginLoading ? c.border : c.primary }]}
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

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20, flexGrow: 1 }]}>
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>Für Therapeuten</Text>
          <Text style={[styles.headerSub, { color: c.muted }]}>Dein Profil auf Revio</Text>
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }]}>
        <Text style={{ fontSize: 28 }}>⚕️</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.infoTitle, { color: c.text, marginBottom: 2 }]}>Werde auf Revio sichtbar</Text>
          <Text style={[styles.noticeBody, { color: c.muted }]}>
            Nur für zugelassene Physiotherapeuten. Dein Profil wird vor der Veröffentlichung manuell geprüft.
          </Text>
        </View>
      </View>

      {[
        { num: '1', title: 'Registrieren', body: 'Konto mit E-Mail anlegen' },
        { num: '2', title: 'Profil ausfüllen', body: 'Spezialisierungen, Ausbildung, Sprachen, Praxis' },
        { num: '3', title: 'Zur Prüfung einreichen', body: __DEV__ ? 'Entwicklungsmodus: sofort freigegeben' : 'Manuell geprüft — in der Regel innerhalb von 48 h' },
        { num: '4', title: 'Öffentlich sichtbar', body: 'Dein Profil erscheint in den Suchergebnissen' },
      ].map((step) => (
        <View key={step.num} style={[styles.stepRow, { borderColor: c.border }]}>
          <View style={[styles.stepNum, { backgroundColor: c.primary }]}>
            <Text style={styles.stepNumText}>{step.num}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stepTitle, { color: c.text }]}>{step.title}</Text>
            <Text style={[styles.stepBody, { color: c.muted }]}>{step.body}</Text>
          </View>
        </View>
      ))}

      <Pressable style={[styles.registerBtn, { backgroundColor: c.primary }]} onPress={() => { setRegStep(1); setRegSubmitted(false); setShowRegister(true); }}>
        <Text style={styles.registerBtnText}>Jetzt registrieren</Text>
      </Pressable>

      <Pressable
        style={[styles.registerBtn, { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, marginTop: 10 }]}
        onPress={() => setShowLogin(true)}
      >
        <Text style={[styles.registerBtnText, { color: c.text }]}>Anmelden</Text>
      </Pressable>

      <Pressable onPress={() => setShowManagerReg(true)} style={{ alignSelf: 'center', paddingVertical: 8, marginTop: 12 }}>
        <Text style={{ color: c.muted, fontSize: 14 }}>Praxis als Manager registrieren</Text>
      </Pressable>
    </ScrollView>
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
          <Pressable onPress={handleSearchPractices}>
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

      <View style={{ flexDirection: 'row', backgroundColor: c.mutedBg, borderRadius: 12, padding: 3, marginBottom: 20 }}>
        {[{ key: 'new', label: 'Neuer Therapeut' }, { key: 'link', label: 'Einladungslink' }].map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setInvitePageTab(tab.key)}
            style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: invitePageTab === tab.key ? c.card : 'transparent' }}
          >
            <Text style={{ fontSize: 14, fontWeight: invitePageTab === tab.key ? '700' : '500', color: invitePageTab === tab.key ? c.text : c.muted }}>
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
              <View style={{ borderRadius: 10, borderWidth: 1, borderColor: c.border, marginTop: -2, overflow: 'hidden', backgroundColor: c.mutedBg }}>
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
              <View style={{ borderRadius: 10, borderWidth: 1, borderColor: c.border, marginTop: -2, overflow: 'hidden', backgroundColor: c.mutedBg }}>
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
            <Text style={{ color: '#E74C3C', fontSize: 13, marginHorizontal: 4 }}>{createTherapistError}</Text>
          )}
          <Pressable onPress={handleCreateTherapist} disabled={createTherapistLoading} style={{ backgroundColor: createTherapistLoading ? c.border : c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
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
              <Pressable onPress={handleShareInviteLink} style={{ backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Link teilen</Text>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={handleLoadInviteToken} style={{ backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Link erstellen</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}
