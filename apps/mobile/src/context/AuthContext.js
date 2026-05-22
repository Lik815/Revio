import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseUrl, TUNNEL_HEADERS, normalizeTherapistProfile } from '../mobile-utils';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authToken, setAuthToken] = useState(null);
  const [loggedInTherapist, setLoggedInTherapist] = useState(null);
  const [loggedInPatient, setLoggedInPatient] = useState(null);
  const [accountType, setAccountType] = useState(null);
  const [bootReady, setBootReady] = useState(false);

  // Restore session from storage on boot
  useEffect(() => {
    AsyncStorage.multiGet(['revio_auth_token', 'revio_account_type']).then(([[, token], [, type]]) => {
      if (!token) { setBootReady(true); return; }
      setAuthToken(token);
      setAccountType(type ?? null);

      fetch(`${getBaseUrl()}/auth/me`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
      })
        .then(async r => {
          if (!r.ok) {
            // Session invalid/expired — clear stored credentials
            await AsyncStorage.multiRemove(['revio_auth_token', 'revio_account_type']);
            setAuthToken(null);
            setAccountType(null);
            return null;
          }
          return r.json();
        })
        .then(profile => {
          if (!profile) return;
          if (profile.role === 'patient') {
            setLoggedInPatient(profile);
          } else {
            setLoggedInTherapist(normalizeTherapistProfile(profile));
          }
        })
        .catch(() => {})
        .finally(() => setBootReady(true));
    }).catch(() => setBootReady(true));
  }, []);

  const loginAsTherapist = async (token, therapist) => {
    await AsyncStorage.setItem('revio_auth_token', token);
    await AsyncStorage.setItem('revio_account_type', 'therapist');
    setAuthToken(token);
    setAccountType('therapist');
    setLoggedInTherapist(therapist ? normalizeTherapistProfile(therapist) : null);
    setLoggedInPatient(null);
  };

  const loginAsPatient = async (token, patient) => {
    await AsyncStorage.setItem('revio_auth_token', token);
    await AsyncStorage.setItem('revio_account_type', 'patient');
    setAuthToken(token);
    setAccountType('patient');
    setLoggedInPatient(patient ?? null);
    setLoggedInTherapist(null);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['revio_auth_token', 'revio_account_type']);
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
