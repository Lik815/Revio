import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { getBaseUrl } from '../utils/app-utils';
import { timedFetch } from '../utils/perf-log';

const REVIEW_NOTIFICATION_TYPES = new Set([
  'PROFILE_APPROVED',
  'PROFILE_CHANGES_REQUESTED',
  'PROFILE_REJECTED',
  'PROFILE_SUSPENDED',
]);

const POLL_MS = 30000;

function getReviewNotificationSeenKey(therapistId) {
  return `revio_seen_review_status_${therapistId}`;
}

const NotificationContext = createContext(null);

/**
 * Single, app-wide poll of /notifications every 30s while a user is logged in —
 * mounted once near the root so screens consume shared state via useNotifications()
 * instead of each starting their own interval. Pauses while the app is backgrounded
 * and refreshes immediately on returning to the foreground.
 */
export function NotificationProvider({ children }) {
  const { authToken, accountType, setLoggedInTherapist } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [dismissedNotifIds, setDismissedNotifIds] = useState(new Set());
  const [showReviewNotificationModal, setShowReviewNotificationModal] = useState(false);
  const [reviewNotification, setReviewNotification] = useState(null);
  const pollRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!authToken) {
      setNotifications([]);
      setReviewNotification(null);
      setShowReviewNotificationModal(false);
      return;
    }

    let cancelled = false;

    const fetchNotifications = async () => {
      if (appStateRef.current !== 'active') return;
      try {
        const res = await timedFetch('notifications', `${getBaseUrl()}/notifications`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok || cancelled) return;
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
            setLoggedInTherapist((prev) => {
              if (!prev || prev.id !== reviewNotif.therapistId || prev.reviewStatus === reviewNotif.reviewStatus) return prev;
              return { ...prev, reviewStatus: reviewNotif.reviewStatus };
            });
          }
        }

        if (!cancelled) setNotifications(next);
      } catch {}
    };

    AsyncStorage.getItem('revio_dismissed_notif_ids').then((raw) => {
      if (!raw || cancelled) return;
      try { setDismissedNotifIds(new Set(JSON.parse(raw))); } catch {}
    });

    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, POLL_MS);

    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasActive = appStateRef.current === 'active';
      appStateRef.current = nextState;
      if (nextState === 'active' && !wasActive) fetchNotifications();
    });

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
      subscription.remove();
    };
  }, [authToken, accountType, setLoggedInTherapist]);

  const dismissNotification = async (id) => {
    const next = new Set(dismissedNotifIds);
    next.add(id);
    setDismissedNotifIds(next);
    await AsyncStorage.setItem('revio_dismissed_notif_ids', JSON.stringify([...next]));
  };

  const dismissAllNotifications = async () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setDismissedNotifIds(allIds);
    await AsyncStorage.setItem('revio_dismissed_notif_ids', JSON.stringify([...allIds]));
  };

  const markReviewNotificationSeen = async (notification = reviewNotification) => {
    const resolvedNotification =
      notification?.therapistId && notification?.reviewStatus
        ? notification
        : reviewNotification;

    if (resolvedNotification?.therapistId && resolvedNotification?.reviewStatus) {
      await AsyncStorage.setItem(
        getReviewNotificationSeenKey(resolvedNotification.therapistId),
        resolvedNotification.reviewStatus,
      );
    }
    setNotifications((prev) => prev.filter((item) => item.id !== resolvedNotification?.id));
    setShowReviewNotificationModal(false);
    setReviewNotification(null);
  };

  return (
    <NotificationContext.Provider value={{
      notifications, setNotifications,
      dismissedNotifIds, setDismissedNotifIds,
      showReviewNotificationModal, setShowReviewNotificationModal,
      reviewNotification, setReviewNotification,
      dismissNotification,
      dismissAllNotifications,
      markReviewNotificationSeen,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
