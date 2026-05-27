import React from 'react';
import { ActivityIndicator, Text, View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from './mobile-utils';
import { AuthProvider } from './context/AuthContext';
import { TherapyProvider } from './context/TherapyContext';
import { AuthBridge } from './context/AuthBridge';
import { DeepLinkHandler } from './context/DeepLinkHandler';


function BootError({ error }) {
  const systemScheme = useColorScheme();
  const palette = COLORS[systemScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        backgroundColor: palette.background,
      }}
    >
      <Text style={{ color: palette.text, fontSize: 22, fontWeight: '700', marginBottom: 12 }}>
        Revio konnte nicht gestartet werden
      </Text>
      <Text style={{ color: palette.textMuted ?? palette.muted, fontSize: 15, lineHeight: 22 }}>
        {error?.message ?? 'Unbekannter Startfehler'}
      </Text>
    </View>
  );
}

function BootLoading() {
  const systemScheme = useColorScheme();
  const palette = COLORS[systemScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        backgroundColor: palette.background,
      }}
    >
      <ActivityIndicator color={palette.primary} size="large" />
      <Text style={{ color: palette.textMuted ?? palette.muted, fontSize: 15 }}>
        Revio wird vorbereitet…
      </Text>
    </View>
  );
}

export default function App() {
  const bootScheme = useColorScheme();
  const statusBarStyle = bootScheme === 'dark' ? 'light' : 'dark';

  try {
    require('react-native-gesture-handler');
    const { RootNavigator } = require('./navigation/RootNavigator');

    return (
      <AuthProvider>
        <TherapyProvider>
          <AuthBridge />
          <DeepLinkHandler />
          <StatusBar style={statusBarStyle} />
          <RootNavigator />
        </TherapyProvider>
      </AuthProvider>
    );
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to boot Revio app shell', error);
    }
    return (
      <>
        <StatusBar style={statusBarStyle} />
        <BootError error={error} />
      </>
    );
  }
}

export { BootLoading };
