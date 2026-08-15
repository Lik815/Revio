'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicPractice, PublicTherapist, SearchResult } from '../lib/public-api';
import {
  FindSearchControls,
  type FindSearchLocation,
  type FindSearchOrigin,
  type FindSearchSubmission,
} from './find-search-controls';
import { PracticeResultCard } from './practice-result-card';
import { TherapistResultCard } from './therapist-result-card';

const cityCollator = new Intl.Collator('de', { sensitivity: 'base', usage: 'search' });

type FindSearchExperienceProps = {
  initialTherapists: PublicTherapist[];
  initialPractices: PublicPractice[];
  defaultQuery: string;
  defaultCity: string;
  defaultHomeVisit: boolean;
  defaultKassenart: string;
  defaultRadiusKm?: number;
};

type SearchContext = {
  query: string;
  city: string;
  homeVisit: boolean;
  kassenart: string;
};

type ResultContext = SearchContext & {
  origin?: FindSearchOrigin;
  radiusKm: number;
};

function isSameCity(left: string, right: string): boolean {
  const normalizedLeft = left.trim();
  const normalizedRight = right.trim();
  return Boolean(normalizedLeft && normalizedRight && cityCollator.compare(normalizedLeft, normalizedRight) === 0);
}

function replaceShareableUrl(submission: FindSearchSubmission) {
  const params = new URLSearchParams();
  if (submission.query.trim()) params.set('q', submission.query.trim());
  if (submission.city.trim()) params.set('city', submission.city.trim());
  if (submission.homeVisit) params.set('homeVisit', 'true');
  if (submission.kassenart) params.set('kassenart', submission.kassenart);

  const queryString = params.toString();
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${queryString ? `?${queryString}` : ''}`,
  );
}

export function FindSearchExperience({
  initialTherapists,
  initialPractices,
  defaultQuery,
  defaultCity,
  defaultHomeVisit,
  defaultKassenart,
  defaultRadiusKm = 5,
}: FindSearchExperienceProps) {
  const [therapists, setTherapists] = useState(initialTherapists);
  const [practices, setPractices] = useState(initialPractices);
  const [context, setContext] = useState<SearchContext>({
    query: defaultQuery,
    city: defaultCity,
    homeVisit: defaultHomeVisit,
    kassenart: defaultKassenart,
  });
  const [resultContext, setResultContext] = useState<ResultContext>({
    query: defaultQuery,
    city: defaultCity,
    homeVisit: defaultHomeVisit,
    kassenart: defaultKassenart,
    radiusKm: defaultRadiusKm,
  });
  const [activeLocation, setActiveLocation] = useState<FindSearchLocation>({
    label: defaultCity,
    city: defaultCity,
  });
  const [activeRadiusKm, setActiveRadiusKm] = useState(defaultRadiusKm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  const runEnhancedSearch = useCallback(
    async (submission: FindSearchSubmission) => {
      const requestId = ++requestSequence.current;
      activeRequest.current?.abort();
      const abortController = new AbortController();
      activeRequest.current = abortController;
      const timeoutId = window.setTimeout(() => abortController.abort(), 10_000);

      const nextContext = {
        query: submission.query,
        city: submission.city,
        homeVisit: submission.homeVisit,
        kassenart: submission.kassenart,
      };
      setContext(nextContext);
      setActiveLocation(submission.location);
      if (submission.radiusKm) setActiveRadiusKm(submission.radiusKm);
      setLoading(true);
      setError('');

      replaceShareableUrl(submission);

      try {
        const response = await fetch('/api/find-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify({
            query: submission.query.trim() || 'physiotherapie',
            city: submission.city || undefined,
            origin: submission.origin,
            radiusKm: submission.origin ? submission.radiusKm : undefined,
            homeVisit: submission.homeVisit || undefined,
            kassenart: submission.kassenart || undefined,
          }),
        });
        if (!response.ok) throw new Error('search_failed');
        const result = (await response.json()) as SearchResult;
        if (requestId !== requestSequence.current) return;
        setTherapists(Array.isArray(result.therapists) ? result.therapists : []);
        setPractices(Array.isArray(result.practices) ? result.practices : []);
        setResultContext({
          ...nextContext,
          ...(submission.origin ? { origin: submission.origin } : {}),
          radiusKm: submission.radiusKm,
        });
      } catch {
        if (requestId !== requestSequence.current) return;
        setError('Die Suche konnte gerade nicht aktualisiert werden. Angezeigt werden die letzten erfolgreich geladenen Treffer.');
      } finally {
        window.clearTimeout(timeoutId);
        if (requestId === requestSequence.current) {
          activeRequest.current = null;
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      requestSequence.current += 1;
      activeRequest.current?.abort();
    };
  }, []);

  const preciseLocationActive = Boolean(resultContext.origin);
  const primaryTherapists = useMemo(
    () =>
      therapists.filter((therapist) => {
        if (!preciseLocationActive) {
          if (!resultContext.city) return true;
          return (
            isSameCity(therapist.city, resultContext.city) ||
            therapist.practices.some((practice) => isSameCity(practice.city, resultContext.city))
          );
        }
        if (therapist.radiusMatch === false) return false;
        // Missing coordinates must not be presented as a measured radius hit.
        return (
          typeof therapist.distKm === 'number' &&
          Number.isFinite(therapist.distKm) &&
          therapist.distKm <= resultContext.radiusKm
        );
      }),
    [preciseLocationActive, resultContext.city, resultContext.radiusKm, therapists],
  );
  const primaryIds = useMemo(
    () => new Set(primaryTherapists.map((therapist) => therapist.id)),
    [primaryTherapists],
  );
  const additionalTherapists = useMemo(
    () => therapists.filter((therapist) => !primaryIds.has(therapist.id)),
    [primaryIds, therapists],
  );

  const resultCount = primaryTherapists.length;
  const locationSuffix = resultContext.city
    ? preciseLocationActive
      ? ` im Umkreis von ${resultContext.city}`
      : ` in ${resultContext.city}`
    : '';

  return (
    <div className="find-experience">
      <FindSearchControls
        defaultQuery={context.query}
        defaultCity={context.city}
        defaultHomeVisit={context.homeVisit}
        defaultKassenart={context.kassenart}
        defaultLocation={activeLocation}
        defaultRadiusKm={activeRadiusKm}
        onEnhancedSearch={runEnhancedSearch}
      />

      <div className="find-results__summary" aria-live="polite" aria-atomic="true">
        <span>
          {resultCount > 0
            ? `${resultCount} Treffer${locationSuffix}`
            : `Keine Treffer${locationSuffix}`}
        </span>
        {loading ? <span className="find-results__loading">Suche wird aktualisiert …</span> : null}
      </div>

      {error ? <p className="find-results__error" role="alert">{error}</p> : null}

      <div className="find-results" aria-busy={loading}>
        {primaryTherapists.length > 0 ? (
          <div className="result-grid result-grid--find">
            {primaryTherapists.map((therapist) => (
              <TherapistResultCard key={therapist.id} therapist={therapist} variant="find" />
            ))}
          </div>
        ) : therapists.length === 0 ? (
          <div className="empty-blog-state find-results__empty">
            <p>Keine passenden Profile gefunden. Versuch es mit einer allgemeineren Beschwerde oder einem anderen Ort.</p>
          </div>
        ) : null}

        {additionalTherapists.length > 0 ? (
          <section className="find-results__additional" aria-labelledby="find-more-results-heading">
            <h2 id="find-more-results-heading">Weitere Ergebnisse</h2>
            <div className="result-grid result-grid--find">
              {additionalTherapists.map((therapist) => (
                <TherapistResultCard key={therapist.id} therapist={therapist} variant="find" />
              ))}
            </div>
          </section>
        ) : null}

        {practices.length > 0 ? (
          <section className="find-results__practices" aria-labelledby="find-practices-heading">
            <div className="section-heading">
              <div className="eyebrow">Praxen</div>
              <h2 id="find-practices-heading">Passende Praxen</h2>
            </div>
            <div className="result-grid">
              {practices.map((practice) => (
                <PracticeResultCard key={practice.id} practice={practice} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
