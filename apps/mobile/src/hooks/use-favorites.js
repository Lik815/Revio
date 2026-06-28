import { useState, useCallback } from 'react';
import { getBaseUrl, TUNNEL_HEADERS } from '../utils/app-utils';

export function useFavorites({ authToken, showToast, t }) {
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesLastLoadedAt, setFavoritesLastLoadedAt] = useState(0);

  const loadFavorites = useCallback(
    async (token, { background = false } = {}) => {
      const tok = token ?? authToken;
      if (!tok) return;
      if (!background || favoritesLastLoadedAt === 0) setFavoritesLoading(true);
      try {
        const res = await fetch(`${getBaseUrl()}/auth/favorites/therapists`, {
          headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${tok}` },
        });
        if (res.ok) {
          const data = await res.json();
          setFavorites(Array.isArray(data.therapists) ? data.therapists : []);
          setFavoritesLastLoadedAt(Date.now());
        }
      } catch {}
      finally { setFavoritesLoading(false); }
    },
    [authToken, favoritesLastLoadedAt],
  );

  const toggleFavorite = useCallback(
    async (therapist) => {
      if (!authToken) {
        showToast?.(t?.('favLoginRequired') ?? 'Bitte einloggen um Favoriten zu speichern');
        return;
      }
      const exists = favorites.some((f) => f.id === therapist.id);
      setFavorites((prev) =>
        exists ? prev.filter((f) => f.id !== therapist.id) : [...prev, therapist],
      );
      if (!exists) showToast?.(t?.('favSaved')?.replace('{name}', therapist.fullName) ?? `${therapist.fullName} gespeichert`);
      else showToast?.(`${therapist.fullName} entfernt`);
      try {
        const res = exists
          ? await fetch(`${getBaseUrl()}/auth/favorites/therapists/${therapist.id}`, {
              method: 'DELETE',
              headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
            })
          : await fetch(`${getBaseUrl()}/auth/favorites/therapists`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
              body: JSON.stringify({ therapistId: therapist.id }),
            });
        if (!res.ok) {
          setFavorites((prev) =>
            exists ? [...prev, therapist] : prev.filter((f) => f.id !== therapist.id),
          );
        }
      } catch {
        setFavorites((prev) =>
          exists ? [...prev, therapist] : prev.filter((f) => f.id !== therapist.id),
        );
      }
    },
    [authToken, favorites, showToast, t],
  );

  const isFavorite = useCallback(
    (id) => favorites.some((f) => f.id === id),
    [favorites],
  );

  // ── Practice favorites (server-backed; mirrors the therapist logic) ─────────
  const [practiceFavorites, setPracticeFavorites] = useState([]);
  const [practiceFavoritesLoading, setPracticeFavoritesLoading] = useState(false);
  const [practiceFavoritesLastLoadedAt, setPracticeFavoritesLastLoadedAt] = useState(0);

  const loadPracticeFavorites = useCallback(
    async (token, { background = false } = {}) => {
      const tok = token ?? authToken;
      if (!tok) return;
      if (!background || practiceFavoritesLastLoadedAt === 0) setPracticeFavoritesLoading(true);
      try {
        const res = await fetch(`${getBaseUrl()}/auth/favorites/practices`, {
          headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${tok}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPracticeFavorites(Array.isArray(data.practices) ? data.practices : []);
          setPracticeFavoritesLastLoadedAt(Date.now());
        }
      } catch {}
      finally { setPracticeFavoritesLoading(false); }
    },
    [authToken, practiceFavoritesLastLoadedAt],
  );

  const togglePracticeFavorite = useCallback(
    async (practice) => {
      if (!authToken) {
        showToast?.(t?.('favLoginRequired') ?? 'Bitte einloggen um Favoriten zu speichern');
        return;
      }
      const exists = practiceFavorites.some((f) => f.id === practice.id);
      setPracticeFavorites((prev) =>
        exists ? prev.filter((f) => f.id !== practice.id) : [practice, ...prev],
      );
      if (!exists) showToast?.(t?.('favSaved')?.replace('{name}', practice.name) ?? `${practice.name} gespeichert`);
      else showToast?.(`${practice.name} entfernt`);
      try {
        const res = exists
          ? await fetch(`${getBaseUrl()}/auth/favorites/practices/${practice.id}`, {
              method: 'DELETE',
              headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
            })
          : await fetch(`${getBaseUrl()}/auth/favorites/practices`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
              body: JSON.stringify({ practiceId: practice.id }),
            });
        if (!res.ok) {
          setPracticeFavorites((prev) =>
            exists ? [practice, ...prev] : prev.filter((f) => f.id !== practice.id),
          );
        }
      } catch {
        setPracticeFavorites((prev) =>
          exists ? [practice, ...prev] : prev.filter((f) => f.id !== practice.id),
        );
      }
    },
    [authToken, practiceFavorites, showToast, t],
  );

  const isPracticeFavorite = useCallback(
    (id) => practiceFavorites.some((f) => f.id === id),
    [practiceFavorites],
  );

  return {
    favorites,
    favoritesLoading,
    favoritesLastLoadedAt,
    loadFavorites,
    toggleFavorite,
    isFavorite,
    practiceFavorites,
    practiceFavoritesLoading,
    practiceFavoritesLastLoadedAt,
    loadPracticeFavorites,
    togglePracticeFavorite,
    isPracticeFavorite,
  };
}
