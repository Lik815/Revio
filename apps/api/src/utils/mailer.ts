import { Resend } from 'resend';

const FROM = 'Revio <revioclub.app@gmail.com>';

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
