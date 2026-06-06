import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseUrl } from '../utils/app-utils';

const NotifContext = createContext(null);

const REVIEW_NOTIFICATION_TYPES = new Set([
  'PROFILE_APPROVED', 'PROFILE_CHANGES_REQUESTED', 'PROFILE_REJECTED', 'PROFILE_SUSPENDED',
]);

const getReviewNotificationSeenKey = (therapistId) =>
  `revio_review_notification_seen_${therapistId}`;

export function NotifProvider({ authToken, accountType, onReviewStatusChange, children }) {
  const [notifications, setNotifications] = useState([]);
  const [dismissedNotifIds, setDismissedNotifIds] = useState(new Set());
  const [showNotifications, setShowNotifications] = useState(false);
  const [reviewNotification, setReviewNotification] = useState(null);
  const [showReviewNotificationModal, setShowReviewNotificationModal] = useState(false);
  const pollRef = useRef(null);

  // Restore dismissed IDs from storage
  useEffect(() => {
    if (!authToken) { setDismissedNotifIds(new Set()); return; }
    AsyncStorage.getItem('revio_dismissed_notif_ids').then((raw) => {
      if (raw) { try { setDismissedNotifIds(new Set(JSON.parse(raw))); } catch {} }
    });
  }, [authToken]);

  // Poll notifications every 30s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!authToken) {
      setNotifications([]);
      setReviewNotification(null);
      setShowReviewNotificationModal(false);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/notifications`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        let next = Array.isArray(data.notifications) ? data.notifications : [];

        const reviewNotif = next.find(
          (n) => REVIEW_NOTIFICATION_TYPES.has(n.type) && n.reviewStatus && n.therapistId,
        );

        if (accountType === 'therapist' && reviewNotif?.therapistId) {
          const seenStatus = await AsyncStorage.getItem(
            getReviewNotificationSeenKey(reviewNotif.therapistId),
          );
          if (seenStatus === reviewNotif.reviewStatus) {
            next = next.filter((n) => n.id !== reviewNotif.id);
          } else {
            setReviewNotification((prev) =>
              prev?.id === reviewNotif.id ? prev : reviewNotif,
            );
            setShowReviewNotificationModal(true);
            onReviewStatusChange?.(reviewNotif.therapistId, reviewNotif.reviewStatus);
          }
        }

        setNotifications(next);
      } catch {}
    };

    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 30000);
    return () => clearInterval(pollRef.current);
  }, [authToken, accountType]);

  const dismissNotification = async (notifId) => {
    const next = new Set([...dismissedNotifIds, notifId]);
    setDismissedNotifIds(next);
    await AsyncStorage.setItem('revio_dismissed_notif_ids', JSON.stringify([...next]));
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
  };

  const dismissAll = async () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setDismissedNotifIds(allIds);
    await AsyncStorage.setItem('revio_dismissed_notif_ids', JSON.stringify([...allIds]));
    setNotifications([]);
  };

  const markReviewNotificationSeen = async (notification = reviewNotification) => {
    if (notification?.therapistId && notification?.reviewStatus) {
      await AsyncStorage.setItem(
        getReviewNotificationSeenKey(notification.therapistId),
        notification.reviewStatus,
      );
    }
    setNotifications((prev) => prev.filter((n) => n.id !== notification?.id));
  };

  return (
    <NotifContext.Provider value={{
      notifications, setNotifications,
      dismissedNotifIds,
      showNotifications, setShowNotifications,
      reviewNotification, setReviewNotification,
      showReviewNotificationModal, setShowReviewNotificationModal,
      dismissNotification, dismissAll, markReviewNotificationSeen,
    }}>
      {children}
    </NotifContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotifContext);
  if (!ctx) throw new Error('useNotifications must be used within NotifProvider');
  return ctx;
}
