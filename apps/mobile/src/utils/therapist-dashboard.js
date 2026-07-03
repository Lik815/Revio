import { computeDayPeriods } from './app-utils';

export function getTodayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function getBookingStart(booking) {
  const raw = booking?.startsAt ?? booking?.confirmedSlotAt ?? booking?.slot?.startsAt ?? null;
  return raw ? new Date(raw) : null;
}

export function getBookingEnd(booking) {
  if (booking?.endsAt) return new Date(booking.endsAt);
  const start = getBookingStart(booking);
  if (!start) return null;
  const dur = booking?.slot?.durationMin ?? 20;
  return new Date(start.getTime() + dur * 60_000);
}

export function getTodayBookings(bookings, date = new Date()) {
  if (!Array.isArray(bookings)) return [];
  const { start, end } = getTodayRange(date);
  return bookings.filter((b) => {
    if (!['CONFIRMED', 'PENDING'].includes(b?.status)) return false;
    const s = getBookingStart(b);
    return s && s >= start && s <= end;
  });
}

export function getNextTherapistBooking(bookings, now = new Date()) {
  if (!Array.isArray(bookings)) return null;
  const candidates = bookings
    .filter((b) => b?.status === 'CONFIRMED' && getBookingStart(b) >= now)
    .sort((a, b) => getBookingStart(a) - getBookingStart(b));
  return candidates[0] ?? null;
}

export function isBookingActive(booking, now = new Date()) {
  const start = getBookingStart(booking);
  const end = getBookingEnd(booking);
  if (!start || !end) return false;
  return now >= start && now < end;
}

export function getBookingProgress(booking, now = new Date()) {
  const start = getBookingStart(booking);
  const end = getBookingEnd(booking);
  if (!start || !end) return 0;
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / total));
}

export function getBookingRemainingMs(booking, now = new Date()) {
  const end = getBookingEnd(booking);
  if (!end) return 0;
  return Math.max(0, end.getTime() - now.getTime());
}

export function formatDuration(ms) {
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h} Std. ${m} Min.`;
  if (h > 0) return `${h} Std.`;
  return `${m} Min.`;
}

export function getNextDayBookingAfter(dayBookings, currentBooking) {
  const currentStart = getBookingStart(currentBooking);
  if (!currentStart) return null;
  const sorted = [...dayBookings]
    .filter((b) => b.id !== currentBooking.id && b.status === 'CONFIRMED')
    .sort((a, b) => (getBookingStart(a)?.getTime() ?? 0) - (getBookingStart(b)?.getTime() ?? 0));
  return sorted.find((b) => {
    const s = getBookingStart(b);
    return s && s > currentStart;
  }) ?? null;
}

export function computeTherapistDashboardStats({
  bookings = [],
  workingHoursRules = [],
  blockedTimes = [],
  date = new Date(),
}) {
  const todayBookings = getTodayBookings(bookings, date);
  const confirmedToday = todayBookings.filter((b) => b.status === 'CONFIRMED');
  const pendingToday = todayBookings.filter((b) => b.status === 'PENDING');
  const nextBooking = getNextTherapistBooking(bookings, date);

  const periods = computeDayPeriods(workingHoursRules, blockedTimes, bookings, date);

  const minutesOf = (kind) =>
    periods
      .filter((p) => p.kind === kind)
      .reduce((sum, p) => {
        const ms = new Date(p.endsAt) - new Date(p.startsAt);
        return sum + Math.max(0, ms / 60_000);
      }, 0);

  const workingMinutes = periods.reduce((sum, p) => {
    const ms = new Date(p.endsAt) - new Date(p.startsAt);
    return sum + Math.max(0, ms / 60_000);
  }, 0);

  const bookedMinutes = minutesOf('booked');
  const requestedMinutes = minutesOf('requested');
  const blockedMinutes = minutesOf('blocked');
  const freeMinutes = minutesOf('free');

  const utilizationPercent = workingMinutes > 0
    ? Math.round((bookedMinutes / workingMinutes) * 100)
    : 0;

  return {
    confirmedToday,
    pendingToday,
    nextBooking,
    periods,
    workingMinutes,
    bookedMinutes,
    requestedMinutes,
    blockedMinutes,
    freeMinutes,
    utilizationPercent,
  };
}
