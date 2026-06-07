import React from 'react';
import { ActivityIndicator, ScrollView, Text, View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from './utils/app-utils';
import { ThemeProvider } from './hooks/use-theme';
import { AuthProvider } from './context/AuthContext';
import { AuthBridge } from './context/AuthBridge';
import { TherapyProvider } from './context/TherapyContext';
import { RootNavigator } from './navigation/RootNavigator';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      const palette = COLORS['light'];
      return (
        <View style={{ flex: 1, backgroundColor: palette.background, padding: 24, paddingTop: 60 }}>
          <Text style={{ color: palette.error, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            App-Fehler
          </Text>
          <ScrollView>
            <Text style={{ color: palette.text, fontSize: 13, fontFamily: 'monospace', lineHeight: 20 }}>
              {this.state.error?.message ?? 'Unbekannter Fehler'}
            </Text>
            <Text style={{ color: palette.textMuted, fontSize: 11, marginTop: 12, lineHeight: 18 }}>
              {this.state.error?.stack ?? ''}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
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

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <TherapyProvider>
              <StatusBar style={statusBarStyle} />
              <AuthBridge />
              <RootNavigator />
            </TherapyProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export { BootLoading };
