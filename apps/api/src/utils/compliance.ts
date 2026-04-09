import type {
  ComplianceStatus,
  HealthAuthorityStatus,
  TherapistCompliance,
} from '@revio/shared';

export const COMPLIANCE_STATUS_VALUES = ['yes', 'no', 'in_progress'] as const;
export const HEALTH_AUTHORITY_STATUS_VALUES = ['yes', 'no', 'in_progress', 'unknown'] as const;

type TherapistComplianceLike = {
  taxRegistrationStatus?: string | null;
  healthAuthorityStatus?: string | null;
  complianceUpdatedAt?: Date | string | null;
};

export function getTherapistCompliance(
  therapist: TherapistComplianceLike,
): TherapistCompliance<Date> {
  const taxRegistrationStatus = COMPLIANCE_STATUS_VALUES.includes(
    therapist.taxRegistrationStatus as ComplianceStatus,
  )
    ? therapist.taxRegistrationStatus as ComplianceStatus
    : null;
  const healthAuthorityStatus = HEALTH_AUTHORITY_STATUS_VALUES.includes(
    therapist.healthAuthorityStatus as HealthAuthorityStatus,
  )
    ? therapist.healthAuthorityStatus as HealthAuthorityStatus
    : null;

  return {
    taxRegistrationStatus,
    healthAuthorityStatus,
    updatedAt: therapist.complianceUpdatedAt ? new Date(therapist.complianceUpdatedAt) : null,
  };
}

export function buildComplianceUpdateData(input: {
  taxRegistrationStatus?: ComplianceStatus | null;
  healthAuthorityStatus?: HealthAuthorityStatus | null;
}) {
  const updateData: Record<string, ComplianceStatus | HealthAuthorityStatus | Date | null> = {};

  if ('taxRegistrationStatus' in input) {
    updateData.taxRegistrationStatus = input.taxRegistrationStatus ?? null;
  }
  if ('healthAuthorityStatus' in input) {
    updateData.healthAuthorityStatus = input.healthAuthorityStatus ?? null;
  }
  if ('taxRegistrationStatus' in input || 'healthAuthorityStatus' in input) {
    updateData.complianceUpdatedAt = new Date();
  }

  return updateData;
}
