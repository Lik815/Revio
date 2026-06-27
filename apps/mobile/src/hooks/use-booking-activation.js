import { useState } from 'react';

// Encapsulates the "Terminanfragen aktivieren" flow (Heilmittel-Auswahl +
// the PATCH /auth/me call passed in as onActivateBookingRequests) so screens
// only need to wire up the resulting state/handlers, not own the flow itself.
export function useBookingActivation({ onActivateBookingRequests }) {
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [showHeilmittelModal, setShowHeilmittelModal] = useState(false);

  const handleActivate = () => {
    setActivationError('');
    setShowHeilmittelModal(true);
  };

  const handleConfirmHeilmittel = async (selectedHeilmittel) => {
    if (!onActivateBookingRequests || activationLoading) return;
    setActivationLoading(true);
    setActivationError('');
    const result = await onActivateBookingRequests(selectedHeilmittel);
    setActivationLoading(false);
    if (!result?.ok) {
      setActivationError(result?.message ?? 'Aktivierung fehlgeschlagen.');
      return;
    }
    setShowHeilmittelModal(false);
  };

  const closeHeilmittelModal = () => setShowHeilmittelModal(false);

  return {
    activationLoading,
    activationError,
    showHeilmittelModal,
    handleActivate,
    handleConfirmHeilmittel,
    closeHeilmittelModal,
  };
}
