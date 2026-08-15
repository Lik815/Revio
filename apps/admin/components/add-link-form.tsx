'use client';

import { useState } from 'react';
import { SearchableSelect, SearchableOption } from './searchable-select';

// Einseitiges Verknüpfungsformular für die Detailseiten: die Gegenseite steht
// bereits fest (die Praxis bzw. der/die Therapeut:in dieser Seite). Bereits
// verknüpfte Einträge und archivierte Therapeut:innen filtert der Aufrufer
// heraus, damit die API-Antwort 409/400 gar nicht erst auftreten kann.
export function AddLinkForm({
  name,
  placeholder,
  submitLabel,
  options,
  action,
  emptyHint,
}: {
  name: 'therapistId' | 'practiceId';
  placeholder: string;
  submitLabel: string;
  options: SearchableOption[];
  action: (formData: FormData) => void | Promise<void>;
  emptyHint: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (options.length === 0) {
    return <p className="table-note" style={{ margin: 0 }}>{emptyHint}</p>;
  }

  return (
    <form action={action} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <SearchableSelect
        name={name}
        placeholder={placeholder}
        options={options}
        value={selected}
        onChange={setSelected}
      />
      <button className="primary-btn" type="submit" disabled={!selected}>
        {submitLabel}
      </button>
    </form>
  );
}
