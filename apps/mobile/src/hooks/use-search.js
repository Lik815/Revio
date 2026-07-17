import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TUNNEL_HEADERS,
  fortbildungOptions,
  getBaseUrl,
  haversine,
  mapApiTherapist,
  normalizeKassenarten,
  resolveKassenartFilterValues,
} from '../utils/app-utils';

const webNavigator = typeof globalThis !== 'undefined' ? globalThis.navigator : undefined;

function normalizeCertificationOption(option) {
  if (typeof option === 'string') {
    const value = option.trim();
    return value ? { key: value, label: value } : null;
  }
  if (!option || typeof option !== 'object') return null;
  const key =
    typeof option.key === 'string' && option.key.trim()
      ? option.key.trim()
      : typeof option.label === 'string' && option.label.trim()
        ? option.label.trim()
        : '';
  const label =
    typeof option.label === 'string' && option.label.trim() ? option.label.trim() : key;
  if (!key || !label) return null;
  return { key, label };
}

function normalizeCertificationOptions(options, fallback = fortbildungOptions) {
  const source = Array.isArray(options) ? options : fallback;
  const seen = new Set();
  return source
    .map(normalizeCertificationOption)
    .filter((option) => {
      if (!option || seen.has(option.key)) return false;
      seen.add(option.key);
      return true;
    });
}

function normalizeAutocompleteSuggestions(groups) {
  if (!Array.isArray(groups)) return [];
  return groups
    .map((group) => {
      const type =
        typeof group?.type === 'string' && group.type.trim() ? group.type.trim() : 'OTHER';
      const items = Array.isArray(group?.items)
        ? group.items
            .map((item) => {
              const text = typeof item?.text === 'string' ? item.text.trim() : '';
              if (!text) return null;
              return {
                text,
                entityId: typeof item?.entityId === 'string' ? item.entityId : null,
              };
            })
            .filter(Boolean)
        : [];
      if (items.length === 0) return null;
      return { type, items };
    })
    .filter(Boolean);
}

/**
 * Owns all search + location state, filters, autocomplete, and map data.
 * Receives `t` (translation function) for alert messages.
 */
export function useSearch({ t }) {
  // ── Search filters ────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeChip, setActiveChip] = useState(null);
  const [homeVisit, setHomeVisit] = useState(false);
  const [kassenart, setKassenart] = useState(null);
  const [gender, setGender] = useState(null);
  const [requestableOnly, setRequestableOnly] = useState(false);
  const [fortbildungen, setFortbildungen] = useState([]);
  const [certificationOptions, setCertificationOptions] = useState(() =>
    normalizeCertificationOptions(fortbildungOptions),
  );
  const [searchRadius, setSearchRadius] = useState(5);
  const [showFilters, setShowFilters] = useState(false);

  // ── Search results ────────────────────────────────────────────────────────
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allApiTherapists, setAllApiTherapists] = useState([]);
  const [searched, setSearched] = useState(false);
  const [viewMode, setViewMode] = useState('list');

  // ── Kurssuche (eigener Pfad, unabhängig von Therapeuten-Ergebnissen) ───────
  // Läuft NICHT durch runSearchWith – Kurse brauchen keinen Ort und dürfen die
  // Therapeuten-Ergebnisse (results/mapTherapists) nicht überschreiben.
  const [courseResults, setCourseResults] = useState([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseCategoryKey, setCourseCategoryKey] = useState(null);
  const courseDebounceRef = useRef(null);

  // ── Autocomplete ──────────────────────────────────────────────────────────
  const [acSuggestions, setAcSuggestions] = useState([]);
  const acDebounceRef = useRef(null);
  const acAbortRef = useRef(null);

  // ── Location ──────────────────────────────────────────────────────────────
  const [city, setCity] = useState('');
  const [userCoords, setUserCoords] = useState(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(null);
  const [locationSheetCity, setLocationSheetCity] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const locationDebounceRef = useRef(null);
  const pendingGPSResult = useRef(null);

  // ── Tracks whether a search has been run (for auto-refresh guards) ────────
  const searchedRef = useRef(false);
  useEffect(() => { searchedRef.current = searched; }, [searched]);

  // ── Load saved location from AsyncStorage on mount ────────────────────────
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('savedCity'),
      AsyncStorage.getItem('savedLocationLabel'),
      AsyncStorage.getItem('savedCoords'),
    ]).then(([savedCity, savedLabel, savedCoords]) => {
      if (savedCity) setCity(savedCity);
      if (savedLabel) setLocationLabel(savedLabel);
      if (savedCoords) {
        try { setUserCoords(JSON.parse(savedCoords)); } catch {}
      }
    });
  }, []);

  // ── Load certification options from API on mount ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/config/options`, { headers: TUNNEL_HEADERS });
        if (!res.ok) return;
        const data = await res.json();
        const nextOptions = normalizeCertificationOptions(data?.certifications, fortbildungOptions);
        if (!cancelled && nextOptions.length > 0) setCertificationOptions(nextOptions);
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Autocomplete debounce ─────────────────────────────────────────────────
  useEffect(() => {
    if (query.length < 2) { setAcSuggestions([]); return; }
    if (acDebounceRef.current) clearTimeout(acDebounceRef.current);
    acDebounceRef.current = setTimeout(async () => {
      if (acAbortRef.current) acAbortRef.current.abort();
      const controller = new AbortController();
      acAbortRef.current = controller;
      try {
        const res = await fetch(
          `${getBaseUrl()}/suggest?q=${encodeURIComponent(query)}`,
          { headers: TUNNEL_HEADERS, signal: controller.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAcSuggestions(normalizeAutocompleteSuggestions(data?.suggestions));
      } catch (err) {
        if (err.name !== 'AbortError') setAcSuggestions([]);
      }
    }, 200);
    return () => { if (acDebounceRef.current) clearTimeout(acDebounceRef.current); };
  }, [query]);

  // ── Kurssuche: Fetch + debounced Effekt ───────────────────────────────────
  const runCourseSearch = async (text, categoryKey) => {
    setCourseLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (trimmed.length >= 2) params.set('q', trimmed);
      if (categoryKey) params.set('categoryKey', categoryKey);
      const res = await fetch(`${getBaseUrl()}/courses?${params}`, { headers: { ...TUNNEL_HEADERS } });
      if (res.ok) {
        const data = await res.json();
        setCourseResults(data.courses ?? []);
      } else {
        setCourseResults([]);
      }
    } catch {
      setCourseResults([]);
    } finally {
      setCourseLoading(false);
    }
  };

  // Ein Effekt deckt alle drei Auslöser im Kursmodus ab: Chip-Aktivierung,
  // Kategorie-Wechsel und Titel-Textsuche (query). 350 ms Debounce.
  useEffect(() => {
    if (activeChip?.type !== 'courses') return;
    if (courseDebounceRef.current) clearTimeout(courseDebounceRef.current);
    courseDebounceRef.current = setTimeout(() => {
      runCourseSearch(query, courseCategoryKey);
    }, 350);
    return () => { if (courseDebounceRef.current) clearTimeout(courseDebounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChip, query, courseCategoryKey]);

  const selectCourseCategory = (key) => {
    setCourseCategoryKey(key);
  };

  // ── Filter helpers ────────────────────────────────────────────────────────
  const activeFilterCount =
    (homeVisit ? 1 : 0) +
    (kassenart ? 1 : 0) +
    (gender ? 1 : 0) +
    fortbildungen.length +
    (requestableOnly ? 1 : 0);

  const getCertificationLabel = (key) =>
    certificationOptions.find((o) => o.key === key)?.label ?? key;

  const toggleFortbildung = (key) => {
    setFortbildungen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const resetDiscoverState = () => {
    setQuery('');
    setShowAutocomplete(false);
    setActiveChip(null);
    setHomeVisit(false);
    setKassenart(null);
    setGender(null);
    setRequestableOnly(false);
    setFortbildungen([]);
    setResults([]);
    setSearched(false);
    setViewMode('list');
    setShowFilters(false);
    setCourseResults([]);
    setCourseCategoryKey(null);
  };

  // ── Core search logic ─────────────────────────────────────────────────────
  // Treffer für Ort/Radius schließen Ergebnisse nicht mehr aus, sondern werden
  // weiter unten zuerst sortiert – Rest bleibt als "weitere Ergebnisse" sichtbar.
  const matchScore = (th) => (th.cityMatch !== false ? 1 : 0) + (th.radiusMatch !== false ? 1 : 0);

  const applyFilters = (list, coords) => {
    const safeList = Array.isArray(list) ? list : [];
    return safeList.filter((th) => {
      if (homeVisit && !th.homeVisit) return false;
      if (kassenart) {
        const accepted = resolveKassenartFilterValues(kassenart);
        const therapistKassenarten = normalizeKassenarten(th.kassenarten ?? th.kassenart);
        if (!accepted.some((value) => therapistKassenarten.includes(value))) return false;
      }
      if (gender && th.gender !== gender) return false;
      if (fortbildungen.length > 0) {
        const certs = Array.isArray(th?.fortbildungen)
          ? th.fortbildungen
          : Array.isArray(th?.certifications)
            ? th.certifications
            : [];
        if (!fortbildungen.some((f) => certs.includes(f))) return false;
      }
      return true;
    });
  };

  const withDistances = (list, coords) => {
    const safeList = Array.isArray(list) ? list : [];
    if (!coords) return safeList;
    return safeList
      .map((th) => {
        if (typeof th.distKm === 'number') return th;
        // Minimum über alle Praxen mit Koordinaten — nicht nur practices[0],
        // sonst gewinnt eine weiter entfernte Erst-Praxis über eine nähere Zweite.
        const distances = (th.practices ?? [])
          .map((practice) =>
            typeof practice.distKm === 'number'
              ? practice.distKm
              : practice.lat
                ? haversine(coords.lat, coords.lng, practice.lat, practice.lng)
                : null,
          )
          .filter((d) => typeof d === 'number');
        if (distances.length === 0) return { ...th, distKm: null };
        return { ...th, distKm: Math.min(...distances) };
      })
      .sort((a, b) => {
        const scoreDiff = matchScore(b) - matchScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return (a.distKm ?? 9999) - (b.distKm ?? 9999);
      });
  };

  const fetchSearchResults = async (q, effectiveCity, origin) => {
    // homeVisit/kassenart/gender/fortbildungen werden bewusst NICHT mehr an den
    // Server geschickt: sie werden lokal über applyFilters angewendet, damit ein
    // Filter-Toggle sofort wirkt (kein Server-Roundtrip). Der Server liefert die
    // nach Suchbegriff + Ort + requestable gefilterte Obermenge; die feineren
    // Filter grenzen diese im Client ein.
    const response = await fetch(`${getBaseUrl()}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
      body: JSON.stringify({
        query: q || 'physiotherapie',
        city: effectiveCity,
        origin: origin ? { lat: origin.lat, lng: origin.lng } : undefined,
        radiusKm: origin ? searchRadius : undefined,
        requestable: requestableOnly || undefined,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return (Array.isArray(payload?.therapists) ? payload.therapists : []).map(mapApiTherapist);
  };

  const runSearchWith = async (q, coords, cityOverride, originOverride) => {
    const effectiveCity =
      typeof (cityOverride ?? city) === 'string' ? (cityOverride ?? city) : '';
    const effectiveOrigin =
      originOverride !== undefined ? originOverride : (coords ?? userCoords);
    if (!effectiveCity.trim()) {
      setPendingQuery(q);
      setLocationSheetCity('');
      setShowLocationSheet(true);
      return;
    }
    setShowAutocomplete(false);
    setSearched(true);
    setSearchLoading(true);
    try {
      const mapped = await fetchSearchResults(q, effectiveCity, effectiveOrigin);
      const withDist = withDistances(mapped, effectiveOrigin);
      setResults(applyFilters(withDist, effectiveOrigin));
      setAllApiTherapists(withDist);
    } catch (err) {
      const message = String(err?.message ?? t('alertUnknownError'));
      const usingLocalTunnel = getBaseUrl().includes('.loca.lt');
      const tunnelHint = usingLocalTunnel
        ? "\n\nHint: Your API URL points to a localtunnel link. Check if the tunnel is still active."
        : '';
      Alert.alert(
        t('alertConnectionError'),
        `${t('alertSearchFail')}: ${message}\n\nAPI-URL: ${getBaseUrl()}${tunnelHint}`,
      );
      setResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const runSearch = () => runSearchWith(query, userCoords);

  const selectChip = (chip) => {
    // Kurs-Chip zweigt VOR runSearchWith ab: kein Ort-Guard, kein LocationSheet.
    if (chip.type === 'courses') {
      setActiveChip(chip);
      setQuery('');
      setShowAutocomplete(false);
      setCourseCategoryKey(null);
      // Fetch übernimmt der debounced Effekt (reagiert auf activeChip-Wechsel).
      return;
    }
    setActiveChip(chip);
    setQuery(chip.label);
    runSearchWith(chip.label, userCoords);
  };

  const selectSuggestion = (suggestion) => {
    const text = typeof suggestion === 'string' ? suggestion : suggestion?.text;
    if (!text) return;
    setQuery(text);
    setAcSuggestions([]);
    setShowAutocomplete(false);
    runSearchWith(text, userCoords);
  };

  // ── Re-filter locally when filters change ─────────────────────────────────
  // Diese Filter grenzen nur die bereits geladene Obermenge ein — kein neuer
  // Server-Request. Im Kursmodus (activeChip.type === 'courses') dürfen die
  // Therapeuten-Ergebnisse nicht angefasst werden.
  useEffect(() => {
    if (!searchedRef.current) return;
    if (activeChip?.type === 'courses') return;
    setResults(applyFilters(allApiTherapists, userCoords));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeVisit, kassenart, gender, fortbildungen]);

  useEffect(() => {
    if (!searchedRef.current) return;
    if (userCoords) { runSearchWith(query, userCoords); return; }
    if (allApiTherapists.length === 0) return;
    setResults(applyFilters(allApiTherapists, userCoords));
  }, [searchRadius]);

  // ── Location sheet ────────────────────────────────────────────────────────
  const fetchLocationSuggestions = (text) => {
    setLocationSheetCity(text);
    pendingGPSResult.current = null;
    setLocationSuggestions([]);
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    if (text.length < 3) return;
    locationDebounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=6&countrycodes=de,at,ch&accept-language=de`;
        const res = await fetch(url, { headers: { 'User-Agent': 'RevioApp/1.0' } });
        const data = await res.json();
        const nextSuggestions = (Array.isArray(data) ? data : [])
          .map((item) => {
            const displayName =
              typeof item?.display_name === 'string' ? item.display_name : '';
            return {
              label: displayName.split(',').slice(0, 3).join(',').trim(),
              city:
                item?.address?.city ||
                item?.address?.town ||
                item?.address?.village ||
                item?.address?.municipality ||
                '',
              lat: Number.parseFloat(item?.lat),
              lng: Number.parseFloat(item?.lon),
            };
          })
          .filter(
            (s) => s.city && Number.isFinite(s.lat) && Number.isFinite(s.lng),
          );
        setLocationSuggestions(nextSuggestions);
      } catch {}
    }, 350);
  };

  const confirmLocationAndSearch = (resolvedCity, coords, label) => {
    setCity(resolvedCity);
    setLocationLabel(label || resolvedCity);
    if (coords) {
      setUserCoords(coords);
      AsyncStorage.setItem('savedCoords', JSON.stringify(coords));
    } else {
      setUserCoords(null);
      AsyncStorage.removeItem('savedCoords');
    }
    AsyncStorage.setItem('savedCity', resolvedCity);
    AsyncStorage.setItem('savedLocationLabel', label || resolvedCity);
    setShowLocationSheet(false);
    runSearchWith(pendingQuery ?? query, coords, resolvedCity, coords ?? null);
    setPendingQuery(null);
  };

  const selectLocationSuggestion = (suggestion) => {
    if (
      !suggestion?.city ||
      !Number.isFinite(suggestion.lat) ||
      !Number.isFinite(suggestion.lng)
    ) return;
    setLocationSuggestions([]);
    setLocationSheetCity(suggestion.label);
    confirmLocationAndSearch(
      suggestion.city,
      { lat: suggestion.lat, lng: suggestion.lng },
      suggestion.label,
    );
  };

  const handleLocationSheetGPS = async () => {
    setLocationLoading(true);
    if (Platform.OS === 'web') {
      if (!webNavigator?.geolocation) {
        Alert.alert(t('alertError'), t('alertLocationNotSupported'));
        setLocationLoading(false);
        return;
      }
      webNavigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=de`,
            );
            const data = await res.json();
            const addr = data?.address || {};
            const detectedCity =
              addr.city || addr.town || addr.village || addr.municipality || '';
            if (!detectedCity) {
              Alert.alert(t('alertError'), t('alertCityNotRecognized'));
              setLocationLoading(false);
              return;
            }
            const streetParts = [addr.road, addr.house_number].filter(Boolean).join(' ');
            const label = streetParts ? `${streetParts}, ${detectedCity}` : detectedCity;
            pendingGPSResult.current = {
              city: detectedCity,
              coords: { lat: latitude, lng: longitude },
              label,
            };
            setLocationSheetCity(label);
          } catch {
            Alert.alert(t('alertError'), t('alertLocationFail'));
          }
          setLocationLoading(false);
        },
        () => {
          Alert.alert(t('alertNoAccess'), t('alertAllowLocationBrowser'));
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('alertNoAccess'), t('alertAllowLocation'));
        setLocationLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      const detectedCity = geo?.city || '';
      if (!detectedCity) {
        Alert.alert(t('alertError'), t('alertCityNotRecognized'));
        setLocationLoading(false);
        return;
      }
      const streetParts = [geo.street, geo.streetNumber].filter(Boolean).join(' ');
      const label = streetParts ? `${streetParts}, ${detectedCity}` : detectedCity;
      pendingGPSResult.current = {
        city: detectedCity,
        coords: { lat: loc.coords.latitude, lng: loc.coords.longitude },
        label,
      };
      setLocationSheetCity(label);
    } catch {
      Alert.alert(t('alertError'), t('alertLocationFail'));
    }
    setLocationLoading(false);
  };

  const handleLocationSheetManual = async () => {
    const input = locationSheetCity.trim();
    if (!input) return;
    if (pendingGPSResult.current && pendingGPSResult.current.label === input) {
      const { city: gpsCity, coords: gpsCoords, label: gpsLabel } = pendingGPSResult.current;
      pendingGPSResult.current = null;
      confirmLocationAndSearch(gpsCity, gpsCoords, gpsLabel);
      return;
    }
    setLocationLoading(true);
    try {
      if (Platform.OS === 'web') {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&limit=1&accept-language=de`,
        );
        const data = await res.json();
        if (data.length > 0) {
          const { lat, lon } = data[0];
          const revRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=de`,
          );
          const revData = await revRes.json();
          const addr = revData?.address || {};
          const resolvedCity =
            addr.city || addr.town || addr.village || addr.municipality || input;
          const streetParts = [addr.road, addr.house_number].filter(Boolean).join(' ');
          const label = streetParts ? `${streetParts}, ${resolvedCity}` : resolvedCity;
          confirmLocationAndSearch(resolvedCity, { lat: parseFloat(lat), lng: parseFloat(lon) }, label);
        } else {
          Alert.alert(t('alertAddressNotFound'), t('alertAddressNotFoundBody'));
        }
      } else {
        const geocoded = await Location.geocodeAsync(input);
        if (geocoded.length > 0) {
          const { latitude, longitude } = geocoded[0];
          const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
          const resolvedCity = geo?.city || input;
          const streetParts = [geo?.street, geo?.streetNumber].filter(Boolean).join(' ');
          const label = streetParts ? `${streetParts}, ${resolvedCity}` : resolvedCity;
          confirmLocationAndSearch(resolvedCity, { lat: latitude, lng: longitude }, label);
        } else {
          Alert.alert(t('alertAddressNotFound'), t('alertAddressNotFoundBody'));
        }
      }
    } catch {
      Alert.alert(t('alertAddressFail'), t('alertAddressFailBody'));
    }
    setLocationLoading(false);
  };

  // ── Map data (derived) ────────────────────────────────────────────────────
  const mapTherapists = useMemo(
    () =>
      results
        .map((th) => {
          if (th.homeVisit && th.homeLat && th.homeLng) {
            return { ...th, _mapLat: th.homeLat, _mapLng: th.homeLng, _mapType: 'home' };
          }
          const p = (th.practices ?? []).find(
            (pr) => pr.lat && pr.lat !== 0 && pr.lng && pr.lng !== 0,
          );
          if (p) return { ...th, _mapLat: p.lat, _mapLng: p.lng, _mapType: 'practice' };
          return null;
        })
        .filter(Boolean),
    [results],
  );

  const mapRegion = useMemo(() => {
    if (userCoords) {
      const delta = Math.max((searchRadius / 111) * 2.8, 0.02);
      return {
        latitude: userCoords.lat,
        longitude: userCoords.lng,
        latitudeDelta: delta,
        longitudeDelta: delta,
      };
    }
    if (mapTherapists.length === 0)
      return { latitude: 51.1657, longitude: 10.4515, latitudeDelta: 5.0, longitudeDelta: 5.0 };
    const avgLat = mapTherapists.reduce((s, th) => s + th._mapLat, 0) / mapTherapists.length;
    const avgLng = mapTherapists.reduce((s, th) => s + th._mapLng, 0) / mapTherapists.length;
    const latSpan =
      Math.max(...mapTherapists.map((th) => Math.abs(th._mapLat - avgLat))) * 2.2 || 0.08;
    const lngSpan =
      Math.max(...mapTherapists.map((th) => Math.abs(th._mapLng - avgLng))) * 2.2 || 0.08;
    return {
      latitude: avgLat,
      longitude: avgLng,
      latitudeDelta: Math.max(latSpan, 0.05),
      longitudeDelta: Math.max(lngSpan, 0.05),
    };
  }, [mapTherapists, userCoords, searchRadius]);

  return {
    // Search filters
    query, setQuery,
    showAutocomplete, setShowAutocomplete,
    activeChip, setActiveChip,
    homeVisit, setHomeVisit,
    kassenart, setKassenart,
    gender, setGender,
    requestableOnly, setRequestableOnly,
    fortbildungen, setFortbildungen,
    certificationOptions,
    searchRadius, setSearchRadius,
    showFilters, setShowFilters,
    activeFilterCount,
    getCertificationLabel,
    toggleFortbildung,
    resetDiscoverState,
    // Search results
    results, setResults,
    searchLoading,
    allApiTherapists,
    searched, setSearched,
    viewMode, setViewMode,
    // Course search
    courseResults,
    courseLoading,
    courseCategoryKey,
    selectCourseCategory,
    // Autocomplete
    acSuggestions,
    // Search actions
    runSearch, runSearchWith,
    selectChip, selectSuggestion,
    // Location
    city, setCity,
    userCoords, setUserCoords,
    locationLabel, setLocationLabel,
    showLocationSheet, setShowLocationSheet,
    locationSheetCity, setLocationSheetCity,
    locationLoading,
    locationSuggestions,
    // Location actions
    fetchLocationSuggestions,
    selectLocationSuggestion,
    confirmLocationAndSearch,
    handleLocationSheetGPS,
    handleLocationSheetManual,
    // Map
    mapTherapists,
    mapRegion,
    getMapRegion: () => mapRegion,
  };
}
