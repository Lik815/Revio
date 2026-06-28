import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '../../../../components/BackButton';
import { getBaseUrl, TUNNEL_HEADERS } from '../../../../utils/app-utils';

// Step (in_practice track) — find the practice you work at. If it exists, a
// PROPOSED link is requested; if not, the typed name is stored as free text.
// No full practice profile is auto-created here.
export function PracticeLinkStep({
  selectedPractice, onSelectPractice,
  freeText, onChangeFreeText,
  error, loading,
  onSubmit, onBack,
  c, t, styles,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (selectedPractice) return;
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/practices/search?q=${encodeURIComponent(q)}`, {
          headers: { ...TUNNEL_HEADERS },
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setResults(Array.isArray(data.practices) ? data.practices : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, selectedPractice]);

  const mutedText = c.textMuted ?? c.muted;

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 24, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
      <BackButton c={c} label={t('backBtn')} onPress={onBack} />

      <View style={{ paddingTop: 8, paddingBottom: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: c.text }}>{t('practiceLinkTitle')}</Text>
        <Text style={{ fontSize: 14, color: c.muted, marginTop: 6, lineHeight: 20 }}>{t('practiceLinkSubtitle')}</Text>
      </View>

      {selectedPractice ? (
        <View style={[styles.noticeBox, { backgroundColor: c.successBg ?? c.mutedBg, borderColor: c.success ?? c.border, marginBottom: 16, alignItems: 'center' }]}>
          <Ionicons name="checkmark-circle" size={18} color={c.success ?? c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, color: c.text, fontWeight: '600' }}>{selectedPractice.name}</Text>
            <Text style={{ fontSize: 13, color: mutedText }}>{selectedPractice.city}</Text>
          </View>
          <Pressable onPress={() => onSelectPractice(null)} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color={mutedText} />
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.searchBox, { backgroundColor: c.card, borderColor: c.border, marginBottom: 8 }]}>
            <Ionicons name="search-outline" size={18} color={c.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('practiceLinkSearchPlaceholder')}
              placeholderTextColor={c.muted}
              style={[styles.searchInput, { color: c.text }]}
              autoCapitalize="words"
            />
            {searching && <ActivityIndicator size="small" color={c.muted} />}
          </View>

          {results.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => { onSelectPractice(p); setQuery(''); setResults([]); }}
              style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: c.text }]}>{p.name}</Text>
                <Text style={[styles.cardTitle, { color: mutedText }]}>{[p.city, p.address].filter(Boolean).join(' · ')}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={20} color={c.primary} />
            </Pressable>
          ))}

          <Text style={{ fontSize: 13, color: mutedText, marginTop: 12, marginBottom: 6 }}>{t('practiceLinkNotFound')}</Text>
          <TextInput
            style={[styles.regInput, { color: c.text, borderColor: freeText ? c.primary : c.border, backgroundColor: c.mutedBg }]}
            placeholder={t('practiceLinkFreeTextPlaceholder')}
            placeholderTextColor={c.muted}
            value={freeText}
            onChangeText={onChangeFreeText}
            autoCapitalize="words"
          />
        </>
      )}

      {!!error && (
        <View style={[styles.noticeBox, { backgroundColor: c.errorBg, borderColor: c.error, marginTop: 16 }]}>
          <Ionicons name="alert-circle-outline" size={18} color={c.error} />
          <Text style={{ fontSize: 14, color: c.error, flex: 1 }}>{error}</Text>
        </View>
      )}

      <Pressable
        style={[styles.registerBtn, { backgroundColor: loading ? c.border : c.primary, marginTop: 20 }]}
        onPress={onSubmit}
        disabled={loading}
      >
        <Text style={styles.registerBtnText}>{loading ? '…' : t('regFinishTherapist')}</Text>
      </Pressable>
    </ScrollView>
  );
}
