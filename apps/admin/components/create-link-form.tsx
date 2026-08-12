'use client';

import { useMemo, useState } from 'react';
import { SearchableSelect, SearchableOption } from './searchable-select';

export function CreateLinkForm({
  therapistOptions,
  practiceOptions,
  existingPairs,
  action,
}: {
  therapistOptions: SearchableOption[];
  practiceOptions: SearchableOption[];
  // "therapistId::practiceId" für jede bereits bestehende Verknüpfung
  existingPairs: string[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);

  const pairSet = useMemo(() => new Set(existingPairs), [existingPairs]);

  // Sobald eine Seite gewählt ist, blendet die andere Liste alles aus, was
  // bereits verknüpft ist — so kann die 409-Antwort der API nicht mehr
  // auftreten, statt sie erst nach dem Absenden zu zeigen.
  const availableTherapists = useMemo(
    () => (practiceId
      ? therapistOptions.filter((t) => !pairSet.has(`${t.value}::${practiceId}`))
      : therapistOptions),
    [therapistOptions, practiceId, pairSet],
  );
  const availablePractices = useMemo(
    () => (therapistId
      ? practiceOptions.filter((p) => !pairSet.has(`${therapistId}::${p.value}`))
      : practiceOptions),
    [practiceOptions, therapistId, pairSet],
  );

  const hiddenTherapists = therapistOptions.length - availableTherapists.length;
  const hiddenPractices = practiceOptions.length - availablePractices.length;

  // Auswahl der Gegenseite verwerfen, wenn sie durch die neue Wahl ungültig wird.
  const handleTherapistChange = (next: string | null) => {
    setTherapistId(next);
    if (next && practiceId && pairSet.has(`${next}::${practiceId}`)) setPracticeId(null);
  };
  const handlePracticeChange = (next: string | null) => {
    setPracticeId(next);
    if (next && therapistId && pairSet.has(`${therapistId}::${next}`)) setTherapistId(null);
  };

  const noneLeft =
    (practiceId && availableTherapists.length === 0) ||
    (therapistId && availablePractices.length === 0);

  return (
    <form action={action} style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <SearchableSelect
          name="therapistId"
          placeholder="Therapeut suchen…"
          options={availableTherapists}
          value={therapistId}
          onChange={handleTherapistChange}
        />
        <SearchableSelect
          name="practiceId"
          placeholder="Praxis suchen…"
          options={availablePractices}
          value={practiceId}
          onChange={handlePracticeChange}
        />
        <button className="primary-btn" type="submit" disabled={!therapistId || !practiceId}>
          Verknüpfen
        </button>
      </div>

      {noneLeft ? (
        <p className="table-note" style={{ margin: 0 }}>
          Für diese Auswahl gibt es keine offenen Verknüpfungen mehr — alles ist bereits verknüpft.
        </p>
      ) : hiddenTherapists > 0 || hiddenPractices > 0 ? (
        <p className="table-note" style={{ margin: 0 }}>
          {hiddenTherapists > 0
            ? `${hiddenTherapists} bereits verknüpfte${hiddenTherapists === 1 ? 'r Therapeut' : ' Therapeuten'} ausgeblendet.`
            : `${hiddenPractices} bereits verknüpfte Prax${hiddenPractices === 1 ? 'is' : 'en'} ausgeblendet.`}
        </p>
      ) : null}
    </form>
  );
}
