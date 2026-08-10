// Pill-Toggles statt Checkbox-Zeilen — bleiben technisch <input type="checkbox">
// (kein Client-JS nötig), nur visuell als Chip gestylt. Schneller scannbar bei
// vielen Optionen (Sprachen, Kassenarten, Spezialisierungen, Heilmittel, …).

export function ChipToggle({
  name,
  value,
  label,
  defaultChecked = false,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="chip-toggle">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} />
      <span>{label}</span>
    </label>
  );
}

export function ChipToggleGroup({
  name,
  options,
  defaultChecked = [],
}: {
  name: string;
  options: { key: string; label: string }[];
  defaultChecked?: string[];
}) {
  return (
    <div className="chip-toggle-group">
      {options.map((o) => (
        <ChipToggle key={o.key} name={name} value={o.key} label={o.label} defaultChecked={defaultChecked.includes(o.key)} />
      ))}
    </div>
  );
}
