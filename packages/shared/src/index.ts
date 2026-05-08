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

export type LinkStatus = 'PROPOSED' | 'CONFIRMED' | 'DISPUTED' | 'REJECTED';

export type BookingMode = 'DIRECTORY_ONLY' | 'FIRST_APPOINTMENT_REQUEST';

export type BookingRequestStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export type SlotStatus = 'AVAILABLE' | 'BOOKED' | 'CANCELLED';

export interface TherapistSlot {
  id: string;
  therapistId: string;
  startsAt: string;
  durationMin: number;
  status: SlotStatus;
  bookingId?: string | null;
  createdAt: string;
}

export interface BookingRequest {
  id: string;
  therapistId: string;
  slotId?: string | null;
  slot?: {
    id: string;
    startsAt: string;
    durationMin: number;
    status: SlotStatus;
  } | null;
  status: BookingRequestStatus;
  patientName: string;
  patientEmail?: string | null;
  patientPhone?: string | null;
  message?: string | null;
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
  isFreelancer: boolean;
  specializations: string[];
  languages: string[];
  certifications: string[];
  homeVisit: boolean;
  serviceRadiusKm?: number | null;
  kassenart: string;
  city: string;
  bio?: string;
  reviewStatus: ReviewStatus;
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
