import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  CalendarDays, 
  Info, 
  Save, 
  Filter,
  Sparkles,
  ShieldCheck,
  User,
  Video
} from 'lucide-react';
import { mongoDB, ExpertAvailabilityDoc } from '../mongoDBService';

interface ExpertAvailabilityManagerProps {
  expertId: string;
  expertName?: string;
  isAdmin?: boolean;
  theme?: 'dark' | 'light';
  onAvailabilityChange?: () => void;
}

export const ExpertAvailabilityManager: React.FC<ExpertAvailabilityManagerProps> = ({
  expertId,
  expertName,
  isAdmin = false,
  theme = 'dark',
  onAvailabilityChange
}) => {
  const isLight = theme === 'light';

  // Helper: Format YYYY-MM-DD
  const formatDateToYMD = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const todayStr = useMemo(() => formatDateToYMD(new Date()), []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [availabilities, setAvailabilities] = useState<ExpertAvailabilityDoc[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Form State for Adding Slot
  const [startTime, setStartTime] = useState<string>('10:00 AM');
  const [endTime, setEndTime] = useState<string>('11:00 AM');
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form State for Editing Slot
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState<string>('');
  const [editEndTime, setEditEndTime] = useState<string>('');
  const [editDuration, setEditDuration] = useState<number>(60);
  const [editStatus, setEditStatus] = useState<'AVAILABLE' | 'DISABLED'>('AVAILABLE');

  // Filter for upcoming list
  const [upcomingFilter, setUpcomingFilter] = useState<'ALL' | 'AVAILABLE' | 'BOOKED' | 'DISABLED'>('ALL');
  const [searchDateQuery, setSearchDateQuery] = useState<string>('');

  const standardTimeOptions = [
    '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
    '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
    '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
    '08:00 PM', '08:30 PM', '09:00 PM'
  ];

  // Parse time string to minutes from midnight
  const parseTimeToMinutes = (timeStr: string): number | null => {
    if (!timeStr) return null;
    const clean = timeStr.trim();
    const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = parseInt(match12[2], 10);
      const ampm = match12[3].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    }
    const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      const hours = parseInt(match24[1], 10);
      const minutes = parseInt(match24[2], 10);
      return hours * 60 + minutes;
    }
    return null;
  };

  // Convert minutes from midnight to formatted 12-hour time
  const minutesToTimeString = (minutes: number): string => {
    const hours24 = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${String(hours12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
  };

  // Calculate duration in minutes between start and end
  const calculateDuration = (startStr: string, endStr: string): number => {
    const s = parseTimeToMinutes(startStr);
    const e = parseTimeToMinutes(endStr);
    if (s === null || e === null || e <= s) return 60;
    return e - s;
  };

  // When start time changes, auto-adjust end time based on selected duration
  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    const startMin = parseTimeToMinutes(newStart);
    if (startMin !== null) {
      const endMin = startMin + selectedDuration;
      if (endMin <= 23 * 60 + 59) {
        setEndTime(minutesToTimeString(endMin));
      }
    }
  };

  // When duration pill is clicked, calculate new end time
  const handleDurationSelect = (durationMinutes: number) => {
    setSelectedDuration(durationMinutes);
    const startMin = parseTimeToMinutes(startTime);
    if (startMin !== null) {
      const endMin = startMin + durationMinutes;
      if (endMin <= 23 * 60 + 59) {
        setEndTime(minutesToTimeString(endMin));
      }
    }
  };

  // Handlers for Edit Form
  const handleEditStartTimeChange = (newStart: string) => {
    setEditStartTime(newStart);
    const startMin = parseTimeToMinutes(newStart);
    if (startMin !== null) {
      const endMin = startMin + editDuration;
      if (endMin <= 23 * 60 + 59) {
        setEditEndTime(minutesToTimeString(endMin));
      }
    }
  };

  const handleEditEndTimeChange = (newEnd: string) => {
    setEditEndTime(newEnd);
    const dur = calculateDuration(editStartTime, newEnd);
    setEditDuration(dur);
  };

  const handleEditDurationSelect = (durMinutes: number) => {
    setEditDuration(durMinutes);
    const startMin = parseTimeToMinutes(editStartTime);
    if (startMin !== null) {
      const endMin = startMin + durMinutes;
      if (endMin <= 23 * 60 + 59) {
        setEditEndTime(minutesToTimeString(endMin));
      }
    }
  };

  const isSlotInPast = (dateStr: string, slotStartTime: string): boolean => {
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;
    const startMin = parseTimeToMinutes(slotStartTime);
    if (startMin === null) return false;
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    return startMin <= currentMin;
  };

  // Load availabilities
  const fetchAvailabilities = async () => {
    if (!expertId) return;
    try {
      const list = await mongoDB.getAvailabilities(expertId);
      setAvailabilities(list);
    } catch {
      const local = mongoDB.getLocalAvailabilities().filter(a => a.expertId === expertId);
      setAvailabilities(local);
    }
  };

  useEffect(() => {
    fetchAvailabilities();

    const handleDbUpdate = () => {
      fetchAvailabilities();
    };
    window.addEventListener('mongo_db_updated', handleDbUpdate);
    return () => {
      window.removeEventListener('mongo_db_updated', handleDbUpdate);
    };
  }, [expertId]);

  // Slots for the currently selected date
  const selectedDateSlots = useMemo(() => {
    return availabilities
      .filter(a => a.availabilityDate === selectedDate)
      .sort((a, b) => (parseTimeToMinutes(a.startTime) || 0) - (parseTimeToMinutes(b.startTime) || 0));
  }, [availabilities, selectedDate]);

  // Map of dates to slot counts for calendar indicators
  const dateSlotCounts = useMemo(() => {
    const counts: Record<string, { available: number; booked: number; disabled: number }> = {};
    availabilities.forEach(a => {
      if (!counts[a.availabilityDate]) {
        counts[a.availabilityDate] = { available: 0, booked: 0, disabled: 0 };
      }
      if (a.status === 'AVAILABLE') counts[a.availabilityDate].available++;
      else if (a.status === 'BOOKED') counts[a.availabilityDate].booked++;
      else if (a.status === 'DISABLED') counts[a.availabilityDate].disabled++;
    });
    return counts;
  }, [availabilities]);

  // All upcoming slots across future dates
  const upcomingSlots = useMemo(() => {
    return availabilities
      .filter(a => {
        if (a.availabilityDate < todayStr) return false;
        if (upcomingFilter !== 'ALL' && a.status !== upcomingFilter) return false;
        if (searchDateQuery.trim()) {
          const q = searchDateQuery.toLowerCase();
          const matchDate = a.availabilityDate.includes(q);
          const matchClient = a.clientName && a.clientName.toLowerCase().includes(q);
          if (!matchDate && !matchClient) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.availabilityDate !== b.availabilityDate) {
          return a.availabilityDate.localeCompare(b.availabilityDate);
        }
        return (parseTimeToMinutes(a.startTime) || 0) - (parseTimeToMinutes(b.startTime) || 0);
      });
  }, [availabilities, todayStr, upcomingFilter, searchDateQuery]);

  // Metrics summary
  const metrics = useMemo(() => {
    const todaySlots = availabilities.filter(a => a.availabilityDate === todayStr);
    const upcoming = availabilities.filter(a => a.availabilityDate >= todayStr);
    const availableUpcoming = upcoming.filter(a => a.status === 'AVAILABLE');
    const bookedUpcoming = upcoming.filter(a => a.status === 'BOOKED');
    
    // Total hours calculated from available upcoming slots
    const totalMinutes = availableUpcoming.reduce((acc, s) => {
      const dur = calculateDuration(s.startTime, s.endTime);
      return acc + dur;
    }, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    return {
      todayCount: todaySlots.length,
      todayAvailable: todaySlots.filter(a => a.status === 'AVAILABLE').length,
      upcomingAvailable: availableUpcoming.length,
      upcomingBooked: bookedUpcoming.length,
      totalHours
    };
  }, [availabilities, todayStr]);

  // Validation function
  const validateSlot = (dateStr: string, sTime: string, eTime: string, excludeSlotId?: string): string | null => {
    if (dateStr < todayStr) {
      return 'Past dates cannot be selected for availability.';
    }
    const startMin = parseTimeToMinutes(sTime);
    const endMin = parseTimeToMinutes(eTime);
    if (startMin === null || endMin === null) {
      return 'Please enter valid start and end times.';
    }
    if (startMin >= endMin) {
      return `Start time (${sTime}) must be strictly earlier than end time (${eTime}).`;
    }
    // Only check past start time when creating a new slot, allowing edits to today's existing slots
    if (!excludeSlotId && isSlotInPast(dateStr, sTime)) {
      return `Cannot configure time slot that has already passed today (${sTime}).`;
    }

    // Interval Overlap Validation: slot [startMin, endMin] overlaps [otherStart, otherEnd] if startMin < otherEnd && endMin > otherStart
    const overlapping = availabilities.find(a => {
      if (a.id === excludeSlotId) return false;
      if (a.expertId !== expertId || a.availabilityDate !== dateStr) return false;
      const otherStart = parseTimeToMinutes(a.startTime);
      const otherEnd = parseTimeToMinutes(a.endTime);
      if (otherStart === null || otherEnd === null) return false;
      return startMin < otherEnd && endMin > otherStart;
    });

    if (overlapping) {
      return `Time slot (${sTime} – ${eTime}) overlaps with existing slot ${overlapping.startTime} – ${overlapping.endTime}.`;
    }

    return null;
  };

  // Add Time Slot Handler
  const handleAddSlot = async () => {
    setFeedback(null);
    const err = validateSlot(selectedDate, startTime, endTime);
    if (err) {
      setFeedback({ type: 'error', text: err });
      return;
    }

    setIsSaving(true);
    try {
      await mongoDB.saveAvailability({
        expertId,
        availabilityDate: selectedDate,
        startTime,
        endTime,
        status: 'AVAILABLE'
      });

      setFeedback({ type: 'success', text: `Added slot: ${startTime} – ${endTime} for ${selectedDate}` });
      await fetchAvailabilities();
      if (onAvailabilityChange) onAvailabilityChange();

      // Automatically advance next slot suggestion
      const endMin = parseTimeToMinutes(endTime);
      if (endMin !== null && endMin + selectedDuration <= 22 * 60) {
        const nextStart = endTime;
        const nextEnd = minutesToTimeString(endMin + selectedDuration);
        setStartTime(nextStart);
        setEndTime(nextEnd);
      }
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.message || 'Failed to add availability slot.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Preset Add
  const handleAddPreset = (s: string, e: string) => {
    setStartTime(s);
    setEndTime(e);
    const dur = calculateDuration(s, e);
    setSelectedDuration(dur);
  };

  // One-click batch standard day slots
  const handleAddStandardDaySchedule = async () => {
    setFeedback(null);
    const standardSlots = [
      { start: '10:00 AM', end: '11:00 AM' },
      { start: '02:00 PM', end: '03:00 PM' },
      { start: '04:00 PM', end: '05:00 PM' }
    ];

    setIsSaving(true);
    let addedCount = 0;
    try {
      for (const slot of standardSlots) {
        const err = validateSlot(selectedDate, slot.start, slot.end);
        if (!err) {
          await mongoDB.saveAvailability({
            expertId,
            availabilityDate: selectedDate,
            startTime: slot.start,
            endTime: slot.end,
            status: 'AVAILABLE'
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        setFeedback({ type: 'success', text: `Successfully generated ${addedCount} standard advisory slot(s) for ${selectedDate}.` });
        await fetchAvailabilities();
        if (onAvailabilityChange) onAvailabilityChange();
      } else {
        setFeedback({ type: 'info', text: 'Standard slots for this date already exist or conflict with past times.' });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.message || 'Failed to populate standard day schedule.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Disable / Available
  const handleToggleStatus = async (slot: ExpertAvailabilityDoc) => {
    if (slot.status === 'BOOKED') {
      setFeedback({ type: 'error', text: 'Booked slots cannot be modified directly.' });
      return;
    }
    const nextStatus = slot.status === 'AVAILABLE' ? 'DISABLED' : 'AVAILABLE';
    const updatedSlot: ExpertAvailabilityDoc = {
      ...slot,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    };

    // Immediate UI update
    setAvailabilities(prev => prev.map(s => s.id === slot.id ? updatedSlot : s));

    try {
      await mongoDB.saveAvailability(updatedSlot);
      setFeedback({ type: 'success', text: `Slot updated to ${nextStatus === 'AVAILABLE' ? 'Available' : 'Unavailable'}` });
      await fetchAvailabilities();
      if (onAvailabilityChange) onAvailabilityChange();
    } catch {
      setFeedback({ type: 'error', text: 'Failed to update slot status.' });
      await fetchAvailabilities();
    }
  };

  // Delete Slot
  const handleDeleteSlot = async (slot: ExpertAvailabilityDoc) => {
    if (slot.status === 'BOOKED' && !isAdmin) {
      setFeedback({ type: 'error', text: 'Booked slots cannot be deleted by expert while active.' });
      return;
    }
    if (!confirm(`Delete ${slot.startTime} – ${slot.endTime}?`)) {
      return;
    }
    try {
      // Immediate UI update
      setAvailabilities(prev => prev.filter(s => s.id !== slot.id));
      await mongoDB.deleteAvailability(slot.id);
      setFeedback({ type: 'success', text: `Slot ${slot.startTime} – ${slot.endTime} deleted successfully.` });
      await fetchAvailabilities();
      if (onAvailabilityChange) onAvailabilityChange();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to delete availability slot.' });
      await fetchAvailabilities();
    }
  };

  // Save Inline Edit
  const handleSaveEdit = async (slot: ExpertAvailabilityDoc) => {
    setFeedback(null);
    const err = validateSlot(slot.availabilityDate, editStartTime, editEndTime, slot.id);
    if (err) {
      setFeedback({ type: 'error', text: err });
      return;
    }

    const updatedSlot: ExpertAvailabilityDoc = {
      ...slot,
      startTime: editStartTime,
      endTime: editEndTime,
      status: editStatus,
      updatedAt: new Date().toISOString()
    };

    // Immediate UI update & close edit form
    setAvailabilities(prev => prev.map(s => s.id === slot.id ? updatedSlot : s));
    setEditingSlotId(null);

    try {
      await mongoDB.saveAvailability(updatedSlot);
      setFeedback({ type: 'success', text: `Slot updated to ${editStartTime} – ${editEndTime} successfully.` });
      await fetchAvailabilities();
      if (onAvailabilityChange) onAvailabilityChange();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to update slot.' });
      await fetchAvailabilities();
    }
  };

  // Calendar Navigation
  const prevMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const jumpToToday = () => {
    setCalendarMonth(new Date());
    setSelectedDate(todayStr);
  };

  // Generate Calendar Days
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean; isPast: boolean }> = [];

    // Prev month padding
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const prevDate = new Date(year, month - 1, d);
      const dateStr = formatDateToYMD(prevDate);
      days.push({ dateStr, dayNum: d, isCurrentMonth: false, isPast: dateStr < todayStr });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const curDate = new Date(year, month, d);
      const dateStr = formatDateToYMD(curDate);
      days.push({ dateStr, dayNum: d, isCurrentMonth: true, isPast: dateStr < todayStr });
    }

    // Next month padding to fill complete grid rows (multiple of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = formatDateToYMD(nextDate);
      days.push({ dateStr, dayNum: d, isCurrentMonth: false, isPast: dateStr < todayStr });
    }

    return days;
  }, [calendarMonth, todayStr]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className={`rounded-3xl border transition-all duration-200 shadow-2xl p-6 md:p-8 space-y-8 ${
      isLight ? 'bg-white border-slate-200/90 text-slate-900 shadow-slate-200/50' : 'bg-[#0B111A] border-white/10 text-white shadow-black/60'
    }`}>
      
      {/* Executive Header & KPI Ribbon */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6 border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black tracking-tight">
                  Slot Availability Management
                </h2>
                {isAdmin && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <ShieldCheck size={12} /> Admin Governance Mode
                  </span>
                )}
                {expertName && (
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    isLight ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white/5 border-white/10 text-slate-300'
                  }`}>
                    {expertName}
                  </span>
                )}
              </div>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Publish explicit consultation windows for direct 1-on-1 client bookings with atomic double-booking prevention.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Synchronization Active
            </span>
          </div>
        </div>

        {/* Quick KPI Stat Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className={`p-4 rounded-2xl border transition-all ${
            isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-[#111A27]/60 border-white/10'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Today's Slots
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black tracking-tight">{metrics.todayCount}</span>
              <span className="text-[11px] text-emerald-400 font-semibold font-mono">
                ({metrics.todayAvailable} open)
              </span>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border transition-all ${
            isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-500/20'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block">
              Upcoming Bookable
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400 tracking-tight">{metrics.upcomingAvailable}</span>
              <span className="text-[11px] text-slate-400 font-mono">slots</span>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border transition-all ${
            isLight ? 'bg-amber-50/50 border-amber-200' : 'bg-amber-950/20 border-amber-500/20'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">
              Confirmed Bookings
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-400 tracking-tight">{metrics.upcomingBooked}</span>
              <span className="text-[11px] text-slate-400 font-mono">sessions</span>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border transition-all ${
            isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-[#111A27]/60 border-white/10'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Configured Capacity
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black tracking-tight">{metrics.totalHours}</span>
              <span className="text-[11px] text-slate-400 font-mono">hours free</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold shadow-md transition-all animate-fadeIn ${
          feedback.type === 'error'
            ? (isLight ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-rose-950/60 text-rose-300 border-rose-500/30')
            : feedback.type === 'success'
            ? (isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30')
            : (isLight ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-950/60 text-amber-300 border-amber-500/30')
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === 'error' ? (
              <AlertCircle size={16} className="text-rose-500 shrink-0" />
            ) : feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            ) : (
              <Info size={16} className="text-amber-500 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75 cursor-pointer text-slate-400 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Two Column Grid: Interactive Calendar + Selected Date Slot Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Interactive Calendar (5 cols) */}
        <div className={`lg:col-span-5 p-5 sm:p-6 rounded-3xl border flex flex-col justify-between ${
          isLight ? 'bg-slate-50/80 border-slate-200 shadow-sm' : 'bg-[#111A27]/70 border-white/10 shadow-xl'
        }`}>
          <div>
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-base tracking-tight flex items-center gap-2">
                  <CalendarIcon size={18} className="text-amber-500" />
                  {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                </h3>
                <span className="text-[10px] text-slate-400">Click any date to inspect or configure slots</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={jumpToToday}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                    isLight ? 'hover:bg-slate-200 border-slate-300 text-slate-700' : 'hover:bg-white/10 border-white/15 text-slate-300'
                  }`}
                  title="Jump to Current Date"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={prevMonth}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isLight ? 'hover:bg-slate-200 border-slate-300' : 'hover:bg-white/10 border-white/15'
                  }`}
                  title="Previous Month"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isLight ? 'hover:bg-slate-200 border-slate-300' : 'hover:bg-white/10 border-white/15'
                  }`}
                  title="Next Month"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-wider mb-2.5 text-slate-400">
              <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
            </div>

            {/* Calendar Day Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((day, idx) => {
                const counts = dateSlotCounts[day.dateStr];
                const isSelected = selectedDate === day.dateStr;
                const isToday = day.dateStr === todayStr;
                const hasAvailable = counts && counts.available > 0;
                const hasBooked = counts && counts.booked > 0;
                const hasDisabled = counts && counts.disabled > 0;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDate(day.dateStr)}
                    className={`h-12 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer text-xs font-bold group ${
                      isSelected
                        ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25 scale-[1.04] z-10'
                        : day.isPast
                        ? (isLight ? 'opacity-30 hover:bg-slate-200 text-slate-400' : 'opacity-30 hover:bg-white/5 text-slate-500')
                        : !day.isCurrentMonth
                        ? (isLight ? 'opacity-40 hover:bg-slate-200 text-slate-400' : 'opacity-40 hover:bg-white/5 text-slate-500')
                        : (isLight ? 'bg-white hover:bg-amber-50 text-slate-800 border border-slate-200' : 'bg-[#0B111A] hover:bg-white/10 text-white border border-white/5')
                    } ${isToday && !isSelected ? 'ring-2 ring-amber-500/70' : ''}`}
                  >
                    <span>{day.dayNum}</span>

                    {/* Dot Indicators */}
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {hasAvailable && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-slate-950' : 'bg-emerald-400'}`} title={`${counts.available} Available`}></span>
                      )}
                      {hasBooked && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-slate-900' : 'bg-amber-400'}`} title={`${counts.booked} Booked`}></span>
                      )}
                      {hasDisabled && !hasAvailable && !hasBooked && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-slate-800' : 'bg-slate-500'}`} title={`${counts.disabled} Disabled`}></span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar Legend */}
          <div className="flex items-center justify-between text-[11px] mt-6 pt-4 border-t border-slate-200/80 dark:border-white/10 text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span> Booked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span> Disabled
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full ring-2 ring-amber-500/70"></span> Today
            </span>
          </div>
        </div>

        {/* Right Column: Selected Date Slot Studio (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Selected Date Banner */}
          <div className={`p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-lg ${
            isLight ? 'bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 border-amber-200 text-slate-900' : 'bg-gradient-to-r from-[#111A27] via-[#142030] to-[#0B111A] border-amber-500/30 text-white'
          }`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                  Target Schedule Date
                </span>
                {selectedDate === todayStr && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    Today
                  </span>
                )}
              </div>
              <p className="text-xl font-black flex items-center gap-2">
                <CalendarIcon size={18} className="text-amber-500" />
                {(() => {
                  try {
                    const [y, m, d] = selectedDate.split('-');
                    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
                    return dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
                  } catch {
                    return selectedDate;
                  }
                })()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedDate < todayStr ? (
                <span className="text-xs px-3 py-1.5 rounded-xl font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                  <AlertCircle size={13} /> Past Date (Read-Only)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleAddStandardDaySchedule}
                  disabled={isSaving}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-200'
                  }`}
                  title="Generate standard 3 slots (10-11 AM, 2-3 PM, 4-5 PM)"
                >
                  <Sparkles size={13} className="text-amber-500" /> Auto-Fill Standard Day
                </button>
              )}
            </div>
          </div>

          {/* Configured Slots for Selected Date */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black tracking-tight flex items-center gap-2">
                <Clock size={16} className="text-amber-500" />
                Configured Slots for Date ({selectedDateSlots.length})
              </h4>
              <span className="text-[11px] text-slate-400">
                {selectedDateSlots.filter(s => s.status === 'AVAILABLE').length} Available · {selectedDateSlots.filter(s => s.status === 'BOOKED').length} Booked
              </span>
            </div>

            {selectedDateSlots.length === 0 ? (
              <div className={`p-8 rounded-2xl border text-center space-y-2.5 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111A27]/40 border-white/5'
              }`}>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
                  <Clock size={22} />
                </div>
                <p className="text-xs font-bold">No availability slots configured for this date</p>
                <p className={`text-[11px] max-w-sm mx-auto ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Clients will see this day as completely unavailable. Use the slot studio below to add consultation windows.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedDateSlots.map((slot) => {
                  const isEditing = editingSlotId === slot.id;
                  const isBooked = slot.status === 'BOOKED';
                  const isAvailable = slot.status === 'AVAILABLE';
                  const duration = calculateDuration(slot.startTime, slot.endTime);

                  if (isEditing) {
                    return (
                      <div
                        key={slot.id}
                        className={`p-4 rounded-2xl border space-y-3.5 shadow-lg ${
                          isLight ? 'bg-amber-50/90 border-amber-300' : 'bg-[#142030] border-amber-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                            <Edit3 size={13} /> Edit Time Slot ({editDuration} mins)
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSlotId(null);
                            }}
                            aria-label="Cancel editing slot"
                            className="text-xs opacity-60 hover:opacity-100 cursor-pointer text-slate-400 hover:text-white transition-opacity px-2 py-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] font-bold uppercase block mb-1 opacity-80">Start Time</label>
                            <select
                              value={editStartTime}
                              onChange={(e) => handleEditStartTimeChange(e.target.value)}
                              className={`w-full text-xs p-2.5 rounded-xl border outline-none font-semibold ${
                                isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#0B111A] border-white/15 text-white focus:border-amber-500'
                              }`}
                            >
                              {standardTimeOptions.map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase block mb-1 opacity-80">End Time</label>
                            <select
                              value={editEndTime}
                              onChange={(e) => handleEditEndTimeChange(e.target.value)}
                              className={`w-full text-xs p-2.5 rounded-xl border outline-none font-semibold ${
                                isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#0B111A] border-white/15 text-white focus:border-amber-500'
                              }`}
                            >
                              {standardTimeOptions.map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase block mb-1 opacity-80">Status</label>
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value as any)}
                              className={`w-full text-xs p-2.5 rounded-xl border outline-none font-semibold ${
                                isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#0B111A] border-white/15 text-white focus:border-amber-500'
                              }`}
                            >
                              <option value="AVAILABLE">Available</option>
                              <option value="DISABLED">Unavailable/Disabled</option>
                            </select>
                          </div>
                        </div>

                        {/* Duration Preset & Action Controls */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Duration Preset:</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {[30, 45, 60, 90, 120].map((dur) => (
                                <button
                                  key={dur}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditDurationSelect(dur);
                                  }}
                                  className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-all cursor-pointer ${
                                    editDuration === dur
                                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
                                      : (isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10')
                                  }`}
                                >
                                  {dur} mins
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit(slot);
                              }}
                              aria-label="Save slot changes"
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer transition-colors shadow-md flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                            >
                              <Save size={13} /> Save Changes
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={slot.id}
                      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        isBooked
                          ? (isLight ? 'bg-amber-50/70 border-amber-300 shadow-sm' : 'bg-[#152233] border-amber-500/40')
                          : isAvailable
                          ? (isLight ? 'bg-white border-slate-200 hover:border-emerald-400 shadow-sm' : 'bg-[#0E1724] border-white/10 hover:border-emerald-500/40')
                          : (isLight ? 'bg-slate-100 border-slate-200 shadow-sm' : 'bg-[#0B111A] border-white/5')
                      }`}
                    >
                      <div className={`flex items-center gap-3.5 ${!isAvailable && !isBooked ? 'opacity-70' : ''}`}>
                        <div className={`w-3 h-3 rounded-full shrink-0 ${
                          isAvailable ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50' : isBooked ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-slate-500'
                        }`} />

                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-extrabold text-sm tracking-tight">
                              {slot.startTime} – {slot.endTime}
                            </span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                              isLight ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white/5 border-white/10 text-slate-300'
                            }`}>
                              {duration} mins
                            </span>
                            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold border ${
                              isAvailable
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : isBooked
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                            }`}>
                              {isAvailable ? 'Available' : isBooked ? 'Booked' : 'Unavailable'}
                            </span>
                          </div>

                          {isBooked && (
                            <div className="flex items-center gap-2 text-[11px] text-amber-400/90 font-mono">
                              <User size={12} />
                              <span>Booked by: <strong>{slot.clientName || 'Client'}</strong> {slot.bookingId ? `(${slot.bookingId})` : ''}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        {isBooked ? (
                          <span className="text-[11px] font-bold px-3 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 h-9">
                            <Video size={12} /> Meet Reserved
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setEditingSlotId(slot.id);
                                setEditStartTime(slot.startTime);
                                setEditEndTime(slot.endTime);
                                setEditDuration(calculateDuration(slot.startTime, slot.endTime));
                                setEditStatus(slot.status === 'AVAILABLE' ? 'AVAILABLE' : 'DISABLED');
                              }}
                              aria-label={`Edit slot ${slot.startTime} to ${slot.endTime}`}
                              title="Edit slot timing"
                              className={`w-9 h-9 flex items-center justify-center rounded-xl border text-xs font-semibold cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
                                isLight 
                                  ? 'hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 focus-visible:ring-offset-white' 
                                  : 'hover:bg-white/10 border-white/10 text-slate-300 hover:text-white hover:border-white/25 focus-visible:ring-offset-[#0B111A]'
                              }`}
                            >
                              <Edit3 size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleToggleStatus(slot);
                              }}
                              aria-label={`${isAvailable ? 'Disable' : 'Enable'} slot ${slot.startTime} to ${slot.endTime}`}
                              title={isAvailable ? 'Mark slot as unavailable' : 'Mark slot as available'}
                              className={`w-20 h-9 flex items-center justify-center rounded-xl border text-xs font-bold cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
                                isAvailable
                                  ? (isLight 
                                      ? 'border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 focus-visible:ring-offset-white' 
                                      : 'border-amber-500/40 text-amber-400 hover:bg-amber-950/40 hover:border-amber-400 focus-visible:ring-offset-[#0B111A]')
                                  : (isLight 
                                      ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 focus-visible:ring-offset-white' 
                                      : 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/40 hover:border-emerald-400 focus-visible:ring-offset-[#0B111A]')
                              }`}
                            >
                              {isAvailable ? 'Disable' : 'Enable'}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleDeleteSlot(slot);
                              }}
                              aria-label={`Delete slot ${slot.startTime} to ${slot.endTime}`}
                              title="Delete slot"
                              className={`w-9 h-9 flex items-center justify-center rounded-xl border text-xs font-semibold cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 ${
                                isLight 
                                  ? 'text-rose-700 hover:bg-rose-50 border-rose-200 hover:border-rose-400 focus-visible:ring-offset-white' 
                                  : 'text-rose-400 hover:bg-rose-950/40 border-rose-500/30 hover:border-rose-400 hover:text-rose-300 focus-visible:ring-offset-[#0B111A]'
                              }`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Time Slot Studio Form */}
          {selectedDate >= todayStr && (
            <div className={`p-6 rounded-3xl border space-y-4 shadow-xl ${
              isLight ? 'bg-slate-50/90 border-slate-200' : 'bg-[#111A27]/90 border-white/10'
            }`}>
              <div className="flex items-center justify-between border-b pb-3 border-slate-200/80 dark:border-white/10">
                <span className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-amber-500">
                  <Plus size={15} /> Quick Slot Studio for Selected Date
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Atomic schedule publish
                </span>
              </div>

              {/* Duration Quick-Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider block text-slate-400">
                  Step 1: Session Duration Preset
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[30, 45, 60, 90].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => handleDurationSelect(dur)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                        selectedDuration === dur
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                          : (isLight ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300')
                      }`}
                    >
                      {dur} mins
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider block mb-1 text-slate-400">
                    Step 2: Start Time
                  </label>
                  <select
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none transition-colors ${
                      isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#0B111A] border-white/15 text-white focus:border-amber-500'
                    }`}
                  >
                    {standardTimeOptions.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider block mb-1 text-slate-400">
                    Step 3: End Time
                  </label>
                  <select
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      const dur = calculateDuration(startTime, e.target.value);
                      setSelectedDuration(dur);
                    }}
                    className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none transition-colors ${
                      isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#0B111A] border-white/15 text-white focus:border-amber-500'
                    }`}
                  >
                    {standardTimeOptions.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Popular Windows:</span>
                {[
                  { label: '09:00 – 10:00 AM', s: '09:00 AM', e: '10:00 AM' },
                  { label: '10:00 – 11:00 AM', s: '10:00 AM', e: '11:00 AM' },
                  { label: '02:00 – 03:00 PM', s: '02:00 PM', e: '03:00 PM' },
                  { label: '04:00 – 05:00 PM', s: '04:00 PM', e: '05:00 PM' },
                  { label: '06:00 – 07:00 PM', s: '06:00 PM', e: '07:00 PM' },
                ].map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddPreset(p.s, p.e)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border font-mono transition-colors cursor-pointer ${
                      isLight ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleAddSlot}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
                >
                  <Plus size={15} /> {isSaving ? 'Publishing Slot...' : '+ Add Time Slot'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Upcoming Availability Schedule Overview */}
      <div className="mt-8 pt-8 border-t border-slate-200/80 dark:border-white/10 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black flex items-center gap-2">
              <CalendarDays size={18} className="text-amber-500" />
              Active Upcoming Schedule ({upcomingSlots.length})
            </h3>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Chronological schedule of published dates bookable by corporate and individual clients
            </p>
          </div>

          {/* Controls: Search + Filter */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <input
              type="text"
              value={searchDateQuery}
              onChange={(e) => setSearchDateQuery(e.target.value)}
              placeholder="Search date (YYYY-MM-DD) or client..."
              className={`text-xs px-3 py-1.5 rounded-xl border outline-none font-medium transition-colors ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#111A27] border-white/15 text-white'
              }`}
            />

            <div className="flex items-center gap-1.5">
              <Filter size={13} className="text-amber-500" />
              <select
                value={upcomingFilter}
                onChange={(e) => setUpcomingFilter(e.target.value as any)}
                className={`text-xs p-1.5 rounded-xl border outline-none font-semibold ${
                  isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#111A27] border-white/15 text-white'
                }`}
              >
                <option value="ALL">All Statuses</option>
                <option value="AVAILABLE">Available Only</option>
                <option value="BOOKED">Booked Only</option>
                <option value="DISABLED">Disabled Only</option>
              </select>
            </div>
          </div>
        </div>

        {upcomingSlots.length === 0 ? (
          <div className={`p-8 rounded-3xl border text-center space-y-2.5 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111A27]/40 border-white/5'
          }`}>
            <CalendarIcon size={32} className="mx-auto text-amber-500/40" />
            <p className="text-xs font-bold">No upcoming availability slots matching your criteria</p>
            <p className={`text-[11px] max-w-sm mx-auto ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Select a date on the calendar above and add time slots to open bookings.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {upcomingSlots.map(slot => {
              const [y, m, d] = slot.availabilityDate.split('-');
              const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
              const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
              const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const duration = calculateDuration(slot.startTime, slot.endTime);

              return (
                <div
                  key={slot.id}
                  onClick={() => setSelectedDate(slot.availabilityDate)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer hover:scale-[1.015] shadow-sm ${
                    slot.status === 'AVAILABLE'
                      ? (isLight ? 'bg-white border-emerald-200/90 hover:border-emerald-400' : 'bg-[#0E1724] border-emerald-500/25 hover:border-emerald-500/50')
                      : slot.status === 'BOOKED'
                      ? (isLight ? 'bg-amber-50/70 border-amber-300' : 'bg-[#152233] border-amber-500/30')
                      : (isLight ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-[#0B111A] border-white/5 opacity-60')
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                        {weekday}
                      </span>
                      <span className="text-xs font-bold">
                        {monthDay}
                      </span>
                    </div>

                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                      slot.status === 'AVAILABLE'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : slot.status === 'BOOKED'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                    }`}>
                      {slot.status === 'AVAILABLE' ? 'Available' : slot.status === 'BOOKED' ? 'Booked' : 'Disabled'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-amber-500" />
                      <span className="text-xs font-extrabold tracking-tight">
                        {slot.startTime} – {slot.endTime}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {duration}m
                    </span>
                  </div>

                  {slot.status === 'BOOKED' && slot.clientName && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-mono mt-2 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20 truncate">
                      <User size={11} />
                      <span className="truncate">Client: <strong>{slot.clientName}</strong></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};