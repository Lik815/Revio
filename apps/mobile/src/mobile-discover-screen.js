import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  formatDist,
  getSearchMatchLabel,
  kassenartOptions,
  quickChips,
  RADIUS,
  SPACE,
  TYPE,
} from './mobile-utils';

// ── Map platform split ──────────────────────────────────────────────────────
// Native (iOS / Android): real react-native-maps
//   iOS  → Apple Maps / MapKit   (no API key required)
//   Android → Google Maps        (requires GOOGLE_MAPS_API_KEY in app.json
//                                  android.config.googleMaps.apiKey for builds)
//
// Web: MapStub.js — a coordinate-projecting layout stub with matching API
//   surface (default MapView, Marker, Circle). No native modules imported.
//
// Two guards work together (see metro.config.js for the full explanation):
//   1. This Platform.OS ternary — dead-code signal to the bundler.
//   2. Metro resolver stub — ensures react-native-maps never enters web bundle.
// ────────────────────────────────────────────────────────────────────────────
function loadMapComponents() {
  try {
    const mapModule = Platform.OS === 'web'
      ? require('./MapStub')
      : require('react-native-maps');

    return {
      error: null,
      MapView: mapModule.default,
      Marker: mapModule.Marker,
      Circle: mapModule.Circle ?? (() => null),
    };
  } catch (error) {
    return {
      error,
      MapView: null,
      Marker: null,
      Circle: () => null,
    };
  }
}

export function DiscoverScreen(props) {
  const {
    HeartButton,
    acSuggestions,
    activeChip,
    activeFilterCount,
    authToken,
    c,
    callPhone,
    certificationOptions,
    city,
    discoverScrollRef,
    getMapRegion,
    homeVisit,
    isFavorite,
    locationLabel,
    mapTherapists,
    mapScrollEnabled,
    notifications,
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
    SkeletonCard,
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

  const safeResults = Array.isArray(results) ? results : [];
  const safeMapTherapists = Array.isArray(mapTherapists) ? mapTherapists : [];
  const safeFortbildungen = Array.isArray(fortbildungen) ? fortbildungen : [];
  const safeCertificationOptions = Array.isArray(certificationOptions)
    ? certificationOptions.filter(
        (option) => option && typeof option.key === 'string' && typeof option.label === 'string'
      )
    : [];
  const safeAcSuggestions = Array.isArray(acSuggestions)
    ? acSuggestions.filter((group) => group && typeof group.type === 'string' && Array.isArray(group.items))
    : [];
  const visibleSuggestions = safeAcSuggestions.filter((group) => group.type !== 'PRACTICE_NAME');
  const mutedText = c.textMuted ?? c.muted;
  const iconHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
  const showHeaderToggle = viewMode === 'map' || searched || safeResults.length > 0;
  const [fortbildungQuery, setFortbildungQuery] = React.useState('');
  const selectedCertificationOptions = safeFortbildungen.map((key) =>
    safeCertificationOptions.find((option) => option.key === key) ?? { key, label: key }
  );
  const normalizedFortbildungQuery = fortbildungQuery.trim().toLowerCase();
  const filteredCertificationOptions = safeCertificationOptions.filter((option) =>
    option.label.toLowerCase().includes(normalizedFortbildungQuery) ||
    option.key.toLowerCase().includes(normalizedFortbildungQuery)
  );
  const certificationSuggestions = filteredCertificationOptions
    .filter((option) => !safeFortbildungen.includes(option.key))
    .slice(0, 6);
  const resetFilters = () => {
    setHomeVisit(false);
    setKassenart(null);
    setFortbildungen([]);
    setFortbildungQuery('');
  };
  const headerToggle = (
    <View style={{ flexDirection: 'row', borderRadius: RADIUS.full, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
      {[{ key: 'list', icon: 'list' }, { key: 'map', icon: 'map' }].map((button, index) => (
        <View key={button.key} style={{ flexDirection: 'row' }}>
          {index > 0 && <View style={{ width: 1, backgroundColor: c.border }} />}
          <Pressable
            onPress={() => setViewMode(button.key)}
            style={{
              minWidth: 42,
              minHeight: 42,
              paddingHorizontal: 10,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: viewMode === button.key ? c.primaryBg : c.card,
            }}
          >
            <Ionicons name={viewMode === button.key ? button.icon : `${button.icon}-outline`} size={18} color={viewMode === button.key ? c.primary : mutedText} />
          </Pressable>
        </View>
      ))}
    </View>
  );
  const filtersPanel = (
    <View style={[styles.filterPanel, styles.filterCompactPanel, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.filterCompactHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.filterCompactTitle, { color: c.text }]}>Filter</Text>
        </View>
        {activeFilterCount > 0 ? (
          <Pressable
            onPress={resetFilters}
            style={styles.filterResetBtn}
          >
            <Text style={[styles.filterResetBtnText, { color: c.primary }]}>{t('resetFilters')}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterCompactSection}>
        <Text style={[styles.filterCompactSectionTitle, { color: c.muted }]}>Leistungen</Text>
        <Pressable
          onPress={() => setHomeVisit(!homeVisit)}
          style={[
            styles.filterCompactChip,
            {
              borderColor: homeVisit ? c.success : c.border,
              backgroundColor: homeVisit ? c.successBg : c.mutedBg,
            },
          ]}
        >
          <Ionicons name="home-outline" size={13} color={homeVisit ? c.success : mutedText} />
          <Text style={[styles.filterCompactChipText, { color: homeVisit ? c.success : c.text }]}>Hausbesuch</Text>
          {homeVisit ? <Ionicons name="checkmark" size={12} color={c.success} /> : null}
        </Pressable>
      </View>

      <View style={styles.filterCompactSection}>
        <Text style={[styles.filterCompactSectionTitle, { color: c.muted }]}>{t('kassenartLabel')}</Text>
        <View style={[styles.kassenartCompactToggle, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
          {kassenartOptions.map((option) => {
            const active = kassenart === option.key;
            return (
              <Pressable
                key={option.key ?? 'all'}
                onPress={() => setKassenart(option.key)}
                style={[
                  styles.kassenartCompactToggleBtn,
                  {
                    borderColor: active ? c.primary : 'transparent',
                    backgroundColor: active ? c.card : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.kassenartCompactToggleText, { color: active ? c.primary : c.textMuted ?? c.muted }]}>
                  {option.label}
                </Text>
                {active ? <Ionicons name="checkmark" size={12} color={c.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.filterCompactSection}>
        <View style={styles.filterCompactSectionHeader}>
          <Text style={[styles.filterCompactSectionTitle, { color: c.muted }]}>{t('fortbildungLabel')}</Text>
          <Text style={[styles.metaNote, { color: mutedText }]}>
            {selectedCertificationOptions.length > 0 ? t('nSelected').replace('{n}', selectedCertificationOptions.length) : t('searchMultiSelect')}
          </Text>
        </View>

        <View style={[styles.filterSearchField, { borderColor: c.border, backgroundColor: c.mutedBg }]}>
          <Ionicons name="search-outline" size={14} color={mutedText} />
          <TextInput
            value={fortbildungQuery}
            onChangeText={setFortbildungQuery}
            placeholder="Fortbildung suchen"
            placeholderTextColor={mutedText}
            style={[styles.filterSearchInput, { color: c.text }]}
          />
          {fortbildungQuery.length > 0 ? (
            <Pressable onPress={() => setFortbildungQuery('')} hitSlop={iconHitSlop}>
              <Ionicons name="close-circle" size={14} color={mutedText} />
            </Pressable>
          ) : null}
        </View>

        {normalizedFortbildungQuery.length > 0 && certificationSuggestions.length > 0 ? (
          <View style={[styles.filterSearchResults, { backgroundColor: c.card, borderColor: c.border }]}>
            {certificationSuggestions.map((option, index) => (
              <Pressable
                key={option.key}
                onPress={() => {
                  toggleFortbildung(option.key);
                  setFortbildungQuery('');
                }}
                style={[
                  styles.filterSearchResultItem,
                  index < certificationSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
                ]}
              >
                <Text style={[styles.filterSearchResultText, { color: c.text }]}>{option.label}</Text>
                <Ionicons name="add" size={14} color={mutedText} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {selectedCertificationOptions.length > 0 ? (
          <View style={styles.filterChipWrap}>
            {selectedCertificationOptions.map((option) => (
              <Pressable
                key={`selected-${option.key}`}
                onPress={() => toggleFortbildung(option.key)}
                style={[styles.filterSelectedChip, { backgroundColor: c.primaryBg, borderColor: c.primary }]}
              >
                <Text numberOfLines={1} style={[styles.filterSelectedChipText, { color: c.primary }]}>
                  {option.label}
                </Text>
                <Ionicons name="close" size={12} color={c.primary} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {normalizedFortbildungQuery.length > 0 && certificationSuggestions.length === 0 ? (
          <Text style={[styles.filterEmptyText, { color: mutedText }]}>{t('noCertsFound')}</Text>
        ) : null}
      </View>
    </View>
  );

  if (viewMode === 'map') {
    const { error: mapError, MapView, Marker, Circle } = loadMapComponents();

    if (!MapView || !Marker) {
      return (
        <View style={{ flex: 1, backgroundColor: c.background, padding: 16, justifyContent: 'center' }}>
          <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={styles.emptyIcon}>🗺️</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>Karte konnte nicht geladen werden</Text>
            <Text style={[styles.emptyBody, { color: c.muted }]}>
              {mapError?.message || 'Der Listenmodus funktioniert weiter.'}
            </Text>
            <Pressable
              onPress={() => setViewMode('list')}
              style={[styles.emptyActionBtn, { backgroundColor: c.primary, marginTop: 12 }]}
            >
              <Text style={[styles.emptyActionText, { color: '#fff' }]}>Zur Liste</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {/* Fixed header + search bar */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: c.background, zIndex: 10, gap: SPACE.sm }}>
          <View style={[styles.header, { justifyContent: 'space-between', marginBottom: 0 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={require('../assets/icon.png')} style={styles.logoMark} />
              <Text style={[styles.brandName, { color: c.text }]}>evio</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {authToken && (
                <Pressable
                  onPress={() => setShowNotifications(true)}
                  hitSlop={iconHitSlop}
                  style={{ width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="notifications-outline" size={18} color={mutedText} />
                  {notifications.length > 0 && <View style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: RADIUS.full, backgroundColor: c.error }} />}
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
              <Pressable onPress={() => { setQuery(''); setShowAutocomplete(false); }} hitSlop={iconHitSlop}>
                <Ionicons name="close-circle" size={16} color={c.muted} />
              </Pressable>
            )}
            <View style={[styles.searchDivider, { backgroundColor: c.border }]} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => { setLocationSheetCity(locationLabel || city); setShowLocationSheet(true); }} style={[styles.searchFilterArea, { paddingRight: 6 }]} hitSlop={iconHitSlop}>
                <View>
                  <Ionicons name="location-outline" size={20} color={city ? c.primary : c.muted} />
                  {city && <View style={{ position: 'absolute', top: -1, right: -1, width: 7, height: 7, borderRadius: 4, backgroundColor: c.success, borderWidth: 1.5, borderColor: c.card }} />}
                </View>
              </Pressable>
              <Pressable onPress={() => setShowFilters(!showFilters)} style={[styles.searchFilterArea, { paddingLeft: 6 }]} hitSlop={iconHitSlop}>
                <Ionicons name="options-outline" size={20} color={showFilters || activeFilterCount > 0 ? c.primary : c.muted} />
                {activeFilterCount > 0 && (
                  <View style={[styles.filterBadge, { backgroundColor: c.primary }]}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
          {showHeaderToggle && <View style={{ alignItems: 'flex-end' }}>{headerToggle}</View>}
          {showFilters ? filtersPanel : null}
          {(searched || safeResults.length > 0) && (
            <Text style={{ ...TYPE.meta, color: mutedText }}>
              {searched ? `${safeResults.length} ${safeResults.length !== 1 ? t('resultsLabelPlural') : t('resultsLabel')}` : t('suggestions')}
            </Text>
          )}
        </View>

        {/* Fullscreen map */}
        <View style={{ flex: 1, position: 'relative' }} onTouchStart={() => { if (showFilters) setShowFilters(false); }}>
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
            {safeMapTherapists.map((th) => (
              <React.Fragment key={`radius-${th.id}`}>
                <Circle
                  center={{ latitude: th.homeLat, longitude: th.homeLng }}
                  radius={th.serviceRadiusKm * 1000}
                  strokeColor="rgba(52,199,89,0.5)"
                  fillColor="rgba(52,199,89,0.07)"
                  strokeWidth={1.5}
                />
                <Marker coordinate={{ latitude: th.homeLat, longitude: th.homeLng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} onPress={() => openTherapistById(th.id)}>
                  <View style={{ backgroundColor: c.success, borderRadius: 16, paddingHorizontal: 9, paddingVertical: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>🏠 {(typeof th?.fullName === 'string' && th.fullName.trim() ? th.fullName.trim().split(/\s+/)[0] : 'Profil')}</Text>
                  </View>
                </Marker>
              </React.Fragment>
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

          {!searchLoading && safeMapTherapists.length === 0 && searched && (
            <View style={{ position: 'absolute', top: 20, left: 20, right: 20, padding: 20, borderRadius: 18, backgroundColor: 'rgba(17,24,39,0.82)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="location-outline" size={36} color="#fff" />
              {userCoords ? (
                <>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 10 }}>
                    {t('noNearbyPractices').replace('{n}', searchRadius)}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, textAlign: 'center', marginTop: 6 }}>
                    {t('tryAnotherLocation')}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 10 }}>
                    {t('noGeoData')}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, textAlign: 'center', marginTop: 6 }}>
                    {t('noGeoDataBody')}
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
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Sticky header — logo, search, chips, location, filters */}
      <View style={{ backgroundColor: c.background, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, zIndex: 10, gap: SPACE.sm }}>
        <View style={[styles.header, { justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={require('../assets/icon.png')} style={styles.logoMark} />
            <Text style={[styles.brandName, { color: c.text }]}>evio</Text>
          </View>
          {authToken && (
            <Pressable
              onPress={() => setShowNotifications(true)}
              hitSlop={iconHitSlop}
              style={{ width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="notifications-outline" size={18} color={mutedText} />
              {notifications.length > 0 && (
                <View style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: RADIUS.full, backgroundColor: c.error }} />
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
              { backgroundColor: c.card, borderColor: showAutocomplete && visibleSuggestions.length > 0 ? c.primary : c.border },
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
              <Pressable onPress={() => { setQuery(''); setShowAutocomplete(false); }} hitSlop={iconHitSlop}>
                <Ionicons name="close-circle" size={16} color={c.muted} />
              </Pressable>
            )}
            <View style={[styles.searchDivider, { backgroundColor: c.border }]} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => { setLocationSheetCity(locationLabel || city); setShowLocationSheet(true); }} style={[styles.searchFilterArea, { paddingRight: 6 }]} hitSlop={iconHitSlop}>
                <View>
                  <Ionicons name="location-outline" size={20} color={city ? c.primary : c.muted} />
                  {city && <View style={{ position: 'absolute', top: -1, right: -1, width: 7, height: 7, borderRadius: 4, backgroundColor: c.success, borderWidth: 1.5, borderColor: c.card }} />}
                </View>
              </Pressable>
              <Pressable onPress={() => setShowFilters(!showFilters)} style={[styles.searchFilterArea, { paddingLeft: 6 }]} hitSlop={iconHitSlop}>
                <Ionicons name="options-outline" size={20} color={showFilters || activeFilterCount > 0 ? c.primary : c.muted} />
                {activeFilterCount > 0 && (
                  <View style={[styles.filterBadge, { backgroundColor: c.primary }]}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {showAutocomplete && visibleSuggestions.length > 0 && (
            <View style={[styles.autocompleteBox, { backgroundColor: c.card, borderColor: c.primary }]}>
              {visibleSuggestions.map((group) => {
                const typeLabel = group.type === 'SPECIALTY' ? 'Spezialisierung'
                  : group.type === 'THERAPIST_NAME' ? 'Therapeut'
                  : group.type === 'CITY' ? 'Ort'
                  : group.type;
                const typeIcon = group.type === 'SPECIALTY' ? 'medical-outline'
                  : group.type === 'THERAPIST_NAME' ? 'person-outline'
                  : group.type === 'CITY' ? 'location-outline'
                  : 'search-outline';
                return (
                  <View key={group.type}>
                    <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: mutedText, textTransform: 'uppercase', letterSpacing: 0.5 }}>{typeLabel}</Text>
                    </View>
                    {group.items.map((item, idx) => (
                      <Pressable
                        key={`${group.type}-${item.text}-${idx}`}
                        onPress={() => selectSuggestion(item)}
                        style={[
                          styles.acItem,
                          idx < group.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
                        ]}
                      >
                        <Ionicons name={typeIcon} size={14} color={c.muted} style={{ marginRight: 4 }} />
                        <Text style={[styles.acItemText, { color: c.text }]}>{item.text}</Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {!showFilters && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={styles.chipsRow}
            >
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
            {showHeaderToggle ? headerToggle : null}
          </View>
        )}

        {showFilters ? filtersPanel : null}
      </View>

      {/* Scrollbare Ergebnisse */}
      <ScrollView
        ref={discoverScrollRef}
        scrollEnabled={mapScrollEnabled}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onTouchStart={() => { if (showFilters) setShowFilters(false); }}
      >
      {(searched || safeResults.length > 0) ? (
        <View style={styles.sectionRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ ...TYPE.meta, color: mutedText }}>
              {searched ? `${safeResults.length} ${safeResults.length !== 1 ? t('resultsLabelPlural') : t('resultsLabel')}` : t('suggestions')}
            </Text>
            <Text style={{ ...TYPE.meta, color: mutedText }}>
              {city ? `In ${city}` : t('locationPlaceholder')}
              {activeFilterCount > 0 ? ` · ${activeFilterCount} Filter` : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.approvedPill, { backgroundColor: c.successBg }]}>
              <Text style={[styles.approvedPillText, { color: c.success }]}>{t('verifiedOnly')}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {viewMode === 'list' && searchLoading && [1, 2, 3].map((item) => (
        <SkeletonCard key={item} C={c} />
      ))}

      {viewMode === 'list' && !searchLoading && safeResults.map((therapist) => (
        <View key={therapist.id} style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.cardTop}>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }} onPress={() => openTherapistById(therapist.id)}>
              <Image source={{ uri: therapist.photo }} style={[styles.avatar, { width: 60, height: 60, borderRadius: RADIUS.full }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: c.text }]}>{therapist.fullName}</Text>
                <Text style={[styles.cardTitle, { color: mutedText }]}>{therapist.professionalTitle}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                  <View style={[styles.metaPill, { backgroundColor: c.mutedBg }]}>
                    <Text style={[styles.metaPillText, { color: c.text }]}>{getSearchMatchLabel(therapist, query)}</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
            </Pressable>
            <HeartButton isSaved={isFavorite(therapist.id)} onToggle={() => toggleFavorite(therapist)} unsavedColor={c.muted} hitSlop={iconHitSlop} />
          </View>

          <View style={styles.tagRow}>
            {(therapist.specializations ?? []).slice(0, 2).map((specialization) => (
              <View key={specialization} style={[styles.tag, { backgroundColor: c.primaryBg }]}>
                <Text style={[styles.tagText, { color: c.primary }]}>{specialization}</Text>
              </View>
            ))}
            {(therapist.specializations ?? []).length > 2 && (
              <View style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: mutedText }]}>+{therapist.specializations.length - 2}</Text>
              </View>
            )}
            {therapist.homeVisit && (
              <View style={[styles.tag, { backgroundColor: c.successBg, borderWidth: 1, borderColor: c.success }]}>
                <Text style={[styles.tagText, { color: c.success }]}>🏠 {therapist.serviceRadiusKm ? `bis ${therapist.serviceRadiusKm} km` : t('homeVisitTag')}</Text>
              </View>
            )}
            {therapist.kassenart && therapist.kassenart !== 'Alle' && (
              <View style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: mutedText }]}>{therapist.kassenart}</Text>
              </View>
            )}
          </View>

          {therapist.fortbildungen?.length > 0 && (
            <View style={styles.tagRow}>
              {(Array.isArray(therapist.fortbildungen) ? therapist.fortbildungen : []).slice(0, 2).map((qualification) => (
                <View key={qualification} style={[styles.tag, { backgroundColor: c.successBg, borderWidth: 1, borderColor: c.success }]}>
                  <Text style={[styles.tagText, { color: c.success }]}>{qualification}</Text>
                </View>
              ))}
            </View>
          )}

          {therapist.homeVisit && therapist.city ? (
            <View style={[styles.practiceBtn, { borderColor: c.border, backgroundColor: c.mutedBg }]}>
              <View style={[styles.practiceInitial, { backgroundColor: c.successBg }]}>
                <Ionicons name="home-outline" size={16} color={c.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.practiceName, { color: c.text }]}>{therapist.city}</Text>
                {therapist.availability ? (
                  <Text style={[styles.practiceCity, { color: c.muted }]} numberOfLines={1}>{therapist.availability}</Text>
                ) : null}
              </View>
              {therapist.distKm != null && (
                <View style={[styles.distBadge, { backgroundColor: c.successBg }]}>
                  <Text style={[styles.distBadgeText, { color: c.success }]}>{formatDist(therapist.distKm)}</Text>
                </View>
              )}
            </View>
          ) : therapist.city ? (
            <View style={[styles.practiceBtn, { borderColor: c.border, backgroundColor: c.mutedBg }]}>
              <View style={[styles.practiceInitial, { backgroundColor: c.border }]}>
                <Ionicons name="location-outline" size={16} color={mutedText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.practiceName, { color: c.text }]}>{therapist.city}</Text>
                {therapist.availability ? (
                  <Text style={[styles.practiceCity, { color: c.muted }]} numberOfLines={1}>{therapist.availability}</Text>
                ) : null}
              </View>
              {therapist.distKm != null ? (
                <View style={[styles.distBadge, { backgroundColor: c.successBg }]}>
                  <Text style={[styles.distBadgeText, { color: c.success }]}>{formatDist(therapist.distKm)}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={[styles.ctaBtn, { backgroundColor: c.primary, marginTop: 2 }]}
            onPress={() => openTherapistById(therapist.id)}
          >
            <Text style={styles.ctaBtnText}>{t('viewProfileBtn')}</Text>
          </Pressable>
        </View>
      ))}

      {viewMode === 'list' && !searchLoading && safeResults.length === 0 && searched && (
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
              <Text style={[styles.emptyActionText, { color: '#fff' }]}>{t('resetFilters')}</Text>
            </Pressable>
            <Pressable
              onPress={() => { setLocationSheetCity(locationLabel || city); setShowLocationSheet(true); }}
              style={[styles.emptyActionBtn, { backgroundColor: c.mutedBg, borderColor: c.border, borderWidth: 1 }]}
            >
              <Text style={[styles.emptyActionText, { color: c.text }]}>{t('changeLocation')}</Text>
            </Pressable>
          </View>
        </View>
      )}
      </ScrollView>
    </View>
  );
}
