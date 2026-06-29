import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTherapyData } from '../../context/TherapyContext';
import { useTheme } from '../../hooks/use-theme';
import { translations } from '../../i18n/translations';
import { AccountHeader } from '../../components/AccountHeader';
import { PatientsPane } from '../therapy/TherapistPatientsScreen';
import { TherapistPatientDetailScreen } from '../therapy/TherapistPatientDetailScreen';

const t = (key) => translations.de[key] ?? key;

// Therapist-only tab (takes the Favoriten slot in the bottom nav — therapists
// have no use for a favorites list). Reuses the same PatientsPane/
// TherapistPatientDetailScreen pair already used from inside the Therapie tab,
// so the list, search/filter, and detail view all stay in sync everywhere.
export function CustomersTabScreen() {
  const { c } = useTheme();
  const { authToken, accountType, loggedInTherapist } = useAuth();
  const {
    patients, patientsLoading, patientsLastLoadedAt,
    loadPatients, therapyRefreshing, handleTherapyRefresh,
  } = useTherapyData();

  const [selectedPatientId, setSelectedPatientId] = useState(null);

  // This tab can now be opened without ever visiting the Therapie tab first,
  // so it can't rely on that screen's effect to have loaded patients already.
  // Refreshing on every focus (not just mount) means a confirmed booking or new
  // patient shows up as soon as the tab is revisited, without a restart.
  useFocusEffect(
    useCallback(() => {
      if (authToken) loadPatients(authToken, { background: true });
    }, [authToken, loadPatients]),
  );

  if (selectedPatientId) {
    return (
      <TherapistPatientDetailScreen
        authToken={authToken}
        patientId={selectedPatientId}
        onBack={() => setSelectedPatientId(null)}
        c={c}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AccountHeader c={c} subtitle={t('customersTitle')} />
      <PatientsPane
        patients={patients}
        patientsLoading={patientsLoading}
        patientsLastLoadedAt={patientsLastLoadedAt}
        onSelectPatient={setSelectedPatientId}
        c={c}
        therapyRefreshing={therapyRefreshing}
        onRefresh={() => handleTherapyRefresh(authToken, accountType, loggedInTherapist)}
      />
    </View>
  );
}
