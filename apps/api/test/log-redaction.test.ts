import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { logRedactOptions, logRedactCensor } from '../src/utils/log-redaction.js';

// Erfasst die vom Fastify-/pino-Logger geschriebenen JSON-Zeilen (DSGVO DS-61).
function captureLogLines(emit: (log: any) => void): any[] {
  const lines: any[] = [];
  const stream = {
    write: (chunk: string) => {
      try { lines.push(JSON.parse(chunk)); } catch { /* ignore non-JSON */ }
    },
  };
  const app = Fastify({ logger: { redact: logRedactOptions, stream } });
  emit(app.log);
  return lines;
}

describe('Logger-Redaction (DSGVO DS-60/61)', () => {
  it('zensiert Geheimnisse und PII an der Wurzel', () => {
    const [line] = captureLogLines((log) =>
      log.info(
        { password: 'hunter2', sessionToken: 'sess-abc', email: 'user@example.de', phone: '+4915112345678' },
        'test',
      ),
    );
    expect(line.password).toBe(logRedactCensor);
    expect(line.sessionToken).toBe(logRedactCensor);
    expect(line.email).toBe(logRedactCensor);
    expect(line.phone).toBe(logRedactCensor);
  });

  it('zensiert sensible Keys eine Ebene tief (*.key)', () => {
    const [line] = captureLogLines((log) =>
      log.info({ user: { passwordHash: 'x', patientEmail: 'p@example.de', otp: '123456' } }, 'test'),
    );
    expect(line.user.passwordHash).toBe(logRedactCensor);
    expect(line.user.patientEmail).toBe(logRedactCensor);
    expect(line.user.otp).toBe(logRedactCensor);
  });

  it('lässt nicht-personenbezogene Felder unangetastet', () => {
    const [line] = captureLogLines((log) =>
      log.info({ requestId: 'req-42', statusCode: 200, durationMs: 12, hasOrigin: true }, 'test'),
    );
    expect(line.requestId).toBe('req-42');
    expect(line.statusCode).toBe(200);
    expect(line.durationMs).toBe(12);
    expect(line.hasOrigin).toBe(true);
  });
});
