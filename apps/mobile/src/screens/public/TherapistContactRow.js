import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Clipboard, Linking, Platform, Pressable, Text, ToastAndroid, View } from 'react-native';

export function TherapistContactRow({ c, styles, phone, email, therapistName, t }) {
  const [open, setOpen] = useState(false);
  if (!phone && !email) return null;

  const openEmailComposer = () => {
    if (!email) return;
    const subject = encodeURIComponent((t('contactSubject') ?? '').replace('{name}', therapistName ?? ''));
    Linking.openURL(`mailto:${email}?subject=${subject}`);
  };

  const copyEmail = (e) => {
    e.stopPropagation?.();
    Clipboard.setString(email);
    if (Platform.OS === 'android') ToastAndroid.show('E-Mail kopiert', ToastAndroid.SHORT);
  };

  return (
    <View style={[styles.infoSection, {
      backgroundColor: c.card,
      borderColor: c.border,
      padding: 0,
      overflow: 'hidden',
    }]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18 }}
      >
        <Ionicons name="call-outline" size={20} color={c.muted} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>Kontakt</Text>
          {!open ? (
            <Text style={{ fontSize: 13, color: c.muted }}>Telefon & E-Mail anzeigen</Text>
          ) : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
      </Pressable>

      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
          {phone ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${phone}`)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                paddingVertical: 14, paddingHorizontal: 18,
                borderBottomWidth: email ? 1 : 0, borderBottomColor: c.border,
              }}
            >
              <Ionicons name="call-outline" size={18} color={c.primary} />
              <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{phone}</Text>
              <Ionicons name="chevron-forward" size={14} color={c.muted} />
            </Pressable>
          ) : null}
          {email ? (
            <Pressable
              onPress={openEmailComposer}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 18 }}
            >
              <Ionicons name="mail-outline" size={18} color={c.primary} />
              <Text style={{ color: c.text, fontSize: 15, flex: 1 }} numberOfLines={1}>{email}</Text>
              <Pressable hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={copyEmail}>
                <Ionicons name="copy-outline" size={16} color={c.muted} />
              </Pressable>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
