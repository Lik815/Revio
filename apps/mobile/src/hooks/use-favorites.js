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

  return {
    favorites,
    favoritesLoading,
    favoritesLastLoadedAt,
    loadFavorites,
    toggleFavorite,
    isFavorite,
  };
}
