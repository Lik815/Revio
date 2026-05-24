import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';

export function PracticeLogoAvatar({ uri, name, style, c }) {
  const [error, setError] = useState(false);
  const initials = name
    ? (name.split(' ').filter(w => w.length > 2).map(w => w[0]).join('').toUpperCase().slice(0, 2) || name.charAt(0).toUpperCase())
    : '?';
  if (uri && !error) {
    return (
      <Image
        source={{ uri }}
        style={style}
        onError={() => setError(true)}
      />
    );
  }
  return (
    <View style={[style, { backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{initials}</Text>
    </View>
  );
}
