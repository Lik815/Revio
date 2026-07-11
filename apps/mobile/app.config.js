module.exports = {
  expo: {
    name: 'Revio',
    slug: 'revio',
    scheme: 'revo',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#2F3E46',
    },
    ios: {
      bundleIdentifier: 'de.myrevio.app',
      supportsTablet: false,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription: 'Revio benötigt deinen Standort, um Therapeuten in deiner Nähe zu finden.',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'Revio benötigt deinen Standort, um Therapeuten in deiner Nähe zu finden.',
      },
    },
    android: {
      package: 'de.myrevio.app',
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#2F3E46',
      },
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
      config: {
        googleMaps: {
          // Read at `expo prebuild` / EAS build time — set GOOGLE_MAPS_API_KEY as an
          // EAS Environment Variable in the Expo Dashboard (production + preview),
          // same pattern as EXPO_PUBLIC_API_URL. A missing/empty key crashes the
          // native Google Maps SDK as soon as the map screen mounts on Android.
          apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
        },
      },
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: false,
          data: [
            {
              scheme: 'revo',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      bundler: 'metro',
    },
    plugins: [
      [
        'expo-build-properties',
        {
          ios: {
            clangCXXLanguageStandard: 'c++20',
          },
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Revio benötigt deinen Standort, um Therapeuten in deiner Nähe zu finden.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#2F3E46',
          sounds: [],
        },
      ],
      '@react-native-community/datetimepicker',
    ],
    extra: {
      eas: {
        projectId: '77125a37-7ed9-4354-9b2f-614fadd5eeb0',
      },
    },
    owner: 'my-revio',
    runtimeVersion: '0.1.0',
    updates: {
      url: 'https://u.expo.dev/77125a37-7ed9-4354-9b2f-614fadd5eeb0',
    },
  },
};
