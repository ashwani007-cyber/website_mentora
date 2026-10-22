// Verification Status Constants - Single Source of Truth
export const VERIFICATION_STATUS = {
  PENDING_VERIFICATION: 'pending_verification',
  PENDING_AUDIT: 'pending_audit',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected'
} as const;

export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];
