#!/usr/bin/env node
// Validator für die Datenklassifizierung (DSGVO DS-02).
//
// Prüft, dass JEDES Skalarfeld jedes Prisma-Modells in data-classification.yaml
// genau einer Klasse zugeordnet ist. Läuft ohne externe Abhängigkeiten, damit es
// problemlos in die CI passt:
//
//   node prisma/check-data-classification.mjs
//
// Exit 1 bei: unklassifiziertem Feld, Doppelklassifizierung, oder Klassifizierung
// eines Feldes, das es im Schema nicht (mehr) gibt.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const schemaText = readFileSync(join(here, 'schema.prisma'), 'utf8');
const classText = readFileSync(join(here, 'data-classification.yaml'), 'utf8');

// ── 1. Schema parsen: pro Modell die Skalarfelder (keine Relationen) ──────────
const scalarKinds = new Set([
  'String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'Decimal', 'BigInt',
]);

// Erst alle Modell- und Enum-Namen sammeln.
const modelNames = new Set([...schemaText.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]));
const enumNames = new Set([...schemaText.matchAll(/^enum\s+(\w+)\s*\{/gm)].map((m) => m[1]));

const schemaFields = {}; // model -> Set(scalarFieldName)
for (const block of schemaText.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
  const model = block[1];
  const body = block[2];
  const fields = new Set();
  for (const line of body.split('\n')) {
    const m = line.match(/^\s{2,}(\w+)\s+([A-Za-z0-9_]+)(\[\])?(\?)?/);
    if (!m) continue;
    const [, name, baseType, isList] = m;
    if (name.startsWith('@')) continue;
    if (isList) continue;                 // Relations-Liste
    if (modelNames.has(baseType)) continue; // Relations-Objekt
    if (scalarKinds.has(baseType) || enumNames.has(baseType)) fields.add(name);
  }
  schemaFields[model] = fields;
}

// ── 2. Klassifizierung parsen (minimaler Parser für das bekannte Format) ──────
const errors = [];
const classified = {}; // model -> { field -> class }
let currentModel = null;
for (const rawLine of classText.split('\n')) {
  const line = rawLine.replace(/#.*$/, '');
  const modelMatch = line.match(/^ {2}(\w+):\s*$/);
  if (modelMatch) { currentModel = modelMatch[1]; classified[currentModel] = {}; continue; }
  const listMatch = line.match(/^ {4}(P[0-3]):\s*\[(.*)\]\s*$/);
  if (listMatch && currentModel) {
    const cls = listMatch[1];
    for (const f of listMatch[2].split(',').map((s) => s.trim()).filter(Boolean)) {
      if (classified[currentModel][f]) {
        errors.push(`${currentModel}.${f}: doppelt klassifiziert (${classified[currentModel][f]} & ${cls})`);
      }
      classified[currentModel][f] = cls;
    }
  }
}

// ── 3. Abgleich ───────────────────────────────────────────────────────────────
for (const [model, fields] of Object.entries(schemaFields)) {
  const cls = classified[model] ?? {};
  for (const f of fields) {
    if (!cls[f]) errors.push(`${model}.${f}: NICHT klassifiziert (DS-02)`);
  }
  for (const f of Object.keys(cls)) {
    if (!fields.has(f)) errors.push(`${model}.${f}: klassifiziert, aber nicht (mehr) im Schema`);
  }
  if (!(model in classified)) errors.push(`${model}: Modell fehlt in data-classification.yaml`);
}

const totalFields = Object.values(schemaFields).reduce((n, s) => n + s.size, 0);
if (errors.length) {
  console.error(`Datenklassifizierung UNVOLLSTÄNDIG (${errors.length} Problem(e)):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`Datenklassifizierung vollständig: ${totalFields} Skalarfelder über ${Object.keys(schemaFields).length} Modelle klassifiziert.`);
