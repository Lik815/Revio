// Tone: 'positive' | 'negative' | 'pending' | 'info' | 'neutral'
const TYPE_META = {
  BOOKING_CONFIRMED:         { icon: 'checkmark-circle',      tone: 'positive' },
  PROFILE_APPROVED:          { icon: 'checkmark-circle',      tone: 'positive' },
  BOOKING_DECLINED:          { icon: 'close-circle',          tone: 'negative' },
  PROFILE_REJECTED:          { icon: 'close-circle',          tone: 'negative' },
  PROFILE_SUSPENDED:         { icon: 'pause-circle',          tone: 'negative' },
  BOOKING_CANCELLED:         { icon: 'calendar-clear-outline', tone: 'neutral' },
  NEW_BOOKING_REQUEST:       { icon: 'calendar',              tone: 'pending'  },
  PROFILE_CHANGES_REQUESTED: { icon: 'create-outline',        tone: 'info'     },
  JOIN_REQUEST:              { icon: 'person-add-outline',    tone: 'info'     },
  INVITE:                    { icon: 'mail-outline',          tone: 'info'     },
};

const FALLBACK = { icon: 'notifications-outline', tone: 'neutral' };

export function getNotificationPresentation(type, c) {
  const meta = TYPE_META[type] ?? FALLBACK;

  switch (meta.tone) {
    case 'positive':
      return {
        icon: meta.icon,
        tone: 'positive',
        iconColor: c.success ?? '#16a34a',
        iconBg: c.successBg ?? '#f0fdf4',
        iconBorder: (c.success ?? '#16a34a') + '28',
      };
    case 'negative':
      return {
        icon: meta.icon,
        tone: 'negative',
        iconColor: c.error ?? '#dc2626',
        iconBg: '#fef2f2',
        iconBorder: '#fca5a530',
      };
    case 'pending':
      return {
        icon: meta.icon,
        tone: 'pending',
        iconColor: c.warning ?? '#d97706',
        iconBg: '#fffbeb',
        iconBorder: '#fde68a50',
      };
    case 'info':
      return {
        icon: meta.icon,
        tone: 'info',
        iconColor: c.primary,
        iconBg: c.primaryBg ?? '#eff6ff',
        iconBorder: c.primary + '28',
      };
    default:
      return {
        icon: meta.icon,
        tone: 'neutral',
        iconColor: c.muted,
        iconBg: c.card,
        iconBorder: c.border,
      };
  }
}
