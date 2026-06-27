import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getBaseUrl, normalizeTherapistProfile, TUNNEL_HEADERS } from '../../../utils/app-utils';
import { useAuth } from '../../../context/AuthContext';
import { useTherapyData } from '../../../context/TherapyContext';
import { useConfigOptions } from '../../../hooks/use-config-options';
import { RoleSelectStep } from './steps/RoleSelectStep';
import { AccountCreateStep } from './steps/AccountCreateStep';
import { OtpVerifyStep } from './steps/OtpVerifyStep';
import { BasicProfileStep } from './steps/BasicProfileStep';
import { EmploymentStep } from './steps/EmploymentStep';
import { SpecializationsStep } from './steps/SpecializationsStep';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Unified registration flow. Owns all step state so back-navigation never loses
// entered data. Patients finish after the name step; therapists continue through
// employment classification and specializations. The account is only created at
// the very end of each track (POST /auth/register or POST /register/therapist),
// and the session is established exclusively via AuthContext login helpers.
export function RegistrationFlow({ onClose, onShowLogin, onComplete, c, t, styles }) {
  const { loginAsPatient, loginAsTherapist } = useAuth();
  const { loadFavorites, loadMyAppointments, loadIncomingBookings } = useTherapyData();
  const { specializationOptions } = useConfigOptions();

  const [role, setRole] = useState(null);
  const [step, setStep] = useState('role');

  // Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [terms, setTerms] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);

  // OTP
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  // Basic profile
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [cityTouched, setCityTouched] = useState(false);
  const [cityLookupLoading, setCityLookupLoading] = useState(false);
  const [gender, setGender] = useState(null);
  const [basicError, setBasicError] = useState('');

  // Therapist track
  const [employmentStatus, setEmploymentStatus] = useState(null);
  const [showPivotConfirm, setShowPivotConfirm] = useState(false);
  const [specializations, setSpecializations] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const normalizedEmail = () => email.trim().toLowerCase();

  // Auto-fill the city from the German postal code (same Nominatim service the
  // search already uses, so it works independently of our own API). Skipped once
  // the user has typed a city manually — manual entry always wins.
  useEffect(() => {
    if (role !== 'therapist' || cityTouched) return;
    if (!/^\d{5}$/.test(postalCode)) return;
    let cancelled = false;
    setCityLookupLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}&country=Germany&format=json&addressdetails=1&limit=1&accept-language=de`,
        );
        const data = await res.json().catch(() => []);
        if (cancelled) return;
        const addr = Array.isArray(data) && data[0]?.address ? data[0].address : null;
        const resolved = addr?.city || addr?.town || addr?.village || addr?.municipality || addr?.county || '';
        if (resolved && !cityTouched) setCity(resolved);
      } catch {
        // Lookup failed — leave the city field for manual entry.
      } finally {
        if (!cancelled) setCityLookupLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [postalCode, cityTouched, role]);

  // ── Step 1: role ───────────────────────────────────────────────────────────
  const handleSelectRole = (r) => { setRole(r); setAccountError(''); setStep('account'); };

  // ── Step 2: account → send OTP ──────────────────────────────────────────────
  const handleSendOtp = async () => {
    setAccountError('');
    if (!EMAIL_RE.test(email)) { setAccountError('Bitte gib eine gültige E-Mail ein.'); return; }
    if (password.length < 8) { setAccountError('Passwort muss mindestens 8 Zeichen haben.'); return; }
    if (password !== passwordConfirm) { setAccountError(t('passwordsMismatch')); return; }
    if (!terms) { setAccountError(t('termsRequired')); return; }
    setAccountLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/register/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
        body: JSON.stringify({ email: normalizedEmail() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAccountError(data.message ?? 'Fehler beim Senden.'); return; }
      setOtpCode('');
      setOtpError('');
      setStep('otp');
    } catch {
      setAccountError('Verbindungsfehler.');
    } finally {
      setAccountLoading(false);
    }
  };

  // ── Step 3: OTP ─────────────────────────────────────────────────────────────
  const handleConfirmOtp = async () => {
    if (otpCode.length !== 6) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch(`${getBaseUrl()}/register/confirm-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
        body: JSON.stringify({ email: normalizedEmail(), code: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setOtpError(data.message ?? 'Falscher Code.'); return; }
      setBasicError('');
      setStep('basic');
    } catch {
      setOtpError('Verbindungsfehler.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch(`${getBaseUrl()}/register/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
        body: JSON.stringify({ email: normalizedEmail() }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setOtpError(d.message ?? 'Fehler beim Senden.'); }
    } catch {
      setOtpError('Verbindungsfehler.');
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Session helpers (AuthContext only — no direct AsyncStorage) ─────────────
  const fetchProfile = async (token) => {
    const res = await fetch(`${getBaseUrl()}/auth/me`, {
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
    });
    return res.ok ? res.json() : null;
  };

  const completeAsPatient = async (token) => {
    const profile = await fetchProfile(token);
    await loginAsPatient(token, profile ?? null);
    loadFavorites(token);
    loadMyAppointments(token);
    onComplete?.({ landing: 'discover' });
  };

  const completeAsTherapist = async (token) => {
    const profile = await fetchProfile(token);
    await loginAsTherapist(token, profile ? normalizeTherapistProfile(profile) : null);
    loadFavorites(token);
    loadIncomingBookings(token);
    onComplete?.({ landing: 'profile' });
  };

  const registerPatient = async () => {
    const res = await fetch(`${getBaseUrl()}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
      body: JSON.stringify({
        email: normalizedEmail(),
        password,
        role: 'patient',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) throw new Error(data.message ?? t('alertConnectionError'));
    await completeAsPatient(data.token);
  };

  const registerTherapist = async (specs) => {
    const res = await fetch(`${getBaseUrl()}/register/therapist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
      body: JSON.stringify({
        email: normalizedEmail(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        city: city.trim(),
        postalCode: postalCode.trim() || undefined,
        employmentStatus,
        specializations: specs,
        languages: ['de'],
        gender,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) throw new Error(data.message ?? t('alertConnectionError'));
    await completeAsTherapist(data.token);
  };

  // ── Step 4: basic profile ───────────────────────────────────────────────────
  const handleBasicSubmit = async () => {
    setBasicError('');
    if (!firstName.trim() || !lastName.trim()) { setBasicError(t('patientRegNameRequired')); return; }
    if (role === 'therapist') {
      if (!city.trim()) { setBasicError('Bitte gib deine Stadt an.'); return; }
      if (!gender) { setBasicError('Bitte wähle Therapeutin oder Therapeut aus.'); return; }
      setStep('employment');
      return;
    }
    // Patient track ends here
    setSubmitting(true);
    try {
      await registerPatient();
    } catch (e) {
      setBasicError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 5: employment ──────────────────────────────────────────────────────
  const handleSelectEmployment = (status) => {
    setEmploymentStatus(status);
    setSubmitError('');
    setStep('specializations');
  };

  const handleConfirmPivot = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      await registerPatient();
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 6: specializations → create therapist ──────────────────────────────
  const submitTherapist = async (specs) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      await registerTherapist(specs);
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSpec = (spec) =>
    setSpecializations((prev) => (prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]));

  // ── Render ──────────────────────────────────────────────────────────────────
  let content;
  if (step === 'account') {
    content = (
      <AccountCreateStep
        email={email} onChangeEmail={(v) => { setEmail(v); setAccountError(''); }}
        password={password} onChangePassword={setPassword}
        passwordConfirm={passwordConfirm} onChangePasswordConfirm={setPasswordConfirm}
        showPassword={showPassword} onToggleShowPassword={() => setShowPassword((v) => !v)}
        showPasswordConfirm={showPasswordConfirm} onToggleShowPasswordConfirm={() => setShowPasswordConfirm((v) => !v)}
        terms={terms} onToggleTerms={() => setTerms((v) => !v)}
        error={accountError} loading={accountLoading}
        onSubmit={handleSendOtp}
        onBack={() => setStep('role')}
        onShowLogin={onShowLogin}
        c={c} t={t} styles={styles}
      />
    );
  } else if (step === 'otp') {
    content = (
      <OtpVerifyStep
        email={normalizedEmail()}
        code={otpCode}
        onChangeCode={(v) => { setOtpCode(v.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
        error={otpError} loading={otpLoading}
        onConfirm={handleConfirmOtp}
        onResend={handleResendOtp}
        onChangeEmail={() => { setOtpCode(''); setOtpError(''); setStep('account'); }}
        onBack={() => setStep('account')}
        c={c} t={t} styles={styles}
      />
    );
  } else if (step === 'basic') {
    content = (
      <BasicProfileStep
        role={role}
        firstName={firstName} onChangeFirstName={setFirstName}
        lastName={lastName} onChangeLastName={setLastName}
        postalCode={postalCode}
        onChangePostalCode={(v) => setPostalCode(v.replace(/\D/g, '').slice(0, 5))}
        city={city}
        onChangeCity={(v) => { setCity(v); setCityTouched(true); }}
        cityLoading={cityLookupLoading}
        gender={gender} onChangeGender={setGender}
        error={basicError} loading={submitting}
        onSubmit={handleBasicSubmit}
        onBack={() => setStep('otp')}
        c={c} t={t} styles={styles}
      />
    );
  } else if (step === 'employment') {
    content = (
      <EmploymentStep
        showPivotConfirm={showPivotConfirm}
        onSelectEmployment={handleSelectEmployment}
        onRequestPivot={() => { setSubmitError(''); setShowPivotConfirm(true); }}
        onConfirmPivot={handleConfirmPivot}
        onCancelPivot={() => setShowPivotConfirm(false)}
        loading={submitting}
        onBack={() => setStep('basic')}
        c={c} t={t} styles={styles}
      />
    );
  } else if (step === 'specializations') {
    content = (
      <SpecializationsStep
        options={specializationOptions}
        selected={specializations}
        onToggle={toggleSpec}
        error={submitError} loading={submitting}
        onSubmit={() => submitTherapist(specializations)}
        onSkip={() => submitTherapist([])}
        onBack={() => setStep('employment')}
        c={c} t={t} styles={styles}
      />
    );
  } else {
    content = (
      <RoleSelectStep
        onSelectRole={handleSelectRole}
        onBack={onClose}
        c={c} t={t}
      />
    );
  }

  return <View style={{ flex: 1 }}>{content}</View>;
}
