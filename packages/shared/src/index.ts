// ─── Status Enums ────────────────────────────────────────────────────────────

export type ReviewStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'
  | 'SUSPENDED';

export type LinkStatus = 'PROPOSED' | 'CONFIRMED' | 'DISPUTED' | 'REJECTED';

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface Therapist {
  id: string;
  email: string;
  fullName: string;
  professionalTitle: string;
  specializations: string[];
  languages: string[];
  certifications: string[];
  homeVisit: boolean;
  city: string;
  bio?: string;
  reviewStatus: ReviewStatus;
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
  city: string;
  language?: string;
  homeVisit?: boolean;
  specialization?: string;
}

export interface SearchPractice {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
}

export interface SearchTherapist {
  id: string;
  fullName: string;
  professionalTitle: string;
  specializations: string[];
  languages: string[];
  homeVisit: boolean;
  city: string;
  bio?: string;
  relevance: number;
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

export interface TherapistWithLinks extends Therapist {
  links: Array<{
    id: string;
    status: LinkStatus;
    practice: Practice;
  }>;
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
