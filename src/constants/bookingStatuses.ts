/**
 * Shared Consultation Booking Status Constants
 * Single source of truth for booking status strings across Client, Expert, and Admin portals.
 */

export const BOOKING_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  LIVE: 'live',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export type BookingStatus = typeof BOOKING_STATUS[keyof typeof BOOKING_STATUS];

/**
 * Normalizes any legacy or variant status string into canonical BookingStatus.
 */
export function normalizeBookingStatus(rawStatus?: string | null): BookingStatus {
  if (!rawStatus) return BOOKING_STATUS.PENDING;
  const s = rawStatus.toLowerCase().trim();

  if (s.includes('live')) return BOOKING_STATUS.LIVE;
  if (s.includes('complete')) return BOOKING_STATUS.COMPLETED;
  if (s.includes('reject') || s.includes('decline')) return BOOKING_STATUS.REJECTED;
  if (s.includes('accept') || s.includes('confirm')) return BOOKING_STATUS.ACCEPTED;
  if (s.includes('cancel')) return BOOKING_STATUS.CANCELLED;
  if (s.includes('pending')) return BOOKING_STATUS.PENDING;

  return BOOKING_STATUS.PENDING;
}

/**
 * Display metadata for badges across Client, Expert, and Admin portals.
 */
export const BOOKING_STATUS_CONFIG: Record<
  BookingStatus,
  {
    label: string;
    clientBadge: string;
    expertBadge: string;
    adminBadge: string;
    color: string;
  }
> = {
  [BOOKING_STATUS.PENDING]: {
    label: 'Pending Expert Acceptance',
    clientBadge: 'Pending Expert Acceptance',
    expertBadge: 'Pending Request',
    adminBadge: 'Pending Expert Acceptance',
    color: 'amber'
  },
  [BOOKING_STATUS.ACCEPTED]: {
    label: 'Accepted - Awaiting Meet Link',
    clientBadge: 'Accepted by Expert',
    expertBadge: 'Accepted - Ready to Schedule',
    adminBadge: 'Confirmed - Scheduled',
    color: 'emerald'
  },
  [BOOKING_STATUS.LIVE]: {
    label: 'Live Meeting Now',
    clientBadge: 'Live - In Progress',
    expertBadge: 'Live Session',
    adminBadge: 'Live Meeting',
    color: 'rose'
  },
  [BOOKING_STATUS.REJECTED]: {
    label: 'Declined by Expert',
    clientBadge: 'Declined by Expert',
    expertBadge: 'Declined',
    adminBadge: 'Declined by Expert',
    color: 'rose'
  },
  [BOOKING_STATUS.COMPLETED]: {
    label: 'Completed',
    clientBadge: 'Completed',
    expertBadge: 'Session Completed',
    adminBadge: 'Completed',
    color: 'emerald'
  },
  [BOOKING_STATUS.CANCELLED]: {
    label: 'Cancelled',
    clientBadge: 'Cancelled',
    expertBadge: 'Cancelled',
    adminBadge: 'Cancelled',
    color: 'slate'
  }
};
