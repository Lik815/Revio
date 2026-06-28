import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getBaseUrl, normalizeTherapistProfile, TUNNEL_HEADERS } from '../../../utils/app-utils';
import { useAuth } from '../../../context/AuthContext';
import { useTherapyData } from '../../../context/TherapyContext';
import { useConfigOptions } from '../../../hooks/use-config-options';
import { RoleSelectStep } from './steps/RoleSelectStep';
import { ProviderTypeStep } from './steps/ProviderTypeStep';
import { AccountCreateStep } from './steps/AccountCreateStep';
import { OtpVerifyStep } from './steps/OtpVerifyStep';
import { BasicProfileStep } from './steps/BasicProfileStep';
import { SpecializationsStep } from './steps/SpecializationsStep';
import { PracticeProfileCreateStep } from './steps/PracticeProfileCreateStep';
import { PracticeLinkStep } from './steps/PracticeLinkStep';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_PRACTICE_FORM = {
  name: '', postalCode: '', city: '', address: '',
  phone: '', email: '', website: '', services: '', description: '',
};

const splitCsv = (value) => value.split(',').map((s) => s.trim()).filter(Boolean);

async function lookupCityByPostalCode(postalCode) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}&country=Germany&format=json&addressdetails=1&limit=1&accept-language=de`,
  );
  const data = await res.json().catch(() => []);
  const addr = Array.isArray(data) && data[0]?.address ? data[0].address : null;
  return addr?.city || addr?.town || addr?.village || addr?.municipality || addr?.county || '';
}

// Unified registration flow. Owns all step state so back-navigation never loses
// entered data. Patients finish after the name step. Providers pick a sub-type
// (freelancer / practice / works-in-practice) and continue on the matching
// track. The account is only created at the very end of each track, and the
// session is established exclusively via AuthContext login helpers.
export function RegistrationFlow({ onClose, onShowLogin, onComplete, c, t, styles }) {
  const { loginAsPatient, loginAsTherapist, loginAsPracticeAdmin } = useAuth();
  const { loadFavorites, loadMyAppointments, loadIncomingBookings } = useTherapyData();
  const { specializationOptions } = useConfigOptions();

  const [role, setRole] = useState(null);            // 'patient' | 'therapist' | 'practice_admin'
  const [providerType, setProviderType] = useState(null); // 'freelance' | 'practice' | 'in_practice'
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

  // Basic profile (patient + therapist tracks)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [cityTouched, setCityTouched] = useState(false);
  const [cityLookupLoading, setCityLookupLoading] = useState(false);
  const [gender, setGender] = useState(null);
  const [basicError, setBasicError] = useState('');

  // Therapist track
  const [specializations, setSpecializations] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Flow C — works in a practice
  const [linkedPractice, setLinkedPractice] = useState(null);
  const [practiceNameText, setPracticeNameText] = useState('');

  // Practice track (Flow B)
  const [practiceForm, setPracticeForm] = useState(EMPTY_PRACTICE_FORM);
  const [practiceSpecialties, setPracticeSpecialties] = useState([]);
  const [practiceCityTouched, setPracticeCityTouched] = useState(false);
  const [practiceCityLoading, setPracticeCityLoading] = useState(false);

  const normalizedEmail = () => email.trim().toLowerCase();

  const setPracticeField = (field, rawValue) => {
    let value = rawValue;
    if (field === 'postalCode') value = rawValue.replace(/\D/g, '').slice(0, 5);
    if (field === 'city') setPracticeCityTouched(true);
    setPracticeForm((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-fill the therapist city from the postal code (manual entry always wins).
  useEffect(() => {
    if (role !== 'therapist' || cityTouched) return;
    if (!/^\d{5}$/.test(postalCode)) return;
    let cancelled = false;
    setCityLookupLoading(true);
    const timer = setTimeout(async () => {
      try {
        const resolved = await lookupCityByPostalCode(postalCode);
        if (!cancelled && resolved && !cityTouched) setCity(resolved);
      } catch {
        // leave for manual entry
      } finally {
        if (!cancelled) setCityLookupLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [postalCode, cityTouched, role]);

  // Same auto-fill for the practice form.
  useEffect(() => {
    if (providerType !== 'practice' || practiceCityTouched) return;
    if (!/^\d{5}$/.test(practiceForm.postalCode)) return;
    let cancelled = false;
    setPracticeCityLoading(true);
    const timer = setTimeout(async () => {
      try {
        const resolved = await lookupCityByPostalCode(practiceForm.postalCode);
        if (!cancelled && resolved && !practiceCityTouched) {
          setPracticeForm((prev) => ({ ...prev, city: resolved }));
        }
      } catch {
        // leave for manual entry
      } finally {
        if (!cancelled) setPracticeCityLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [practiceForm.postalCode, practiceCityTouched, providerType]);

  // ── Step 1: role ───────────────────────────────────────────────────────────
  const handleSelectRole = (r) => {
    setAccountError('');
    if (r === 'patient') { setRole('patient'); setProviderType(null); setStep('account'); return; }
    setStep('providerType');
  };

  // ── Step 2 (provider): sub-type ─────────────────────────────────────────────
  const handleSelectProviderType = (type) => {
    setProviderType(type);
    setRole(type === 'practice' ? 'practice_admin' : 'therapist');
    setAccountError('');
    setStep('account');
  };

  // ── Step: account → send OTP ────────────────────────────────────────────────
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

  // ── Step: OTP ───────────────────────────────────────────────────────────────
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
      setSubmitError('');
      setStep(role === 'practice_admin' ? 'practiceCreate' : 'basic');
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

  // ── Session helpers (AuthContext only) ──────────────────────────────────────
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

  const completeAsPracticeAdmin = async (token) => {
    const profile = await fetchProfile(token);
    await loginAsPracticeAdmin(token, profile ?? null);
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
    const isInPractice = providerType === 'in_practice';
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
        specializations: specs,
        languages: ['de'],
        gender,
        isFreelancer: !isInPractice,
        ...(isInPractice && linkedPractice ? { practiceId: linkedPractice.id } : {}),
        ...(isInPractice && !linkedPractice && practiceNameText.trim()
          ? { practiceNameText: practiceNameText.trim() }
          : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) throw new Error(data.message ?? t('alertConnectionError'));
    await completeAsTherapist(data.token);
  };

  const registerPractice = async () => {
    const res = await fetch(`${getBaseUrl()}/register/practice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
      body: JSON.stringify({
        email: normalizedEmail(),
        password,
        practice: {
          name: practiceForm.name.trim(),
          city: practiceForm.city.trim(),
          postalCode: practiceForm.postalCode.trim() || undefined,
          address: practiceForm.address.trim() || undefined,
          phone: practiceForm.phone.trim() || undefined,
          email: practiceForm.email.trim() || undefined,
          website: practiceForm.website.trim() || undefined,
          description: practiceForm.description.trim() || undefined,
          specialties: practiceSpecialties,
          services: splitCsv(practiceForm.services),
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    // Duplicate guard: surface the warning (claim flow is Phase 2).
    if (res.status === 409 && data.code === 'practice_exists') {
      throw new Error(data.message || 'Diese Praxis existiert bereits.');
    }
    if (!res.ok || !data.token) throw new Error(data.message ?? t('alertConnectionError'));
    await completeAsPracticeAdmin(data.token);
  };

  // ── Step: basic profile ─────────────────────────────────────────────────────
  const handleBasicSubmit = async () => {
    setBasicError('');
    if (!firstName.trim() || !lastName.trim()) { setBasicError(t('patientRegNameRequired')); return; }
    if (role === 'therapist') {
      if (!city.trim()) { setBasicError('Bitte gib deine Stadt an.'); return; }
      if (!gender) { setBasicError('Bitte wähle Therapeutin oder Therapeut aus.'); return; }
      setStep('specializations');
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

  // ── Therapist final submit ──────────────────────────────────────────────────
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

  const handleSpecializationsNext = (specs) => {
    if (providerType === 'in_practice') { setSubmitError(''); setStep('practiceLink'); return; }
    submitTherapist(specs);
  };

  // ── Practice final submit ───────────────────────────────────────────────────
  const handlePracticeSubmit = async () => {
    setSubmitError('');
    if (!practiceForm.name.trim()) { setSubmitError('Bitte gib den Praxisnamen an.'); return; }
    if (!practiceForm.city.trim()) { setSubmitError('Bitte gib die Stadt an.'); return; }
    setSubmitting(true);
    try {
      await registerPractice();
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSpec = (spec) =>
    setSpecializations((prev) => (prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]));

  const togglePracticeSpecialty = (spec) =>
    setPracticeSpecialties((prev) => (prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]));

  // ── Render ──────────────────────────────────────────────────────────────────
  let content;
  if (step === 'providerType') {
    content = (
      <ProviderTypeStep
        onSelectType={handleSelectProviderType}
        onBack={() => setStep('role')}
        c={c} t={t}
      />
    );
  } else if (step === 'account') {
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
        onBack={() => setStep(role === 'patient' ? 'role' : 'providerType')}
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
  } else if (step === 'specializations') {
    content = (
      <SpecializationsStep
        options={specializationOptions}
        selected={specializations}
        onToggle={toggleSpec}
        error={submitError} loading={submitting}
        onSubmit={() => handleSpecializationsNext(specializations)}
        onSkip={() => handleSpecializationsNext([])}
        onBack={() => setStep('basic')}
        c={c} t={t} styles={styles}
      />
    );
  } else if (step === 'practiceLink') {
    content = (
      <PracticeLinkStep
        selectedPractice={linkedPractice}
        onSelectPractice={setLinkedPractice}
        freeText={practiceNameText}
        onChangeFreeText={setPracticeNameText}
        error={submitError} loading={submitting}
        onSubmit={() => submitTherapist(specializations)}
        onBack={() => setStep('specializations')}
        c={c} t={t} styles={styles}
      />
    );
  } else if (step === 'practiceCreate') {
    content = (
      <PracticeProfileCreateStep
        values={practiceForm}
        setField={setPracticeField}
        specializationOptions={specializationOptions}
        selectedSpecialties={practiceSpecialties}
        onToggleSpecialty={togglePracticeSpecialty}
        cityLoading={practiceCityLoading}
        error={submitError} loading={submitting}
        onSubmit={handlePracticeSubmit}
        onBack={() => setStep('otp')}
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
