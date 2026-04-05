import Expo from 'expo-server-sdk';

const expo = new Expo();

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  if (!Expo.isExpoPushToken(pushToken)) return;
  try {
    await expo.sendPushNotificationsAsync([{ to: pushToken, title, body, data }]);
  } catch {
    // best-effort — never throw
  }
}
