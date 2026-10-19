import React, { useState } from 'react';
import type { AuthUser, Booking } from '../types';
import { TrainingUpsellView } from './TrainingUpsellView';
import { TeleconsultSimulatorModal } from './TeleconsultSimulatorModal';
import { ExpertAvailabilityManager } from './ExpertAvailabilityManager';
import { Footer } from './Footer';
import { 
  Award, 
  ShieldCheck, 
  Calendar, 
  Video, 
  DollarSign, 
  GraduationCap, 
  UserCheck, 
  LogOut, 
  Clock, 
  Sparkles
} from 'lucide-react';

interface SeniorProDashboardProps {
  user: AuthUser;
  onLogout: () => void;
  bookings: Booking[];
}

export const SeniorProDashboard: React.FC<SeniorProDashboardProps> = ({
  user,
  onLogout,
  bookings,
}) => {
  const [activeTab, setActiveTab] = useState<'consultations' | 'availability' | 'profile' | 'training' | 'payouts' | 'membership'>('consultations');
  const [activeCallBooking, setActiveCallBooking] = useState<Booking | null>(null);

  const [hourlyRate, setHourlyRate] = useState(user.hourlyRate || 799);
  const [bio, setBio] = useState('Over 30+ years guiding corporate budgets, valuation readiness, tax restructuring, and seed-to-Series B financial planning for Indian enterprises & tech startups.');
  const [availableDays, setAvailableDays] = useState(['Mon', 'Wed', 'Fri', 'Sat']);

  const netEarnings = 4375;

  return (
    <div className="min-h-screen bg-[#0b132b] text-white flex flex-col font-sans">
      
      {/* Senior Professional Header */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-amber-500/30 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Logo & Senior Badge */}
            <div className="flex items-center gap-3.5">
              <img
                src="/mentora-logo-horizontal-dark.png"
                alt="Mentora — Empowering Future Leaders"
                className="h-10 sm:h-11 w-auto object-contain drop-shadow-md brightness-[1.02] contrast-[1.05]"
              />
              <div className="hidden sm:block border-l border-white/10 pl-3.5">
                <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                  EXECUTIVE ADVISOR PORTAL
                </span>
                <p className="text-xs text-amber-300 font-bold flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  {user.name} • {user.exCompany || 'Ex-Corporate Leader'} ({user.yearsOfExperience || 30}+ Yrs Exp)
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden lg:flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 text-xs font-bold">
              <button
                onClick={() => setActiveTab('consultations')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === 'consultations' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Calendar className="w-4 h-4" /> Advisory Calls ({bookings.length})
              </button>

              <button
                onClick={() => setActiveTab('availability')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === 'availability' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Clock className="w-4 h-4" /> Availability Management
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === 'profile' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-300 hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4" /> Profile & Rates (₹{hourlyRate}/hr)
              </button>

              <button
                onClick={() => setActiveTab('training')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === 'training' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-300 hover:text-white'
                }`}
              >
                <GraduationCap className="w-4 h-4" /> Digital Skills Upsell
              </button>

              <button
                onClick={() => setActiveTab('payouts')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === 'payouts' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-300 hover:text-white'
                }`}
              >
                <DollarSign className="w-4 h-4" /> Bank Payouts (₹{netEarnings})
              </button>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('membership')}
                className="hidden sm:flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3.5 py-2 rounded-xl text-xs font-black hover:bg-amber-500/30 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Prime Pro Tier</span>
              </button>

              <button
                onClick={onLogout}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-white/10 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        
        {activeTab === 'consultations' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 p-6 sm:p-8 rounded-3xl border border-amber-500/30">
              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl font-black text-white">Client Advisory Session Requests</h2>
                <p className="text-xs text-slate-300">You have {bookings.length} upcoming client consultations scheduled.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-white/10 text-xs text-right">
                <span className="text-slate-400 block font-semibold">Your Advisory Rate</span>
                <span className="text-xl font-black text-amber-400">₹{hourlyRate} / hr</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bookings.map((b) => (
                <div key={b.id} className="bg-slate-900 border border-white/10 p-6 rounded-3xl space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
                      {b.serviceType}
                    </span>
                    <span className="text-xs text-emerald-400 font-bold">Earn: ₹{Math.round(b.amount * 0.875)} (Net)</span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-base">Client: {b.clientName}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" /> {b.date} at {b.timeSlot}
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-white/5 text-xs text-slate-300">
                    <span className="text-slate-400 font-bold block mb-1">Advisory Agenda:</span>
                    <p>"{b.topic}"</p>
                  </div>

                  <button
                    onClick={() => setActiveCallBooking(b)}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 py-3.5 rounded-2xl font-black text-xs shadow-lg"
                  >
                    <Video className="w-4 h-4 fill-slate-950" />
                    <span>Launch SilverConnect HD Call Room</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'availability' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 p-6 sm:p-8 rounded-3xl border border-amber-500/30">
              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
                  <Calendar className="w-7 h-7 text-amber-400" />
                  Slot Availability Management
                </h2>
                <p className="text-xs text-slate-300">Configure and publish explicit consultation time slots for client advisory bookings.</p>
              </div>
              <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
                Single Source of Truth Active
              </span>
            </div>

            <ExpertAvailabilityManager
              expertId={user.id || 'exp-1'}
              expertName={user.name}
              isAdmin={false}
              theme="dark"
            />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 max-w-3xl mx-auto shadow-2xl">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-amber-400" />
              Manage Senior Advisory Profile & Rates
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Hourly Advisory Rate (₹)</label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  className="w-full p-3.5 bg-slate-950 border border-white/10 rounded-xl text-amber-400 font-black text-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Professional Bio & Corporate Leadership History</label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full p-3.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Available Advisory Days</label>
                <div className="flex flex-wrap gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => {
                    const isSelected = availableDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setAvailableDays(availableDays.filter(d => d !== day));
                          } else {
                            setAvailableDays([...availableDays, day]);
                          }
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                          isSelected ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950 text-slate-400 border-white/5'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => alert("Senior Executive Profile Updated Successfully!")}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs shadow-lg"
              >
                Save Profile Changes
              </button>
            </div>
          </div>
        )}

        {activeTab === 'training' && <TrainingUpsellView />}

        {activeTab === 'payouts' && (
          <div className="space-y-8 max-w-4xl mx-auto">
            <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 space-y-4 shadow-xl">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Net Advisor Earnings</span>
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-4xl font-black text-emerald-400">₹{netEarnings.toLocaleString('en-IN')}</span>
                  <p className="text-xs text-slate-400 mt-1">Calculated after 12.5% platform commission cut per specification.</p>
                </div>

                <button
                  onClick={() => alert(`Bank payout of ₹${netEarnings} initiated to SBI Account •••• 4092!`)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-3 rounded-2xl font-black text-xs shadow-lg"
                >
                  Withdraw to Bank Account
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'membership' && (
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-8 max-w-2xl mx-auto space-y-6 shadow-2xl text-center">
            <Sparkles className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-2xl font-black text-white">Silver Prime Senior Expert Tier</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              ₹499/month for higher directory visibility, Gold Verified Badge, and reduced 10% platform commission.
            </p>
            <div className="text-3xl font-black text-amber-400">₹499 / month</div>
            <button
              onClick={() => alert("Upgraded to Silver Prime Senior Tier!")}
              className="w-full py-3.5 bg-amber-500 text-slate-950 font-black rounded-2xl text-xs shadow-lg"
            >
              Subscribe to Prime Tier (₹499/mo)
            </button>
          </div>
        )}

      </main>

      <TeleconsultSimulatorModal
        booking={activeCallBooking}
        onClose={() => setActiveCallBooking(null)}
      />

      <Footer setActiveTab={() => {}} />
    </div>
  );
};
