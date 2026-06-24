// Tone: 'positive' | 'negative' | 'pending' | 'info' | 'neutral'
const TYPE_META = {
  BOOKING_CONFIRMED:         { icon: 'checkmark-circle',      tone: 'positive', title: 'Termin bestätigt' },
  PROFILE_APPROVED:          { icon: 'checkmark-circle',      tone: 'positive', title: 'Profil freigegeben' },
  BOOKING_DECLINED:          { icon: 'close-circle',          tone: 'negative', title: 'Terminanfrage abgelehnt' },
  PROFILE_REJECTED:          { icon: 'close-circle',          tone: 'negative', title: 'Profil nicht freigegeben' },
  PROFILE_SUSPENDED:         { icon: 'pause-circle',          tone: 'negative', title: 'Profil pausiert' },
  BOOKING_CANCELLED:         { icon: 'calendar-clear-outline', tone: 'neutral', title: 'Termin abgesagt' },
  NEW_BOOKING_REQUEST:       { icon: 'calendar',              tone: 'pending',  title: 'Neue Terminanfrage' },
  PROFILE_CHANGES_REQUESTED: { icon: 'create-outline',        tone: 'info',     title: 'Änderungen angefordert' },
  JOIN_REQUEST:              { icon: 'person-add-outline',    tone: 'info',     title: 'Beitrittsanfrage' },
  INVITE:                    { icon: 'mail-outline',          tone: 'info',     title: 'Einladung' },
};

const FALLBACK = { icon: 'notifications-outline', tone: 'neutral', title: 'Mitteilung' };

export function getNotificationPresentation(type, c) {
  const meta = TYPE_META[type] ?? FALLBACK;

  switch (meta.tone) {
    case 'positive':
      return {
        icon: meta.icon,
        title: meta.title,
        tone: 'positive',
        iconColor: c.success ?? '#16a34a',
        iconBg: c.successBg ?? '#f0fdf4',
        iconBorder: (c.success ?? '#16a34a') + '28',
      };
    case 'negative':
      return {
        icon: meta.icon,
        title: meta.title,
        tone: 'negative',
        iconColor: c.error ?? '#dc2626',
        iconBg: '#fef2f2',
        iconBorder: '#fca5a530',
      };
    case 'pending':
      return {
        icon: meta.icon,
        title: meta.title,
        tone: 'pending',
        iconColor: c.warning ?? '#d97706',
        iconBg: '#fffbeb',
        iconBorder: '#fde68a50',
      };
    case 'info':
      return {
        icon: meta.icon,
        title: meta.title,
        tone: 'info',
        iconColor: c.primary,
        iconBg: c.primaryBg ?? '#eff6ff',
        iconBorder: c.primary + '28',
      };
    default:
      return {
        icon: meta.icon,
        title: meta.title,
        tone: 'neutral',
        iconColor: c.muted,
        iconBg: c.card,
        iconBorder: c.border,
      };
  }
}
