// ─── Compliance ───────────────────────────────────────────────────────────────

export type ComplianceStatus = 'yes' | 'no' | 'in_progress';
export type HealthAuthorityStatus = 'yes' | 'no' | 'in_progress' | 'unknown';

export interface TherapistCompliance<T = Date> {
  taxRegistrationStatus: ComplianceStatus | null;
  healthAuthorityStatus: HealthAuthorityStatus | null;
  updatedAt: T | null;
}

export type TherapistProfileStatus = 'draft' | 'incomplete' | 'ready_for_review';

// ─── Status Enums ────────────────────────────────────────────────────────────

export type ReviewStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'
  | 'SUSPENDED';

export type EmploymentStatus = 'SELF_EMPLOYED' | 'PREPARING';

export type LinkStatus = 'PROPOSED' | 'CONFIRMED' | 'DISPUTED' | 'REJECTED';

export type BookingMode = 'DIRECTORY_ONLY' | 'FIRST_APPOINTMENT_REQUEST';

export type BookingRequestStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export type AppFeedbackStatus = 'NEW' | 'RESOLVED';

export interface AppFeedback {
  id: string;
  email: string;
  message: string;
  status: AppFeedbackStatus;
  isAuthenticated: boolean;
  createdAt: string;
  updatedAt: string;
  userId?: string | null;
}

// Recurring weekly working hours ("Arbeitszeiten"). See
// docs/claude-therapist-working-hours-plan.md for the full design. One rule
// covers a single contiguous time block on a single weekday — a weekday with
// a lunch gap is two rules with the same weekday, not a different shape.
export interface TherapistWorkingHoursRule {
  id: string;
  weekday: number; // 0-6, JS Date#getDay() convention (0=So..6=Sa)
  startMinute: number;
  endMinute: number;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  isActive: boolean;
}

export interface TherapistWorkingHoursRuleInput {
  weekday: number;
  startMinute: number;
  endMinute: number;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  isActive?: boolean;
}

export interface PutWorkingHoursResponse {
  rules: TherapistWorkingHoursRule[];
}

export interface BookingRequest {
  id: string;
  therapistId: string;
  status: BookingRequestStatus;
  patientName: string;
  patientEmail?: string | null;
  patientPhone?: string | null;
  message?: string | null;
  heilmittel?: string | null;
  kassenart?: string | null;
  cancelReason?: string | null;
  cancelledBy?: 'PATIENT' | 'THERAPIST' | null;
  cancelledAt?: string | null;
  // Zeitfenster des Termins (dynamisches Buchungssystem).
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  responseDueAt: string;
  respondedAt?: string | null;
  confirmedSlotAt?: string | null;
}

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface Therapist {
  id: string;
  email: string;
  fullName: string;
  professionalTitle: string;
  gender?: string | null;
  isFreelancer: boolean;
  specializations: string[];
  languages: string[];
  certifications: string[];
  heilmittel: string[];
  homeVisit: boolean;
  serviceRadiusKm?: number | null;
  kassenart: string;
  city: string;
  bio?: string;
  reviewStatus: ReviewStatus;
  employmentStatus: EmploymentStatus;
  isVisible: boolean;
  isPublished: boolean;
  onboardingStatus: string | null;
  createdAt: string;
  bookingMode?: BookingMode;
  nextFreeSlotAt?: string | null;
}

export interface Practice {
  id: string;
  name: string;
  city: string;
  address?: string;
  phone?: string;
  lat: number;
  lng: number;
  reviewStatus: ReviewStatus;
  createdAt: string;
}

export interface TherapistPracticeLink {
  id: string;
  therapistId: string;
  practiceId: string;
  status: LinkStatus;
  createdAt: string;
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchInput {
  query: string;
  city?: string;
  origin?: {
    lat: number;
    lng: number;
  };
  radiusKm?: number;
  language?: string;
  homeVisit?: boolean;
  specialization?: string;
  heilmittel?: string;
  kassenart?: string;
}

export interface SearchPractice {
  id: string;
  name: string;
  city: string;
  address?: string;
  phone?: string;
  hours?: string;
  description?: string;
  lat: number;
  lng: number;
  distKm?: number;
  logo?: string;
  photos?: string[];
}

export interface SearchTherapist {
  id: string;
  fullName: string;
  professionalTitle: string;
  isFreelancer: boolean;
  specializations: string[];
  languages: string[];
  certifications: string[];
  heilmittel: string[];
  kassenart: string;
  availability?: string;
  homeVisit: boolean;
  serviceRadiusKm?: number | null;
  homeLat?: number;
  homeLng?: number;
  city: string;
  bio?: string;
  email?: string;
  photo?: string;
  relevance: number;
  distKm?: number;
  practices: SearchPractice[];
  bookingMode?: BookingMode;
  requestable?: boolean;
  nextFreeSlotAt?: string | null;
  cityMatch?: boolean;
  radiusMatch?: boolean;
}

export interface SearchResponse {
  therapists: SearchTherapist[];
  practices: SearchPractice[];
  meta: { note: string };
}

// ─── Registration ─────────────────────────────────────────────────────────────

export interface TherapistRegistrationInput {
  email: string;
  fullName: string;
  professionalTitle: string;
  city: string;
  bio?: string;
  homeVisit: boolean;
  specializations: string[];
  languages: string[];
  certifications: string[];
  practice: {
    name: string;
    city: string;
    address?: string;
    phone?: string;
  };
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  therapists: {
    draft: number;
    pending_review: number;
    approved: number;
    rejected: number;
    changes_requested: number;
    suspended: number;
  };
  practices: {
    draft: number;
    pending_review: number;
    approved: number;
    rejected: number;
    changes_requested: number;
    suspended: number;
  };
  links: {
    proposed: number;
    confirmed: number;
    disputed: number;
    rejected: number;
  };
}

export type VisibilityState = 'not_approved' | 'blocked' | 'visible';

export interface TherapistVisibility {
  visibilityState: VisibilityState;
  publicSearchEligible: boolean;
  blockingReasons: string[];
}

export interface TherapistWithLinks extends Therapist {
  links: Array<{
    id: string;
    status: LinkStatus;
    practice: Practice;
  }>;
  visibility: TherapistVisibility;
}

export interface PracticeWithLinks extends Practice {
  links: Array<{
    id: string;
    status: LinkStatus;
    therapist: Therapist;
  }>;
}

export interface LinkWithEntities extends TherapistPracticeLink {
  therapist: Pick<Therapist, 'id' | 'fullName' | 'professionalTitle'>;
  practice: Pick<Practice, 'id' | 'name' | 'city'>;
}

export type TherapistReviewStatus = 'PUBLISHED' | 'HIDDEN' | 'REPORTED';

export interface TherapistReview<T = Date> {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: T;
  patientName: string;
}

export interface TherapistReviewSummary {
  avgRating: number | null;
  count: number;
}

export interface ReviewEligibility {
  eligible: boolean;
  alreadyReviewed: boolean;
  bookingId?: string;
  review?: { rating: number; comment?: string | null };
}

// ─── Therapist-Patient Relationship ───────────────────────────────────────────

export interface TherapistPatientListItem {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  addressLine?: string | null;
  bookingCount: number;
  lastBookingAt: string;
  nextAppointmentAt?: string | null;
  lastStatus?: BookingRequestStatus | null;
}

export interface TherapistPatientAppointment {
  id: string;
  status: BookingRequestStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  confirmedSlotAt?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  message?: string | null;
  heilmittel?: string | null;
  kassenart?: string | null;
  declinedReason?: string | null;
  cancelReason?: string | null;
}

export interface TherapistPatientDetail {
  patient: TherapistPatientListItem;
  appointments: TherapistPatientAppointment[];
}

// ─── Dynamisches Buchungssystem ───────────────────────────────────────────────

// Ein live berechnetes, nicht gespeichertes Zeitfenster für eine Leistung.
export interface AvailableSlot {
  startsAt: string; // ISO-8601
  endsAt: string;   // ISO-8601
}

// Therapeutenspezifische Leistungskonfiguration (Dauer-Override pro Heilmittel).
export interface TherapistService {
  id: string;
  therapistId: string;
  heilmittelKey: string;
  durationMin: number;
  bufferAfterMin: number;
  slotIntervalMin: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Neutrale Blockzeit (Pause, Hausbesuch, Urlaub, …).
export interface TherapistBlockedTime {
  id: string;
  therapistId: string;
  startsAt: string;
  endsAt: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetTherapistServicesResponse {
  services: TherapistService[];
}

export interface PutTherapistServiceInput {
  durationMin: number;
  bufferAfterMin?: number;
  slotIntervalMin?: number | null;
  isActive?: boolean;
}

export interface GetBlockedTimesResponse {
  blockedTimes: TherapistBlockedTime[];
}

export interface CreateBlockedTimeInput {
  startsAt: string;
  endsAt: string;
  title?: string;
}

export interface GetAvailableSlotsResponse {
  slots: AvailableSlot[];
}
