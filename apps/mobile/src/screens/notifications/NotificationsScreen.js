import React from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/use-theme';
import { useNotifications } from '../../context/NotificationContext';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { NotificationCard } from '../../components/NotificationCard';
import { ReviewNotificationModal } from '../../modals/ReviewNotificationModal';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { AccountHeader } from '../../components/AccountHeader';

const t = (key) => translations.de[key] ?? key;

export function NotificationsTabScreen() {
  const navigation = useNavigation();
  const { c } = useTheme();

  const {
    notifications,
    dismissedNotifIds,
    dismissNotification,
    dismissAllNotifications,
    showReviewNotificationModal,
    reviewNotification,
    markReviewNotificationSeen,
  } = useNotifications();

  const items = notifications.filter((n) => !dismissedNotifIds.has(n.id));

  const handleNotificationPress = (notification) => {
    dismissNotification(notification.id);
    const type = notification?.type;
    if (
      type === 'NEW_BOOKING_REQUEST' || type === 'BOOKING_CONFIRMED' ||
      type === 'BOOKING_DECLINED' || type === 'BOOKING_CANCELLED'
    ) {
      navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.THERAPY });
      return;
    }
    if (
      type === 'PROFILE_APPROVED' || type === 'PROFILE_CHANGES_REQUESTED' ||
      type === 'PROFILE_REJECTED' || type === 'PROFILE_SUSPENDED'
    ) {
      navigation.navigate(ROOT_ROUTES.PROFILE);
    }
  };

  return (
    <>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <AccountHeader c={c} subtitle={t('notificationsTitle')} />
        {items.length === 0 ? (
          <View style={[appStyles.emptyState, { backgroundColor: c.card, borderColor: c.border, margin: 24, paddingVertical: 32 }]}>
            <Text style={[appStyles.emptyTitle, { color: c.text }]}>Keine neuen Mitteilungen</Text>
            <Text style={[appStyles.emptyBody, { color: c.muted }]}>{t('noNotifications')}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[appStyles.scrollContent, { paddingTop: 8, paddingBottom: 36 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={[appStyles.infoSection, { backgroundColor: c.card, borderColor: c.border, paddingTop: 4, paddingBottom: 4 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 4 }}>
                <Text style={{ fontSize: 13, color: c.muted, fontWeight: '600' }}>
                  {items.length} {items.length === 1 ? 'Mitteilung' : 'Mitteilungen'}
                </Text>
                <Pressable onPress={dismissAllNotifications} hitSlop={12}>
                  <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>
                    {t('clearAllBtn') ?? 'Alle löschen'}
                  </Text>
                </Pressable>
              </View>
              {items.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onPress={() => handleNotificationPress(notification)}
                  onDismiss={() => dismissNotification(notification.id)}
                  c={c}
                />
              ))}
            </View>
          </ScrollView>
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
