import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Send, 
  Settings, 
  Sliders, 
  Layers, 
  Mail, 
  Smartphone, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Filter, 
  Search, 
  Eye, 
  Calendar, 
  Video, 
  Check, 
  X, 
  Edit3, 
  Radio, 
  ChevronRight, 
  UserCheck, 
  Sparkles, 
  ShieldCheck, 
  Wallet, 
  ArrowUpRight 
} from 'lucide-react';
import { 
  NotificationChannel, 
  NotificationDeliveryStatus, 
  NotificationEventName, 
  NotificationRule, 
  NotificationTemplate, 
  NotificationLog, 
  ScheduledNotification 
} from '../types';
import { 
  notificationEngine, 
  NotificationSettings, 
  NOTIFICATION_ENGINE_UPDATED 
} from '../services/notificationEngine';

interface NotificationManagementDeskProps {
  isLight: boolean;
  T: any;
}

export const NotificationManagementDesk: React.FC<NotificationManagementDeskProps> = ({ isLight, T }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rules' | 'templates' | 'send' | 'scheduled' | 'logs' | 'settings'>('dashboard');

  // Engine state
  const [settings, setSettings] = useState<NotificationSettings>(() => notificationEngine.getSettings());
  const [rules, setRules] = useState<NotificationRule[]>(() => notificationEngine.getRules());
  const [templates, setTemplates] = useState<NotificationTemplate[]>(() => notificationEngine.getTemplates());
  const [logs, setLogs] = useState<NotificationLog[]>(() => notificationEngine.getLogs());
  const [scheduled, setScheduled] = useState<ScheduledNotification[]>(() => notificationEngine.getScheduled());

  // Form states for manual send
  const [targetAudience, setTargetAudience] = useState<'all' | 'client' | 'expert' | 'landing' | 'custom'>('all');
  const [customRecipient, setCustomRecipient] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<NotificationChannel[]>(['in_app', 'email', 'push']);
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState('');

  // Logs filters
  const [logSearch, setLogSearch] = useState('');
  const [logChannelFilter, setLogChannelFilter] = useState<'all' | NotificationChannel>('all');
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | NotificationDeliveryStatus>('all');

  // Modal states for editing
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [viewingLog, setViewingLog] = useState<NotificationLog | null>(null);

  const refreshData = () => {
    setSettings(notificationEngine.getSettings());
    setRules(notificationEngine.getRules());
    setTemplates(notificationEngine.getTemplates());
    setLogs(notificationEngine.getLogs());
    setScheduled(notificationEngine.getScheduled());
  };

  useEffect(() => {
    refreshData();
    window.addEventListener(NOTIFICATION_ENGINE_UPDATED, refreshData);
    return () => {
      window.removeEventListener(NOTIFICATION_ENGINE_UPDATED, refreshData);
    };
  }, []);

  // Compute metrics
  const totalLogs = logs.length;
  const deliveredCount = logs.filter(l => l.status === 'delivered' || l.status === 'read').length;
  const readCount = logs.filter(l => l.status === 'read').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;
  const readRate = totalLogs > 0 ? Math.round((readCount / totalLogs) * 100) : 0;
  const deliveryRate = totalLogs > 0 ? Math.round((deliveredCount / totalLogs) * 100) : 100;
  const activeRulesCount = rules.filter(r => r.enabled).length;

  const inAppLogsCount = logs.filter(l => l.channel === 'in_app').length;
  const emailLogsCount = logs.filter(l => l.channel === 'email').length;
  const pushLogsCount = logs.filter(l => l.channel === 'push').length;

  // Filtered logs
  const filteredLogs = logs.filter(log => {
    if (logChannelFilter !== 'all' && log.channel !== logChannelFilter) return false;
    if (logStatusFilter !== 'all' && log.status !== logStatusFilter) return false;
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase().trim();
      const match = 
        log.eventName.toLowerCase().includes(q) ||
        (log.recipientName || '').toLowerCase().includes(q) ||
        log.recipientId.toLowerCase().includes(q) ||
        log.title.toLowerCase().includes(q) ||
        log.message.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Handle template selection in send form
  const handleSelectTemplate = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    if (!tmplId) return;
    const tmpl = templates.find(t => t.id === tmplId);
    if (tmpl) {
      setManualTitle(tmpl.titleTemplate);
      setManualMessage(tmpl.bodyTemplate);
    }
  };

  // Toggle channel in send form
  const handleToggleChannel = (ch: NotificationChannel) => {
    if (selectedChannels.includes(ch)) {
      if (selectedChannels.length === 1) return; // keep at least 1
      setSelectedChannels(selectedChannels.filter(c => c !== ch));
    } else {
      setSelectedChannels([...selectedChannels, ch]);
    }
  };

  // Send or schedule manual notification
  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualMessage.trim()) {
      alert('Please provide a notification title and message.');
      return;
    }

    setIsSending(true);

    if (sendMode === 'schedule') {
      if (!scheduleDateTime) {
        alert('Please specify the date and time for the scheduled dispatch.');
        setIsSending(false);
        return;
      }
      notificationEngine.scheduleNotification({
        eventName: 'platform_broadcast',
        title: manualTitle,
        message: manualMessage,
        recipientType: targetAudience === 'custom' ? 'all' : targetAudience,
        recipientId: targetAudience === 'custom' ? customRecipient : undefined,
        channels: selectedChannels,
        scheduledTime: scheduleDateTime,
      });
      setSendSuccessMsg('Notification successfully queued for automated future dispatch!');
    } else {
      // Send immediately
      await notificationEngine.trigger('platform_broadcast', {
        recipientType: targetAudience === 'custom' ? 'all' : targetAudience,
        recipientId: targetAudience === 'custom' ? customRecipient : undefined,
        customTitle: manualTitle,
        customMessage: manualMessage,
        topic: manualTitle,
      });
      setSendSuccessMsg('Notification successfully delivered across selected channels!');
    }

    setIsSending(false);
    refreshData();
    setTimeout(() => setSendSuccessMsg(''), 4000);
  };

  // Toggle rule status
  const handleToggleRule = (ruleId: string) => {
    notificationEngine.toggleRule(ruleId);
    refreshData();
  };

  // Save rule edit
  const handleSaveRule = () => {
    if (editingRule) {
      notificationEngine.updateRule(editingRule.id, editingRule);
      setEditingRule(null);
      refreshData();
    }
  };

  // Save template edit
  const handleSaveTemplate = () => {
    if (editingTemplate) {
      notificationEngine.updateTemplate(editingTemplate.id, editingTemplate);
      setEditingTemplate(null);
      refreshData();
    }
  };

  // Retry log item
  const handleRetryLog = (logId: string) => {
    notificationEngine.retryLog(logId);
    refreshData();
  };

  // Cancel scheduled
  const handleCancelScheduled = (id: string) => {
    notificationEngine.cancelScheduled(id);
    refreshData();
  };

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    notificationEngine.updateSettings(settings);
    alert('Notification Management settings updated successfully.');
    refreshData();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-amber-500 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse text-amber-500" />
            Desk 06 • Centralized Multi-Channel Notification Desk
          </span>
          <h1 className={`text-2xl sm:text-3xl font-serif font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>
            Notification Management
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            Full event-driven notification orchestration: Dashboard, System Rules, Variable Templates, Multi-Channel Dispatch, Automated Meeting Reminders & Delivery Logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshData}
            className={`px-3 py-2 text-xs rounded-xl font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              isLight 
                ? "bg-white border-slate-300 text-slate-800 hover:bg-slate-100" 
                : "bg-slate-900 border-white/10 text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('send')}
            className="px-4 py-2 text-xs rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all flex items-center gap-1.5 shadow-lg cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Send Broadcast
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs Bar */}
      <div className={`p-1.5 rounded-2xl border flex items-center gap-1 overflow-x-auto ${
        isLight ? "bg-[#ECE6D8] border-[#D8CFB8]" : "bg-slate-900/60 border-white/10"
      }`}>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'dashboard' 
              ? "bg-amber-500 text-slate-950 shadow-md" 
              : isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Dashboard
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'rules' 
              ? "bg-amber-500 text-slate-950 shadow-md" 
              : isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Rules ({activeRulesCount}/{rules.length})
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'templates' 
              ? "bg-amber-500 text-slate-950 shadow-md" 
              : isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          Templates ({templates.length})
        </button>

        <button
          onClick={() => setActiveTab('send')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'send' 
              ? "bg-amber-500 text-slate-950 shadow-md" 
              : isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          Send Notification
        </button>

        <button
          onClick={() => setActiveTab('scheduled')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'scheduled' 
              ? "bg-amber-500 text-slate-950 shadow-md" 
              : isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Scheduled ({scheduled.filter(s => s.status === 'scheduled').length})
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'logs' 
              ? "bg-amber-500 text-slate-950 shadow-md" 
              : isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Delivery Logs ({logs.length})
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'settings' 
              ? "bg-amber-500 text-slate-950 shadow-md" 
              : isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
      </div>

      {/* ==========================================================
          SUB-TAB 1: NOTIFICATION DASHBOARD
      ========================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl border" style={{ background: T.cardBg, borderColor: T.lineInk }}>
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Total Dispatched</span>
              <span className={`text-2xl font-black mt-1 block font-mono ${isLight ? "text-slate-900" : "text-white"}`}>
                {totalLogs}
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold mt-0.5 block flex items-center gap-1">
                <Check className="w-3 h-3" /> Multi-channel
              </span>
            </div>

            <div className="p-4 rounded-2xl border" style={{ background: T.cardBg, borderColor: T.lineInk }}>
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Delivered</span>
              <span className="text-2xl font-black text-emerald-400 mt-1 block font-mono">
                {deliveredCount}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
                {deliveryRate}% success
              </span>
            </div>

            <div className="p-4 rounded-2xl border" style={{ background: T.cardBg, borderColor: T.lineInk }}>
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Read Rate</span>
              <span className="text-2xl font-black text-amber-400 mt-1 block font-mono">
                {readRate}%
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
                {readCount} read receipts
              </span>
            </div>

            <div className="p-4 rounded-2xl border" style={{ background: T.cardBg, borderColor: T.lineInk }}>
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Failed / Bounced</span>
              <span className={`text-2xl font-black mt-1 block font-mono ${failedCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                {failedCount}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
                {failedCount === 0 ? 'Zero failures' : 'Action needed'}
              </span>
            </div>

            <div className="p-4 rounded-2xl border" style={{ background: T.cardBg, borderColor: T.lineInk }}>
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Scheduled</span>
              <span className="text-2xl font-black text-blue-400 mt-1 block font-mono">
                {scheduled.filter(s => s.status === 'scheduled').length}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
                24h, 1h & 15m active
              </span>
            </div>

            <div className="p-4 rounded-2xl border" style={{ background: T.cardBg, borderColor: T.lineInk }}>
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Active Rules</span>
              <span className="text-2xl font-black text-amber-500 mt-1 block font-mono">
                {activeRulesCount} / {rules.length}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
                Engine automated
              </span>
            </div>
          </div>

          {/* Delivery Channels Breakdown + Session Reminders Status */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Delivery Channels */}
            <div className="p-5 rounded-2xl border" style={{ background: T.cardBg, borderColor: T.lineInk }}>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? "text-slate-900" : "text-white"}`}>
                <Radio className="w-4 h-4 text-amber-500" />
                Delivery Channel Distribution
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Logs and event dispatches across the three channels</p>

              <div className="space-y-3 mt-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      <span>In-App Notification Center</span>
                    </span>
                    <span className="font-mono">{inAppLogsCount} ({totalLogs > 0 ? Math.round((inAppLogsCount/totalLogs)*100) : 0}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full" 
                      style={{ width: `${totalLogs > 0 ? Math.round((inAppLogsCount/totalLogs)*100) : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-400" />
                      <span>Email Delivery Gateway</span>
                    </span>
                    <span className="font-mono">{emailLogsCount} ({totalLogs > 0 ? Math.round((emailLogsCount/totalLogs)*100) : 0}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full" 
                      style={{ width: `${totalLogs > 0 ? Math.round((emailLogsCount/totalLogs)*100) : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Browser Push Notifications</span>
                    </span>
                    <span className="font-mono">{pushLogsCount} ({totalLogs > 0 ? Math.round((pushLogsCount/totalLogs)*100) : 0}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full" 
                      style={{ width: `${totalLogs > 0 ? Math.round((pushLogsCount/totalLogs)*100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Session Reminders Engine Status */}
            <div className="p-5 rounded-2xl border" style={{ background: T.cardBg, borderColor: T.lineInk }}>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? "text-slate-900" : "text-white"}`}>
                <Clock className="w-4 h-4 text-blue-400" />
                Automated Meeting Reminders Heartbeat
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Automated background reminders synchronized with Meeting OPS</p>

              <div className="space-y-2.5 mt-4 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-slate-900/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold">24-Hour Prior Consultation Countdown</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    {settings.sessionReminders.remind24h ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-slate-900/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold">1-Hour Prior Advisory Readiness Check</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    {settings.sessionReminders.remind1h ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-slate-900/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold">15-Minute Direct Google Meet Call Prompt</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    {settings.sessionReminders.remind15m ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Notification Activity Stream */}
          <div className="p-5 rounded-2xl border" style={{ background: T.cardBg, borderColor: T.lineInk }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                  Recent Platform Dispatches & Audit Activity
                </h3>
                <p className="text-xs text-slate-400">Real-time log trace of dispatched events and notifications</p>
              </div>
              <button
                onClick={() => setActiveTab('logs')}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <span>View Full Log Registry</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b ${isLight ? "border-slate-200 text-slate-500" : "border-white/10 text-slate-400"}`}>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Event Trigger</th>
                    <th className="py-2.5 px-3">Target Recipient</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Message Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.slice(0, 6).map((item) => (
                    <tr key={item.id} className={isLight ? "hover:bg-slate-100/60" : "hover:bg-slate-900/40"}>
                      <td className="py-2.5 px-3 text-slate-400 font-mono whitespace-nowrap">{item.createdAt}</td>
                      <td className="py-2.5 px-3 font-semibold text-amber-400 whitespace-nowrap">{item.eventName}</td>
                      <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                        {item.recipientName || item.recipientId}
                        <span className="text-[10px] text-slate-500 block uppercase">{item.recipientType}</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                          item.channel === 'email' ? 'bg-blue-500/20 text-blue-400' :
                          item.channel === 'push' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {item.channel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1 w-fit ${
                          item.status === 'read' ? 'bg-amber-500/20 text-amber-300' :
                          item.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-rose-500/20 text-rose-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            item.status === 'read' ? 'bg-amber-400' :
                            item.status === 'delivered' ? 'bg-emerald-400' :
                            'bg-rose-400'
                          }`} />
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          SUB-TAB 2: NOTIFICATION RULES
      ========================================================== */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ background: T.cardBg, borderColor: T.lineInk }}>
            <div>
              <h3 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                System Event Trigger Rules
              </h3>
              <p className="text-xs text-slate-400">
                Configure automated notification dispatch rules when users interact with the platform.
              </p>
            </div>
            <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
              {activeRulesCount} Active Rules Configured
            </span>
          </div>

          <div className="grid gap-3">
            {rules.map((rule) => (
              <div 
                key={rule.id}
                className="p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                style={{ background: T.cardBg, borderColor: T.lineInk }}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className={`text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                      {rule.title}
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-amber-400 border border-white/10">
                      {rule.eventName}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      rule.priority === 'urgent' ? 'bg-rose-500/20 text-rose-400' :
                      rule.priority === 'high' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-500/20 text-slate-300'
                    }`}>
                      {rule.priority} priority
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{rule.description}</p>

                  <div className="flex items-center gap-3 pt-1 flex-wrap text-[11px]">
                    <span className="text-slate-400 font-medium">
                      Audience: <strong className="text-white capitalize">{rule.recipientTypes.join(', ')}</strong>
                    </span>
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      Channels:
                      {rule.channels.map(c => (
                        <span key={c} className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 uppercase">
                          {c}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingRule(rule)}
                    className="p-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    title="Edit Rule Settings"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Configure</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleRule(rule.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      rule.enabled 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30' 
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==========================================================
          SUB-TAB 3: NOTIFICATION TEMPLATES
      ========================================================== */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ background: T.cardBg, borderColor: T.lineInk }}>
            <div>
              <h3 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                Dynamic Message Templates & Variable Substitution
              </h3>
              <p className="text-xs text-slate-400">
                Customize message wording with dynamic tags like <code className="text-amber-400 font-mono">{"{{client_name}}"}</code>, <code className="text-amber-400 font-mono">{"{{expert_name}}"}</code>, <code className="text-amber-400 font-mono">{"{{meeting_link}}"}</code>.
              </p>
            </div>
            <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
              {templates.length} Active Templates
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {templates.map((tmpl) => (
              <div 
                key={tmpl.id}
                className="p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all"
                style={{ background: T.cardBg, borderColor: T.lineInk }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                      {tmpl.name}
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase">
                      {tmpl.category}
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Subject / Header:</span>
                    <p className="font-semibold text-amber-300 text-xs">{tmpl.subject || tmpl.titleTemplate}</p>
                  </div>

                  <div className="text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Body Template:</span>
                    <p className={`p-2.5 rounded-xl border text-xs leading-relaxed ${
                      isLight ? "bg-slate-100 border-slate-200 text-slate-800" : "bg-slate-900/60 border-white/10 text-slate-300"
                    }`}>
                      {tmpl.bodyTemplate}
                    </p>
                  </div>

                  {/* Variables */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-slate-400 font-semibold">Variables:</span>
                    {tmpl.variables.map(v => (
                      <span key={v} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingTemplate(tmpl)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==========================================================
          SUB-TAB 4: SEND NOTIFICATION (BROADCAST / MANUAL)
      ========================================================== */}
      {activeTab === 'send' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border" style={{ background: T.cardBg, borderColor: T.lineInk }}>
            <h3 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
              Dispatch Platform Broadcast / Manual Alert
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Target all platform users, specific portals (Clients or Experts), or individual recipients across In-App, Email, and Push channels.
            </p>
          </div>

          {sendSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" />
              {sendSuccessMsg}
            </div>
          )}

          <div className="p-6 rounded-2xl border shadow-xl" style={{ background: T.cardBg, borderColor: T.lineInk }}>
            <form onSubmit={handleDispatch} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Target Audience */}
                <div>
                  <label className="text-xs font-bold block mb-1.5 text-amber-400 uppercase tracking-wider">
                    1. Target Audience:
                  </label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as any)}
                    className={`w-full px-3 py-2.5 text-xs rounded-xl border font-bold outline-none cursor-pointer ${
                      isLight 
                        ? "bg-white border-slate-300 text-slate-900 focus:border-amber-500" 
                        : "bg-slate-900 border-slate-700 text-white focus:border-amber-400"
                    }`}
                  >
                    <option value="all">📢 All Platform Users (Universal Broadcast)</option>
                    <option value="client">💼 All Enterprise & Startup Clients</option>
                    <option value="expert">🎖️ All Senior Professionals & Experts</option>
                    <option value="landing">🌐 Landing Page / Public Announcement</option>
                    <option value="custom">🎯 Custom Specific User ID / Recipient</option>
                  </select>

                  {targetAudience === 'custom' && (
                    <input
                      type="text"
                      value={customRecipient}
                      onChange={(e) => setCustomRecipient(e.target.value)}
                      placeholder="Enter client name, expert name, or user ID (e.g. Expert JK)"
                      className={`w-full mt-2 px-3 py-2 text-xs rounded-xl border outline-none ${
                        isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                      }`}
                      required
                    />
                  )}
                </div>

                {/* Template Quick Select */}
                <div>
                  <label className="text-xs font-bold block mb-1.5 text-amber-400 uppercase tracking-wider">
                    2. Load from Template (Optional):
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    className={`w-full px-3 py-2.5 text-xs rounded-xl border font-bold outline-none cursor-pointer ${
                      isLight 
                        ? "bg-white border-slate-300 text-slate-900 focus:border-amber-500" 
                        : "bg-slate-900 border-slate-700 text-white focus:border-amber-400"
                    }`}
                  >
                    <option value="">-- Custom Manual Composition --</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Delivery Channels */}
              <div>
                <label className="text-xs font-bold block mb-1.5 text-amber-400 uppercase tracking-wider">
                  3. Select Delivery Channels:
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    selectedChannels.includes('in_app') 
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300" 
                      : "bg-slate-900/30 border-white/10 text-slate-400"
                  }`}>
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes('in_app')}
                      onChange={() => handleToggleChannel('in_app')}
                      className="accent-amber-500"
                    />
                    <Bell className="w-3.5 h-3.5" />
                    <span>In-App Center Alert</span>
                  </label>

                  <label className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    selectedChannels.includes('email') 
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-300" 
                      : "bg-slate-900/30 border-white/10 text-slate-400"
                  }`}>
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes('email')}
                      onChange={() => handleToggleChannel('email')}
                      className="accent-amber-500"
                    />
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Gateway</span>
                  </label>

                  <label className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    selectedChannels.includes('push') 
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" 
                      : "bg-slate-900/30 border-white/10 text-slate-400"
                  }`}>
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes('push')}
                      onChange={() => handleToggleChannel('push')}
                      className="accent-amber-500"
                    />
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Browser Push Notification</span>
                  </label>
                </div>
              </div>

              {/* Title & Body */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold block mb-1 text-slate-300">
                    Subject / Notification Title:
                  </label>
                  <input
                    type="text"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="e.g. Important Advisory Window Update for Senior CXO Sessions"
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none font-semibold ${
                      isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1 text-slate-300">
                    Message Body Content:
                  </label>
                  <textarea
                    rows={4}
                    value={manualMessage}
                    onChange={(e) => setManualMessage(e.target.value)}
                    placeholder="Provide full details. If targeting automated events, variables will be substituted dynamically."
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none font-medium resize-none leading-relaxed ${
                      isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Send Mode: Now vs Schedule */}
              <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="sendMode"
                      value="now"
                      checked={sendMode === 'now'}
                      onChange={() => setSendMode('now')}
                      className="accent-amber-500"
                    />
                    <span>Send Immediately (Real-Time)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="sendMode"
                      value="schedule"
                      checked={sendMode === 'schedule'}
                      onChange={() => setSendMode('schedule')}
                      className="accent-amber-500"
                    />
                    <span>Schedule for Later Date & Time</span>
                  </label>
                </div>

                {sendMode === 'schedule' && (
                  <div className="pt-2">
                    <label className="text-xs font-bold block mb-1 text-slate-300">
                      Target Schedule Date & Time:
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduleDateTime}
                      onChange={(e) => setScheduleDateTime(e.target.value)}
                      className={`px-3 py-2 text-xs rounded-xl border outline-none font-mono ${
                        isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                      }`}
                      required={sendMode === 'schedule'}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-6 py-2.5 text-xs rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispatching Notification...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendMode === 'schedule' ? 'Queue Scheduled Notification' : 'Execute Real-Time Broadcast'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================
          SUB-TAB 5: SCHEDULED NOTIFICATIONS
      ========================================================== */}
      {activeTab === 'scheduled' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ background: T.cardBg, borderColor: T.lineInk }}>
            <div>
              <h3 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                Scheduled & Automated Reminders Queue
              </h3>
              <p className="text-xs text-slate-400">
                Active queued dispatches including automated 24-hour, 1-hour, and 15-minute consultation countdowns.
              </p>
            </div>
            <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
              {scheduled.length} Queued Items
            </span>
          </div>

          {scheduled.length === 0 ? (
            <div className="py-16 text-center space-y-2 border rounded-2xl" style={{ background: T.cardBg, borderColor: T.lineInk }}>
              <Clock className="w-8 h-8 mx-auto text-slate-500 opacity-40" />
              <p className="text-xs font-bold text-slate-300">No scheduled notifications pending</p>
              <p className="text-[11px] text-slate-500">Scheduled broadcasts and meeting reminders will appear here when active.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {scheduled.map((item) => (
                <div 
                  key={item.id}
                  className="p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                  style={{ background: T.cardBg, borderColor: T.lineInk }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                        {item.title}
                      </h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        item.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                        item.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">{item.message}</p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400 flex-wrap">
                      <span>Target: <strong className="text-white capitalize">{item.recipientType}</strong></span>
                      <span>Scheduled for: <strong className="text-amber-400 font-mono">{item.scheduledTime}</strong></span>
                      <span className="flex items-center gap-1">
                        Channels: 
                        {item.channels.map(c => (
                          <span key={c} className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-white/5 border border-white/10">
                            {c}
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>

                  {item.status === 'scheduled' && (
                    <div className="self-end md:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCancelScheduled(item.id)}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
                      >
                        Cancel Dispatch
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==========================================================
          SUB-TAB 6: NOTIFICATION LOGS & AUDIT TRAIL
      ========================================================== */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border" style={{ background: T.cardBg, borderColor: T.lineInk }}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                  Audit & Delivery Logs Registry
                </h3>
                <p className="text-xs text-slate-400">
                  Searchable, verifiable log of all multi-channel notification events, deliveries, and read receipts.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Search logs..."
                    className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border outline-none font-medium ${
                      isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                    }`}
                  />
                </div>

                <select
                  value={logChannelFilter}
                  onChange={(e) => setLogChannelFilter(e.target.value as any)}
                  className={`px-2.5 py-1.5 text-xs rounded-xl border outline-none font-bold cursor-pointer ${
                    isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                  }`}
                >
                  <option value="all">All Channels</option>
                  <option value="in_app">In-App</option>
                  <option value="email">Email</option>
                  <option value="push">Push</option>
                </select>

                <select
                  value={logStatusFilter}
                  onChange={(e) => setLogStatusFilter(e.target.value as any)}
                  className={`px-2.5 py-1.5 text-xs rounded-xl border outline-none font-bold cursor-pointer ${
                    isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                  }`}
                >
                  <option value="all">All Statuses</option>
                  <option value="delivered">Delivered</option>
                  <option value="read">Read</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl border shadow-xl overflow-x-auto" style={{ background: T.cardBg, borderColor: T.lineInk }}>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${isLight ? "border-slate-200 text-slate-500" : "border-white/10 text-slate-400"}`}>
                  <th className="py-2.5 px-3">Log ID</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Event Name</th>
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Subject / Title</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      No logs matching current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className={isLight ? "hover:bg-slate-100/60" : "hover:bg-slate-900/40"}>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[10px]">{log.id.slice(0, 12)}...</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono whitespace-nowrap">{log.createdAt}</td>
                      <td className="py-2.5 px-3 font-semibold text-amber-400 whitespace-nowrap">{log.eventName}</td>
                      <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                        {log.recipientName || log.recipientId}
                        <span className="text-[10px] text-slate-500 block uppercase">{log.recipientType}</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                          log.channel === 'email' ? 'bg-blue-500/20 text-blue-400' :
                          log.channel === 'push' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {log.channel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1 w-fit ${
                          log.status === 'read' ? 'bg-amber-500/20 text-amber-300' :
                          log.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-rose-500/20 text-rose-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            log.status === 'read' ? 'bg-amber-400' :
                            log.status === 'delivered' ? 'bg-emerald-400' :
                            'bg-rose-400'
                          }`} />
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 max-w-xs truncate">{log.title}</td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingLog(log)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Inspect Log Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {log.status === 'failed' && (
                            <button
                              type="button"
                              onClick={() => handleRetryLog(log.id)}
                              className="px-2 py-1 text-[10px] font-bold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==========================================================
          SUB-TAB 7: NOTIFICATION SETTINGS
      ========================================================== */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border" style={{ background: T.cardBg, borderColor: T.lineInk }}>
            <h3 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
              Global Notification Engine Configuration
            </h3>
            <p className="text-xs text-slate-400">
              Master delivery switches, quiet hours schedule, and automated session reminder rules.
            </p>
          </div>

          <div className="p-6 rounded-2xl border shadow-xl" style={{ background: T.cardBg, borderColor: T.lineInk }}>
            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Master Switches */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">
                  1. Master Channel Delivery Switches
                </h4>
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-slate-900/40 cursor-pointer">
                    <span className="flex items-center gap-2 text-xs font-bold">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <span>In-App Notification Center</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.masterInAppEnabled}
                      onChange={(e) => setSettings({ ...settings, masterInAppEnabled: e.target.checked })}
                      className="accent-amber-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-slate-900/40 cursor-pointer">
                    <span className="flex items-center gap-2 text-xs font-bold">
                      <Mail className="w-4 h-4 text-blue-400" />
                      <span>Email Delivery Gateway</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.masterEmailEnabled}
                      onChange={(e) => setSettings({ ...settings, masterEmailEnabled: e.target.checked })}
                      className="accent-amber-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-slate-900/40 cursor-pointer">
                    <span className="flex items-center gap-2 text-xs font-bold">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      <span>Browser Push Notifications</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.masterPushEnabled}
                      onChange={(e) => setSettings({ ...settings, masterPushEnabled: e.target.checked })}
                      className="accent-amber-500 rounded"
                    />
                  </label>
                </div>
              </div>

              {/* Consultation Reminders */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">
                  2. Automated Consultation Session Reminders
                </h4>
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-slate-900/40 cursor-pointer">
                    <span className="text-xs font-bold">
                      <span>24 Hours Prior Countdown</span>
                      <span className="text-[10px] text-slate-400 block font-normal">Dispatches day-before session reminder</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.sessionReminders.remind24h}
                      onChange={(e) => setSettings({
                        ...settings,
                        sessionReminders: { ...settings.sessionReminders, remind24h: e.target.checked }
                      })}
                      className="accent-amber-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-slate-900/40 cursor-pointer">
                    <span className="text-xs font-bold">
                      <span>1 Hour Prior Readiness Check</span>
                      <span className="text-[10px] text-slate-400 block font-normal">Prompts camera/audio readiness</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.sessionReminders.remind1h}
                      onChange={(e) => setSettings({
                        ...settings,
                        sessionReminders: { ...settings.sessionReminders, remind1h: e.target.checked }
                      })}
                      className="accent-amber-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-slate-900/40 cursor-pointer">
                    <span className="text-xs font-bold">
                      <span>15 Minutes Direct Call Prompt</span>
                      <span className="text-[10px] text-slate-400 block font-normal">Urgent push with Google Meet link</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.sessionReminders.remind15m}
                      onChange={(e) => setSettings({
                        ...settings,
                        sessionReminders: { ...settings.sessionReminders, remind15m: e.target.checked }
                      })}
                      className="accent-amber-500 rounded"
                    />
                  </label>
                </div>
              </div>

              {/* Quiet Hours & Retry Threshold */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-white">Quiet Hours Policy</h5>
                      <p className="text-[11px] text-slate-400">Silence non-critical alerts during night hours</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.quietHoursEnabled}
                      onChange={(e) => setSettings({ ...settings, quietHoursEnabled: e.target.checked })}
                      className="accent-amber-500 rounded"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Start Time:</span>
                      <input
                        type="time"
                        value={settings.quietHoursStart}
                        onChange={(e) => setSettings({ ...settings, quietHoursStart: e.target.value })}
                        className={`w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none font-mono ${
                          isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                        }`}
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">End Time:</span>
                      <input
                        type="time"
                        value={settings.quietHoursEnd}
                        onChange={(e) => setSettings({ ...settings, quietHoursEnd: e.target.value })}
                        className={`w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none font-mono ${
                          isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 space-y-3">
                  <div>
                    <h5 className="text-xs font-bold text-white">Retry & Failover Policy</h5>
                    <p className="text-[11px] text-slate-400">Maximum automatic retry count for failed dispatches</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Max Retries:</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={settings.retryThreshold}
                      onChange={(e) => setSettings({ ...settings, retryThreshold: parseInt(e.target.value) || 3 })}
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border outline-none font-mono ${
                        isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-xl flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Global Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================
          MODAL: EDIT TEMPLATE
      ========================================================== */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150" style={{ background: T.cardBg, borderColor: T.lineInk }}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                Edit Template: {editingTemplate.name}
              </h3>
              <button 
                type="button" 
                onClick={() => setEditingTemplate(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Subject Line:</label>
                <input
                  type="text"
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Title Template:</label>
                <input
                  type="text"
                  value={editingTemplate.titleTemplate}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, titleTemplate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Body Template:</label>
                <textarea
                  rows={4}
                  value={editingTemplate.bodyTemplate}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyTemplate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none resize-none leading-relaxed"
                />
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Allowed Variables:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {editingTemplate.variables.map(v => (
                    <span key={v} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          MODAL: EDIT RULE
      ========================================================== */}
      {editingRule && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150" style={{ background: T.cardBg, borderColor: T.lineInk }}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                Configure Rule: {editingRule.title}
              </h3>
              <button 
                type="button" 
                onClick={() => setEditingRule(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Priority Level:</label>
                <select
                  value={editingRule.priority}
                  onChange={(e) => setEditingRule({ ...editingRule, priority: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none cursor-pointer"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent Priority</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1.5">Active Channels:</label>
                <div className="flex items-center gap-3">
                  {(['in_app', 'email', 'push'] as NotificationChannel[]).map((ch) => (
                    <label key={ch} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingRule.channels.includes(ch)}
                        onChange={(e) => {
                          const exists = editingRule.channels.includes(ch);
                          const updated = exists 
                            ? editingRule.channels.filter(c => c !== ch) 
                            : [...editingRule.channels, ch];
                          if (updated.length > 0) {
                            setEditingRule({ ...editingRule, channels: updated });
                          }
                        }}
                        className="accent-amber-500 rounded"
                      />
                      <span className="uppercase font-mono text-[11px]">{ch}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-slate-900/40">
                <span className="font-bold text-white">Rule Active Status</span>
                <input
                  type="checkbox"
                  checked={editingRule.enabled}
                  onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
                  className="accent-amber-500 rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRule}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
              >
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          MODAL: VIEW LOG DETAILS
      ========================================================== */}
      {viewingLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150" style={{ background: T.cardBg, borderColor: T.lineInk }}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                Notification Payload & Delivery Audit
              </h3>
              <button 
                type="button" 
                onClick={() => setViewingLog(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Event Name:</span>
                  <span className="font-mono text-amber-400 font-bold">{viewingLog.eventName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Channel:</span>
                  <span className="font-mono text-emerald-400 font-bold uppercase">{viewingLog.channel}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Recipient:</span>
                  <span className="text-white font-medium">{viewingLog.recipientName || viewingLog.recipientId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Status:</span>
                  <span className="text-amber-400 font-bold uppercase">{viewingLog.status}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Title:</span>
                <p className="text-white font-semibold">{viewingLog.title}</p>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Message Content:</span>
                <p className="p-3 rounded-xl bg-slate-900 border border-white/10 text-slate-300 leading-relaxed">
                  {viewingLog.message}
                </p>
              </div>

              {viewingLog.metadata && Object.keys(viewingLog.metadata).length > 0 && (
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Metadata Payload:</span>
                  <pre className="p-2.5 rounded-xl bg-slate-950 font-mono text-[10px] text-slate-400 overflow-x-auto">
                    {JSON.stringify(viewingLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setViewingLog(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
