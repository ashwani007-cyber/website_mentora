export type UserRole = 'client' | 'professional' | 'admin';

export type DomainCategory = 
  | 'All'
  | 'Finance & Audit'
  | 'Finance & Taxation'
  | 'HR & Talent'
  | 'Tech & Digital'
  | 'Marketing & Growth'
  | 'Marketing Strategy'
  | 'Legal & Compliance'
  | 'Operations & Logistics'
  | 'Teaching & Academia'
  | 'School Mathematics'
  | 'Manufacturing Ops'
  | (string & {});

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  exCompany?: string;
  yearsOfExperience?: number;
  domain?: DomainCategory;
  hourlyRate?: number;
  isVerified?: boolean;
}

export interface RetiredProfessional {
  id: string;
  name: string;
  title: string;
  exCompany: string;
  exRole: string;
  yearsOfExperience: number;
  domain: DomainCategory;
  location: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  projectRate?: number;
  avatarUrl: string;
  isVerified: boolean;
  isSponsored?: boolean;
  bio: string;
  skills: string[];
  languages: string[];
  badges: string[];
  videoIntroUrl?: string;
  availableDays: string[];
  totalSessionsCompleted: number;
  featuredQuote: string;
}

export interface Booking {
  id: string;
  expertId: string;
  expertName: string;
  expertAvatar: string;
  expertTitle: string;
  clientName: string;
  serviceType: '1-on-1 Advisory' | 'Project Consultation' | 'Monthly Mentorship';
  date: string;
  timeSlot: string;
  topic: string;
  amount: number;
  commission: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  meetingRoomId: string;
  notes?: string;
}

export interface TrainingCourse {
  id: string;
  title: string;
  targetAudience: 'Seniors/Pros' | 'Clients';
  category: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  price: number;
  thumbnail: string;
  description: string;
  modulesCount: number;
  enrolledCount: number;
  rating: number;
  skillsLearned: string[];
}

export interface RehiredStory {
  id: string;
  name: string;
  age: number;
  formerRole: string;
  newRole: string;
  companyImpact: string;
  quote: string;
  fullStory: string;
  location: string;
  imageUrl: string;
  domain: string;
}

export interface WalletTransaction {
  id: string;
  date: string;
  type: 'deposit' | 'booking_payment' | 'payout' | 'subscription_fee' | 'commission_cut';
  amount: number;
  description: string;
  status: 'completed' | 'pending';
}

export interface SubscriptionTier {
  id: string;
  name: string;
  userType: 'professional' | 'client';
  priceMonthly: number;
  features: string[];
  badge?: string;
  isPopular?: boolean;
}

export interface AIMatchResult {
  expert: RetiredProfessional;
  matchPercentage: number;
  reason: string;
  recommendedService: string;
}

export interface ReviewItem {
  id: string;
  clientName: string;
  clientAvatar?: string;
  expertName: string;
  expertEmail?: string;
  rating: number;
  comment: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  visibleToExpert: boolean;
  featuredOnLanding: boolean;
}

export type NotificationTarget = 'all' | 'client' | 'expert' | 'admin' | 'landing';
export type NotificationType = 'booking' | 'session' | 'review' | 'verification' | 'wallet' | 'announcement' | 'system' | 'message' | 'payment';
export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms';
export type NotificationDeliveryStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export type NotificationEventName =
  | 'client_registered'
  | 'expert_registered'
  | 'booking_created'
  | 'booking_accepted'
  | 'booking_rejected'
  | 'consultant_request_sent'
  | 'request_accepted'
  | 'request_declined'
  | 'meeting_scheduled'
  | 'meeting_rescheduled'
  | 'meeting_cancelled'
  | 'meeting_link_generated'
  | 'meet_link_sent'
  | 'session_reminder_24h'
  | 'session_reminder_1h'
  | 'session_reminder_15m'
  | 'new_message'
  | 'payment_successful'
  | 'payment_success'
  | 'payment_failed'
  | 'expert_approved'
  | 'expert_rejected'
  | 'expert_kyc_approved'
  | 'expert_kyc_rejected'
  | 'session_completed'
  | 'feedback_request'
  | 'review_submitted'
  | 'platform_broadcast'
  | 'custom_announcement';

export interface AppNotification {
  id: string;
  senderId?: string;
  target: NotificationTarget;
  recipientId?: string; // specific user email or expert name if not 'all'
  recipientName?: string;
  recipientType?: NotificationTarget;
  audienceType?: 'all' | 'client' | 'expert' | 'landing' | 'admin' | 'custom';
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  status?: NotificationDeliveryStatus;
  createdAt?: string;
  actionLink?: string;
  channel?: NotificationChannel;
  channels?: NotificationChannel[];
  eventId?: string;
  eventName?: NotificationEventName;
  deliveredAt?: string;
  readAt?: string;
  relatedEntityId?: string;
  metadata?: Record<string, any>;
}

export interface NotificationRule {
  id: string;
  eventName: NotificationEventName;
  title: string;
  description: string;
  recipientTypes: ('client' | 'expert' | 'admin' | 'landing')[];
  channels: NotificationChannel[];
  templateId: string;
  enabled: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  delayMinutes?: number;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  eventName: NotificationEventName;
  subject: string;
  titleTemplate: string;
  bodyTemplate: string;
  variables: string[];
  category: 'booking' | 'session' | 'account' | 'payment' | 'system';
}

export interface NotificationLog {
  id: string;
  eventId?: string;
  eventName: NotificationEventName | string;
  recipientId: string;
  recipientName?: string;
  recipientType: 'client' | 'expert' | 'admin' | 'landing' | 'all';
  channel: NotificationChannel;
  title: string;
  message: string;
  status: NotificationDeliveryStatus;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface ScheduledNotification {
  id: string;
  eventId?: string;
  eventName: NotificationEventName | string;
  title: string;
  message: string;
  recipientType: 'all' | 'client' | 'expert' | 'admin' | 'landing' | 'custom';
  recipientId?: string;
  channels: NotificationChannel[];
  scheduledTime: string;
  status: 'scheduled' | 'processing' | 'completed' | 'cancelled';
  createdAt: string;
  templateId?: string;
  payload?: Record<string, any>;
}

export interface UserNotificationPreferences {
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
  bookingAlerts: boolean; // critical - always true
  meetingReminders: boolean; // critical - always true
  paymentAlerts: boolean; // critical - always true
  messageAlerts: boolean;
  marketingAnnouncements: boolean;
  quietHoursEnabled?: boolean;
}

export type AvailabilityStatus = 'AVAILABLE' | 'BOOKED' | 'DISABLED';

export interface ExpertAvailability {
  id: string;
  expertId: string;
  availabilityDate: string; // YYYY-MM-DD
  startTime: string; // e.g. "10:00 AM" or "10:00"
  endTime: string; // e.g. "11:00 AM" or "11:00"
  status: AvailabilityStatus;
  bookingId?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Dedicated Project Review Workflow Types (WORKFLOW B)
// -------------------------------------------------------------

export type ProjectReviewStatus =
  | 'PendingExpertAcceptance'
  | 'Accepted'
  | 'Declined'
  | 'ProjectSubmitted'
  | 'InReview'
  | 'MeetingRequested'
  | 'MeetingScheduled'
  | 'ReviewCompleted'
  | 'Completed'
  | 'Cancelled';

export type ProjectReviewPaymentStatus =
  | 'PaymentPending'
  | 'PaymentSuccessful'
  | 'PaymentFailed'
  | 'RefundPending'
  | 'Refunded';

export type ProjectReviewEarningStatus =
  | 'EarningPending'
  | 'EarningReleased'
  | 'EarningCancelled';

export type ProjectReviewMeetingStatus =
  | 'Scheduled'
  | 'Upcoming'
  | 'Started'
  | 'Completed'
  | 'Cancelled';

export interface ProjectReviewSubmissionFile {
  id: string;
  name: string;
  url: string;
  size?: string;
  fileType?: string;
  uploadedAt: string;
}

export interface ProjectReviewSubmission {
  submissionId: string;
  files: ProjectReviewSubmissionFile[];
  repositoryUrl?: string;
  demoUrl?: string;
  description: string;
  questions?: string;
  submittedAt: string;
  version: number;
}

export interface ProjectReviewChatMessage {
  id: string;
  chatId?: string;
  projectReviewId: string;
  senderId: string;
  senderRole: 'client' | 'expert' | 'admin' | 'system';
  senderName: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachmentUrl?: string;
  attachmentName?: string;
}

export interface ProjectReviewProposedTime {
  id: string;
  proposedBy: 'client' | 'expert';
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "14:00"
  endTime: string; // e.g. "15:00"
  durationMinutes?: number;
  reason?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface ProjectReviewMeeting {
  meetingId: string;
  projectReviewId: string;
  meetingNumber: number; // 1 or 2
  clientId: string;
  clientName?: string;
  expertId: string;
  expertName?: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  googleMeetLink?: string;
  meetingStatus: ProjectReviewMeetingStatus;
  createdAt: string;
  completedAt?: string;
  cancelledAt?: string;
}

export interface ProjectReviewActivity {
  activityId: string;
  projectReviewId: string;
  userId: string;
  userName: string;
  role: 'client' | 'expert' | 'admin' | 'system';
  eventType: string;
  description: string;
  previousStatus?: string;
  newStatus?: string;
  timestamp: string;
}

export interface ProjectReviewWalletTransaction {
  transactionId: string;
  projectReviewId: string;
  clientId: string;
  expertId?: string;
  amount: number;
  transactionType: 'client_payment' | 'expert_payout' | 'platform_commission' | 'refund';
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface ProjectReviewRecord {
  projectReviewId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  expertId: string;
  expertName: string;
  expertEmail: string;
  packageId: string;
  packageName: string;
  price: number;
  expertEarning: number;
  platformFee: number;
  status: ProjectReviewStatus;
  paymentStatus: ProjectReviewPaymentStatus;
  expertEarningStatus: ProjectReviewEarningStatus;
  requestNotes?: string;
  expectedScope?: string;
  reviewType?: string;
  submission?: ProjectReviewSubmission;
  chat: ProjectReviewChatMessage[];
  proposedTimes: ProjectReviewProposedTime[];
  meetings: ProjectReviewMeeting[];
  completedMeetingCount: number; // Strictly max 2
  reviewFeedback?: {
    summary: string;
    recommendations?: string[];
    strengths?: string;
    issues?: string;
    completedAt: string;
  };
  clientWalletTxId?: string;
  expertWalletTxId?: string;
  clientArchived: boolean;
  expertArchived: boolean;
  activityTimeline: ProjectReviewActivity[];
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Blogs & Articles CMS Data Models
// -------------------------------------------------------------
export type BlogContentType = 'blog' | 'article';
export type BlogContentStatus = 'draft' | 'published';

export interface BlogArticleSection {
  type: 'paragraph' | 'heading' | 'quote' | 'callout' | 'list';
  text?: string;
  items?: string[];
  quotee?: string;
}

export interface BlogArticleAuthor {
  name: string;
  role: string;
  avatar?: string;
}

export interface BlogArticleRecord {
  id: string;
  type: BlogContentType;
  title: string;
  slug: string;
  excerpt: string;
  summary?: string;
  content: string;
  category: string;
  author: BlogArticleAuthor;
  authorName?: string;
  authorRole?: string;
  coverImage: string;
  image?: string;
  readTime: string;
  status: BlogContentStatus;
  featured: boolean;
  displayOrder?: number;
  publishedAt?: string;
  date?: string;
  createdAt: string;
  updatedAt: string;
  keywords?: string[];
  keyTakeaways?: string[];
  sections?: BlogArticleSection[];
}

export interface BlogCategoryRecord {
  id: string;
  name: string;
  slug: string;
  description?: string;
  articleCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlogCMSStats {
  total: number;
  published: number;
  drafts: number;
  featured: number;
  categories: number;
}


