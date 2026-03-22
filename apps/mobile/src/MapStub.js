import React from 'react';
import { Pressable, View } from 'react-native';

const MapContext = React.createContext({
  layout: { width: 0, height: 0 },
  region: null,
});

function projectCoordinate(region, layout, coordinate) {
  if (!region || !coordinate || !layout.width || !layout.height) return null;
  if (!Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) return null;
  if (!region.latitudeDelta || !region.longitudeDelta) return null;

  const minLng = region.longitude - region.longitudeDelta / 2;
  const maxLat = region.latitude + region.latitudeDelta / 2;

  return {
    x: ((coordinate.longitude - minLng) / region.longitudeDelta) * layout.width,
    y: ((maxLat - coordinate.latitude) / region.latitudeDelta) * layout.height,
  };
}

function getCircleGeometry(region, layout, center, radius) {
  const point = projectCoordinate(region, layout, center);
  if (!point || !Number.isFinite(radius) || radius <= 0) return null;

  const latDiameterPx = ((radius / 111000) * 2 / region.latitudeDelta) * layout.height;
  const lngScale = Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.2);
  const lngDiameterPx = ((radius / (111000 * lngScale)) * 2 / region.longitudeDelta) * layout.width;

  return {
    width: lngDiameterPx,
    height: latDiameterPx,
    left: point.x - lngDiameterPx / 2,
    top: point.y - latDiameterPx / 2,
  };
}

export default function MapView({ children, style, region }) {
  const [layout, setLayout] = React.useState({ width: 0, height: 0 });

  return (
    <View
      onLayout={(event) => setLayout(event.nativeEvent.layout)}
      style={[
        {
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#edf5f6',
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: '#edf5f6',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          opacity: 0.35,
        }}
      >
        {[20, 40, 60, 80].map((top) => (
          <View
            key={`h-${top}`}
            style={{
              position: 'absolute',
              top: `${top}%`,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: '#c9dadd',
            }}
          />
        ))}
        {[20, 40, 60, 80].map((left) => (
          <View
            key={`v-${left}`}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: '#c9dadd',
            }}
          />
        ))}
      </View>

      <MapContext.Provider value={{ layout, region }}>
        {children}
      </MapContext.Provider>
    </View>
  );
}

export function Marker({ anchor, children, coordinate, onPress }) {
  const { layout, region } = React.useContext(MapContext);
  const point = projectCoordinate(region, layout, coordinate);
  if (!point) return null;

  const offsetX = ((anchor?.x ?? 0.5) - 0.5) * 24;
  const offsetY = ((anchor?.y ?? 0.5) - 0.5) * 24;

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
        left: point.x + offsetX,
        top: point.y + offsetY,
        transform: [{ translateX: -12 }, { translateY: -12 }],
        zIndex: 2,
      }}
    >
      {children ?? (
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: '#2b6877',
            borderWidth: 3,
            borderColor: '#fff',
          }}
        />
      )}
    </Pressable>
  );
}

export function Circle({ center, fillColor, radius, strokeColor, strokeWidth = 1 }) {
  const { layout, region } = React.useContext(MapContext);
  const geometry = getCircleGeometry(region, layout, center, radius);
  if (!geometry) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: geometry.left,
        top: geometry.top,
        width: geometry.width,
        height: geometry.height,
        borderRadius: Math.max(geometry.width, geometry.height) / 2,
        borderWidth: strokeWidth,
        borderColor: strokeColor,
        backgroundColor: fillColor,
      }}
    />
  );
}
