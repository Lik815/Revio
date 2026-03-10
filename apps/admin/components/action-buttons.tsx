'use client';

import { useTransition } from 'react';

type Action = () => Promise<void>;

function ActionButton({
  label,
  action,
  variant = 'default',
}: {
  label: string;
  action: Action;
  variant?: 'approve' | 'reject' | 'warn' | 'default';
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className={`action-btn action-btn--${variant}`}
      disabled={pending}
      onClick={() => startTransition(action)}
    >
      {pending ? '…' : label}
    </button>
  );
}

export function TherapistActions({ id, status, actions }: {
  id: string;
  status: string;
  actions: {
    approve: (id: string) => Promise<void>;
    reject: (id: string) => Promise<void>;
    requestChanges: (id: string) => Promise<void>;
    suspend: (id: string) => Promise<void>;
  };
}) {
  return (
    <div className="action-row">
      {status !== 'APPROVED' && (
        <ActionButton label="Freigeben" variant="approve" action={() => actions.approve(id)} />
      )}
      {status !== 'REJECTED' && (
        <ActionButton label="Ablehnen" variant="reject" action={() => actions.reject(id)} />
      )}
      {status !== 'CHANGES_REQUESTED' && (
        <ActionButton label="Änderungen" variant="warn" action={() => actions.requestChanges(id)} />
      )}
      {status === 'APPROVED' && (
        <ActionButton label="Sperren" variant="reject" action={() => actions.suspend(id)} />
      )}
    </div>
  );
}

export function PracticeActions({ id, status, actions }: {
  id: string;
  status: string;
  actions: {
    approve: (id: string) => Promise<void>;
    reject: (id: string) => Promise<void>;
    suspend: (id: string) => Promise<void>;
  };
}) {
  return (
    <div className="action-row">
      {status !== 'APPROVED' && (
        <ActionButton label="Freigeben" variant="approve" action={() => actions.approve(id)} />
      )}
      {status !== 'REJECTED' && (
        <ActionButton label="Ablehnen" variant="reject" action={() => actions.reject(id)} />
      )}
      {status === 'APPROVED' && (
        <ActionButton label="Sperren" variant="reject" action={() => actions.suspend(id)} />
      )}
    </div>
  );
}

export function LinkActions({ id, status, actions }: {
  id: string;
  status: string;
  actions: {
    confirm: (id: string) => Promise<void>;
    reject: (id: string) => Promise<void>;
    dispute: (id: string) => Promise<void>;
  };
}) {
  return (
    <div className="action-row">
      {status !== 'CONFIRMED' && (
        <ActionButton label="Bestätigen" variant="approve" action={() => actions.confirm(id)} />
      )}
      {status !== 'REJECTED' && (
        <ActionButton label="Ablehnen" variant="reject" action={() => actions.reject(id)} />
      )}
      {status !== 'DISPUTED' && (
        <ActionButton label="Umstritten" variant="warn" action={() => actions.dispute(id)} />
      )}
    </div>
  );
}
