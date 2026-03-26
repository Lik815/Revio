const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Send one or more Expo push notifications.
 * Failures are logged but never thrown — push is best-effort and must not
 * affect the admin action that triggered it.
 */
export async function sendPushNotification(message: PushMessage): Promise<void> {
  if (!message.to.startsWith('ExponentPushToken[')) {
    console.warn('[push] Invalid push token, skipping:', message.to);
    return;
  }

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[push] Expo push API returned ${res.status}: ${body}`);
      return;
    }

    const result = await res.json();
    const ticket = result?.data;
    if (ticket?.status === 'error') {
      console.warn('[push] Expo push ticket error:', ticket.message, ticket.details);
    }
  } catch (err) {
    console.error('[push] Failed to send push notification:', err);
  }
}
