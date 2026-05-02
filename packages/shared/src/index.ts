// ─── Status Enums ────────────────────────────────────────────────────────────

export type ReviewStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'
  | 'SUSPENDED';

export type LinkStatus = 'PROPOSED' | 'CONFIRMED' | 'DISPUTED' | 'REJECTED';
export type ComplianceStatus = 'yes' | 'no' | 'in_progress';
export type HealthAuthorityStatus = ComplianceStatus | 'unknown';
export type TherapistProfileStatus = 'draft' | 'incomplete' | 'ready_for_review';
export type LocationPrecision = 'exact' | 'approximate';

export interface TherapistCompliance<TDate = string> {
  taxRegistrationStatus?: ComplianceStatus | null;
  healthAuthorityStatus?: HealthAuthorityStatus | null;
  updatedAt?: TDate | null;
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
  postalCode?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  locationPrecision?: LocationPrecision | null;
  latitude?: number | null;
  longitude?: number | null;
  bio?: string;
  reviewStatus: ReviewStatus;
  gender?: 'female' | 'male' | null;
  isVisible: boolean;
  isPublished: boolean;
  onboardingStatus: string | null;
  compliance?: TherapistCompliance | null;
  profileStatus?: TherapistProfileStatus;
  createdAt: string;
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
  gender?: 'female' | 'male';
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
  postalCode?: string;
  street?: string;
  houseNumber?: string;
  locationPrecision?: LocationPrecision;
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
