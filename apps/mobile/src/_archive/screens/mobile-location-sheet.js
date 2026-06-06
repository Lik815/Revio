import React from 'react';
import { Modal, Pressable, View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const RADIUS_OPTIONS = [1, 3, 5, 10, 25];

export function LocationSheet({
  visible,
  onClose,
  locationSheetCity,
  onChangeCity,
  onConfirm,
  locationSuggestions,
  onSelectSuggestion,
  locationLoading,
  searchRadius,
  onRadiusChange,
  onGPS,
  c,
  t,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} />
        <ScrollView
          style={{ backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
          contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 }} />
          <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, textAlign: 'center' }}>{t('locationTitle')}</Text>
          <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', marginTop: -8 }}>
            {t('locationSub')}
          </Text>

          <Pressable
            onPress={onGPS}
            disabled={locationLoading}
            style={{ backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
          >
            <Ionicons name="navigate-sharp" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              {locationLoading ? t('gpsLoading') : t('useGPS')}
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            <Text style={{ color: c.muted, fontSize: 12 }}>{t('locationDivider')}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
          </View>

          <View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                value={locationSheetCity}
                onChangeText={onChangeCity}
                placeholder={t('locationExamplePlaceholder')}
                placeholderTextColor={c.muted}
                style={{ flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: locationSuggestions.length > 0 ? c.primary : c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: c.text, fontSize: 15 }}
                onSubmitEditing={onConfirm}
                returnKeyType="search"
                autoCapitalize="words"
                autoCorrect={false}
              />
              <Pressable
                onPress={onConfirm}
                disabled={!locationSheetCity.trim() || locationLoading}
                style={{ backgroundColor: (locationSheetCity.trim() && !locationLoading) ? c.primary : c.mutedBg, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' }}
              >
                <Text style={{ color: (locationSheetCity.trim() && !locationLoading) ? '#fff' : c.muted, fontSize: 15, fontWeight: '600' }}>
                  {locationLoading ? '…' : t('confirmLocation')}
                </Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {RADIUS_OPTIONS.map((km) => (
                <Pressable
                  key={km}
                  onPress={() => onRadiusChange(km)}
                  style={{ borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: searchRadius === km ? c.primary : c.border, backgroundColor: searchRadius === km ? c.primary : c.card }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: searchRadius === km ? '#fff' : c.muted }}>{km} km</Text>
                </Pressable>
              ))}
            </View>

            {locationSuggestions.length > 0 && (
              <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.primary, borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
                {locationSuggestions.map((s, i) => (
                  <Pressable
                    key={i}
                    onPress={() => onSelectSuggestion(s)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i < locationSuggestions.length - 1 ? 1 : 0, borderBottomColor: c.border }}
                  >
                    <Ionicons name="navigate-sharp" size={14} color={c.primary} />
                    <Text style={{ flex: 1, color: c.text, fontSize: 14 }} numberOfLines={2}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
