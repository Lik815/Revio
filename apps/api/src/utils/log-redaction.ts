// Redaction-Layer für den pino/Fastify-Logger (DSGVO DS-60/61).
//
// Sicherheitsnetz, damit personenbezogene Daten (P1) und Geheimnisse (P3) nicht
// versehentlich in Logs landen — kein Freibrief, PII bewusst zu loggen. Die
// primäre Regel bleibt: erst gar keine PII an den Logger geben (docs/dsgvo.md).
//
// pinos redact-Wildcard `*` matcht genau EIN Pfad-Segment. Deshalb listen wir
// jeden sensiblen Key an drei Stellen: Wurzel (`key`), eine Ebene tief (`*.key`)
// und im Request-Body (`req.body.key`). Tiefer verschachtelte Objekte deckt das
// nicht vollständig ab — dort greift weiterhin DS-60 (nichts Sensibles loggen).

const SENSITIVE_KEYS = [
  // P3 — Geheimnisse
  'password', 'passwordHash', 'currentPassword', 'newPassword', 'oldPassword',
  'token', 'sessionToken', 'confirmToken', 'cancelToken', 'resetToken', 'otp',
  'secret', 'apiKey', 'authorization',
  // P1 — personenbezogen
  'email', 'patientEmail', 'phone', 'patientPhone', 'iban',
];

export const logRedactCensor = '[redacted]';

export const logRedactPaths = [
  // Header, die Tokens/Sessions tragen
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  // Sensible Keys an Wurzel, eine Ebene tief und im Request-Body
  ...SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `req.body.${key}`]),
];

export const logRedactOptions = {
  paths: logRedactPaths,
  censor: logRedactCensor,
};
