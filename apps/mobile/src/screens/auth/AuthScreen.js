import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../hooks/use-theme';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { LoginScreen } from './LoginScreen';
import { TherapistLandingScreen } from './TherapistLandingScreen';
import { PatientSignupFlow } from './PatientSignupFlow';
import { TherapistRegistrationFlow } from './TherapistRegistrationFlow';
import { useAuth } from '../../context/AuthContext';
import { useTherapyData } from '../../context/TherapyContext';
import { getBaseUrl, normalizeTherapistProfile, TUNNEL_HEADERS } from '../../utils/app-utils';
import AsyncStorage from '@react-native-async-storage/async-storage';

const t = (key) => translations.de[key] ?? key;

export function AuthScreen() {
  const { c } = useTheme();
  const { loginAsPatient, loginAsTherapist } = useAuth();
  const { loadFavorites, loadMyAppointments, loadIncomingBookings } = useTherapyData();

  const [view, setView] = useState('landing');

  const handleTherapistRegistered = async (token) => {
    await AsyncStorage.setItem('revio_auth_token', token);
    await AsyncStorage.setItem('revio_account_type', 'therapist');
    const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
    });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      await loginAsTherapist(token, normalizeTherapistProfile(profile));
    }
    loadFavorites(token);
    loadIncomingBookings(token);
  };

  const handlePatientSignedUp = async (token) => {
    await AsyncStorage.setItem('revio_auth_token', token);
    await AsyncStorage.setItem('revio_account_type', 'patient');
    const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
    });
    if (profileRes.ok) {
      await loginAsPatient(token, await profileRes.json());
    }
    loadFavorites(token);
    loadMyAppointments(token);
  };

  return (
    <View style={{ flex: 1 }}>
      {view === 'login' ? (
        <LoginScreen
          c={c}
          styles={appStyles}
          t={t}
          onClose={() => setView('landing')}
        />
      ) : view === 'patientSignup' ? (
        <PatientSignupFlow
          visible
          onClose={() => setView('landing')}
          onSignedUp={handlePatientSignedUp}
          onShowLogin={() => setView('login')}
          onSelectTherapist={() => setView('therapistRegister')}
          c={c}
          t={t}
          styles={appStyles}
        />
      ) : view === 'therapistRegister' ? (
        <TherapistRegistrationFlow
          visible
          onClose={() => setView('landing')}
          onRegistered={handleTherapistRegistered}
          c={c}
          t={t}
          styles={appStyles}
        />
      ) : (
        <TherapistLandingScreen
          c={c}
          setShowLogin={() => setView('login')}
          setShowSignup={() => setView('patientSignup')}
          styles={appStyles}
          t={t}
        />
      )}
    </View>
  );
}
