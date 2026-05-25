import React, { useState, useEffect } from 'react';
import { Modal, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDeepLinks } from '../hooks/use-deep-links';
import { useAuth } from './AuthContext';
import { useTheme } from '../hooks/use-theme';
import { appStyles } from '../styles/app-styles';
import { translations } from '../mobile-translations';
import { getBaseUrl, normalizeTherapistProfile, TUNNEL_HEADERS } from '../mobile-utils';
import { EmailVerifyScreen } from '../mobile-email-verify-screen';
import { InviteClaimScreen } from '../mobile-invite-claim-screen';
import { ResetPasswordModal } from '../mobile-reset-password-modal';

const t = (key) => translations.de[key] ?? key;

export function DeepLinkHandler() {
  const { deepLink, clear } = useDeepLinks();
  const { loginAsPatient, loginAsTherapist } = useAuth();
  const { c } = useTheme();

  const [emailVerifyStatus, setEmailVerifyStatus] = useState('idle');
  const [emailVerifyError, setEmailVerifyError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteData, setInviteData] = useState(null);

  useEffect(() => {
    if (!deepLink) return;

    if (deepLink.type === 'verify-email') {
      handleVerifyEmail(deepLink.token);
    } else if (deepLink.type === 'invite') {
      handleInviteValidate(deepLink.token);
    }
  }, [deepLink]);

  const handleVerifyEmail = async (token) => {
    setEmailVerifyError('');
    setEmailVerifyStatus('verifying');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let res;
      try {
        res = await fetch(`${getBaseUrl()}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setEmailVerifyError(err.message ?? t('alertVerifyFailed'));
        setEmailVerifyStatus('error');
        return;
      }
      const data = await res.json();
      if (data.token) {
        await AsyncStorage.setItem('revio_auth_token', data.token);
        await AsyncStorage.setItem('revio_account_type', data.accountType ?? 'therapist');
        const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${data.token}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile.role === 'patient') {
            await loginAsPatient(data.token, profile);
          } else {
            await loginAsTherapist(data.token, normalizeTherapistProfile(profile));
          }
        }
      }
      setEmailVerifyStatus('success');
      setTimeout(() => clear(), 2500);
    } catch {
      setEmailVerifyError(t('alertConnectionError') + '. ' + t('alertConnectionErrorBody'));
      setEmailVerifyStatus('error');
    }
  };

  const handleInviteValidate = async (token) => {
    setInviteLoading(true);
    setInviteError('');
    setInviteData(null);
    try {
      const res = await fetch(`${getBaseUrl()}/invite/validate?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setInviteError(err.message ?? t('alertInvalidInvite'));
      } else {
        setInviteData(await res.json());
      }
    } catch {
      setInviteError(t('alertInviteConnectionError'));
    } finally {
      setInviteLoading(false);
    }
  };

  if (!deepLink) return null;

  if (deepLink.type === 'verify-email') {
    return (
      <Modal visible animationType="slide" onRequestClose={clear}>
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <EmailVerifyScreen
            status={emailVerifyStatus}
            error={emailVerifyError}
            onCancel={clear}
            c={c}
            t={t}
            styles={appStyles}
          />
        </View>
      </Modal>
    );
  }

  if (deepLink.type === 'reset-password') {
    return (
      <ResetPasswordModal
        visible
        token={deepLink.token}
        onClose={clear}
        onDone={clear}
        c={c}
      />
    );
  }

  if (deepLink.type === 'invite') {
    return (
      <Modal visible animationType="slide" onRequestClose={clear}>
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <InviteClaimScreen
            loading={inviteLoading}
            error={inviteError}
            claimData={inviteData}
            token={deepLink.token}
            onClose={clear}
            onClaimed={clear}
            c={c}
            t={t}
            styles={appStyles}
          />
        </View>
      </Modal>
    );
  }

  return null;
}
