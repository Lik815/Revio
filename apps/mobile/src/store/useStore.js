import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const DEFAULT_THEME_PREFERENCE = 'system';

const INITIAL_AUTH_STATE = {
  authHydrated: false,
  authToken: null,
  accountType: null,
  loggedInPatient: null,
  loggedInTherapist: null,
};

const INITIAL_FAVORITES_STATE = {
  favorites: [],
  favoritesLastLoadedAt: 0,
  favoritesLoading: false,
};

const INITIAL_UI_STATE = {
  themePreference: DEFAULT_THEME_PREFERENCE,
};

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const upsertById = (collection, nextItem) => {
  if (!nextItem?.id) return collection;
  const remaining = collection.filter((item) => item?.id !== nextItem.id);
  return [nextItem, ...remaining];
};

const resetSessionState = () => ({
  ...INITIAL_AUTH_STATE,
  authHydrated: true,
  ...INITIAL_FAVORITES_STATE,
});

export const useAppStore = create(
  persist(
    (set, get) => ({
      ...INITIAL_AUTH_STATE,
      ...INITIAL_FAVORITES_STATE,
      ...INITIAL_UI_STATE,

      markHydrated: () => {
        set({ authHydrated: true });
      },

      setThemePreference: (themePreference) => {
        set({
          themePreference: themePreference ?? DEFAULT_THEME_PREFERENCE,
        });
      },

      signIn: ({ authToken, accountType, loggedInPatient = null, loggedInTherapist = null }) => {
        set({
          authHydrated: true,
          authToken: authToken ?? null,
          accountType: accountType ?? null,
          loggedInPatient,
          loggedInTherapist,
        });
      },

      signOut: () => {
        set(resetSessionState());
      },

      setAuthToken: (authToken) => {
        set({
          authHydrated: true,
          authToken: authToken ?? null,
        });
      },

      setAccountType: (accountType) => {
        set({
          accountType: accountType ?? null,
        });
      },

      setLoggedInPatient: (loggedInPatient) => {
        set({
          loggedInPatient: loggedInPatient ?? null,
        });
      },

      setLoggedInTherapist: (loggedInTherapist) => {
        set({
          loggedInTherapist: loggedInTherapist ?? null,
        });
      },

      updateTherapistProfile: (patch) => {
        const current = get().loggedInTherapist ?? {};
        set({
          loggedInTherapist: {
            ...current,
            ...(patch ?? {}),
          },
        });
      },

      updatePatientProfile: (patch) => {
        const current = get().loggedInPatient ?? {};
        set({
          loggedInPatient: {
            ...current,
            ...(patch ?? {}),
          },
        });
      },

      setFavorites: (favorites) => {
        set({
          favorites: normalizeArray(favorites),
          favoritesLastLoadedAt: Date.now(),
        });
      },

      setFavoritesLoading: (favoritesLoading) => {
        set({
          favoritesLoading: Boolean(favoritesLoading),
        });
      },

      addFavorite: (favorite) => {
        set((state) => ({
          favorites: upsertById(state.favorites, favorite),
          favoritesLastLoadedAt: Date.now(),
        }));
      },

      removeFavorite: (favoriteId) => {
        set((state) => ({
          favorites: state.favorites.filter((item) => item?.id !== favoriteId),
          favoritesLastLoadedAt: Date.now(),
        }));
      },

      isFavorite: (favoriteId) => {
        return get().favorites.some((item) => item?.id === favoriteId);
      },
    }),
    {
      name: 'revio-mobile-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        authToken: state.authToken,
        accountType: state.accountType,
        loggedInPatient: state.loggedInPatient,
        loggedInTherapist: state.loggedInTherapist,
        favorites: state.favorites,
        favoritesLastLoadedAt: state.favoritesLastLoadedAt,
        themePreference: state.themePreference,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated?.();
      },
    },
  ),
);

export const appStoreSelectors = {
  authToken: (state) => state.authToken,
  accountType: (state) => state.accountType,
  isAuthenticated: (state) => Boolean(state.authToken),
  authHydrated: (state) => state.authHydrated,
  themePreference: (state) => state.themePreference,
  favorites: (state) => state.favorites,
  loggedInPatient: (state) => state.loggedInPatient,
  loggedInTherapist: (state) => state.loggedInTherapist,
};
