import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useAppStore } from '../store/useStore';

/**
 * Syncs AuthContext state → useAppStore so RootNavigator reacts to auth changes.
 * Render this inside AuthProvider but outside NavigationContainer (or inside it — no navigation needed).
 */
export function AuthBridge() {
  const { authToken, accountType, loggedInPatient, loggedInTherapist } = useAuth();
  const signIn = useAppStore((s) => s.signIn);
  const signOut = useAppStore((s) => s.signOut);

  useEffect(() => {
    if (authToken) {
      signIn({ authToken, accountType, loggedInPatient, loggedInTherapist });
    } else {
      signOut();
    }
  }, [authToken, accountType, loggedInPatient, loggedInTherapist]);

  return null;
}
