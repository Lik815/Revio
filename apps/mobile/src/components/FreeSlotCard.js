import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function FreeSlotCard({ c, slot, onCancelSlot, deletingSlotIds, selectionMode, isSelected, onToggleSelect }) {
  const d = new Date(slot.startsAt);
  const timeStr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const isDeleting = deletingSlotIds.includes(slot.id);

  const containerStyle = {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: selectionMode && isSelected ? c.primary : c.border, borderRadius: 10,
    backgroundColor: selectionMode && isSelected ? (c.primaryBg ?? c.card) : c.card,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
  };

  const content = (
    <>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.success ?? '#5A9E8E', marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{timeStr} Uhr</Text>
        <Text style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{slot.durationMin} Min · Frei</Text>
      </View>
      {selectionMode ? (
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={isSelected ? c.primary : c.muted}
        />
      ) : isDeleting ? (
        <ActivityIndicator size="small" color={c.muted} />
      ) : (
        <Pressable onPress={() => onCancelSlot(slot.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-outline" size={16} color={c.muted} />
        </Pressable>
      )}
    </>
  );

  if (selectionMode) {
    return (
      <Pressable onPress={() => onToggleSelect(slot.id)} style={containerStyle}>
        {content}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{content}</View>;
}
