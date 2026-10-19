import { 
  AppNotification, 
  NotificationChannel, 
  NotificationDeliveryStatus, 
  NotificationEventName, 
  NotificationRule, 
  NotificationTemplate, 
  NotificationLog, 
  ScheduledNotification, 
  UserNotificationPreferences 
} from '../types';
import { notificationService, NOTIFICATION_EVENT_NAME } from './notificationService';

export const NOTIFICATION_ENGINE_UPDATED = 'app_platform_notification_engine_updated';

const RULES_STORAGE_KEY = 'app_notification_rules';
const TEMPLATES_STORAGE_KEY = 'app_notification_templates';
const LOGS_STORAGE_KEY = 'app_notification_logs';
const SCHEDULED_STORAGE_KEY = 'app_notification_scheduled';
const SETTINGS_STORAGE_KEY = 'app_notification_settings';
const SENT_REMINDERS_KEY = 'app_notification_sent_reminders';

export interface NotificationSettings {
  masterInAppEnabled: boolean;
  masterEmailEnabled: boolean;
  masterPushEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // e.g. "22:00"
  quietHoursEnd: string;   // e.g. "07:00"
  retryThreshold: number;  // e.g. 3
  sessionReminders: {
    remind24h: boolean;
    remind1h: boolean;
    remind15m: boolean;
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  masterInAppEnabled: true,
  masterEmailEnabled: true,
  masterPushEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  retryThreshold: 3,
  sessionReminders: {
    remind24h: true,
    remind1h: true,
    remind15m: true,
  },
};

const DEFAULT_RULES: NotificationRule[] = [
  {
    id: 'rule-client-registered',
    eventName: 'client_registered',
    title: 'Client Onboarding Alert',
    description: 'Triggered when a new enterprise or individual client creates an account.',
    recipientTypes: ['client', 'admin'],
    channels: ['in_app', 'email'],
    templateId: 'tmpl-client-welcome',
    enabled: true,
    priority: 'high',
  },
  {
    id: 'rule-expert-registered',
    eventName: 'expert_registered',
    title: 'Expert Application Received',
    description: 'Triggered when a veteran leader or IAS/CXO submits their registration.',
    recipientTypes: ['expert', 'admin'],
    channels: ['in_app', 'email'],
    templateId: 'tmpl-expert-welcome',
    enabled: true,
    priority: 'high',
  },
  {
    id: 'rule-kyc-approved',
    eventName: 'expert_kyc_approved',
    title: 'Expert KYC Credentials Verified',
    description: 'Notifies expert when admin approves their verified identity credentials.',
    recipientTypes: ['expert'],
    channels: ['in_app', 'email', 'push'],
    templateId: 'tmpl-kyc-approved',
    enabled: true,
    priority: 'high',
  },
  {
    id: 'rule-kyc-rejected',
    eventName: 'expert_kyc_rejected',
    title: 'Expert KYC Clarification Required',
    description: 'Notifies expert if documentation requires updates or corrections.',
    recipientTypes: ['expert'],
    channels: ['in_app', 'email'],
    templateId: 'tmpl-kyc-rejected',
    enabled: true,
    priority: 'high',
  },
  {
    id: 'rule-consultant-requested',
    eventName: 'consultant_request_sent',
    title: 'Incoming Consultation Request',
    description: 'Dispatched to expert and admin when a client books an advisory session.',
    recipientTypes: ['expert', 'admin'],
    channels: ['in_app', 'email', 'push'],
    templateId: 'tmpl-consultant-request',
    enabled: true,
    priority: 'urgent',
  },
  {
    id: 'rule-request-accepted',
    eventName: 'request_accepted',
    title: 'Consultation Request Accepted',
    description: 'Dispatched to client and admin when expert accepts the booking.',
    recipientTypes: ['client', 'admin'],
    channels: ['in_app', 'email', 'push'],
    templateId: 'tmpl-request-accepted',
    enabled: true,
    priority: 'urgent',
  },
  {
    id: 'rule-request-declined',
    eventName: 'request_declined',
    title: 'Consultation Request Declined',
    description: 'Dispatched to client and admin when expert is unavailable.',
    recipientTypes: ['client', 'admin'],
    channels: ['in_app', 'email'],
    templateId: 'tmpl-request-declined',
    enabled: true,
    priority: 'high',
  },
  {
    id: 'rule-meet-link-sent',
    eventName: 'meet_link_sent',
    title: 'Google Meet Link Generated & Dispatched',
    description: 'Instant notification when expert adds or dispatches the meeting link.',
    recipientTypes: ['client', 'admin'],
    channels: ['in_app', 'email', 'push'],
    templateId: 'tmpl-meet-link',
    enabled: true,
    priority: 'urgent',
  },
  {
    id: 'rule-session-reminder-24h',
    eventName: 'session_reminder_24h',
    title: '24-Hour Consultation Countdown',
    description: 'Automated notification sent 24 hours prior to scheduled advisory session.',
    recipientTypes: ['client', 'expert'],
    channels: ['in_app', 'email'],
    templateId: 'tmpl-reminder-24h',
    enabled: true,
    priority: 'medium',
  },
  {
    id: 'rule-session-reminder-1h',
    eventName: 'session_reminder_1h',
    title: '1-Hour Advisory Readiness Check',
    description: 'Automated alert sent 1 hour before scheduled consultation session.',
    recipientTypes: ['client', 'expert'],
    channels: ['in_app', 'email', 'push'],
    templateId: 'tmpl-reminder-1h',
    enabled: true,
    priority: 'high',
  },
  {
    id: 'rule-session-reminder-15m',
    eventName: 'session_reminder_15m',
    title: '15-Minute Session Direct Call Prompt',
    description: 'High-priority alert with Google Meet link sent 15 minutes before meeting.',
    recipientTypes: ['client', 'expert'],
    channels: ['in_app', 'push'],
    templateId: 'tmpl-reminder-15m',
    enabled: true,
    priority: 'urgent',
  },
  {
    id: 'rule-session-completed',
    eventName: 'session_completed',
    title: 'Consultation Concluded',
    description: 'Sent when advisory session is marked complete by expert or admin.',
    recipientTypes: ['client', 'expert', 'admin'],
    channels: ['in_app', 'email'],
    templateId: 'tmpl-session-completed',
    enabled: true,
    priority: 'medium',
  },
  {
    id: 'rule-payment-success',
    eventName: 'payment_success',
    title: 'Advisory Retainer / Escrow Secured',
    description: 'Dispatched upon successful client payment verification.',
    recipientTypes: ['client', 'expert', 'admin'],
    channels: ['in_app', 'email'],
    templateId: 'tmpl-payment-success',
    enabled: true,
    priority: 'high',
  },
  {
    id: 'rule-review-submitted',
    eventName: 'review_submitted',
    title: 'Session Review & Testimonial Added',
    description: 'Dispatched when client rates an expert or leaves governance feedback.',
    recipientTypes: ['expert', 'admin'],
    channels: ['in_app'],
    templateId: 'tmpl-review-submitted',
    enabled: true,
    priority: 'medium',
  },
  {
    id: 'rule-platform-broadcast',
    eventName: 'platform_broadcast',
    title: 'Admin Platform Announcement Broadcast',
    description: 'Platform-wide bulletin dispatched directly by Administrator.',
    recipientTypes: ['client', 'expert', 'landing'],
    channels: ['in_app', 'email', 'push'],
    templateId: 'tmpl-broadcast',
    enabled: true,
    priority: 'high',
  },
];

const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'tmpl-client-welcome',
    name: 'Client Welcome & Onboarding',
    eventName: 'client_registered',
    subject: 'Welcome to Mentora',
    titleTemplate: 'Welcome to Mentora, {{client_name}}!',
    bodyTemplate: 'Your corporate advisory account has been provisioned. Browse senior CXOs, retired IAS officers, and defense advisors.',
    variables: ['{{client_name}}'],
    category: 'account',
  },
  {
    id: 'tmpl-expert-welcome',
    name: 'Expert Registration Received',
    eventName: 'expert_registered',
    subject: 'Advisory Dossier Received for Governance Audit',
    titleTemplate: 'Profile Received: {{expert_name}}',
    bodyTemplate: 'Thank you for enrolling in Mentora. Our admin governance desk will audit your credentials shortly.',
    variables: ['{{expert_name}}'],
    category: 'account',
  },
  {
    id: 'tmpl-kyc-approved',
    name: 'Expert Verification Approval',
    eventName: 'expert_kyc_approved',
    subject: 'Your Expert Dossier & Credentials Have Been Verified',
    titleTemplate: 'Credentials Verified & Approved',
    bodyTemplate: 'Congratulations {{expert_name}}, your identity and advisory dossier are verified. You are now live for client bookings.',
    variables: ['{{expert_name}}'],
    category: 'account',
  },
  {
    id: 'tmpl-kyc-rejected',
    name: 'Expert Verification Clarification',
    eventName: 'expert_kyc_rejected',
    subject: 'Action Required: Documentation Verification Update',
    titleTemplate: 'Verification Clarification Needed',
    bodyTemplate: 'Hello {{expert_name}}, please re-upload your service records or identity proof via your Expert Profile portal.',
    variables: ['{{expert_name}}'],
    category: 'account',
  },
  {
    id: 'tmpl-consultant-request',
    name: 'Incoming Consultation Request',
    eventName: 'consultant_request_sent',
    subject: 'New Consultation Request from {{client_name}}',
    titleTemplate: 'New Advisory Request from {{client_name}}',
    bodyTemplate: '{{client_name}} has requested a session on "{{topic}}" for {{meeting_date}} at {{meeting_time}} (Booking ID: {{booking_id}}). Please review and accept or decline.',
    variables: ['{{client_name}}', '{{topic}}', '{{meeting_date}}', '{{meeting_time}}', '{{booking_id}}'],
    category: 'booking',
  },
  {
    id: 'tmpl-request-accepted',
    name: 'Consultation Request Accepted',
    eventName: 'request_accepted',
    subject: 'Your Consultation Request has been Accepted by {{expert_name}}',
    titleTemplate: 'Request Accepted by {{expert_name}}',
    bodyTemplate: 'Great news! {{expert_name}} has accepted your consultation request for {{meeting_date}} at {{meeting_time}}. The meeting link will be dispatched shortly.',
    variables: ['{{expert_name}}', '{{meeting_date}}', '{{meeting_time}}'],
    category: 'booking',
  },
  {
    id: 'tmpl-request-declined',
    name: 'Consultation Request Declined',
    eventName: 'request_declined',
    subject: 'Update on Your Consultation Request with {{expert_name}}',
    titleTemplate: 'Request Declined by {{expert_name}}',
    bodyTemplate: 'The expert is currently unavailable and has declined your consultation request. Please select an alternate schedule or consult another certified expert.',
    variables: ['{{expert_name}}'],
    category: 'booking',
  },
  {
    id: 'tmpl-meet-link',
    name: 'Google Meet Link Dispatched',
    eventName: 'meet_link_sent',
    subject: 'Meeting Link Confirmed for Your Session with {{expert_name}}',
    titleTemplate: 'Google Meet Link Ready: {{meeting_link}}',
    bodyTemplate: 'The meeting link for your advisory session with {{expert_name}} is confirmed: {{meeting_link}}. Session scheduled for {{meeting_date}} at {{meeting_time}}.',
    variables: ['{{expert_name}}', '{{meeting_link}}', '{{meeting_date}}', '{{meeting_time}}'],
    category: 'session',
  },
  {
    id: 'tmpl-reminder-24h',
    name: 'Session Reminder (24 Hours)',
    eventName: 'session_reminder_24h',
    subject: 'Reminder: Consultation Session Tomorrow at {{meeting_time}}',
    titleTemplate: 'Upcoming Session in 24 Hours',
    bodyTemplate: 'Your advisory consultation on "{{topic}}" is scheduled for tomorrow ({{meeting_date}}) at {{meeting_time}}. Join Link: {{meeting_link}}.',
    variables: ['{{topic}}', '{{meeting_date}}', '{{meeting_time}}', '{{meeting_link}}'],
    category: 'session',
  },
  {
    id: 'tmpl-reminder-1h',
    name: 'Session Reminder (1 Hour)',
    eventName: 'session_reminder_1h',
    subject: 'Reminder: Consultation Starting in 1 Hour',
    titleTemplate: 'Starting in 1 Hour: Consultation on {{topic}}',
    bodyTemplate: 'Your session begins at {{meeting_time}}. Please ensure your microphone and video camera are ready. Link: {{meeting_link}}.',
    variables: ['{{topic}}', '{{meeting_time}}', '{{meeting_link}}'],
    category: 'session',
  },
  {
    id: 'tmpl-reminder-15m',
    name: 'Session Starting Prompt (15 Mins)',
    eventName: 'session_reminder_15m',
    subject: 'Starting in 15 Minutes: Join Google Meet',
    titleTemplate: '15 Mins to Session: Click to Join Meet',
    bodyTemplate: 'Your advisory session is commencing in 15 minutes. Join now via Google Meet: {{meeting_link}}.',
    variables: ['{{meeting_link}}'],
    category: 'session',
  },
  {
    id: 'tmpl-session-completed',
    name: 'Session Concluded & Feedback Request',
    eventName: 'session_completed',
    subject: 'Advisory Consultation Concluded',
    titleTemplate: 'Session Completed: {{topic}}',
    bodyTemplate: 'Your advisory meeting has concluded. Please take a moment to rate your experience and provide feedback for {{expert_name}}.',
    variables: ['{{topic}}', '{{expert_name}}'],
    category: 'session',
  },
  {
    id: 'tmpl-payment-success',
    name: 'Advisory Fee Payment Confirmed',
    eventName: 'payment_success',
    subject: 'Receipt: Advisory Retainer {{amount}} Confirmed',
    titleTemplate: 'Payment Confirmed: {{amount}}',
    bodyTemplate: 'Payment for booking #{{booking_id}} with {{expert_name}} has been verified and deposited into platform escrow.',
    variables: ['{{amount}}', '{{booking_id}}', '{{expert_name}}'],
    category: 'payment',
  },
  {
    id: 'tmpl-review-submitted',
    name: 'New Advisory Review Received',
    eventName: 'review_submitted',
    subject: 'New Client Review Received',
    titleTemplate: 'New Review for {{expert_name}}',
    bodyTemplate: 'Client {{client_name}} has submitted a review for their recent consultation on "{{topic}}".',
    variables: ['{{expert_name}}', '{{client_name}}', '{{topic}}'],
    category: 'system',
  },
  {
    id: 'tmpl-broadcast',
    name: 'Platform Broadcast Template',
    eventName: 'platform_broadcast',
    subject: 'Official Platform Notice: {{topic}}',
    titleTemplate: 'Platform Announcement: {{topic}}',
    bodyTemplate: '{{topic}}',
    variables: ['{{topic}}'],
    category: 'system',
  },
];

const INITIAL_LOGS: NotificationLog[] = [
  {
    id: 'log-seed-1',
    eventId: 'evt-init-1',
    eventName: 'client_registered',
    recipientId: 'client-1',
    recipientName: 'Vikram Malhotra (Tata Steel)',
    recipientType: 'client',
    channel: 'email',
    title: 'Welcome to Mentora, Vikram Malhotra!',
    message: 'Your corporate advisory account has been provisioned. Browse senior CXOs.',
    status: 'delivered',
    createdAt: '12 mins ago',
    deliveredAt: '12 mins ago',
    metadata: { browser: 'Chrome Desktop', ip: '103.21.244.2' },
  },
  {
    id: 'log-seed-2',
    eventId: 'evt-init-2',
    eventName: 'consultant_request_sent',
    recipientId: 'expert-jk',
    recipientName: 'Dr. JK Sharma (Former IAS)',
    recipientType: 'expert',
    channel: 'in_app',
    title: 'New Advisory Request from Client ABC',
    message: 'Client ABC has requested a session on "Public Policy Advisory".',
    status: 'read',
    createdAt: '25 mins ago',
    deliveredAt: '25 mins ago',
    readAt: '20 mins ago',
    metadata: { bookingId: 'BK-9821' },
  },
  {
    id: 'log-seed-3',
    eventId: 'evt-init-3',
    eventName: 'meet_link_sent',
    recipientId: 'client-abc',
    recipientName: 'Client ABC Corp',
    recipientType: 'client',
    channel: 'push',
    title: 'Google Meet Link Ready: meet.google.com/abc-defg-hij',
    message: 'The meeting link for your advisory session with Expert JK is confirmed.',
    status: 'delivered',
    createdAt: '40 mins ago',
    deliveredAt: '40 mins ago',
    metadata: { link: 'https://meet.google.com/abc-defg-hij' },
  },
  {
    id: 'log-seed-4',
    eventId: 'evt-init-4',
    eventName: 'session_reminder_1h',
    recipientId: 'client-sunita',
    recipientName: 'Sunita Rao Enterprise',
    recipientType: 'client',
    channel: 'email',
    title: 'Starting in 1 Hour: Consultation on Defense Procurement',
    message: 'Your session begins at 11:00 AM. Please ensure your camera and mic are connected.',
    status: 'delivered',
    createdAt: '1 hour ago',
    deliveredAt: '1 hour ago',
    metadata: { sessionTime: '11:00 AM' },
  },
  {
    id: 'log-seed-5',
    eventId: 'evt-init-5',
    eventName: 'expert_kyc_approved',
    recipientId: 'expert-air-marshal',
    recipientName: 'Air Marshal PS Ahluwalia',
    recipientType: 'expert',
    channel: 'email',
    title: 'Credentials Verified & Approved',
    message: 'Your identity and advisory dossier are verified. You are live for client bookings.',
    status: 'delivered',
    createdAt: '2 hours ago',
    deliveredAt: '2 hours ago',
    metadata: { approver: 'Admin Superuser' },
  }
];

class NotificationEngine {
  private reminderInterval: any = null;

  constructor() {
    this.initDefaults();
    this.startBackgroundReminderRunner();
  }

  private initDefaults() {
    try {
      if (!localStorage.getItem(RULES_STORAGE_KEY)) {
        localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(DEFAULT_RULES));
      }
      if (!localStorage.getItem(TEMPLATES_STORAGE_KEY)) {
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
      }
      if (!localStorage.getItem(SETTINGS_STORAGE_KEY)) {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
      }
      if (!localStorage.getItem(LOGS_STORAGE_KEY)) {
        localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(INITIAL_LOGS));
      }
      if (!localStorage.getItem(SCHEDULED_STORAGE_KEY)) {
        localStorage.setItem(SCHEDULED_STORAGE_KEY, JSON.stringify([]));
      }
    } catch (e) {
      console.error('Error initializing notification engine storage', e);
    }
  }

  // --- Settings ---
  public getSettings(): NotificationSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_SETTINGS;
  }

  public updateSettings(partial: Partial<NotificationSettings>): NotificationSettings {
    const current = this.getSettings();
    const updated = { ...current, ...partial };
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      this.dispatchUpdate();
    } catch {}
    return updated;
  }

  // --- Rules ---
  public getRules(): NotificationRule[] {
    try {
      const raw = localStorage.getItem(RULES_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_RULES;
  }

  public updateRule(ruleId: string, updates: Partial<NotificationRule>): void {
    const rules = this.getRules();
    const idx = rules.findIndex(r => r.id === ruleId);
    if (idx !== -1) {
      rules[idx] = { ...rules[idx], ...updates };
      try {
        localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
        this.dispatchUpdate();
      } catch {}
    }
  }

  public toggleRule(ruleId: string): void {
    const rules = this.getRules();
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = !rule.enabled;
      try {
        localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
        this.dispatchUpdate();
      } catch {}
    }
  }

  // --- Templates ---
  public getTemplates(): NotificationTemplate[] {
    try {
      const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_TEMPLATES;
  }

  public updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): void {
    const tmpls = this.getTemplates();
    const idx = tmpls.findIndex(t => t.id === templateId);
    if (idx !== -1) {
      tmpls[idx] = { ...tmpls[idx], ...updates };
      try {
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(tmpls));
        this.dispatchUpdate();
      } catch {}
    }
  }

  // --- Logs ---
  public getLogs(): NotificationLog[] {
    try {
      const raw = localStorage.getItem(LOGS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return INITIAL_LOGS;
  }

  public addLog(log: Omit<NotificationLog, 'id' | 'createdAt'>): NotificationLog {
    const logs = this.getLogs();
    const newLog: NotificationLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: 'Just now',
    };
    const updated = [newLog, ...logs.slice(0, 199)]; // Keep max 200 logs
    try {
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updated));
      this.dispatchUpdate();
    } catch {}
    return newLog;
  }

  public retryLog(logId: string): boolean {
    const logs = this.getLogs();
    const item = logs.find(l => l.id === logId);
    if (!item) return false;

    // Simulate resending
    item.status = 'delivered';
    item.deliveredAt = 'Just now (Retried)';
    item.failureReason = undefined;
    try {
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
      this.dispatchUpdate();
    } catch {}
    return true;
  }

  // --- Scheduled Notifications ---
  public getScheduled(): ScheduledNotification[] {
    try {
      const raw = localStorage.getItem(SCHEDULED_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  public scheduleNotification(notif: Omit<ScheduledNotification, 'id' | 'createdAt' | 'status'>): ScheduledNotification {
    const list = this.getScheduled();
    const item: ScheduledNotification = {
      ...notif,
      id: `sched-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      status: 'scheduled',
      createdAt: 'Just now',
    };
    const updated = [item, ...list];
    try {
      localStorage.setItem(SCHEDULED_STORAGE_KEY, JSON.stringify(updated));
      this.dispatchUpdate();
    } catch {}
    return item;
  }

  public cancelScheduled(id: string): void {
    const list = this.getScheduled();
    const updated = list.map(item => item.id === id ? { ...item, status: 'cancelled' as const } : item);
    try {
      localStorage.setItem(SCHEDULED_STORAGE_KEY, JSON.stringify(updated));
      this.dispatchUpdate();
    } catch {}
  }

  // --- User Preferences ---
  public getUserPreferences(userId: string): UserNotificationPreferences {
    try {
      const raw = localStorage.getItem(`app_user_prefs_${userId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      userId,
      emailNotifications: true,
      pushNotifications: true,
      inAppNotifications: true,
      bookingAlerts: true,
      meetingReminders: true,
      paymentAlerts: true,
      messageAlerts: true,
      marketingAnnouncements: true,
    };
  }

  public saveUserPreferences(prefs: UserNotificationPreferences): void {
    try {
      localStorage.setItem(`app_user_prefs_${prefs.userId}`, JSON.stringify(prefs));
    } catch {}
  }

  // --- Template Interpolation Helper ---
  public interpolate(template: string, vars: Record<string, any> = {}): string {
    if (!template) return '';
    let result = template;
    for (const [key, val] of Object.entries(vars)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
      result = result.replace(pattern, String(val || ''));
    }
    return result;
  }

  // --- MAIN TRIGGER EVENT PIPELINE ---
  public async trigger(
    eventName: NotificationEventName, 
    payload: {
      recipientId?: string;
      recipientName?: string;
      recipientType?: 'client' | 'expert' | 'admin' | 'landing' | 'all';
      clientName?: string;
      expertName?: string;
      meetingDate?: string;
      meetingTime?: string;
      meetingLink?: string;
      topic?: string;
      amount?: string;
      bookingId?: string;
      actionLink?: string;
      customTitle?: string;
      customMessage?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<NotificationLog[]> {
    const settings = this.getSettings();
    const rules = this.getRules();
    const templates = this.getTemplates();

    // 1. Locate matching active rule
    const rule = rules.find(r => r.eventName === eventName);
    if (rule && !rule.enabled) {
      console.log(`[NotificationEngine] Rule for event ${eventName} is disabled. Skipping.`);
      return [];
    }

    // 2. Locate template or construct default
    const tmpl = templates.find(t => t.eventName === eventName) || templates.find(t => t.id === rule?.templateId);
    
    // Variables dictionary
    const vars: Record<string, any> = {
      client_name: payload.clientName || 'Client',
      expert_name: payload.expertName || 'Expert',
      meeting_date: payload.meetingDate || 'Upcoming Date',
      meeting_time: payload.meetingTime || 'Scheduled Time',
      meeting_link: payload.meetingLink || 'Virtual Session Room',
      topic: payload.topic || 'Executive Advisory Consultation',
      amount: payload.amount || '₹0',
      booking_id: payload.bookingId || 'BK-1001',
      ...payload.metadata,
    };

    const title = payload.customTitle || (tmpl ? this.interpolate(tmpl.titleTemplate, vars) : `Notification: ${eventName}`);
    const message = payload.customMessage || (tmpl ? this.interpolate(tmpl.bodyTemplate, vars) : 'You have a new update.');

    const channels: NotificationChannel[] = rule?.channels || ['in_app', 'email', 'push'];
    let recipientTypes: ('all' | 'client' | 'expert' | 'admin' | 'landing')[];
    if (payload.recipientId) {
      // Individual custom dispatch: single targeted notification
      recipientTypes = [payload.recipientType && payload.recipientType !== 'all' ? payload.recipientType : 'all'];
    } else if (payload.recipientType) {
      recipientTypes = [payload.recipientType];
    } else {
      recipientTypes = rule?.recipientTypes || ['all'];
    }

    const generatedLogs: NotificationLog[] = [];

    // 3. Dispatch for each target & channel
    for (const rType of recipientTypes) {
      const isIndividual = Boolean(payload.recipientId);
      const targetRecipientId = isIndividual ? payload.recipientId : undefined;
      const targetRecipientName = payload.recipientName || 
        (rType === 'client' ? (payload.clientName || 'All Platform Clients') : 
         rType === 'expert' ? (payload.expertName || 'All Senior Experts') : 
         rType === 'landing' ? 'Public Landing Page' : 
         rType === 'all' ? 'All Platform Users' : 'Admin Governance');

      for (const ch of channels) {
        // Check master switch
        if (ch === 'in_app' && !settings.masterInAppEnabled) continue;
        if (ch === 'email' && !settings.masterEmailEnabled) continue;
        if (ch === 'push' && !settings.masterPushEnabled) continue;

        // Determine mapped notification type for in_app
        let notifCategory: any = 'announcement';
        if (eventName.includes('booking') || eventName.includes('request')) notifCategory = 'booking';
        else if (eventName.includes('meet') || eventName.includes('session')) notifCategory = 'session';
        else if (eventName.includes('kyc') || eventName.includes('verification')) notifCategory = 'verification';
        else if (eventName.includes('review')) notifCategory = 'review';
        else if (eventName.includes('payment')) notifCategory = 'wallet';

        // Deliver via in-app notification center if in_app
        if (ch === 'in_app') {
          notificationService.add({
            target: rType,
            recipientId: targetRecipientId,
            recipientName: targetRecipientName,
            type: notifCategory,
            title,
            message,
            actionLink: payload.actionLink || (rType === 'admin' ? 'owner' : rType === 'landing' ? 'landing' : rType),
            channel: 'in_app',
            channels: channels,
            senderId: 'admin',
            eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            eventName: eventName,
            metadata: payload.metadata
          });
        }

        // Add log entry
        const log = this.addLog({
          eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          eventName,
          recipientId: targetRecipientId || `${rType}-broadcast`,
          recipientName: targetRecipientName,
          recipientType: rType,
          channel: ch,
          title,
          message,
          status: 'delivered',
          deliveredAt: 'Just now',
          metadata: { ...payload.metadata, bookingId: payload.bookingId, meetingLink: payload.meetingLink }
        });

        generatedLogs.push(log);
      }
    }

    return generatedLogs;
  }

  // --- Background Meeting Reminder Scanner ---
  private startBackgroundReminderRunner() {
    if (typeof window === 'undefined') return;
    
    // Scan every 30 seconds for upcoming sessions
    this.reminderInterval = setInterval(() => {
      this.checkAndRunSessionReminders();
    }, 30000);

    // Initial check after 3 seconds
    setTimeout(() => {
      this.checkAndRunSessionReminders();
    }, 3000);
  }

  public checkAndRunSessionReminders() {
    const settings = this.getSettings();
    if (!settings.sessionReminders.remind24h && !settings.sessionReminders.remind1h && !settings.sessionReminders.remind15m) {
      return;
    }

    try {
      // Read sessions from storage
      const sessionsRaw = localStorage.getItem('app_platform_sessions');
      if (!sessionsRaw) return;
      const sessions = JSON.parse(sessionsRaw);
      if (!Array.isArray(sessions) || sessions.length === 0) return;

      const sentRemindersRaw = localStorage.getItem(SENT_REMINDERS_KEY);
      const sentReminders: string[] = sentRemindersRaw ? JSON.parse(sentRemindersRaw) : [];
      const sentSet = new Set(sentReminders);

      const now = new Date().getTime();

      for (const sess of sessions) {
        // Only active / scheduled sessions
        if (sess.status === 'declined' || sess.status === 'completed' || sess.status === 'cancelled') continue;

        // Parse session date & time
        const sessDateTimeStr = `${sess.date} ${sess.time || '10:00 AM'}`;
        const sessTime = new Date(sessDateTimeStr).getTime();

        // If valid timestamp
        if (!isNaN(sessTime)) {
          const diffMs = sessTime - now;
          const diffMinutes = Math.floor(diffMs / 60000);

          // 24 Hour reminder: 1400 - 1460 minutes before
          if (settings.sessionReminders.remind24h && diffMinutes > 1400 && diffMinutes <= 1460) {
            const key = `${sess.id}_24h`;
            if (!sentSet.has(key)) {
              sentSet.add(key);
              this.trigger('session_reminder_24h', {
                recipientId: sess.clientName,
                recipientName: sess.clientName,
                recipientType: 'client',
                clientName: sess.clientName,
                expertName: sess.expertName,
                meetingDate: sess.date,
                meetingTime: sess.time,
                meetingLink: sess.meetLink,
                topic: sess.topic,
                bookingId: sess.id,
              });
              this.trigger('session_reminder_24h', {
                recipientId: sess.expertName,
                recipientName: sess.expertName,
                recipientType: 'expert',
                clientName: sess.clientName,
                expertName: sess.expertName,
                meetingDate: sess.date,
                meetingTime: sess.time,
                meetingLink: sess.meetLink,
                topic: sess.topic,
                bookingId: sess.id,
              });
            }
          }

          // 1 Hour reminder: 50 - 70 minutes before
          if (settings.sessionReminders.remind1h && diffMinutes > 50 && diffMinutes <= 70) {
            const key = `${sess.id}_1h`;
            if (!sentSet.has(key)) {
              sentSet.add(key);
              this.trigger('session_reminder_1h', {
                recipientId: sess.clientName,
                recipientName: sess.clientName,
                recipientType: 'client',
                clientName: sess.clientName,
                expertName: sess.expertName,
                meetingDate: sess.date,
                meetingTime: sess.time,
                meetingLink: sess.meetLink,
                topic: sess.topic,
                bookingId: sess.id,
              });
              this.trigger('session_reminder_1h', {
                recipientId: sess.expertName,
                recipientName: sess.expertName,
                recipientType: 'expert',
                clientName: sess.clientName,
                expertName: sess.expertName,
                meetingDate: sess.date,
                meetingTime: sess.time,
                meetingLink: sess.meetLink,
                topic: sess.topic,
                bookingId: sess.id,
              });
            }
          }

          // 15 Minute reminder: 5 - 20 minutes before
          if (settings.sessionReminders.remind15m && diffMinutes > 5 && diffMinutes <= 20) {
            const key = `${sess.id}_15m`;
            if (!sentSet.has(key)) {
              sentSet.add(key);
              this.trigger('session_reminder_15m', {
                recipientId: sess.clientName,
                recipientName: sess.clientName,
                recipientType: 'client',
                clientName: sess.clientName,
                expertName: sess.expertName,
                meetingDate: sess.date,
                meetingTime: sess.time,
                meetingLink: sess.meetLink,
                topic: sess.topic,
                bookingId: sess.id,
              });
              this.trigger('session_reminder_15m', {
                recipientId: sess.expertName,
                recipientName: sess.expertName,
                recipientType: 'expert',
                clientName: sess.clientName,
                expertName: sess.expertName,
                meetingDate: sess.date,
                meetingTime: sess.time,
                meetingLink: sess.meetLink,
                topic: sess.topic,
                bookingId: sess.id,
              });
            }
          }
        }
      }

      // Save back updated sent markers
      localStorage.setItem(SENT_REMINDERS_KEY, JSON.stringify(Array.from(sentSet).slice(-200)));
    } catch (e) {
      console.error('[NotificationEngine] Error running reminder scanner', e);
    }
  }

  private dispatchUpdate() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NOTIFICATION_ENGINE_UPDATED));
      window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT_NAME, { detail: { action: 'engine_update' } }));
    }
  }
}

export const notificationEngine = new NotificationEngine();
