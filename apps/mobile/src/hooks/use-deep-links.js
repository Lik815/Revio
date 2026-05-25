import { useState, useEffect } from 'react';
import { Linking } from 'react-native';

function parseDeepLink(url) {
  if (!url) return null;
  const tokenMatch = url.match(/[?&]token=([^&]+)/);
  if (!tokenMatch) return null;
  const token = decodeURIComponent(tokenMatch[1]);
  if (/revo:\/\/verify|\/verify[?]|verify-email/.test(url)) {
    return { type: 'verify-email', token };
  }
  if (/revo:\/\/reset-password|reset-password/.test(url)) {
    return { type: 'reset-password', token };
  }
  return { type: 'invite', token };
}

/**
 * Listens for incoming deep links and returns the parsed link state.
 * Returns { type: 'verify-email' | 'reset-password' | 'invite', token } or null.
 * Call clear() to dismiss after handling.
 */
export function useDeepLinks() {
  const [deepLink, setDeepLink] = useState(null);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      const parsed = parseDeepLink(url);
      if (parsed) setDeepLink(parsed);
    });

    const sub = Linking.addEventListener('url', (e) => {
      const parsed = parseDeepLink(e.url);
      if (parsed) setDeepLink(parsed);
    });

    return () => sub.remove();
  }, []);

  const clear = () => setDeepLink(null);

  return { deepLink, clear };
}
