import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  fortbildungOptions,
  formatDist,
  getLangLabel,
  getPracticeInitials,
  getSearchMatchLabel,
  kassenartOptions,
  quickChips,
} from './mobile-utils';

const mapModule = Platform.OS === 'web'
  ? require('./MapStub')
  : require('react-native-maps');

const MapView = mapModule.default;
const Marker = mapModule.Marker;
const Circle = mapModule.Circle ?? (() => null);

export function DiscoverScreen(props) {
  const {
    HeartButton,
    acSuggestions,
    activeChip,
    activeFilterCount,
    authToken,
    c,
    callPhone,
    city,
    discoverScrollRef,
    getMapRegion,
    homeVisit,
    isFavorite,
    locationLabel,
    mapPractices,
    mapScrollEnabled,
    notifications,
    openPractice,
    openTherapistById,
    query,
    results,
    runSearch,
    runSearchWith,
    searched,
    searchLoading,
    selectChip,
    selectSuggestion,
    setActiveChip,
    setFortbildungen,
    setHomeVisit,
    setKassenart,
    setLocationSheetCity,
    setMapScrollEnabled,
    setQuery,
    setShowAutocomplete,
    setShowFilters,
    setShowLocationSheet,
    setShowNotifications,
    setViewMode,
    showAutocomplete,
    showFilters,
    styles,
    t,
    toggleFavorite,
    toggleFortbildung,
    userCoords,
    viewMode,
    fortbildungen,
    kassenart,
    searchRadius,
    setSearchRadius,
  } = props;

  if (viewMode === 'map') {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {/* Fixed header + search bar */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: c.background, zIndex: 10 }}>
          <View style={[styles.header, { justifyContent: 'space-between', marginBottom: 8 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.logoMark, { backgroundColor: c.primary }]}>
                <Text style={styles.logoText}>R</Text>
              </View>
              <Text style={[styles.brandName, { color: c.text }]}>evio</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {authToken && (
                <Pressable onPress={() => setShowNotifications(true)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'transparent', borderWidth: 2, borderColor: c.muted, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="notifications-outline" size={16} color={c.muted} />
                  {notifications.length > 0 && <View style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: '#E74C3C' }} />}
                </Pressable>
              )}
            </View>
          </View>
          <View style={[styles.searchBox, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="search-outline" size={18} color={c.muted} />
            <TextInput
              value={query}
              onChangeText={(text) => { setQuery(text); setShowAutocomplete(true); setActiveChip(null); }}
              onSubmitEditing={() => runSearch()}
              onFocus={() => setShowAutocomplete(true)}
              onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
              returnKeyType="search"
              placeholder={t('searchPlaceholder')}
              placeholderTextColor={c.muted}
              style={[styles.searchInput, { color: c.text }]}
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(''); setShowAutocomplete(false); }} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={c.muted} />
              </Pressable>
            )}
            <View style={[styles.searchDivider, { backgroundColor: c.border }]} />
            <Pressable onPress={() => setShowFilters(!showFilters)} style={styles.searchFilterArea} hitSlop={4}>
              <Ionicons name="options-outline" size={20} color={showFilters || activeFilterCount > 0 ? c.primary : c.muted} />
              {activeFilterCount > 0 && <View style={[styles.filterBadge, { backgroundColor: c.accent }]}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View>}
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 2 }}>
            <View style={{ flex: 1 }}>
              {(searched || results.length > 0) && (
                <>
                  <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>
                    {searched ? `${results.length} ${results.length !== 1 ? t('resultsLabelPlural') : t('resultsLabel')}` : 'Vorschläge'}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                    {city ? `In ${city}` : 'Standort auswählen'}
                  </Text>
                </>
              )}
            </View>
            <View style={{ flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
              {[{ key: 'list', icon: 'list-outline' }, { key: 'map', icon: 'map-outline' }].map((button, index) => (
                <View key={button.key} style={{ flexDirection: 'row' }}>
                  {index > 0 && <View style={{ width: 1, backgroundColor: c.border }} />}
                  <Pressable
                    onPress={() => setViewMode(button.key)}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: viewMode === button.key ? c.primary : c.card }}
                  >
                    <Ionicons name={button.icon} size={17} color={viewMode === button.key ? '#fff' : c.muted} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => { setLocationSheetCity(locationLabel || city); setShowLocationSheet(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: city ? c.card : c.mutedBg, borderWidth: 1, borderColor: city ? c.accent : c.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, maxWidth: 240 }}
            >
              <Ionicons name="navigate-sharp" size={13} color="#2b6877" />
              <Text numberOfLines={1} style={{ fontSize: 13, color: city ? c.text : c.muted, fontWeight: city ? '500' : '400', flexShrink: 1 }}>
                {locationLabel || city || t('locationPlaceholder')}
              </Text>
              <Text style={{ fontSize: 11, color: c.muted }}>▾</Text>
            </Pressable>
          </View>
        </View>

        {/* Fullscreen map */}
        <View style={{ flex: 1, position: 'relative' }}>
          <MapView
            style={{ flex: 1 }}
            region={getMapRegion()}
            onTouchStart={() => setMapScrollEnabled(false)}
            onTouchEnd={() => setMapScrollEnabled(true)}
            onTouchCancel={() => setMapScrollEnabled(true)}
          >
            {userCoords && (
              <Circle
                center={{ latitude: userCoords.lat, longitude: userCoords.lng }}
                radius={searchRadius * 1000}
                strokeColor="rgba(52,199,89,0.7)"
                fillColor="rgba(52,199,89,0.1)"
                strokeWidth={1.5}
              />
            )}
            {userCoords && (
              <Marker coordinate={{ latitude: userCoords.lat, longitude: userCoords.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.primary, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 5 }} />
              </Marker>
            )}
            {mapPractices.map((practice) => (
              <Marker key={practice.id} coordinate={{ latitude: practice.lat, longitude: practice.lng }} onPress={() => openPractice(practice)} tracksViewChanges={false}>
                <View style={{ backgroundColor: c.primary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{getPracticeInitials(practice.name)}</Text>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', maxWidth: 100 }} numberOfLines={1}>{practice.name}</Text>
                </View>
              </Marker>
            ))}
          </MapView>

          {/* Radius selector overlay */}
          <View style={{ position: 'absolute', bottom: 20, left: 12, right: 12, flexDirection: 'row', gap: 6, justifyContent: 'center', zIndex: 20, elevation: 20 }}>
            {[1, 3, 5, 10, 25].map((km) => (
              <Pressable
                key={km}
                onPress={() => setSearchRadius(km)}
                style={{ borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: searchRadius === km ? c.primary : 'rgba(0,0,0,0.55)', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{km} km</Text>
              </Pressable>
            ))}
          </View>

          {searchLoading && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {!searchLoading && mapPractices.length === 0 && searched && (
            <View style={{ position: 'absolute', top: 20, left: 20, right: 20, padding: 20, borderRadius: 18, backgroundColor: 'rgba(17,24,39,0.82)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="location-outline" size={36} color="#fff" />
              {userCoords ? (
                <>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 10 }}>
                    Keine Praxen im Umkreis von {searchRadius} km
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, textAlign: 'center', marginTop: 6 }}>
                    Versuche einen anderen Ort oder einen größeren Radius.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 10 }}>
                    Keine Praxen mit Standortdaten
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, textAlign: 'center', marginTop: 6 }}>
                    Fuer diese Ergebnisse liegen noch keine Koordinaten vor.
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      ref={discoverScrollRef}
      scrollEnabled={mapScrollEnabled}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.logoMark, { backgroundColor: c.primary }]}>
            <Text style={styles.logoText}>R</Text>
          </View>
          <Text style={[styles.brandName, { color: c.text }]}>evio</Text>
        </View>
        {authToken && (
          <Pressable onPress={() => setShowNotifications(true)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'transparent', borderWidth: 2, borderColor: c.muted, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="notifications-outline" size={16} color={c.muted} />
            {notifications.length > 0 && (
              <View style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: '#E74C3C' }} />
            )}
          </Pressable>
        )}
      </View>

      {!searched && (
        <View style={styles.hero}>
          <Text style={[styles.heroTitle, { color: c.text }]}>{t('heroTitle')}</Text>
          <Text style={[styles.heroSub, { color: c.muted }]}>{t('heroSub')}</Text>
        </View>
      )}

      <View style={{ zIndex: 10 }}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: c.card, borderColor: showAutocomplete && acSuggestions.length > 0 ? c.primary : c.border },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={c.muted} />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setShowAutocomplete(true);
              setActiveChip(null);
            }}
            onSubmitEditing={() => runSearch()}
            onFocus={() => setShowAutocomplete(true)}
            onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
            returnKeyType="search"
            placeholder={t('searchPlaceholder')}
            placeholderTextColor={c.muted}
            style={[styles.searchInput, { color: c.text }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setShowAutocomplete(false); }} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.muted} />
            </Pressable>
          )}
          <View style={[styles.searchDivider, { backgroundColor: c.border }]} />
          <Pressable onPress={() => setShowFilters(!showFilters)} style={styles.searchFilterArea} hitSlop={4}>
            <Ionicons name="options-outline" size={20} color={showFilters || activeFilterCount > 0 ? c.primary : c.muted} />
            {activeFilterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: c.accent }]}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {showAutocomplete && acSuggestions.length > 0 && (
          <View style={[styles.autocompleteBox, { backgroundColor: c.card, borderColor: c.primary }]}>
            {acSuggestions.map((suggestion, index) => (
              <Pressable
                key={suggestion}
                onPress={() => selectSuggestion(suggestion)}
                style={[
                  styles.acItem,
                  index < acSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
                ]}
              >
                <Text style={[styles.acSearchIcon, { color: c.muted }]}>⌕</Text>
                <Text style={[styles.acItemText, { color: c.text }]}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {quickChips.map((chip) => {
          const active = activeChip?.label === chip.label;
          return (
            <Pressable
              key={chip.label}
              onPress={() => selectChip(chip)}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: c.primary, borderColor: c.primary }
                  : { backgroundColor: c.card, borderColor: c.border },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? '#FFFFFF' : c.text }]}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={() => { setLocationSheetCity(locationLabel || city); setShowLocationSheet(true); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: city ? c.card : c.mutedBg, borderWidth: 1, borderColor: city ? c.accent : c.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, maxWidth: 280 }}
      >
        <Ionicons name="navigate-sharp" size={13} color="#2b6877" />
        <Text numberOfLines={1} style={{ fontSize: 13, color: city ? c.text : c.muted, fontWeight: city ? '500' : '400', flexShrink: 1 }}>
          {locationLabel || city || t('locationPlaceholder')}
        </Text>
        <Text style={{ fontSize: 11, color: c.muted }}>▾</Text>
      </Pressable>

      {showFilters && (
        <View style={[styles.filterPanel, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('kassenartLabel')}</Text>
          <View style={styles.kassenartRow}>
            {kassenartOptions.map((option) => {
              const active = kassenart === option.key;
              return (
                <Pressable
                  key={String(option.key)}
                  onPress={() => setKassenart(option.key)}
                  style={[
                    styles.kassenartBtn,
                    active
                      ? { backgroundColor: c.primary, borderColor: c.primary }
                      : { backgroundColor: c.mutedBg, borderColor: c.border },
                  ]}
                >
                  <Text style={[styles.kassenartText, { color: active ? '#FFFFFF' : c.text }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 14 }]}>{t('fortbildungLabel')}</Text>
          {fortbildungOptions.map((option) => {
            const checked = fortbildungen.includes(option.key);
            return (
              <Pressable key={option.key} onPress={() => toggleFortbildung(option.key)} style={styles.checkRow}>
                <View style={[styles.checkbox, { borderColor: checked ? c.primary : c.border, backgroundColor: checked ? c.primary : 'transparent' }]}>
                  {checked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.checkLabel, { color: c.text }]}>{option.label}</Text>
              </Pressable>
            );
          })}

          <View style={[styles.switchRow, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.border }]}>
            <View>
              <Text style={[styles.switchTitle, { color: c.text }]}>{t('homeVisitLabel')}</Text>
              <Text style={[styles.switchLabel, { color: c.muted }]}>{t('homeVisitToggle')}</Text>
            </View>
            <Switch value={homeVisit} onValueChange={setHomeVisit} trackColor={{ true: c.success }} />
          </View>
        </View>
      )}

      {(searched || results.length > 0) ? (
        <View style={styles.sectionRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionLabel, { color: c.text }]}>
              {searched ? `${results.length} ${results.length !== 1 ? t('resultsLabelPlural') : t('resultsLabel')}` : 'Vorschlaege'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 3 }}>
              {city ? `In ${city}` : 'Standort auswaehlen'}
              {activeFilterCount > 0 ? ` · ${activeFilterCount} Filter aktiv` : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.approvedPill, { backgroundColor: c.successBg }]}>
              <Text style={[styles.approvedPillText, { color: c.success }]}>{t('verifiedOnly')}</Text>
            </View>
            {searched && (
              <View style={{ flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
                {[{ key: 'list', icon: 'list-outline' }, { key: 'map', icon: 'map-outline' }].map((button, index) => (
                  <View key={button.key} style={{ flexDirection: 'row' }}>
                    {index > 0 && <View style={{ width: 1, backgroundColor: c.border }} />}
                    <Pressable
                      onPress={() => setViewMode(button.key)}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: viewMode === button.key ? c.primary : c.card }}
                    >
                      <Ionicons name={button.icon} size={17} color={viewMode === button.key ? '#fff' : c.muted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      ) : null}

      {viewMode === 'list' && results.map((therapist) => (
        <View key={therapist.id} style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.cardTop}>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }} onPress={() => openTherapistById(therapist.id)}>
              <Image source={{ uri: therapist.photo }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: c.text }]}>{therapist.fullName}</Text>
                <Text style={[styles.cardTitle, { color: c.muted }]}>{therapist.professionalTitle}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                  <View style={[styles.metaPill, { backgroundColor: c.mutedBg }]}>
                    <Text style={[styles.metaPillText, { color: c.text }]}>{getSearchMatchLabel(therapist, query)}</Text>
                  </View>
                  {therapist.practices?.length > 1 && (
                    <View style={[styles.metaPill, { backgroundColor: c.successBg }]}>
                      <Text style={[styles.metaPillText, { color: c.success }]}>{`${therapist.practices.length} Praxen`}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
            </Pressable>
            <HeartButton isSaved={isFavorite(therapist.id)} onToggle={() => toggleFavorite(therapist)} unsavedColor={c.muted} hitSlop={10} />
          </View>

          <View style={styles.tagRow}>
            {therapist.specializations.map((specialization) => (
              <View key={specialization} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.text }]}>{specialization}</Text>
              </View>
            ))}
            {therapist.languages.map((language) => (
              <View key={language} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.muted }]}>{getLangLabel(language)}</Text>
              </View>
            ))}
            {therapist.homeVisit && (
              <View style={[styles.tag, { backgroundColor: c.successBg }]}>
                <Text style={[styles.tagText, { color: c.success }]}>{t('homeVisitTag')}</Text>
              </View>
            )}
          </View>

          {therapist.fortbildungen?.length > 0 && (
            <View style={styles.tagRow}>
              {therapist.fortbildungen.map((qualification) => (
                <View key={qualification} style={[styles.tag, { backgroundColor: c.successBg, borderWidth: 1, borderColor: c.success }]}>
                  <Text style={[styles.tagText, { color: c.success }]}>{qualification}</Text>
                </View>
              ))}
            </View>
          )}

          {therapist.practices?.length > 0 && (
            <Pressable onPress={() => openPractice(therapist.practices[0])} style={[styles.practiceBtn, { borderColor: c.border, backgroundColor: c.mutedBg }]}>
              <View style={[styles.practiceInitial, { backgroundColor: c.primary }]}>
                <Text style={[styles.practiceInitialText, { color: '#FFFFFF' }]}>
                  {getPracticeInitials(therapist.practices[0].name)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.practiceName, { color: c.text }]}>{therapist.practices[0].name}</Text>
                <Text style={[styles.practiceCity, { color: c.muted }]}>{therapist.practices[0].city}</Text>
                {!!therapist.practices[0].address && (
                  <Text style={[styles.practiceCity, { color: c.muted }]} numberOfLines={1}>{therapist.practices[0].address}</Text>
                )}
              </View>
              {therapist.distKm != null && (
                <View style={[styles.distBadge, { backgroundColor: c.successBg }]}>
                  <Text style={[styles.distBadgeText, { color: c.success }]}>{formatDist(therapist.distKm)}</Text>
                </View>
              )}
              <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
            </Pressable>
          )}

          <Pressable style={[styles.ctaBtn, { backgroundColor: c.accent }]} onPress={() => callPhone(therapist.practices?.[0]?.phone)}>
            <Text style={styles.ctaBtnText}>{t('callPractice')}</Text>
          </Pressable>
        </View>
      ))}

      {viewMode === 'list' && searchLoading && (
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={styles.emptyIcon}>⏳</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('loading')}</Text>
        </View>
      )}

      {viewMode === 'list' && !searchLoading && results.length === 0 && searched && (
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('noResults')}</Text>
          <Text style={[styles.emptyBody, { color: c.muted }]}>{t('noResultsBody')}</Text>
          <View style={styles.emptyActions}>
            <Pressable
              onPress={() => {
                setHomeVisit(false);
                setKassenart(null);
                setFortbildungen([]);
                runSearchWith(query, userCoords);
              }}
              style={[styles.emptyActionBtn, { backgroundColor: c.primary }]}
            >
              <Text style={[styles.emptyActionText, { color: '#fff' }]}>Filter zuruecksetzen</Text>
            </Pressable>
            <Pressable
              onPress={() => { setLocationSheetCity(locationLabel || city); setShowLocationSheet(true); }}
              style={[styles.emptyActionBtn, { backgroundColor: c.mutedBg, borderColor: c.border, borderWidth: 1 }]}
            >
              <Text style={[styles.emptyActionText, { color: c.text }]}>Standort aendern</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
