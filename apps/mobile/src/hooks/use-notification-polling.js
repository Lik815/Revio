import { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseUrl } from '../utils/app-utils';

const REVIEW_NOTIFICATION_TYPES = new Set([
  'PROFILE_APPROVED',
  'PROFILE_CHANGES_REQUESTED',
  'PROFILE_REJECTED',
  'PROFILE_SUSPENDED',
]);

function getReviewNotificationSeenKey(therapistId) {
  return `revio_seen_review_status_${therapistId}`;
}

/**
 * Polls /notifications every 30s while a user is logged in.
 *
 * onTherapistReviewStatus(therapistId, reviewStatus) — called when a review
 * notification arrives with a status the user hasn't seen yet, so App() can
 * update loggedInTherapist.reviewStatus without owning the polling logic.
 */
export function useNotificationPolling({ authToken, accountType, onTherapistReviewStatus }) {
  const [notifications, setNotifications] = useState([]);
  const [dismissedNotifIds, setDismissedNotifIds] = useState(new Set());
  const [showNotifications, setShowNotifications] = useState(false);
  const [showReviewNotificationModal, setShowReviewNotificationModal] = useState(false);
  const [reviewNotification, setReviewNotification] = useState(null);
  const pollRef = useRef(null);

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
            onTherapistReviewStatus?.(reviewNotif.therapistId, reviewNotif.reviewStatus);
          }
        }

        setNotifications(next);
      } catch {}
    };

    AsyncStorage.getItem('revio_dismissed_notif_ids').then((raw) => {
      if (raw) {
        try { setDismissedNotifIds(new Set(JSON.parse(raw))); } catch {}
      }
    });

    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 30000);
    return () => clearInterval(pollRef.current);
  }, [authToken, accountType]);

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

  return {
    notifications,
    setNotifications,
    dismissedNotifIds,
    setDismissedNotifIds,
    showNotifications,
    setShowNotifications,
    showReviewNotificationModal,
    setShowReviewNotificationModal,
    reviewNotification,
    setReviewNotification,
    dismissNotification,
    dismissAllNotifications,
    markReviewNotificationSeen,
  };
}
