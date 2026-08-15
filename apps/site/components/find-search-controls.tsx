'use client';

import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

export type FindSearchLocation = {
  /** Text shown in the location chip. May contain the reverse-geocoded address. */
  label: string;
  /** City-only value that is safe to include in the shareable URL. */
  city: string;
  lat?: number;
  lng?: number;
};

export type FindSearchOrigin = {
  lat: number;
  lng: number;
};

export type FindSearchSubmission = {
  query: string;
  city: string;
  homeVisit: boolean;
  kassenart: string;
  location: FindSearchLocation;
  /** Only present when the location came from geolocation. */
  origin?: FindSearchOrigin;
  radiusKm: number;
};

export type FindSearchControlsProps = {
  defaultQuery?: string;
  defaultCity?: string;
  defaultHomeVisit?: boolean;
  defaultKassenart?: string;
  defaultLocation?: FindSearchLocation;
  defaultRadiusKm?: number;
  placeholder?: string;
  formId?: string;
  /**
   * Handles a coordinate-aware search without exposing coordinates in the URL.
   *
   * When coordinates exist, submit is handled through this callback instead of
   * performing the native GET navigation. Without coordinates (or without this
   * callback), the form keeps its normal `/finden` GET fallback.
   */
  onEnhancedSearch?: (submission: FindSearchSubmission) => void | Promise<void>;
};

type OpenPanel = 'location' | 'filters' | 'radius' | null;

type ReverseGeocodeResponse = {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    road?: string;
    pedestrian?: string;
    footway?: string;
    house_number?: string;
    postcode?: string;
  };
};

const KASSENARTEN = [
  { value: '', label: 'Alle' },
  { value: 'gesetzlich', label: 'Gesetzlich' },
  { value: 'privat', label: 'Privat' },
  { value: 'selbstzahler', label: 'Selbstzahler' },
  { value: 'privat_selbstzahler', label: 'Privat & Selbstzahler' },
] as const;

const RADIUS_OPTIONS = [1, 3, 5, 10, 25] as const;
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 300_000,
};

const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function isKnownRadius(value: number): value is (typeof RADIUS_OPTIONS)[number] {
  return RADIUS_OPTIONS.some((option) => option === value);
}

function normalizeRadius(value: number | undefined): number {
  return value !== undefined && isKnownRadius(value) ? value : 5;
}

function normalizeKassenart(value: string | undefined): string {
  return KASSENARTEN.some((option) => option.value === value) ? value ?? '' : '';
}

function hasCoordinates(location: FindSearchLocation): location is FindSearchLocation & FindSearchOrigin {
  return (
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    Math.abs(location.lat as number) <= 90 &&
    Math.abs(location.lng as number) <= 180
  );
}

function getCity(address: ReverseGeocodeResponse['address']): string {
  return (
    address?.city ||
    address?.town ||
    address?.village ||
    address?.municipality ||
    address?.county ||
    ''
  ).trim();
}

function getLocationLabel(data: ReverseGeocodeResponse, city: string): string {
  const address = data.address;
  const street = address?.road || address?.pedestrian || address?.footway || '';
  const streetLine = [street, address?.house_number].filter(Boolean).join(' ');
  const cityLine = [address?.postcode, city].filter(Boolean).join(' ');
  return [streetLine, cityLine].filter(Boolean).join(', ') || data.display_name?.trim() || city;
}

async function reverseGeocodeLocation(
  lat: number,
  lng: number,
  signal: AbortSignal,
): Promise<FindSearchLocation> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&addressdetails=1&accept-language=de`,
    {
      headers: { Accept: 'application/json' },
      signal,
    },
  );

  if (!response.ok) throw new Error('Reverse geocoding failed');

  const data = (await response.json()) as ReverseGeocodeResponse;
  const city = getCity(data.address);
  if (!city) throw new Error('No city found for position');

  return {
    label: getLocationLabel(data, city),
    city,
    lat,
    lng,
  };
}

function SearchIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function LocationIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <circle cx="9" cy="7" r="2" />
      <path d="M4 17h16" />
      <circle cx="15" cy="17" r="2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CurrentLocationIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="find-search__spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

export function FindSearchControls({
  defaultQuery = '',
  defaultCity = '',
  defaultHomeVisit = false,
  defaultKassenart = '',
  defaultLocation,
  defaultRadiusKm = 5,
  placeholder = 'Beschwerde oder Spezialisierung',
  formId = 'find-search-form',
  onEnhancedSearch,
}: FindSearchControlsProps) {
  const initialCity = (defaultLocation?.city || defaultCity).trim();
  const initialLocation: FindSearchLocation = {
    label: (defaultLocation?.label || initialCity).trim(),
    city: initialCity,
    ...(typeof defaultLocation?.lat === 'number' ? { lat: defaultLocation.lat } : {}),
    ...(typeof defaultLocation?.lng === 'number' ? { lng: defaultLocation.lng } : {}),
  };

  const [query, setQuery] = useState(defaultQuery);
  const [city, setCity] = useState(initialCity);
  const [homeVisit, setHomeVisit] = useState(defaultHomeVisit);
  const [kassenart, setKassenart] = useState(() => normalizeKassenart(defaultKassenart));
  const [location, setLocation] = useState<FindSearchLocation>(initialLocation);
  const [locationDraft, setLocationDraft] = useState(initialCity);
  const [radiusKm, setRadiusKm] = useState(() => normalizeRadius(defaultRadiusKm));
  const [panel, setPanel] = useState<OpenPanel>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [locationError, setLocationError] = useState('');

  const wrapperRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const homeVisitInputRef = useRef<HTMLInputElement>(null);
  const selectedRadiusRef = useRef<HTMLButtonElement>(null);
  const panelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const locationRequestId = useRef(0);
  const reverseGeocodeController = useRef<AbortController | null>(null);
  const enhancedSearchHandler = useRef(onEnhancedSearch);
  const latestSearchState = useRef({ query, homeVisit, kassenart, location, radiusKm });

  enhancedSearchHandler.current = onEnhancedSearch;
  latestSearchState.current = { query, homeVisit, kassenart, location, radiusKm };

  const id = useId();
  const queryId = `${id}-query`;
  const locationPanelId = `${id}-location-panel`;
  const locationInputId = `${id}-location-input`;
  const filterPanelId = `${id}-filter-panel`;
  const insuranceId = `${id}-insurance`;
  const radiusPanelId = `${id}-radius-panel`;
  const locationStatusId = `${id}-location-status`;

  const activeFilterCount = (homeVisit ? 1 : 0) + (kassenart ? 1 : 0);
  const locationIsPrecise = hasCoordinates(location);

  const buildSubmission = useCallback(
    (nextLocation?: FindSearchLocation, nextRadiusKm?: number): FindSearchSubmission => {
      const current = latestSearchState.current;
      const resolvedLocation = nextLocation ?? current.location;
      const resolvedRadiusKm = nextRadiusKm ?? current.radiusKm;
      const origin = hasCoordinates(resolvedLocation)
        ? { lat: resolvedLocation.lat, lng: resolvedLocation.lng }
        : undefined;

      return {
        query: current.query.trim(),
        city: resolvedLocation.city.trim(),
        homeVisit: current.homeVisit,
        kassenart: current.kassenart,
        location: resolvedLocation,
        ...(origin ? { origin } : {}),
        radiusKm: resolvedRadiusKm,
      };
    },
    [],
  );

  const notifyEnhancedSearch = useCallback(
    (nextLocation: FindSearchLocation, nextRadiusKm?: number) => {
      const handler = enhancedSearchHandler.current;
      if (!handler) return;
      void handler(buildSubmission(nextLocation, nextRadiusKm));
    },
    [buildSubmission],
  );

  const cancelLocationLookup = useCallback(() => {
    locationRequestId.current += 1;
    reverseGeocodeController.current?.abort();
    reverseGeocodeController.current = null;
    setLocating(false);
  }, []);

  const closePanel = useCallback((restoreFocus = false) => {
    setPanel(null);
    if (!restoreFocus) return;

    const trigger = panelTriggerRef.current;
    window.requestAnimationFrame(() => {
      trigger?.focus();
    });
  }, []);

  const togglePanel = (nextPanel: Exclude<OpenPanel, null>, trigger: HTMLButtonElement) => {
    if (panel === 'location') cancelLocationLookup();
    if (panel === nextPanel) {
      closePanel(true);
      return;
    }
    panelTriggerRef.current = trigger;
    if (nextPanel === 'location') setLocationError('');
    setPanel(nextPanel);
  };

  useEffect(() => {
    const nextCity = (defaultLocation?.city || defaultCity).trim();
    const nextLocation: FindSearchLocation = {
      label: (defaultLocation?.label || nextCity).trim(),
      city: nextCity,
      ...(typeof defaultLocation?.lat === 'number' ? { lat: defaultLocation.lat } : {}),
      ...(typeof defaultLocation?.lng === 'number' ? { lng: defaultLocation.lng } : {}),
    };
    setQuery(defaultQuery);
    setCity(nextCity);
    setHomeVisit(defaultHomeVisit);
    setKassenart(normalizeKassenart(defaultKassenart));
    setLocation(nextLocation);
    setLocationDraft(nextCity);
    setRadiusKm(normalizeRadius(defaultRadiusKm));
  }, [
    defaultCity,
    defaultHomeVisit,
    defaultKassenart,
    defaultLocation?.city,
    defaultLocation?.label,
    defaultLocation?.lat,
    defaultLocation?.lng,
    defaultQuery,
    defaultRadiusKm,
  ]);

  useEffect(() => () => {
    locationRequestId.current += 1;
    reverseGeocodeController.current?.abort();
  }, []);

  useEffect(() => {
    if (!panel) return;

    if (panel === 'location') {
      setLocationDraft(location.city);
      window.requestAnimationFrame(() => locationInputRef.current?.focus());
    }
    if (panel === 'filters') {
      window.requestAnimationFrame(() => homeVisitInputRef.current?.focus());
    }
    if (panel === 'radius') {
      window.requestAnimationFrame(() => selectedRadiusRef.current?.focus());
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        if (panel === 'location') cancelLocationLookup();
        closePanel();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (panel === 'location') cancelLocationLookup();
        closePanel(true);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [cancelLocationLookup, closePanel, location.city, panel]);

  const applyManualLocation = () => {
    cancelLocationLookup();
    const nextCity = locationDraft.trim();
    const nextLocation: FindSearchLocation = { label: nextCity, city: nextCity };
    setCity(nextCity);
    setLocation(nextLocation);
    setLocationError('');
    setLocationMessage(nextCity ? `Standort ${nextCity} übernommen.` : 'Standort entfernt.');
    closePanel(true);
    notifyEnhancedSearch(nextLocation);
  };

  const clearLocation = () => {
    cancelLocationLookup();
    const nextLocation: FindSearchLocation = { label: '', city: '' };
    setCity('');
    setLocation(nextLocation);
    setLocationDraft('');
    setLocationError('');
    setLocationMessage('Standort entfernt.');
    closePanel(true);
    notifyEnhancedSearch(nextLocation);
  };

  const detectLocation = () => {
    cancelLocationLookup();
    setLocationMessage('');
    setLocationError('');
    if (!navigator.geolocation) {
      const message = 'Die Standortbestimmung wird von diesem Browser nicht unterstützt.';
      setLocationMessage(message);
      setLocationError(message);
      return;
    }

    const requestId = ++locationRequestId.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (requestId !== locationRequestId.current) return;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const controller = new AbortController();
        reverseGeocodeController.current = controller;
        const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
        try {
          const nextLocation = await reverseGeocodeLocation(lat, lng, controller.signal);
          if (requestId !== locationRequestId.current) return;
          setCity(nextLocation.city);
          setLocation(nextLocation);
          setLocationDraft(nextLocation.city);
          setLocationError('');
          setLocationMessage(`Standort ${nextLocation.label} erkannt.`);
          closePanel(true);
          notifyEnhancedSearch(nextLocation);
        } catch {
          if (requestId !== locationRequestId.current) return;
          const message = 'Der Standort konnte keiner Stadt zugeordnet werden. Bitte gib den Ort manuell ein.';
          setLocationMessage(message);
          setLocationError(message);
        } finally {
          window.clearTimeout(timeoutId);
          if (requestId === locationRequestId.current) {
            reverseGeocodeController.current = null;
            setLocating(false);
          }
        }
      },
      () => {
        if (requestId !== locationRequestId.current) return;
        const message = 'Der Standort konnte nicht ermittelt werden. Bitte prüfe die Browserfreigabe.';
        setLocating(false);
        setLocationMessage(message);
        setLocationError(message);
      },
      GEO_OPTIONS,
    );
  };

  const selectRadius = (nextRadiusKm: number) => {
    setRadiusKm(nextRadiusKm);
    setLocationMessage(`Umkreis auf ${nextRadiusKm} km gesetzt.`);
    notifyEnhancedSearch(location, nextRadiusKm);
    closePanel(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!onEnhancedSearch || !locationIsPrecise) return;

    // The enhanced client path deliberately keeps exact coordinates out of the
    // address bar. Consumers can update the results from the callback payload.
    event.preventDefault();
    void onEnhancedSearch(buildSubmission());
    if (panel === 'location') cancelLocationLookup();
    closePanel();
  };

  const handleLocationInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyManualLocation();
  };

  return (
    <div className="find-search" ref={wrapperRef}>
      <form id={formId} method="GET" action="/finden" className="find-search__form" onSubmit={handleSubmit}>
        <div className="find-search__bar">
          <button type="submit" className="find-search__submit" aria-label="Suche starten">
            <SearchIcon />
          </button>

          <label className="find-search__query-label" htmlFor={queryId}>
            <span style={VISUALLY_HIDDEN}>Beschwerde oder Spezialisierung</span>
            <input
              ref={queryRef}
              id={queryId}
              className="find-search__query"
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => {
                if (!panel) return;
                if (panel === 'location') cancelLocationLookup();
                closePanel();
              }}
              placeholder={placeholder}
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>

          {query ? (
            <button
              type="button"
              className="find-search__clear"
              onClick={() => {
                setQuery('');
                queryRef.current?.focus();
              }}
              aria-label="Suchbegriff löschen"
            >
              <CloseIcon />
            </button>
          ) : null}

          <span className="find-search__divider" aria-hidden="true" />

          <div className="find-search__tools">
            <button
              type="button"
              className={`find-search__tool${city ? ' find-search__tool--active' : ''}`}
              onClick={(event) => togglePanel('location', event.currentTarget)}
              aria-label={city ? `Standort ändern: ${city}` : 'Standort wählen'}
              aria-expanded={panel === 'location'}
              aria-controls={locationPanelId}
            >
              <LocationIcon />
              {city ? <span className="find-search__status-dot" aria-hidden="true" /> : null}
            </button>

            <button
              type="button"
              className={`find-search__tool${activeFilterCount ? ' find-search__tool--active' : ''}`}
              onClick={(event) => togglePanel('filters', event.currentTarget)}
              aria-label={activeFilterCount ? `Filter, ${activeFilterCount} aktiv` : 'Filter öffnen'}
              aria-expanded={panel === 'filters'}
              aria-controls={filterPanelId}
            >
              <FilterIcon />
              {activeFilterCount ? (
                <span className="find-search__filter-badge" aria-hidden="true">{activeFilterCount}</span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Only coarse, shareable values are submitted. Address and coordinates stay client-side. */}
        <input type="hidden" name="city" value={city} />
        {homeVisit ? <input type="hidden" name="homeVisit" value="true" /> : null}
        <input type="hidden" name="kassenart" value={kassenart} />
      </form>

      <div className="find-search__location-radius" aria-label="Suchgebiet">
        <button
          type="button"
          className={`find-search__location-chip${city ? ' find-search__location-chip--active' : ''}`}
          onClick={(event) => togglePanel('location', event.currentTarget)}
          aria-expanded={panel === 'location'}
          aria-controls={locationPanelId}
        >
          <LocationIcon size={18} />
          <span title={location.label || undefined}>{location.label || city || 'Standort wählen'}</span>
        </button>

        {locationIsPrecise ? (
          <>
            <span className="find-search__location-radius-divider" aria-hidden="true" />
            <button
              type="button"
              className="find-search__radius-chip"
              onClick={(event) => togglePanel('radius', event.currentTarget)}
              aria-expanded={panel === 'radius'}
              aria-controls={radiusPanelId}
            >
              <span>{radiusKm} km</span>
              <ChevronDownIcon />
            </button>
          </>
        ) : null}
      </div>

      {panel === 'location' ? (
        <div id={locationPanelId} className="find-search__panel find-search__panel--location" role="region" aria-labelledby={`${locationPanelId}-title`}>
          <div className="find-search__panel-heading" id={`${locationPanelId}-title`}>Standort wählen</div>
          <label className="find-search__field" htmlFor={locationInputId}>
            <span>Stadt oder Ort</span>
            <span className="find-search__location-input-row">
              <input
                ref={locationInputRef}
                id={locationInputId}
                type="text"
                value={locationDraft}
                onChange={(event) => setLocationDraft(event.target.value)}
                onKeyDown={handleLocationInputKeyDown}
                placeholder="z. B. Köln"
                autoComplete="address-level2"
              />
              {locationDraft ? (
                <button type="button" onClick={() => setLocationDraft('')} aria-label="Ortseingabe löschen">
                  <CloseIcon />
                </button>
              ) : null}
            </span>
          </label>

          <div className="find-search__panel-actions">
            <button type="button" className="find-search__panel-primary" onClick={applyManualLocation}>
              Übernehmen
            </button>
            <button type="button" className="find-search__locate" onClick={detectLocation} disabled={locating}>
              {locating ? <SpinnerIcon /> : <CurrentLocationIcon />}
              <span>{locating ? 'Standort wird ermittelt …' : 'Aktuellen Standort verwenden'}</span>
            </button>
          </div>

          {locationError ? (
            <p className="find-search__location-error" role="alert">{locationError}</p>
          ) : null}

          {city ? (
            <button type="button" className="find-search__reset" onClick={clearLocation}>
              Standort entfernen
            </button>
          ) : null}
        </div>
      ) : null}

      {panel === 'filters' ? (
        <div id={filterPanelId} className="find-search__panel find-search__panel--filters" role="region" aria-labelledby={`${filterPanelId}-title`}>
          <div className="find-search__panel-heading" id={`${filterPanelId}-title`}>Filter</div>

          <label className="find-search__checkbox">
            <input
              ref={homeVisitInputRef}
              type="checkbox"
              checked={homeVisit}
              onChange={(event) => setHomeVisit(event.target.checked)}
            />
            <span>Hausbesuch möglich</span>
          </label>

          <label className="find-search__field find-search__field--select" htmlFor={insuranceId}>
            <span>Kassenart</span>
            <select id={insuranceId} value={kassenart} onChange={(event) => setKassenart(normalizeKassenart(event.target.value))}>
              {KASSENARTEN.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="find-search__panel-footer">
            {activeFilterCount ? (
              <button
                type="button"
                className="find-search__reset"
                onClick={() => {
                  setHomeVisit(false);
                  setKassenart('');
                }}
              >
                Filter zurücksetzen
              </button>
            ) : <span />}
            <button type="button" className="find-search__panel-primary" onClick={() => closePanel(true)}>
              Fertig
            </button>
          </div>
        </div>
      ) : null}

      {panel === 'radius' && locationIsPrecise ? (
        <div id={radiusPanelId} className="find-search__panel find-search__panel--radius" role="region" aria-labelledby={`${radiusPanelId}-title`}>
          <div className="find-search__panel-heading" id={`${radiusPanelId}-title`}>Umkreis</div>
          <p className="find-search__panel-copy">Suche um {location.label || city}</p>
          <div className="find-search__radius-options" role="group" aria-label="Suchradius">
            {RADIUS_OPTIONS.map((option) => (
              <button
                key={option}
                ref={radiusKm === option ? selectedRadiusRef : undefined}
                type="button"
                aria-pressed={radiusKm === option}
                className={`find-search__radius-option${radiusKm === option ? ' find-search__radius-option--active' : ''}`}
                onClick={() => selectRadius(option)}
              >
                {option} km
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p id={locationStatusId} style={VISUALLY_HIDDEN} role="status" aria-live="polite">
        {locationMessage}
      </p>
    </div>
  );
}
