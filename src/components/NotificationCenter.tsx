import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  X, 
  CheckCheck, 
  Trash2, 
  CalendarDays, 
  Star, 
  ShieldCheck, 
  Wallet, 
  Sparkles, 
  Video, 
  ExternalLink,
  Settings,
  Mail,
  Smartphone,
  Check,
  Lock
} from 'lucide-react';
import { AppNotification, NotificationType, UserNotificationPreferences } from '../types';
import { notificationService, NOTIFICATION_EVENT_NAME } from '../services/notificationService';
import { notificationEngine, NOTIFICATION_ENGINE_UPDATED } from '../services/notificationEngine';

interface NotificationCenterProps {
  role?: string | null;
  recipientId?: string;
  onNavigate?: (page: string) => void;
  darkTheme?: boolean;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  role,
  recipientId,
  onNavigate,
  darkTheme = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'sessions' | 'announcements'>('all');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [latestToast, setLatestToast] = useState<AppNotification | null>(null);
  const [prefs, setPrefs] = useState<UserNotificationPreferences>(() => 
    notificationEngine.getUserPreferences(recipientId || role || 'guest')
  );

  const drawerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = () => {
    const list = notificationService.getForUser(role || undefined, recipientId);
    setNotifications(list);
  };

  useEffect(() => {
    loadNotifications();

    const handleNewNotification = (e: any) => {
      loadNotifications();
      if (e.detail && e.detail.id && e.detail.title) {
        const notif = e.detail;
        const normRole = (role || '').toLowerCase().trim();
        const normRec = (recipientId || '').toLowerCase().trim();
        
        let shouldShowToast = false;
        if (notif.target === 'all') {
          shouldShowToast = true;
        } else if (normRole === 'admin') {
          shouldShowToast = true;
        } else if (normRole === 'landing' || (!normRole && !normRec)) {
          if (notif.target === 'landing') shouldShowToast = true;
        } else if (normRole === 'expert' && notif.target === 'expert') {
          const isBroadcast = !notif.recipientId || notif.recipientId === 'expert-user' || notif.recipientId === 'expert' || notif.recipientId === 'all';
          if (isBroadcast) shouldShowToast = true;
          else if (normRec && notif.recipientId && (notif.recipientId.toLowerCase().includes(normRec) || normRec.includes(notif.recipientId.toLowerCase()))) shouldShowToast = true;
        } else if (normRole === 'client' && notif.target === 'client') {
          const isBroadcast = !notif.recipientId || notif.recipientId === 'client-user' || notif.recipientId === 'client' || notif.recipientId === 'all';
          if (isBroadcast) shouldShowToast = true;
          else if (normRec && notif.recipientId && (notif.recipientId.toLowerCase().includes(normRec) || normRec.includes(notif.recipientId.toLowerCase()))) shouldShowToast = true;
        }

        if (shouldShowToast) {
          setLatestToast(notif);
          setTimeout(() => {
            setLatestToast((prev) => (prev?.id === notif.id ? null : prev));
          }, 5000);
        }
      }
    };

    const handleEngineUpdate = () => {
      loadNotifications();
    };

    window.addEventListener(NOTIFICATION_EVENT_NAME, handleNewNotification);
    window.addEventListener(NOTIFICATION_ENGINE_UPDATED, handleEngineUpdate);
    return () => {
      window.removeEventListener(NOTIFICATION_EVENT_NAME, handleNewNotification);
      window.removeEventListener(NOTIFICATION_ENGINE_UPDATED, handleEngineUpdate);
    };
  }, [role, recipientId]);

  // Sync prefs when recipientId changes
  useEffect(() => {
    if (recipientId || role) {
      setPrefs(notificationEngine.getUserPreferences(recipientId || role || 'guest'));
    }
  }, [recipientId, role]);

  // Click outside to close drawer
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowPreferences(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.read;
    if (activeFilter === 'sessions') return n.type === 'session' || n.type === 'booking';
    if (activeFilter === 'announcements') return n.type === 'announcement' || n.target === 'all';
    return true;
  });

  const handleNotificationClick = (notif: AppNotification) => {
    notificationService.markAsRead(notif.id);
    loadNotifications();
    if (notif.actionLink && onNavigate) {
      onNavigate(notif.actionLink);
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = () => {
    notificationService.markAllAsRead(role || undefined, recipientId);
    loadNotifications();
  };

  const handleClearAll = () => {
    if (confirm('Clear all notifications?')) {
      notificationService.clearForUser(role || undefined, recipientId);
      loadNotifications();
    }
  };

  const handleTogglePref = (key: keyof UserNotificationPreferences) => {
    // Critical alerts cannot be turned off
    if (key === 'bookingAlerts' || key === 'meetingReminders' || key === 'paymentAlerts') {
      return;
    }
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    notificationEngine.saveUserPreferences(updated);
  };

  const getIconForType = (type: NotificationType) => {
    switch (type) {
      case 'booking':
        return <CalendarDays className="w-4 h-4 text-emerald-400" />;
      case 'session':
        return <Video className="w-4 h-4 text-blue-400" />;
      case 'review':
        return <Star className="w-4 h-4 text-amber-400 fill-amber-400" />;
      case 'verification':
        return <ShieldCheck className="w-4 h-4 text-teal-400" />;
      case 'wallet':
        return <Wallet className="w-4 h-4 text-amber-300" />;
      case 'announcement':
      default:
        return <Sparkles className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="relative inline-block z-40" ref={drawerRef}>
      {/* Trigger Bell Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
          setShowPreferences(false);
        }}
        className={`relative p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
          darkTheme 
            ? 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10' 
            : 'bg-[#E3DBC5] hover:bg-[#D8CFB8] text-[#1E2A38] border border-[#D8CFB8]'
        }`}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'animate-bounce text-amber-400' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white font-black text-[10px] rounded-full flex items-center justify-center px-1 shadow-md animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Popover / Drawer */}
      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className={`absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl shadow-2xl z-50 overflow-hidden border backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
            darkTheme 
              ? 'bg-slate-950/95 text-white border-white/15 shadow-black/80' 
              : 'bg-[#F8F5EC] text-[#1E2A38] border-[#D8CFB8] shadow-2xl'
          }`}
          style={{ maxHeight: '540px' }}
        >
          {/* Header */}
          <div className={`p-3.5 border-b flex items-center justify-between ${
            darkTheme ? 'border-white/10 bg-slate-900/60' : 'border-[#D8CFB8] bg-[#EFE9DD]'
          }`}>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-400" />
                {showPreferences ? 'Notification Preferences' : 'Notifications'}
              </span>
              {!showPreferences && unreadCount > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                  {unreadCount} New
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                  showPreferences 
                    ? 'bg-amber-500 text-slate-950 font-bold' 
                    : darkTheme ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-[#E3DBC5] text-slate-600 hover:text-black'
                }`}
                title={showPreferences ? "Back to alerts" : "Notification Settings"}
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {!showPreferences && (
                <>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className={`p-1.5 rounded-lg text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                        darkTheme ? 'hover:bg-slate-800 text-slate-400 hover:text-emerald-400' : 'hover:bg-[#E3DBC5] text-slate-600 hover:text-emerald-700'
                      }`}
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Mark all</span>
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className={`p-1.5 rounded-lg text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                        darkTheme ? 'hover:bg-slate-800 text-slate-400 hover:text-rose-400' : 'hover:bg-[#E3DBC5] text-slate-600 hover:text-rose-700'
                      }`}
                      title="Clear all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}

              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowPreferences(false);
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  darkTheme ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-[#E3DBC5] text-slate-600 hover:text-black'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body content: Preferences vs Notification List */}
          {showPreferences ? (
            <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: '420px' }}>
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                  Delivery Channels
                </h4>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-slate-900/40 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      <span>In-App Center Alerts</span>
                    </span>
                    <input 
                      type="checkbox" 
                      checked={prefs.inAppNotifications}
                      onChange={() => handleTogglePref('inAppNotifications')}
                      className="accent-amber-500 rounded" 
                    />
                  </label>
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-slate-900/40 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-blue-400" />
                      <span>Email Delivery Dispatches</span>
                    </span>
                    <input 
                      type="checkbox" 
                      checked={prefs.emailNotifications}
                      onChange={() => handleTogglePref('emailNotifications')}
                      className="accent-amber-500 rounded" 
                    />
                  </label>
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-slate-900/40 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Browser Push Notifications</span>
                    </span>
                    <input 
                      type="checkbox" 
                      checked={prefs.pushNotifications}
                      onChange={() => handleTogglePref('pushNotifications')}
                      className="accent-amber-500 rounded" 
                    />
                  </label>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                  Category Controls
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-slate-900/40 opacity-90">
                    <span className="flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Booking Requests & Approvals</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Required
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-slate-900/40 opacity-90">
                    <span className="flex items-center gap-2">
                      <Video className="w-3.5 h-3.5 text-blue-400" />
                      <span>Meeting Reminders (24h, 1h, 15m)</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Required
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-slate-900/40 opacity-90">
                    <span className="flex items-center gap-2">
                      <Wallet className="w-3.5 h-3.5 text-amber-400" />
                      <span>Escrow & Payment Receipts</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Required
                    </span>
                  </div>

                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-slate-900/40 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>Platform Bulletins & News</span>
                    </span>
                    <input 
                      type="checkbox" 
                      checked={prefs.marketingAnnouncements}
                      onChange={() => handleTogglePref('marketingAnnouncements')}
                      className="accent-amber-500 rounded" 
                    />
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowPreferences(false)}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save & Return to Alerts
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Filter Tabs */}
              <div className={`flex border-b px-2 py-1.5 text-xs font-semibold gap-1 overflow-x-auto ${
                darkTheme ? 'border-white/10 bg-slate-900/30' : 'border-[#D8CFB8] bg-[#EFE9DD]/50'
              }`}>
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[10px] whitespace-nowrap ${
                    activeFilter === 'all'
                      ? darkTheme ? 'bg-slate-800 text-amber-300 font-bold' : 'bg-[#E3DBC5] text-[#1E2A38] font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setActiveFilter('unread')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[10px] whitespace-nowrap ${
                    activeFilter === 'unread'
                      ? darkTheme ? 'bg-slate-800 text-amber-300 font-bold' : 'bg-[#E3DBC5] text-[#1E2A38] font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  onClick={() => setActiveFilter('sessions')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[10px] whitespace-nowrap ${
                    activeFilter === 'sessions'
                      ? darkTheme ? 'bg-slate-800 text-amber-300 font-bold' : 'bg-[#E3DBC5] text-[#1E2A38] font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Meetings
                </button>
                <button
                  onClick={() => setActiveFilter('announcements')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[10px] whitespace-nowrap ${
                    activeFilter === 'announcements'
                      ? darkTheme ? 'bg-slate-800 text-amber-300 font-bold' : 'bg-[#E3DBC5] text-[#1E2A38] font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Broadcasts
                </button>
              </div>

              {/* Notification List */}
              <div className="overflow-y-auto divide-y divide-white/5" style={{ maxHeight: '360px' }}>
                {filteredNotifications.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <Bell className="w-8 h-8 mx-auto text-slate-500 opacity-40" />
                    <p className="text-xs font-bold text-slate-400">No notifications here</p>
                    <p className="text-[10px] text-slate-500">You're all caught up with platform updates!</p>
                  </div>
                ) : (
                  filteredNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 transition-all cursor-pointer flex items-start gap-3 relative ${
                        !notif.read 
                          ? darkTheme ? 'bg-slate-900/60 hover:bg-slate-800/80' : 'bg-[#EFE9DD] hover:bg-[#E3DBC5]' 
                          : darkTheme ? 'hover:bg-slate-900/40 opacity-75' : 'hover:bg-[#EFE9DD]/50 opacity-75'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                        darkTheme ? 'bg-slate-900 border-white/10' : 'bg-white border-[#D8CFB8]'
                      }`}>
                        {getIconForType(notif.type)}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold truncate leading-tight">
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 shrink-0">{notif.timestamp}</span>
                        </div>

                        <p className={`text-[11px] leading-relaxed line-clamp-2 ${
                          darkTheme ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          {notif.message}
                        </p>

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">
                              {notif.channel ? notif.channel.toUpperCase() : 'IN-APP'}
                            </span>
                          </div>

                          {notif.actionLink && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                              <span>Open Section</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </div>
                      </div>

                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5 shadow-sm shadow-amber-400" />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer note */}
              <div className={`p-2.5 text-center text-[10px] border-t flex items-center justify-between px-3 ${
                darkTheme ? 'border-white/10 bg-slate-900/40 text-slate-400' : 'border-[#D8CFB8] bg-[#EFE9DD]/30 text-slate-500'
              }`}>
                <span>🔔 Multi-Channel Delivery Engine</span>
                <span className="text-[9px] font-mono text-emerald-400">● Real-Time Sync</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Real-time Floating Toast Alert */}
      {latestToast && (
        <div className="fixed top-5 right-5 z-50 max-w-sm w-full bg-slate-950 text-white border border-amber-500/60 rounded-2xl p-4 shadow-2xl flex items-start gap-3 animate-in slide-in-from-top duration-300">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            {getIconForType(latestToast.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-amber-300 flex items-center gap-1.5">
              <span>🔔 New Notification</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono">
                {latestToast.channel ? latestToast.channel.toUpperCase() : 'IN-APP'}
              </span>
            </p>
            <p className="text-xs font-bold text-white mt-0.5 truncate">{latestToast.title}</p>
            <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2 leading-tight">{latestToast.message}</p>
          </div>
          <button
            onClick={() => setLatestToast(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
