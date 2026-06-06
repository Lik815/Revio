import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useAppStore } from '../store/useStore';

export function AuthBridge() {
  const { authToken, accountType, loggedInPatient, loggedInTherapist, bootReady } = useAuth();
  const signIn = useAppStore((s) => s.signIn);
  const signOut = useAppStore((s) => s.signOut);

  useEffect(() => {
    if (!bootReady) return;
    if (authToken) {
      signIn({ authToken, accountType, loggedInPatient, loggedInTherapist });
    } else {
      signOut();
    }
  }, [bootReady, authToken, accountType, loggedInPatient, loggedInTherapist]);

  return null;
}
