import React, { useState, useEffect, useMemo } from 'react';
import { RetiredProfessional, Booking, ExpertAvailability } from '../types';
import { mongoDB } from '../mongoDBService';
import confetti from 'canvas-confetti';
import { 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  Wallet, 
  ShieldCheck, 
  CheckCircle2, 
  Video, 
  ArrowRight,
  Sparkles,
  Info,
  AlertCircle
} from 'lucide-react';

interface BookingModalProps {
  expert: RetiredProfessional | null;
  isOpen: boolean;
  onClose: () => void;
  walletBalance: number;
  onConfirmBooking: (newBooking: Booking, totalCost: number) => void;
  onLaunchVirtualCall: (booking: Booking) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  expert,
  isOpen,
  onClose,
  walletBalance,
  onConfirmBooking,
  onLaunchVirtualCall,
}) => {
  const [serviceType, setServiceType] = useState<'1-on-1 Advisory' | 'Project Consultation' | 'Monthly Mentorship'>('1-on-1 Advisory');
  const todayStr = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  const [expertAvailabilities, setExpertAvailabilities] = useState<ExpertAvailability[]>([]);
  const [isLoadingAvailabilities, setIsLoadingAvailabilities] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Load expert's explicit availability
  const loadAvailabilities = async () => {
    if (!expert) return;
    setIsLoadingAvailabilities(true);
    try {
      const data = await mongoDB.getAvailabilities(expert.id);
      setExpertAvailabilities(data);
    } catch {
      setExpertAvailabilities(mongoDB.getLocalAvailabilities(expert.id));
    } finally {
      setIsLoadingAvailabilities(false);
    }
  };

  useEffect(() => {
    if (isOpen && expert) {
      loadAvailabilities();
      setConflictError(null);
    }
  }, [isOpen, expert?.id]);

  const dynamicProjectRate = typeof expert?.projectRate === 'number' ? Math.min(2000, Math.max(0, expert.projectRate)) : (expert?.hourlyRate ? Math.min(2000, expert.hourlyRate * 3) : 1000);
  const [dynamicPlatformCharge, setDynamicPlatformCharge] = useState<number>(() => {
    try {
      const c = typeof window !== 'undefined' ? (localStorage.getItem('mongo_platform_charge') || localStorage.getItem('mongo_project_review_config')) : null;
      if (c) {
        const p = JSON.parse(c);
        if (typeof p.feeValue === 'number') {
          return p.feeType === 'percentage' ? Math.round(dynamicProjectRate * (p.feeValue / 100)) : p.feeValue;
        }
      }
    } catch {}
    return 200;
  });

  useEffect(() => {
    const syncFee = () => {
      try {
        const c = typeof window !== 'undefined' ? (localStorage.getItem('mongo_platform_charge') || localStorage.getItem('mongo_project_review_config')) : null;
        if (c) {
          const p = JSON.parse(c);
          if (typeof p.feeValue === 'number') {
            setDynamicPlatformCharge(p.feeType === 'percentage' ? Math.round(dynamicProjectRate * (p.feeValue / 100)) : p.feeValue);
          }
        }
      } catch {}
    };
    window.addEventListener('platform_fee_updated', syncFee);
    window.addEventListener('storage', syncFee);
    return () => {
      window.removeEventListener('platform_fee_updated', syncFee);
      window.removeEventListener('storage', syncFee);
    };
  }, [dynamicProjectRate]);

  const basePrice = expert ? (serviceType === '1-on-1 Advisory' ? expert.hourlyRate : dynamicProjectRate) : 0;
  const platformCommission = serviceType === '1-on-1 Advisory' ? Math.round(basePrice * 0.125) : dynamicPlatformCharge;
  const totalPayable = serviceType === '1-on-1 Advisory' ? basePrice : (basePrice + dynamicPlatformCharge);

  // Check if a time slot has already passed for today
  const isSlotInPast = (slotDateStr: string, slotStr: string): boolean => {
    if (!slotDateStr || !slotStr) return false;
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
      const currentDay = String(now.getDate()).padStart(2, "0");
      const currentToday = `${currentYear}-${currentMonth}-${currentDay}`;

      if (slotDateStr < currentToday) return true;
      if (slotDateStr > currentToday) return false;

      const startTimePart = slotStr.split(" - ")[0].trim();
      const match = startTimePart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!match) return false;

      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();

      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;

      const slotStartMinutes = hours * 60 + minutes;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      return slotStartMinutes <= currentMinutes;
    } catch {
      return false;
    }
  };

  // 1. Valid upcoming slots configured for this expert (exclude disabled)
  const upcomingSlots = useMemo(() => {
    return expertAvailabilities.filter(s => s.availabilityDate >= todayStr && s.status !== "DISABLED");
  }, [expertAvailabilities, todayStr]);

  // 2. Only show dates where expert has availability configured
  const availableDates = useMemo(() => {
    return Array.from(new Set(upcomingSlots.map(s => s.availabilityDate))).sort();
  }, [upcomingSlots]);

  // Sync selectedDate to first available date
  useEffect(() => {
    if (availableDates.length > 0) {
      if (!selectedDate || !availableDates.includes(selectedDate)) {
        setSelectedDate(availableDates[0]);
      }
    } else {
      setSelectedDate('');
    }
  }, [availableDates, selectedDate]);

  // 3. Configured slots for current selectedDate
  const slotsOnDate = useMemo(() => {
    if (!selectedDate) return [];
    return upcomingSlots
      .filter(s => s.availabilityDate === selectedDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [upcomingSlots, selectedDate]);

  // Available (unbooked, active, non-past) slots
  const bookableSlotsOnDate = useMemo(() => {
    return slotsOnDate.filter(s => {
      if (s.status !== "AVAILABLE") return false;
      if (isSlotInPast(selectedDate, `${s.startTime} - ${s.endTime}`)) return false;
      return true;
    });
  }, [slotsOnDate, selectedDate]);

  // Auto-select first available slot when date or slots change
  useEffect(() => {
    const current = slotsOnDate.find(s => s.id === selectedSlotId);
    if (current && current.status === "AVAILABLE" && !isSlotInPast(selectedDate, `${current.startTime} - ${current.endTime}`)) {
      return;
    }
    if (bookableSlotsOnDate.length > 0) {
      setSelectedSlotId(bookableSlotsOnDate[0].id);
    } else {
      setSelectedSlotId('');
    }
  }, [slotsOnDate, bookableSlotsOnDate, selectedDate, selectedSlotId]);

  const chosenSlot = slotsOnDate.find(s => s.id === selectedSlotId);

  const handleProcessPayment = async () => {
    if (isSubmitting || !expert) return;
    setConflictError(null);

    if (availableDates.length === 0) {
      alert("⚠️ No Availability: This expert has not configured any upcoming available dates.");
      return;
    }

    if (!selectedDate) {
      alert("⚠️ Please select an available date.");
      return;
    }

    if (!chosenSlot || chosenSlot.status !== 'AVAILABLE') {
      alert("⚠️ Please select an available time slot.");
      return;
    }

    if (isSlotInPast(selectedDate, `${chosenSlot.startTime} - ${chosenSlot.endTime}`)) {
      alert("⚠️ Invalid Time Slot: The selected time slot has already passed for today. Please select an upcoming time slot.");
      return;
    }

    if (walletBalance < totalPayable) {
      alert(`Insufficient Wallet Balance (Required: ₹${totalPayable}, Current: ₹${walletBalance}). Please top up your Mentora wallet.`);
      return;
    }

    setIsSubmitting(true);
    const bookingId = `book-${Date.now()}`;
    const slotString = `${chosenSlot.startTime} - ${chosenSlot.endTime}`;

    try {
      // Concurrency lock call to backend atomic /api/availability/book
      const bookRes = await mongoDB.bookAvailability(chosenSlot.id, {
        bookingId,
        clientId: 'client-startup',
        clientName: 'Startup Client',
        expertId: expert.id
      });

      if (!bookRes.success) {
        setIsSubmitting(false);
        setConflictError(bookRes.error || "Time slot clash: This slot was just booked by another client. Please select another slot.");
        await loadAvailabilities();
        return;
      }

      const newBooking: Booking = {
        id: bookingId,
        expertId: expert.id,
        expertName: expert.name,
        expertAvatar: expert.avatarUrl,
        expertTitle: expert.title,
        clientName: 'Startup Client',
        serviceType,
        date: selectedDate,
        timeSlot: slotString,
        topic: topic || `Consultation on ${expert.domain}`,
        amount: basePrice,
        commission: platformCommission,
        status: 'upcoming',
        meetingRoomId: `room-${expert.id.substring(0, 5)}-${Date.now().toString().slice(-4)}`
      };

      setIsSubmitting(false);
      onConfirmBooking(newBooking, totalPayable);
      setCreatedBooking(newBooking);
      setIsSuccess(true);

      // Trigger celebration confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (err: any) {
      setIsSubmitting(false);
      setConflictError(err.message || "Failed to confirm booking due to concurrency conflict.");
      await loadAvailabilities();
    }
  };

  if (!isOpen || !expert) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto my-auto text-white">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-amber-500/20 via-slate-800 to-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src={expert.avatarUrl}
              alt={expert.name}
              className="w-12 h-12 rounded-xl object-cover border-2 border-amber-500/40"
            />
            <div>
              <h3 className="font-bold text-white text-lg">Book Advisory Session</h3>
              <p className="text-xs text-amber-400 font-medium">with {expert.name} ({expert.title})</p>
            </div>
          </div>

          <button
            onClick={() => {
              setIsSuccess(false);
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {!isSuccess ? (
          <div className="p-6 space-y-6">
            
            {/* Step 1: Service Type Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                1. Select Consultation Package
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setServiceType('1-on-1 Advisory')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    serviceType === '1-on-1 Advisory'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-white">1-on-1 Advisory</span>
                    <span className="text-sm font-extrabold text-amber-400">₹{expert.hourlyRate}/hr</span>
                  </div>
                  <p className="text-xs text-slate-400">60-minute video session with interactive whiteboard & notes.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setServiceType('Project Consultation')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    serviceType === 'Project Consultation'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-white">Project Review Pack</span>
                    <span className="text-sm font-extrabold text-amber-400">₹{dynamicProjectRate + dynamicPlatformCharge}</span>
                  </div>
                  <p className="text-xs text-slate-400">Comprehensive document audit + 2 video strategy calls.</p>
                </button>
              </div>
            </div>

            {/* Step 2: Interactive Date Selection Strip */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  2. Select Consultation Date
                </label>
                {availableDates.length > 0 && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {availableDates.length} date{availableDates.length > 1 ? 's' : ''} available
                  </span>
                )}
              </div>

              {isLoadingAvailabilities ? (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 text-center text-xs text-slate-400">
                  Loading schedule...
                </div>
              ) : availableDates.length === 0 ? (
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-center text-xs text-amber-300">
                  No availability dates configured by this expert
                </div>
              ) : (
                <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
                  {availableDates.map((d) => {
                    const daySlots = upcomingSlots.filter((s) => s.availabilityDate === d);
                    const openCount = daySlots.filter((s) => s.status === 'AVAILABLE' && !isSlotInPast(d, `${s.startTime} - ${s.endTime}`)).length;
                    const isSelected = selectedDate === d;
                    const isFull = openCount === 0;

                    let weekday = "";
                    let monthDay = "";
                    try {
                      const [y, m, dayNum] = d.split('-');
                      const dt = new Date(Number(y), Number(m) - 1, Number(dayNum));
                      weekday = dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                      monthDay = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    } catch {
                      weekday = "DATE";
                      monthDay = d;
                    }

                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setSelectedDate(d);
                          setConflictError(null);
                        }}
                        className={`shrink-0 px-3.5 py-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center min-w-[90px] ${
                          isSelected
                            ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25 border-amber-400 scale-[1.03]'
                            : isFull
                            ? 'bg-slate-950 border-slate-800/80 opacity-50 text-slate-500'
                            : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-white'
                        }`}
                      >
                        <span className={`text-[10px] font-black tracking-widest ${isSelected ? 'text-slate-950' : 'text-amber-500'}`}>
                          {weekday}
                        </span>
                        <span className="text-xs font-black mt-0.5 whitespace-nowrap">
                          {monthDay}
                        </span>
                        <span className={`text-[9px] font-mono mt-1 px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected
                            ? 'bg-slate-950/20 text-slate-950'
                            : isFull
                            ? 'bg-slate-500/20 text-slate-400'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {isFull ? 'Full' : `${openCount} open`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 3: Interactive Time Slot Matrix */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  3. Select Consultation Time Slot
                </label>
                {selectedDate && slotsOnDate.length > 0 && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {bookableSlotsOnDate.length} of {slotsOnDate.length} slots open
                  </span>
                )}
              </div>

              {isLoadingAvailabilities ? (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 text-center text-xs text-slate-400">
                  Loading available time slots...
                </div>
              ) : slotsOnDate.length === 0 ? (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 text-center text-xs text-slate-400">
                  No time slots configured for {selectedDate || 'this date'}.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                  {slotsOnDate.map((s) => {
                    const isPast = isSlotInPast(selectedDate, `${s.startTime} - ${s.endTime}`);
                    const isBooked = s.status === 'BOOKED';
                    const isDisabled = s.status === 'DISABLED';
                    const isAvailable = s.status === 'AVAILABLE' && !isPast;
                    const isSelected = selectedSlotId === s.id;

                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => {
                          setSelectedSlotId(s.id);
                          setConflictError(null);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all relative ${
                          !isAvailable
                            ? 'bg-slate-950 border-slate-800/60 opacity-40 cursor-not-allowed text-slate-500'
                            : isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-white font-extrabold shadow-md ring-2 ring-amber-500/40'
                            : 'bg-slate-950 hover:border-amber-500/40 border-slate-800 text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className={isSelected ? 'text-amber-400' : isAvailable ? 'text-emerald-400' : 'text-slate-500'} />
                            <span className="text-xs font-bold font-mono">
                              {s.startTime}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[10px]">
                          <span className="text-slate-400 font-mono">to {s.endTime}</span>
                          <span className={`px-1.5 py-0.2 rounded font-mono font-bold ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950'
                              : isBooked
                              ? 'bg-amber-500/15 text-amber-400'
                              : isPast
                              ? 'bg-slate-500/20 text-slate-400'
                              : 'bg-emerald-500/15 text-emerald-400'
                          }`}>
                            {isBooked ? 'Booked' : isPast ? 'Passed' : isDisabled ? 'Off' : 'Open'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Real-Time Conflict Alert Banner */}
            {conflictError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-start gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">❌ Double-Booking Prevented</p>
                  <p className="text-[11px] mt-0.5 text-rose-200 leading-relaxed">
                    {conflictError}
                  </p>
                </div>
              </div>
            )}

            {/* No Availability Notice Banner */}
            {availableDates.length === 0 && !isLoadingAvailabilities && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-start gap-2">
                <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">No Availability Configured</p>
                  <p className="text-[11px] mt-0.5 text-slate-300 leading-relaxed">
                    Expert <strong className="text-amber-400">{expert.name}</strong> has not configured any upcoming availability. Unavailable dates cannot be selected.
                  </p>
                </div>
              </div>
            )}

            {/* No Slots Available on Selected Date Notice Banner */}
            {availableDates.length > 0 && bookableSlotsOnDate.length === 0 && !isLoadingAvailabilities && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-start gap-2">
                <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">No Time Slots Remaining for {selectedDate}</p>
                  <p className="text-[11px] mt-0.5 text-slate-300 leading-relaxed">
                    All time slots for this date have either concluded or are already reserved. Please select another date above.
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Topic Note */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                4. Primary Discussion Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Reviewing cap table before seed pitch & ESOP pool allocation..."
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Price & Platform Fee Calculation Breakdown */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Expert Fee ({serviceType})</span>
                <span>₹{basePrice}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  Mentora Platform Fee (12.5% included) <span title="Commission model per PDF spec"><Info className="w-3 h-3 text-slate-500" /></span>
                </span>
                <span className="text-emerald-400 font-semibold">₹{platformCommission}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-sm font-bold text-white">Total Deducted from Wallet</span>
                <span className="text-xl font-extrabold text-amber-400">₹{totalPayable}</span>
              </div>
            </div>

            {/* Wallet Balance Alert */}
            <div className="flex items-center justify-between p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">Mentora Wallet Balance:</span>
                <strong className="text-emerald-400 font-bold">₹{walletBalance.toLocaleString('en-IN')}</strong>
              </div>
              {walletBalance < totalPayable && (
                <span className="text-rose-400 font-bold">Top-up Required</span>
              )}
            </div>

            {/* Submit Action */}
            <button
              onClick={handleProcessPayment}
              disabled={isSubmitting || isLoadingAvailabilities || bookableSlotsOnDate.length === 0 || !chosenSlot || walletBalance < totalPayable}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-500 text-slate-950 py-3.5 px-6 rounded-2xl font-bold text-base shadow-xl shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01]"
            >
              <CheckCircle2 className="w-5 h-5 fill-slate-950" />
              <span>
                {isSubmitting
                  ? "Securing Atomic Booking..."
                  : bookableSlotsOnDate.length === 0
                  ? "❌ No Slots Available"
                  : `Confirm & Pay ₹${totalPayable} via Wallet`}
              </span>
            </button>

          </div>
        ) : (
          /* Booking Success State */
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto shadow-xl">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white">Booking Confirmed!</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Your session with <strong className="text-amber-400">{expert.name}</strong> is scheduled for{' '}
                <strong className="text-white">{selectedDate}</strong> at <strong className="text-white">{createdBooking?.timeSlot}</strong>.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between text-slate-400">
                <span>Meeting Room ID:</span>
                <span className="font-mono text-amber-300 font-bold">{createdBooking?.meetingRoomId}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Wallet Debit:</span>
                <span className="text-emerald-400 font-bold">₹{totalPayable}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  if (createdBooking) {
                    onClose();
                    setIsSuccess(false);
                    onLaunchVirtualCall(createdBooking);
                  }
                }}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 px-6 py-3 rounded-xl font-bold text-sm shadow-lg"
              >
                <Video className="w-4 h-4 fill-slate-950" />
                <span>Launch SilverConnect Video Room</span>
              </button>

              <button
                onClick={() => {
                  setIsSuccess(false);
                  onClose();
                }}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl"
              >
                Close & Return to App
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
