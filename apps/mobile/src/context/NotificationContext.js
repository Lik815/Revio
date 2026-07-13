import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
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

const NotificationContext = createContext(null);

/**
 * Single, app-wide poll of /notifications every 30s while a user is logged in —
 * mounted once near the root so screens consume shared state via useNotifications()
 * instead of each starting their own interval. Pauses while the app is backgrounded
 * and refreshes immediately on returning to the foreground.
 *
 * Gelesen-Status kommt jetzt vom Server (Notification.readAt) statt aus
 * geräte-lokalem AsyncStorage — damit ist er über mehrere Geräte hinweg
 * konsistent.
 */
export function NotificationProvider({ children }) {
  const { authToken, accountType, setLoggedInTherapist } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showReviewNotificationModal, setShowReviewNotificationModal] = useState(false);
  const [reviewNotification, setReviewNotification] = useState(null);
  const pollRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const authTokenRef = useRef(authToken);
  authTokenRef.current = authToken;

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
        const next = Array.isArray(data.notifications) ? data.notifications : [];

        const reviewNotif = next.find(
          (n) => REVIEW_NOTIFICATION_TYPES.has(n.type) && !n.read && n.reviewStatus && n.therapistId,
        );

        if (accountType === 'therapist' && reviewNotif) {
          setReviewNotification((prev) => (prev?.id === reviewNotif.id ? prev : reviewNotif));
          setShowReviewNotificationModal(true);
          setLoggedInTherapist((prev) => {
            if (!prev || prev.id !== reviewNotif.therapistId || prev.reviewStatus === reviewNotif.reviewStatus) return prev;
            return { ...prev, reviewStatus: reviewNotif.reviewStatus };
          });
        }

        if (!cancelled) setNotifications(next);
      } catch {}
    };

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

  const markNotificationRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await timedFetch('notifications-read', `${getBaseUrl()}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authTokenRef.current}` },
      });
    } catch {}
  };

  // Markiert eine feste Liste von IDs als gelesen (Snapshot beim Betreten des
  // Mitteilungen-Screens), statt aller aktuell geladenen Notifications — so
  // bleiben währenddessen neu eintreffende Einträge ungelesen.
  const markNotificationsReadByIds = async (ids) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setNotifications((prev) => prev.map((n) => (idSet.has(n.id) ? { ...n, read: true } : n)));
    try {
      await Promise.all(ids.map((id) =>
        timedFetch('notifications-read', `${getBaseUrl()}/notifications/${id}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${authTokenRef.current}` },
        }),
      ));
    } catch {}
  };

  const markAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await timedFetch('notifications-read-all', `${getBaseUrl()}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authTokenRef.current}` },
      });
    } catch {}
  };

  const markReviewNotificationSeen = async (notification = reviewNotification) => {
    const resolvedNotification =
      notification?.therapistId && notification?.reviewStatus ? notification : reviewNotification;

    if (resolvedNotification?.id) await markNotificationRead(resolvedNotification.id);
    setShowReviewNotificationModal(false);
    setReviewNotification(null);
  };

  return (
    <NotificationContext.Provider value={{
      notifications, setNotifications,
      showReviewNotificationModal, setShowReviewNotificationModal,
      reviewNotification, setReviewNotification,
      markNotificationRead,
      markAllNotificationsRead,
      markNotificationsReadByIds,
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
