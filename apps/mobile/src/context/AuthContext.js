import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseUrl, TUNNEL_HEADERS, normalizeTherapistProfile } from '../mobile-utils';

const AuthContext = createContext(null);
const AUTH_TOKEN_KEY = 'revio_auth_token';
const AUTH_ACCOUNT_TYPE_KEY = 'revio_account_type';
const STORE_PERSIST_KEY = 'revio-mobile-store';

function readPersistedStoreSession(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return { authToken: null, accountType: null };

  try {
    const parsed = JSON.parse(rawValue);
    const state = parsed?.state ?? parsed;
    return {
      authToken: typeof state?.authToken === 'string' && state.authToken.trim() ? state.authToken : null,
      accountType: typeof state?.accountType === 'string' && state.accountType.trim() ? state.accountType : null,
    };
  } catch {
    return { authToken: null, accountType: null };
  }
}

export function AuthProvider({ children }) {
  const [authToken, setAuthToken] = useState(null);
  const [loggedInTherapist, setLoggedInTherapist] = useState(null);
  const [loggedInPatient, setLoggedInPatient] = useState(null);
  const [accountType, setAccountType] = useState(null);
  const [bootReady, setBootReady] = useState(false);

  // Restore session from storage on boot
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          AUTH_TOKEN_KEY,
          AUTH_ACCOUNT_TYPE_KEY,
          STORE_PERSIST_KEY,
        ]);

        const map = Object.fromEntries(entries);
        const rawToken = map[AUTH_TOKEN_KEY] ?? null;
        const rawAccountType = map[AUTH_ACCOUNT_TYPE_KEY] ?? null;
        const persisted = readPersistedStoreSession(map[STORE_PERSIST_KEY]);

        const resolvedToken = rawToken || persisted.authToken;
        const resolvedAccountType = rawAccountType || persisted.accountType || null;

        if (!resolvedToken) {
          if (!cancelled) setBootReady(true);
          return;
        }

        // Backfill legacy raw keys from the persisted store if needed.
        if (!rawToken) {
          await AsyncStorage.setItem(AUTH_TOKEN_KEY, resolvedToken);
        }
        if (!rawAccountType && resolvedAccountType) {
          await AsyncStorage.setItem(AUTH_ACCOUNT_TYPE_KEY, resolvedAccountType);
        }

        if (cancelled) return;

        setAuthToken(resolvedToken);
        setAccountType(resolvedAccountType);

        try {
          const response = await fetch(`${getBaseUrl()}/auth/me`, {
            headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${resolvedToken}` },
          });

          if (!response.ok) {
            await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_ACCOUNT_TYPE_KEY]);
            if (!cancelled) {
              setAuthToken(null);
              setAccountType(null);
              setLoggedInPatient(null);
              setLoggedInTherapist(null);
            }
            return;
          }

          const profile = await response.json();
          if (cancelled || !profile) return;

          if (profile.role === 'patient') {
            setLoggedInPatient(profile);
            setLoggedInTherapist(null);
          } else {
            setLoggedInTherapist(normalizeTherapistProfile(profile));
            setLoggedInPatient(null);
          }
        } catch {
          // Keep resolved token in memory so existing sessions are not dropped on transient boot errors.
        } finally {
          if (!cancelled) setBootReady(true);
        }
      } catch {
        if (!cancelled) setBootReady(true);
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const loginAsTherapist = async (token, therapist) => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    await AsyncStorage.setItem(AUTH_ACCOUNT_TYPE_KEY, 'therapist');
    setAuthToken(token);
    setAccountType('therapist');
    setLoggedInTherapist(therapist ? normalizeTherapistProfile(therapist) : null);
    setLoggedInPatient(null);
  };

  const loginAsPatient = async (token, patient) => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    await AsyncStorage.setItem(AUTH_ACCOUNT_TYPE_KEY, 'patient');
    setAuthToken(token);
    setAccountType('patient');
    setLoggedInPatient(patient ?? null);
    setLoggedInTherapist(null);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_ACCOUNT_TYPE_KEY]);
    setAuthToken(null);
    setAccountType(null);
    setLoggedInTherapist(null);
    setLoggedInPatient(null);
  };

  return (
    <AuthContext.Provider value={{
      authToken, loggedInTherapist, loggedInPatient, accountType, bootReady,
      setAuthToken, setLoggedInTherapist, setLoggedInPatient, setAccountType,
      loginAsTherapist, loginAsPatient, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
