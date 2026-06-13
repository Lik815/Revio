import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function LocationSheet({
  visible,
  onClose,
  city,
  onChangeCity,
  suggestions,
  onSelectSuggestion,
  onUseGPS,
  loading,
  onConfirm,
  c,
  t,
}) {
  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            paddingBottom: 32,
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.border,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />

          <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 4 }}>
            {t('locationTitle')}
          </Text>
          <Text style={{ fontSize: 13, color: c.muted, marginBottom: 16, lineHeight: 18 }}>
            {t('locationSub')}
          </Text>

          <Pressable
            onPress={onUseGPS}
            disabled={loading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: c.primaryBg,
              borderRadius: 14,
              paddingVertical: 14,
              marginBottom: 16,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator size="small" color={c.primary} />
            ) : (
              <Ionicons name="locate-outline" size={18} color={c.primary} />
            )}
            <Text style={{ color: c.primary, fontSize: 15, fontWeight: '600' }}>
              {loading ? t('gpsLoading') : t('useGPS')}
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            <Text style={{ fontSize: 12, color: c.muted }}>{t('locationDivider')}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: c.mutedBg,
            }}
          >
            <Ionicons name="location-outline" size={18} color={c.muted} />
            <TextInput
              value={city}
              onChangeText={onChangeCity}
              placeholder={t('locationExamplePlaceholder')}
              placeholderTextColor={c.muted}
              style={{ flex: 1, fontSize: 15, color: c.text }}
              onSubmitEditing={onConfirm}
              returnKeyType="done"
            />
            {city.length > 0 && (
              <Pressable onPress={() => onChangeCity('')} hitSlop={10}>
                <Ionicons name="close-circle" size={16} color={c.muted} />
              </Pressable>
            )}
          </View>

          {safeSuggestions.length > 0 && (
            <ScrollView
              style={{
                maxHeight: 180,
                marginTop: 8,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 14,
                backgroundColor: c.card,
              }}
              keyboardShouldPersistTaps="handled"
            >
              {safeSuggestions.map((s, index) => (
                <Pressable
                  key={`${s.label}-${index}`}
                  onPress={() => onSelectSuggestion(s)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderBottomWidth: index < safeSuggestions.length - 1 ? 1 : 0,
                    borderBottomColor: c.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Ionicons name="location-outline" size={14} color={c.muted} />
                  <Text style={{ flex: 1, fontSize: 14, color: c.text }} numberOfLines={1}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Pressable
            onPress={onConfirm}
            disabled={!city.trim() || loading}
            style={{
              marginTop: 16,
              backgroundColor: city.trim() ? c.primary : c.border,
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              {t('confirmLocation')}
            </Text>
          </Pressable>

          <Pressable onPress={onClose} style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: c.muted, fontSize: 14 }}>{t('cancelBtn')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
