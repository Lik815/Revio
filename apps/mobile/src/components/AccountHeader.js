import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getBaseUrl } from '../utils/app-utils';
import { ROOT_ROUTES, TAB_ROUTES } from '../navigation/route-names';

const AVATAR_SIZE = 52;
const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

function resolvePhotoUri(photo) {
  if (!photo) return null;
  return photo.startsWith('http') ? photo : `${getBaseUrl()}${photo}`;
}

function initialsFromName(name) {
  const initials = (name ?? '').trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return initials || null;
}

/**
 * Shared header for logged-in main tabs: avatar, account name, a per-tab
 * subtitle, and an edit icon. Mirrors TabHeader's safe-area handling (owns
 * its own `insets.top` padding) — TabHeader itself stays in use for detail
 * screens, this component is only for the main tab roots.
 *
 * Props:
 *   c             — COLORS[scheme] theme object (required)
 *   subtitle      — small text under the name, e.g. 'Suche', 'Favoriten'
 *   titleOverride — replaces the auth-derived name, e.g. 'Mein Konto'
 *   onPressAccount — defaults to opening the Options tab
 *   onPressEdit    — defaults to opening the profile screen
 *   style          — merged onto the outer wrapper (e.g. to add zIndex)
 */
export function AccountHeader({ c, subtitle, titleOverride, onPressAccount, onPressEdit, style }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { loggedInTherapist, loggedInPatient } = useAuth();

  const patientName = loggedInPatient
    ? `${loggedInPatient.firstName ?? ''} ${loggedInPatient.lastName ?? ''}`.trim()
    : '';
  const name = titleOverride || loggedInTherapist?.fullName || patientName || 'Mein Konto';
  const photo = resolvePhotoUri(loggedInTherapist?.photo);
  const initials = photo ? null : initialsFromName(loggedInTherapist?.fullName || patientName);

  const handlePressAccount = onPressAccount
    ?? (() => navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.OPTIONS }));
  const handlePressEdit = onPressEdit
    ?? (() => navigation.navigate(ROOT_ROUTES.PROFILE));

  return (
    <View style={[{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 18, backgroundColor: c.background }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={handlePressAccount} hitSlop={HIT_SLOP}>
          <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {photo ? (
              <Image source={{ uri: photo }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }} />
            ) : (
              <Text style={{ fontSize: 18, fontWeight: '700', color: c.primary }}>{initials ?? '?'}</Text>
            )}
          </View>
        </Pressable>

        <Pressable onPress={handlePressAccount} style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: c.text }} numberOfLines={1}>{name}</Text>
          {subtitle ? <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>{subtitle}</Text> : null}
        </Pressable>

        <Pressable onPress={handlePressEdit} hitSlop={HIT_SLOP} style={{ padding: 4 }}>
          <Ionicons name="pencil-outline" size={22} color={c.accent ?? c.primary} />
        </Pressable>
      </View>
    </View>
  );
}
