import React, { useState, useEffect } from 'react';
import { Alert, Modal, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDeepLinks } from '../hooks/use-deep-links';
import { useAuth } from './AuthContext';
import { useTheme } from '../hooks/use-theme';
import { appStyles } from '../styles/app-styles';
import { translations } from '../i18n/translations';
import { getBaseUrl, normalizeTherapistProfile, TUNNEL_HEADERS } from '../utils/app-utils';
import { EmailVerifyScreen } from '../_archive/screens/mobile-email-verify-screen';
import { InviteClaimScreen } from '../_archive/screens/mobile-invite-claim-screen';
import { ResetPasswordModal } from '../_archive/screens/mobile-reset-password-modal';
import { VisibilityModal } from '../_archive/screens/mobile-visibility-modal';

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
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [claimedToken, setClaimedToken] = useState(null);

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

  const handleInviteClaimed = async (token) => {
    setClaimedToken(token);
    await AsyncStorage.setItem('revio_auth_token', token);
    const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      await loginAsTherapist(token, normalizeTherapistProfile(profile));
    }
    clear();
    setShowVisibilityModal(true);
  };

  const handleVisibilityChoice = async (preference) => {
    const token = claimedToken;
    if (!token) { setShowVisibilityModal(false); return; }
    setVisibilityLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/invite/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ visibilityPreference: preference }),
      });
      const data = await res.json().catch(() => ({}));
      setShowVisibilityModal(false);
      setClaimedToken(null);
      if (res.ok && preference === 'visible' && !data.isPublished && data.missingFields?.length > 0) {
        Alert.alert(
          t('alertProfileIncomplete'),
          t('alertProfileIncompleteBody').replace('{fields}', data.missingFields.join(', ')),
        );
      }
    } catch {
      setShowVisibilityModal(false);
    } finally {
      setVisibilityLoading(false);
    }
  };

  if (!deepLink && !showVisibilityModal) return null;

  if (showVisibilityModal) {
    return (
      <VisibilityModal
        visible
        onClose={() => { setShowVisibilityModal(false); setClaimedToken(null); }}
        onChoice={handleVisibilityChoice}
        loading={visibilityLoading}
        c={c} t={t}
      />
    );
  }

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
            onClaimed={handleInviteClaimed}
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
