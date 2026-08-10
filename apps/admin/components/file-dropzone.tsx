'use client';

import { useRef, useState } from 'react';

// Bleibt ein natives <input type="file"> innerhalb eines Server-Action-Formulars
// (FormData funktioniert unabhängig von Client/Server-Komponentengrenzen) —
// nur mit Drag-Ziel-Styling und clientseitiger Vorschau ohne Server-Roundtrip.
export function FileDropzone({
  name,
  accept,
  multiple,
  required,
  title,
  hint,
}: {
  name: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  title: string;
  hint: string;
}) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function updatePreviews(files: FileList | null) {
    if (!files || files.length === 0) {
      setPreviews([]);
      return;
    }
    setPreviews(Array.from(files).slice(0, multiple ? 8 : 1).map((f) => URL.createObjectURL(f)));
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (inputRef.current && files.length > 0) {
      inputRef.current.files = files;
      updatePreviews(files);
    }
  }

  return (
    <label
      className={`file-dropzone${dragActive ? ' file-dropzone--active' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        required={required}
        onChange={(e) => updatePreviews(e.target.files)}
      />
      {previews.length > 0 ? (
        <div style={{ display: 'flex', gap: 6 }}>
          {previews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" className="file-dropzone__preview" />
          ))}
        </div>
      ) : (
        <div className="file-dropzone__icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
      )}
      <div className="file-dropzone__text">
        <div className="file-dropzone__title">
          {previews.length > 0 ? `${previews.length} Datei${previews.length > 1 ? 'en' : ''} ausgewählt` : title}
        </div>
        <div className="file-dropzone__hint">{hint}</div>
      </div>
    </label>
  );
}
