import React, { useCallback, useMemo } from 'react';
import { SectionList, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/use-theme';
import { useNotifications } from '../../context/NotificationContext';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { isSameDay, startOfWeek } from '../../utils/app-utils';
import { NotificationCard } from '../../components/NotificationCard';
import { ReviewNotificationModal } from '../../modals/ReviewNotificationModal';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { AccountHeader } from '../../components/AccountHeader';

const t = (key) => translations.de[key] ?? key;

const BUCKET_ORDER = ['Heute', 'Diese Woche', 'Älter'];

function getRelativeBucket(date) {
  const now = new Date();
  if (isSameDay(date, now)) return 'Heute';
  if (date >= startOfWeek(now)) return 'Diese Woche';
  return 'Älter';
}

export function NotificationsTabScreen() {
  const navigation = useNavigation();
  const { c } = useTheme();

  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    markNotificationsReadByIds,
    showReviewNotificationModal,
    reviewNotification,
    markReviewNotificationSeen,
  } = useNotifications();

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Markiert erst beim Verlassen des Screens als gelesen (Snapshot der beim
  // Betreten vorhandenen IDs) — so bleiben Ungelesen-Punkte während des
  // Besuchs sichtbar, und währenddessen neu eintreffende Mitteilungen
  // bleiben ungelesen.
  useFocusEffect(useCallback(() => {
    const idsAtFocus = notifications.map((n) => n.id);
    return () => {
      if (idsAtFocus.length > 0) markNotificationsReadByIds(idsAtFocus);
    };
  }, [notifications, markNotificationsReadByIds]));

  // Server already caps notifications to a retention window, so no per-item
  // dismiss is needed here — items just move from unread to read.
  const sections = useMemo(() => {
    const buckets = { Heute: [], 'Diese Woche': [], Älter: [] };
    [...notifications]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((n) => buckets[getRelativeBucket(new Date(n.createdAt))].push(n));
    return BUCKET_ORDER
      .filter((key) => buckets[key].length > 0)
      .map((key) => ({ title: key, data: buckets[key] }));
  }, [notifications]);

  const handleNotificationPress = (notification) => {
    markNotificationRead(notification.id);
    const type = notification?.type;

    // Therapeut: neue Einzel-Buchungsanfrage → direkt das Buchungsdetail öffnen.
    if (type === 'NEW_BOOKING_REQUEST' && notification.bookingId) {
      navigation.navigate(TAB_ROUTES.THERAPY, { openBookingId: notification.bookingId });
      return;
    }
    // Patient: Ergebnis einer Einzel-Buchung → den konkreten Termin öffnen.
    if (
      (type === 'BOOKING_CONFIRMED' || type === 'BOOKING_DECLINED' || type === 'BOOKING_CANCELLED') &&
      notification.bookingId
    ) {
      navigation.navigate(TAB_ROUTES.THERAPY, { openAppointmentId: notification.bookingId });
      return;
    }
    // Therapeut: automatisch bestätigte Termine / neue Serien-Anfrage → Anfragen-Unterreiter.
    if (type === 'AUTO_CONFIRMED_APPOINTMENT' || type === 'NEW_INQUIRY') {
      navigation.navigate(TAB_ROUTES.THERAPY, { openTab: 'anfragen' });
      return;
    }
    // Patient: Ergebnis einer Serien-Anfrage.
    if (type === 'INQUIRY_CONFIRMED' || type === 'INQUIRY_DECLINED') {
      navigation.navigate(TAB_ROUTES.THERAPY);
      return;
    }
    if (type === 'INVITE') {
      navigation.navigate(ROOT_ROUTES.PROFILE);
      return;
    }
    if (
      type === 'PROFILE_APPROVED' || type === 'PROFILE_CHANGES_REQUESTED' ||
      type === 'PROFILE_REJECTED' || type === 'PROFILE_SUSPENDED'
    ) {
      navigation.navigate(ROOT_ROUTES.PROFILE);
      return;
    }
    // Fallback für unbekannte/alte Typen ohne spezifisches Ziel.
    navigation.navigate(TAB_ROUTES.THERAPY);
  };

  return (
    <>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <AccountHeader c={c} subtitle={t('notificationsTitle')} />
        {notifications.length === 0 ? (
          <View style={[appStyles.emptyState, { backgroundColor: c.card, borderColor: c.border, margin: 24, paddingVertical: 32 }]}>
            <Text style={[appStyles.emptyTitle, { color: c.text }]}>Keine neuen Mitteilungen</Text>
            <Text style={[appStyles.emptyBody, { color: c.muted }]}>{t('noNotifications')}</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={[appStyles.scrollContent, { paddingTop: 8, paddingBottom: 36 }]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              unreadCount > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingHorizontal: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.success ?? '#5A9E8E' }} />
                  <Text style={{ fontSize: 14, color: c.muted, fontWeight: '600' }}>{unreadCount} ungelesen</Text>
                </View>
              ) : null
            }
            renderSectionHeader={({ section }) => (
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: c.muted, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 }}>
                {section.title}
              </Text>
            )}
            renderItem={({ item }) => (
              <NotificationCard
                notification={item}
                isRead={Boolean(item.read)}
                onPress={() => handleNotificationPress(item)}
                c={c}
              />
            )}
            renderSectionFooter={() => <View style={{ marginBottom: 12 }} />}
            ListFooterComponent={
              unreadCount > 0 ? (
                <Pressable
                  onPress={markAllNotificationsRead}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, marginTop: 8 }}
                >
                  <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                  <Ionicons name="checkmark-circle-outline" size={16} color={c.success ?? '#5A9E8E'} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: c.success ?? '#5A9E8E' }}>Alle Mitteilungen gelesen</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                </Pressable>
              ) : null
            }
          />
        )}
      </View>

      <ReviewNotificationModal
        visible={showReviewNotificationModal}
        notification={reviewNotification}
        onDone={markReviewNotificationSeen}
        c={c}
        t={t}
      />
    </>
  );
}
