import { useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../mobile-utils';

export function useTheme() {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState(systemScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    AsyncStorage.getItem('themeMode').then((saved) => {
      if (saved === 'light' || saved === 'dark') setThemeMode(saved);
    });
  }, []);

  const scheme = themeMode;
  const c = COLORS[scheme];

  return { themeMode, setThemeMode, scheme, c };
}
