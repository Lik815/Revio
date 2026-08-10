'use client';

import { useState } from 'react';
import { SearchableSelect, SearchableOption } from './searchable-select';

export function CreateLinkForm({
  therapistOptions,
  practiceOptions,
  action,
}: {
  therapistOptions: SearchableOption[];
  practiceOptions: SearchableOption[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);

  return (
    <form action={action} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <SearchableSelect
        name="therapistId"
        placeholder="Therapeut suchen…"
        options={therapistOptions}
        value={therapistId}
        onChange={setTherapistId}
      />
      <SearchableSelect
        name="practiceId"
        placeholder="Praxis suchen…"
        options={practiceOptions}
        value={practiceId}
        onChange={setPracticeId}
      />
      <button className="primary-btn" type="submit" disabled={!therapistId || !practiceId}>
        Verknüpfen
      </button>
    </form>
  );
}
