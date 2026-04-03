import { Resend } from 'resend';

const FROM = 'Revio <noreply@my-revio.de>';

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set — add it to apps/api/.env');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendInviteEmail(opts: {
  to: string;
  therapistName: string;
  practiceName: string;
  inviteLink: string;
}) {
  const { to, therapistName, practiceName, inviteLink } = opts;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `${practiceName} lädt dich zu Revio ein`,
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1a1a1a">
        <h2 style="color:#2563eb">Willkommen bei Revio</h2>
        <p>Hallo ${therapistName},</p>
        <p>
          <strong>${practiceName}</strong> hat ein Profil für dich auf Revio erstellt –
          der Plattform für Physiotherapeutinnen und Physiotherapeuten.
        </p>
        <p>
          Klicke auf den Button, um dein Konto zu aktivieren, dein Passwort zu setzen
          und dein Profil zu vervollständigen:
        </p>
        <p style="margin:32px 0">
          <a href="${inviteLink}"
             style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;
                    text-decoration:none;font-weight:600;font-size:16px">
            Profil aktivieren
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">
          Dieser Link ist 7 Tage gültig. Wenn du diese E-Mail nicht erwartet hast,
          kannst du sie ignorieren.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0"/>
        <p style="color:#9ca3af;font-size:12px">Revio · revioclub.app@gmail.com</p>
      </div>
    `,
    text: `Hallo ${therapistName},\n\n${practiceName} hat ein Profil für dich auf Revio erstellt.\n\nKlicke hier, um dein Konto zu aktivieren:\n${inviteLink}\n\nDieser Link ist 7 Tage gültig.`,
  });
}

export async function sendVerificationEmail(opts: {
  to: string;
  name: string;
  verifyLink: string;
  browserFallbackLink?: string;
}) {
  const { to, name, verifyLink, browserFallbackLink } = opts;
  const fallbackSection = browserFallbackLink
    ? `<p style="color:#6b7280;font-size:13px;margin-top:24px">
        Button funktioniert nicht?
        <a href="${browserFallbackLink}" style="color:#2563eb">Im Browser bestätigen</a>
       </p>`
    : '';
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Revio – Bitte bestätige deine E-Mail-Adresse',
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1a1a1a">
        <h2 style="color:#2563eb">E-Mail bestätigen</h2>
        <p>Hallo ${name},</p>
        <p>Danke für deine Registrierung bei Revio. Tippe auf den Button, um dein Konto in der App zu aktivieren:</p>
        <p style="margin:32px 0">
          <a href="${verifyLink}"
             style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;
                    text-decoration:none;font-weight:600;font-size:16px">
            E-Mail bestätigen
          </a>
        </p>
        ${fallbackSection}
        <p style="color:#6b7280;font-size:13px;margin-top:16px">
          Dieser Link ist 48 Stunden gültig. Wenn du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0"/>
        <p style="color:#9ca3af;font-size:12px">Revio · revioclub.app@gmail.com</p>
      </div>
    `,
    text: `Hallo ${name},\n\nBitte bestätige deine E-Mail-Adresse:\n${verifyLink}\n\n${browserFallbackLink ? `Alternativ im Browser: ${browserFallbackLink}\n\n` : ''}Dieser Link ist 48 Stunden gültig.`,
  });
}

export async function sendProfileApprovedEmail(opts: {
  to: string;
  name: string;
}) {
  const { to, name } = opts;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Revio – Dein Profil wurde freigegeben ✓',
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1a1a1a">
        <h2 style="color:#16a34a">Profil freigegeben</h2>
        <p>Hallo ${name},</p>
        <p>
          Gute Neuigkeiten! Dein Therapeutenprofil auf Revio wurde geprüft und
          <strong>freigegeben</strong>. Du bist jetzt für Patienten sichtbar.
        </p>
        <p style="color:#6b7280;font-size:13px">
          Melde dich in der App an, um dein Profil zu verwalten.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0"/>
        <p style="color:#9ca3af;font-size:12px">Revio · revioclub.app@gmail.com</p>
      </div>
    `,
    text: `Hallo ${name},\n\nDein Therapeutenprofil auf Revio wurde geprüft und freigegeben. Du bist jetzt für Patienten sichtbar.\n\nMelde dich in der App an, um dein Profil zu verwalten.`,
  });
}

export async function sendProfileRejectedEmail(opts: {
  to: string;
  name: string;
}) {
  const { to, name } = opts;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Revio – Dein Profil wurde nicht freigegeben',
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1a1a1a">
        <h2 style="color:#dc2626">Profil nicht freigegeben</h2>
        <p>Hallo ${name},</p>
        <p>
          Dein Therapeutenprofil auf Revio konnte leider nicht freigegeben werden.
        </p>
        <p>
          Bitte kontaktiere uns unter
          <a href="mailto:revioclub.app@gmail.com" style="color:#2563eb">revioclub.app@gmail.com</a>,
          wenn du Fragen hast oder weitere Informationen benötigst.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0"/>
        <p style="color:#9ca3af;font-size:12px">Revio · revioclub.app@gmail.com</p>
      </div>
    `,
    text: `Hallo ${name},\n\nDein Therapeutenprofil auf Revio konnte leider nicht freigegeben werden.\n\nBitte kontaktiere uns unter revioclub.app@gmail.com, wenn du Fragen hast.`,
  });
}

export async function sendProfileChangesRequestedEmail(opts: {
  to: string;
  name: string;
}) {
  const { to, name } = opts;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Revio – Änderungen an deinem Profil erforderlich',
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1a1a1a">
        <h2 style="color:#d97706">Änderungen erforderlich</h2>
        <p>Hallo ${name},</p>
        <p>
          Bei der Prüfung deines Therapeutenprofils auf Revio wurden Änderungen festgestellt,
          die vor der Freigabe korrigiert werden müssen.
        </p>
        <p>
          Bitte melde dich in der App an, aktualisiere dein Profil und reiche es erneut ein.
          Bei Fragen erreichst du uns unter
          <a href="mailto:revioclub.app@gmail.com" style="color:#2563eb">revioclub.app@gmail.com</a>.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0"/>
        <p style="color:#9ca3af;font-size:12px">Revio · revioclub.app@gmail.com</p>
      </div>
    `,
    text: `Hallo ${name},\n\nBei der Prüfung deines Therapeutenprofils auf Revio wurden Änderungen festgestellt, die vor der Freigabe korrigiert werden müssen.\n\nBitte melde dich in der App an, aktualisiere dein Profil und reiche es erneut ein. Bei Fragen: revioclub.app@gmail.com`,
  });
}

export async function sendReinviteEmail(opts: {
  to: string;
  therapistName: string;
  practiceName: string;
  inviteLink: string;
}) {
  const { to, therapistName, practiceName, inviteLink } = opts;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Neue Einladung von ${practiceName} – Revio`,
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1a1a1a">
        <h2 style="color:#2563eb">Neue Einladung</h2>
        <p>Hallo ${therapistName},</p>
        <p>
          <strong>${practiceName}</strong> hat dir eine neue Einladung geschickt.
          Dein vorheriger Link ist nicht mehr gültig.
        </p>
        <p style="margin:32px 0">
          <a href="${inviteLink}"
             style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;
                    text-decoration:none;font-weight:600;font-size:16px">
            Profil aktivieren
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">
          Dieser Link ist 7 Tage gültig.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0"/>
        <p style="color:#9ca3af;font-size:12px">Revio · revioclub.app@gmail.com</p>
      </div>
    `,
    text: `Hallo ${therapistName},\n\n${practiceName} hat dir eine neue Einladung geschickt.\n\nKlicke hier:\n${inviteLink}\n\nDieser Link ist 7 Tage gültig.`,
  });
}
