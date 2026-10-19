import { AppNotification, NotificationTarget, NotificationType, NotificationChannel } from '../types';

const STORAGE_KEY = 'app_platform_notifications';
export const NOTIFICATION_EVENT_NAME = 'app_platform_notification_event';

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    senderId: 'admin',
    target: 'all',
    audienceType: 'all',
    recipientType: 'all',
    type: 'announcement',
    title: 'Welcome to Mentora!',
    message: 'Connect with India\'s elite retired CXO leaders, IAS officers & executive advisors.',
    timestamp: 'Just now',
    createdAt: '2026-09-01T08:00:00.000Z',
    read: false,
    status: 'delivered',
    actionLink: 'landing',
    channel: 'in_app',
    channels: ['in_app', 'email', 'push']
  },
  {
    id: 'notif-2',
    senderId: 'admin',
    target: 'expert',
    audienceType: 'expert',
    recipientType: 'expert',
    type: 'verification',
    title: 'Document Audit Queue Active',
    message: 'Admin Governance Desk is reviewing uploaded work certificates & relieving letters.',
    timestamp: '10 mins ago',
    createdAt: '2026-09-01T08:10:00.000Z',
    read: false,
    status: 'delivered',
    actionLink: 'expert',
    channel: 'in_app',
    channels: ['in_app', 'email', 'push']
  },
  {
    id: 'notif-3',
    senderId: 'admin',
    target: 'client',
    audienceType: 'client',
    recipientType: 'client',
    type: 'booking',
    title: 'Advisory Consultation Slots Available',
    message: 'Expert JK & Sunita Rao have opened morning and evening slots for virtual teleconsults.',
    timestamp: '25 mins ago',
    createdAt: '2026-09-01T08:20:00.000Z',
    read: false,
    status: 'delivered',
    actionLink: 'client',
    channel: 'in_app',
    channels: ['in_app', 'email', 'push']
  },
  {
    id: 'notif-4',
    senderId: 'admin',
    target: 'admin',
    audienceType: 'admin',
    recipientType: 'admin',
    type: 'review',
    title: 'Review Moderation Desk Ready',
    message: 'Audit new consultation feedback and approve featured testimonials for the main homepage.',
    timestamp: '1 hour ago',
    createdAt: '2026-09-01T08:30:00.000Z',
    read: false,
    status: 'delivered',
    actionLink: 'owner',
    channel: 'in_app',
    channels: ['in_app', 'email', 'push']
  }
];

let isFetching = false;

export const notificationService = {
  getLocal(): AppNotification[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return INITIAL_NOTIFICATIONS;
  },

  getAll(): AppNotification[] {
    const local = this.getLocal();
    if (!isFetching) {
      this.syncWithBackend().catch(() => {});
    }
    return local;
  },

  async syncWithBackend(role?: string, recipientId?: string): Promise<AppNotification[]> {
    if (typeof window === 'undefined' || isFetching) return this.getLocal();
    try {
      isFetching = true;
      const params = new URLSearchParams();
      const effectiveRole = role || 'landing';
      params.append('role', effectiveRole);
      if (recipientId) params.append('recipientId', recipientId);

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.notifications)) {
          if (effectiveRole === 'admin') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.notifications));
          } else {
            const existing = this.getLocal();
            const map = new Map(existing.map(n => [n.id, n]));
            data.notifications.forEach((n: AppNotification) => map.set(n.id, n));
            const merged = Array.from(map.values());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT_NAME, { detail: { action: 'sync' } }));
          }
          return data.notifications;
        }
      }
    } catch (err) {
      // Backend unavailable or network error, fallback to localStorage
    } finally {
      isFetching = false;
    }
    return this.getLocal();
  },

  getForUser(role?: string, recipientId?: string): AppNotification[] {
    const all = this.getAll();
    const normalizedRole = (role || '').toLowerCase().trim();
    const normalizedRecipient = (recipientId || '').toLowerCase().trim();

    return all.filter((n) => {
      const isBroadcast = !n.recipientId || n.recipientId === 'expert-user' || n.recipientId === 'client-user' || n.recipientId === 'all';

      // 1. Landing Page / Public visitor (unauthenticated or role === 'landing')
      if (normalizedRole === 'landing' || (!normalizedRole && !normalizedRecipient)) {
        if (!isBroadcast) return false;
        return n.target === 'landing' || n.target === 'all';
      }

      // 2. Admin Portal: has visibility over all platform notifications and audits
      if (normalizedRole === 'admin') {
        return true;
      }

      // 3. Platform-wide broadcast (only if not an individual notification)
      if (n.target === 'all' && isBroadcast) {
        return true;
      }

      // 4. Expert Portal
      if (normalizedRole === 'expert') {
        if (n.target === 'all' && isBroadcast) return true;
        if (n.target === 'expert' && isBroadcast) return true;
        // Individual targeting for specific expert
        if (normalizedRecipient && n.recipientId) {
          const targetRec = n.recipientId.toLowerCase().trim();
          return targetRec === normalizedRecipient || targetRec.includes(normalizedRecipient) || normalizedRecipient.includes(targetRec);
        }
        return false;
      }

      // 5. Client Portal
      if (normalizedRole === 'client') {
        if (n.target === 'all' && isBroadcast) return true;
        if (n.target === 'client' && isBroadcast) return true;
        // Individual targeting for specific client
        if (normalizedRecipient && n.recipientId) {
          const targetRec = n.recipientId.toLowerCase().trim();
          return targetRec === normalizedRecipient || targetRec.includes(normalizedRecipient) || normalizedRecipient.includes(targetRec);
        }
        return false;
      }

      // 6. Direct match for recipientId
      if (normalizedRecipient && n.recipientId) {
        const targetRec = n.recipientId.toLowerCase().trim();
        if (targetRec === normalizedRecipient || targetRec.includes(normalizedRecipient) || normalizedRecipient.includes(targetRec)) {
          return true;
        }
      }

      return false;
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  },

  add(notification: {
    target: NotificationTarget;
    recipientId?: string;
    recipientName?: string;
    type: NotificationType;
    title: string;
    message: string;
    actionLink?: string;
    channel?: NotificationChannel;
    channels?: NotificationChannel[];
    senderId?: string;
    eventId?: string;
    eventName?: any;
    metadata?: Record<string, any>;
  }): AppNotification {
    const all = this.getAll();
    const newNotifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const defaultActionLink = notification.actionLink || 
      (notification.target === 'client' ? 'client' : notification.target === 'expert' ? 'expert' : notification.target === 'admin' ? 'owner' : 'landing');

    const newNotif: AppNotification = {
      id: newNotifId,
      senderId: notification.senderId || 'admin',
      target: notification.target,
      audienceType: notification.target,
      recipientId: notification.recipientId,
      recipientName: notification.recipientName,
      recipientType: notification.target,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      status: 'delivered',
      actionLink: defaultActionLink,
      channel: notification.channel || 'in_app',
      channels: notification.channels || ['in_app', 'email', 'push'],
      eventId: notification.eventId || `evt-${Date.now()}`,
      eventName: notification.eventName || 'platform_broadcast',
      metadata: notification.metadata || {}
    };

    // 1. Immediately update local cache & localStorage
    const updated = [newNotif, ...all];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    // 2. Dispatch global event for instant UI update and Toast banner
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(NOTIFICATION_EVENT_NAME, { detail: newNotif })
      );
    }

    // 3. Persist to Backend API / Database asynchronously
    if (typeof fetch !== 'undefined') {
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newNotif.id,
          senderId: newNotif.senderId,
          target: newNotif.target,
          audienceType: newNotif.audienceType,
          recipientId: newNotif.recipientId,
          recipientName: newNotif.recipientName,
          type: newNotif.type,
          title: newNotif.title,
          message: newNotif.message,
          actionLink: newNotif.actionLink,
          channel: newNotif.channel,
          channels: newNotif.channels,
          eventId: newNotif.eventId,
          eventName: newNotif.eventName,
          metadata: newNotif.metadata
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.notification) {
          // Confirm sync with authoritative record
          try {
            const current = this.getAll();
            const idx = current.findIndex(n => n.id === newNotif.id);
            if (idx !== -1) {
              current[idx] = { ...newNotif, ...data.notification };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
            }
          } catch {}
        }
      })
      .catch(err => {
        console.warn('[notificationService] Failed to persist notification to /api/notifications:', err);
      });
    }

    return newNotif;
  },

  markAsRead(id: string): void {
    const all = this.getAll();
    const updated = all.map((n) => (n.id === id ? { ...n, read: true, status: 'read' as const, readAt: new Date().toISOString() } : n));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT_NAME, { detail: { action: 'read', id } }));
      }
    } catch {}

    // Sync to backend API
    if (typeof fetch !== 'undefined') {
      fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      }).catch(() => {});
    }
  },

  markAllAsRead(role?: string, recipientId?: string): void {
    const all = this.getAll();
    const userNotifs = this.getForUser(role, recipientId);
    const userIds = new Set(userNotifs.map((n) => n.id));

    const updated = all.map((n) => (userIds.has(n.id) ? { ...n, read: true, status: 'read' as const, readAt: new Date().toISOString() } : n));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT_NAME, { detail: { action: 'mark_all_read' } }));
      }
    } catch {}

    // Sync to backend API
    if (typeof fetch !== 'undefined') {
      fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, recipientId })
      }).catch(() => {});
    }
  },

  clearForUser(role?: string, recipientId?: string): void {
    const all = this.getAll();
    const userNotifs = this.getForUser(role, recipientId);
    const userIds = new Set(userNotifs.map((n) => n.id));

    const remaining = all.filter((n) => !userIds.has(n.id));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT_NAME, { detail: { action: 'clear' } }));
      }
    } catch {}

    // Sync to backend API
    if (typeof fetch !== 'undefined') {
      fetch('/api/notifications/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, recipientId })
      }).catch(() => {});
    }
  }
};

// Cross-tab synchronization via storage event
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT_NAME, { detail: { action: 'cross_tab_sync' } }));
    }
  });
}

