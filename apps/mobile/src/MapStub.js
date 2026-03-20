import React from 'react';
import { View } from 'react-native';
export default function MapView({ children, style }) {
  return <View style={style}>{children}</View>;
}
export function Marker() { return null; }
