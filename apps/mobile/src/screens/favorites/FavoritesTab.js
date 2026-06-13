import React from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TabHeader } from '../../components/TabHeader';

const ICON_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };
const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

function FavoritesVerticalList({ favorites, favoritesLoading, favoritesLastLoadedAt, toggleFavorite, onOpenProfile, showAll, onShowAll, styles, c, t }) {
  if (shouldShowSectionLoading(favoritesLoading, favoritesLastLoadedAt)) {
    return (
      <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 20 }]}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }
  if (favorites.length === 0) {
    return (
      <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 20 }]}>
        <Text style={[styles.emptyTitle, { color: c.text }]}>Du hast noch keine Therapeut:innen gespeichert.</Text>
        <Text style={[styles.emptyBody, { color: c.muted }]}>{t('favoritesEmptyBody')}</Text>
      </View>
    );
  }

  const shown = showAll ? favorites : favorites.slice(0, 2);
  const mutedColor = c.textMuted ?? c.muted;

  return (
    <View style={{ gap: 10 }}>
      {shown.map((fav) => {
        const initials = (fav.fullName ?? '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
        const spec = (fav.specializations ?? [])[0] ?? null;
        return (
          <Pressable
            key={fav.id}
            onPress={() => onOpenProfile(fav)}
            style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View>
                {fav.photo ? (
                  <Image source={{ uri: fav.photo }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                ) : (
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: c.primary }}>{initials}</Text>
                  </View>
                )}
                {fav.requestable ? (
                  <View style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 5.5, backgroundColor: c.success, borderWidth: 2, borderColor: c.card }} />
                ) : null}
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, lineHeight: 21 }} numberOfLines={1}>{fav.fullName}</Text>
                <Text style={{ fontSize: 13, color: mutedColor, lineHeight: 18, marginTop: 1 }} numberOfLines={1}>{fav.professionalTitle}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 2 }}>
                <Pressable onPress={(e) => { e.stopPropagation?.(); toggleFavorite(fav); }} hitSlop={ICON_HIT_SLOP} style={{ padding: 4 }}>
                  <Ionicons name="heart" size={17} color={c.error ?? '#ef4444'} />
                </Pressable>
                <Ionicons name="chevron-forward" size={13} color={c.muted} style={{ opacity: 0.45 }} />
              </View>
            </View>

            {fav.requestable ? (
              <View style={{ marginTop: 9 }}>
                <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.successBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.success }} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: c.success }}>Direkt buchbar</Text>
                </View>
              </View>
            ) : null}

            {(fav.homeVisit || spec) ? (
              <View style={{ marginTop: 10, gap: 6 }}>
                {fav.homeVisit ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Ionicons name="home-outline" size={13} color={mutedColor} />
                    <Text style={{ fontSize: 13, color: c.text }}>Hausbesuch möglich</Text>
                  </View>
                ) : null}
                {spec ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Ionicons name="medical-outline" size={13} color={mutedColor} />
                    <Text style={{ fontSize: 13, color: c.text }} numberOfLines={1}>{spec}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {fav.city ? (
              <View style={{ marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: c.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="location-outline" size={12} color={mutedColor} />
                  <Text style={{ fontSize: 12, color: mutedColor }} numberOfLines={1}>{fav.city}</Text>
                </View>
              </View>
            ) : null}
          </Pressable>
        );
      })}
      {!showAll && favorites.length > 2 && (
        <Pressable onPress={onShowAll} style={{ paddingTop: 6, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>Alle Favoriten anzeigen ›</Text>
        </Pressable>
      )}
    </View>
  );
}

export function FavoritesTab({
  authToken,
  favorites, favoritesLoading, favoritesLastLoadedAt,
  loadFavorites, toggleFavorite, openTherapistById,
  notifications, dismissedNotifIds, setShowNotifications,
  setActiveTab, setShowLogin,
  styles, c, t,
}) {
  if (!authToken) {
    return (
      <View style={{ flex: 1 }}>
        <TabHeader c={c} title={t('favoritesTitle')} />
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="heart-outline" size={32} color={c.muted} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>{t('favoritesLoginRequired') ?? 'Einloggen für Favoriten'}</Text>
            <Text style={[styles.emptyBody, { color: c.muted }]}>{t('favoritesLoginRequiredBody') ?? 'Melde dich an, um Therapeuten als Favoriten zu speichern.'}</Text>
            <Pressable
              onPress={() => { setActiveTab('profile'); setShowLogin(true); }}
              style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 16, paddingHorizontal: 32 }]}
            >
              <Text style={styles.registerBtnText}>{t('loginAction')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  const badgeCount = notifications.filter(n => !dismissedNotifIds.has(n.id)).length;

  return (
    <View style={{ flex: 1 }}>
      <TabHeader
        c={c}
        title={t('favoritesTitle')}
        sub={`${favorites.length} gespeicherte ${favorites.length === 1 ? 'Therapeut:in' : 'Therapeut:innen'}`}
        onBellPress={() => setShowNotifications(true)}
        hasBadge={badgeCount > 0}
      />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40, paddingTop: 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={favoritesLoading} onRefresh={() => loadFavorites(authToken)} tintColor={c.primary} />}
      >
        <FavoritesVerticalList
          favorites={favorites}
          favoritesLoading={favoritesLoading}
          favoritesLastLoadedAt={favoritesLastLoadedAt}
          toggleFavorite={toggleFavorite}
          onOpenProfile={(fav) => openTherapistById(fav.id, fav)}
          showAll
          styles={styles}
          c={c}
          t={t}
        />
      </ScrollView>
    </View>
  );
}
