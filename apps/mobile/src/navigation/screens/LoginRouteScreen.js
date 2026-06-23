import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ROOT_ROUTES, TAB_ROUTES } from '../route-names';

// Legacy root route for places that still navigate to ROOT_ROUTES.LOGIN.
// Keep the visible login screen inside AppTabs so the guest bottom nav remains
// available everywhere.
export function LoginRouteScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: ROOT_ROUTES.MAIN_TABS,
          params: { screen: TAB_ROUTES.AUTH },
        },
      ],
    });
  }, [navigation]);

  return null;
}
