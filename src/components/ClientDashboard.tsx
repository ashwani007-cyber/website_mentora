import React, { useState } from 'react';
import type { AuthUser, RetiredProfessional, Booking, WalletTransaction, DomainCategory, ReviewItem } from '../types';
import { Hero } from './Hero';
import { ExpertDirectory } from './ExpertDirectory';
import { ExpertDetailModal } from './ExpertDetailModal';
import { AIMatchmakerModal } from './AIMatchmakerModal';
import { BookingModal } from './BookingModal';
import { TeleconsultSimulatorModal } from './TeleconsultSimulatorModal';
import { WalletView } from './WalletView';
import { StoryHubView } from './StoryHubView';
import { Footer } from './Footer';
import { NotificationCenter } from './NotificationCenter';
import { notificationService } from '../services/notificationService';
import { FlowWallpaper } from './FlowWallpaper';
import { 
  Building2, 
  Wallet, 
  Sparkles, 
  LogOut, 
  Search, 
  Video, 
  Calendar, 
  Award,
  Star,
  MessageSquarePlus,
  CheckCircle2,
  X
} from 'lucide-react';

interface ClientDashboardProps {
  user: AuthUser;
  onLogout: () => void;
  walletBalance: number;
  onAddFunds: (amount: number) => void;
  bookings: Booking[];
  onConfirmBooking: (newBooking: Booking, totalCost: number) => void;
  transactions: WalletTransaction[];
  theme?: "dark" | "light";
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({
  user,
  onLogout,
  walletBalance,
  onAddFunds,
  bookings,
  onConfirmBooking,
  transactions,
  theme = "dark",
}) => {
  const [activeTab, setActiveTab] = useState<'directory' | 'bookings' | 'wallet' | 'stories'>('directory');
  const [selectedDomain, setSelectedDomain] = useState<DomainCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAIMatchmakerOpen, setIsAIMatchmakerOpen] = useState(false);
  const [selectedExpertForDetails, setSelectedExpertForDetails] = useState<RetiredProfessional | null>(null);
  const [selectedExpertForBooking, setSelectedExpertForBooking] = useState<RetiredProfessional | null>(null);
  const [activeCallBooking, setActiveCallBooking] = useState<Booking | null>(null);

  // Review Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewExpertName, setReviewExpertName] = useState('JK');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const handleSubmittingReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) {
      alert('Please enter your feedback comments before submitting.');
      return;
    }
    try {
      const existingRaw = localStorage.getItem('app_platform_reviews');
      let currentReviews: any[] = [];
      if (existingRaw) {
        try { currentReviews = JSON.parse(existingRaw); } catch {}
      }
      const newReview: ReviewItem = {
        id: `rev-${Date.now()}`,
        clientName: user.name || 'Client',
        clientAvatar: user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        expertName: reviewExpertName,
        rating: reviewRating,
        comment: reviewComment.trim(),
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        visibleToExpert: false,
        featuredOnLanding: false,
      };
      const updated = [newReview, ...currentReviews];
      localStorage.setItem('app_platform_reviews', JSON.stringify(updated));
      
      // Dispatch notifications
      notificationService.add({
        target: 'admin',
        type: 'review',
        title: 'New Client Review Submitted',
        message: `${user.name || 'Client'} submitted a ${reviewRating}★ review for "${reviewExpertName}". Awaiting audit.`,
        actionLink: 'owner'
      });
      notificationService.add({
        target: 'client',
        recipientId: user.email,
        type: 'review',
        title: 'Review Awaiting Approval',
        message: `Your ${reviewRating}★ rating for "${reviewExpertName}" was sent to Admin Desk.`,
        actionLink: 'client'
      });

      setIsReviewModalOpen(false);
      setReviewComment('');
      alert(`⭐ Review Submitted to Admin Desk!\nYour review for ${reviewExpertName} has been submitted successfully and sent to Admin Audit Desk for moderation.`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col font-sans relative">
      {/* Flow Wallpaper Background (Dedicated to Client Portal) */}
      <FlowWallpaper theme={theme} />

      <div className="relative z-10 flex flex-col flex-1">
        {/* Client Executive Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-white/10 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Logo */}
            <div className="flex items-center gap-3.5 cursor-pointer group" onClick={() => setActiveTab('directory')}>
              <img
                src="/mentora-logo-horizontal-dark.png"
                alt="Mentora — Empowering Future Leaders"
                className="h-10 sm:h-11 w-auto object-contain transition-transform duration-200 group-hover:scale-105 drop-shadow-md brightness-[1.02] contrast-[1.05]"
              />
              <div className="hidden sm:block border-l border-white/10 pl-3.5">
                <span className="bg-blue-500/20 text-blue-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-blue-500/30 uppercase tracking-widest">
                  CLIENT PORTAL
                </span>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Organization: <strong className="text-white">{user.name}</strong></p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden lg:flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 text-xs font-bold">
              <button
                onClick={() => setActiveTab('directory')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === 'directory' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Search className="w-4 h-4 text-blue-400" /> Explore Advisory Directory
              </button>

              <button
                onClick={() => setActiveTab('bookings')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === 'bookings' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Calendar className="w-4 h-4 text-amber-400" /> My Sessions ({bookings.length})
              </button>

              <button
                onClick={() => setActiveTab('wallet')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === 'wallet' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Wallet className="w-4 h-4 text-emerald-400" /> Wallet (₹{walletBalance})
              </button>

              <button
                onClick={() => setActiveTab('stories')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === 'stories' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Award className="w-4 h-4 text-amber-400" /> Executive Stories
              </button>
            </nav>

            {/* Right Action */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setReviewExpertName('JK');
                  setIsReviewModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-lg hover:from-emerald-400 hover:to-teal-500 transition-all border border-emerald-400/30"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>⭐ Write Review</span>
              </button>

              <button
                onClick={() => setIsAIMatchmakerOpen(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 px-4 py-2.5 rounded-xl font-black text-xs shadow-lg shadow-amber-500/20"
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                <span>SilverMatch AI</span>
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
      <main className="flex-1">
        {activeTab === 'directory' && (
          <>
            <Hero
              selectedDomain={selectedDomain}
              setSelectedDomain={setSelectedDomain}
              openAIMatchmaker={() => setIsAIMatchmakerOpen(true)}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
            <ExpertDirectory
              selectedDomain={selectedDomain}
              setSelectedDomain={setSelectedDomain}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onViewDetails={(expert) => setSelectedExpertForDetails(expert)}
              onBook={(expert) => setSelectedExpertForBooking(expert)}
            />
          </>
        )}

        {activeTab === 'bookings' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-white">Your Booked Advisory Consultations</h2>
                <p className="text-xs text-slate-400 mt-1">Manage virtual advisory calls scheduled with retired CXO leaders.</p>
              </div>
              <button
                onClick={() => {
                  setReviewExpertName('JK');
                  setIsReviewModalOpen(true);
                }}
                className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>Rate & Review Expert Session</span>
              </button>
            </div>

            {bookings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {bookings.map((b) => (
                  <div key={b.id} className="bg-slate-900 border border-white/10 p-6 rounded-3xl space-y-4 shadow-xl">
                    <div className="flex items-center gap-4">
                      <img src={b.expertAvatar} alt={b.expertName} className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400/40" />
                      <div>
                        <h3 className="font-bold text-white text-base">{b.expertName}</h3>
                        <p className="text-xs text-amber-400 font-semibold">{b.expertTitle}</p>
                        <span className="text-[11px] text-slate-400 block mt-1">{b.date} • {b.timeSlot}</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-950 rounded-2xl border border-white/5 text-xs space-y-1">
                      <span className="text-slate-400 block">Agenda: <strong className="text-slate-200">{b.topic}</strong></span>
                      <span className="text-slate-400 block">Fee Paid: <strong className="text-emerald-400">₹{b.amount}</strong></span>
                    </div>

                    <div className="space-y-2">
                      {b.status === 'upcoming' ? (
                        <button
                          onClick={() => setActiveCallBooking(b)}
                          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 py-3 rounded-2xl font-black text-xs shadow-lg"
                        >
                          <Video className="w-4 h-4 fill-slate-950" />
                          <span>Launch SilverConnect HD Call Room</span>
                        </button>
                      ) : (
                        <div className="text-center p-2.5 bg-slate-950 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/20">
                          ✓ Advisory Session Completed
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setReviewExpertName(b.expertName || 'JK');
                          setIsReviewModalOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 text-amber-300 border border-amber-500/30 py-2.5 rounded-2xl font-bold text-xs transition-all"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>Write Review for {b.expertName}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-white/10 p-8 space-y-3">
                <Calendar className="w-12 h-12 text-slate-500 mx-auto" />
                <h3 className="text-lg font-bold text-white">No Active Consultations Booked</h3>
                <div className="flex justify-center gap-3">
                  <button onClick={() => setActiveTab('directory')} className="px-6 py-3 bg-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-lg">
                    Explore Verified Senior Experts
                  </button>
                  <button 
                    onClick={() => {
                      setReviewExpertName('JK');
                      setIsReviewModalOpen(true);
                    }}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold rounded-xl text-xs"
                  >
                    ⭐ Write Session Review
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'wallet' && (
          <WalletView
            balance={walletBalance}
            onAddFunds={onAddFunds}
            transactions={transactions}
          />
        )}

        {activeTab === 'stories' && <StoryHubView />}
      </main>

      {/* Write Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsReviewModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Rate & Review Consultation</h3>
                <p className="text-xs text-slate-400">Submit your feedback to Admin Governance Desk for approval.</p>
              </div>
            </div>

            <form onSubmit={handleSubmittingReview} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Select Expert / Senior Leader</label>
                <select
                  value={reviewExpertName}
                  onChange={(e) => setReviewExpertName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="JK">JK (Senior Logistics & Advisory Expert)</option>
                  <option value="Sunita Rao">Sunita Rao (Chartered Accountant & Finance Pro)</option>
                  <option value="Vikram Malhotra">Vikram Malhotra (Supply Chain Strategist)</option>
                  <option value="Deepak Nair">Deepak Nair (Civil Engineering Advisor)</option>
                  <option value="Rajesh Kumar">Rajesh Kumar (HR & Talent Director)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Rating (1 to 5 Stars)</label>
                <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-white/10">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className="p-1 cursor-pointer transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= reviewRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-600 fill-none'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-black text-amber-400 ml-2">{reviewRating} Out of 5 Stars</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Session Experience Review Comment</label>
                <textarea
                  required
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share details about your consultation experience, practical guidance received, and recommendations for other clients..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>Your review will be sent to Admin Audit Desk. Once approved by Admin, it will be published to the Expert Profile and Landing Page!</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-lg hover:brightness-110 transition-all"
                >
                  Submit Review to Admin Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      <AIMatchmakerModal
        isOpen={isAIMatchmakerOpen}
        onClose={() => setIsAIMatchmakerOpen(false)}
        onSelectExpertToBook={(expert) => setSelectedExpertForBooking(expert)}
      />

      <ExpertDetailModal
        expert={selectedExpertForDetails}
        onClose={() => setSelectedExpertForDetails(null)}
        onBook={(expert) => setSelectedExpertForBooking(expert)}
      />

      <BookingModal
        expert={selectedExpertForBooking}
        isOpen={!!selectedExpertForBooking}
        onClose={() => setSelectedExpertForBooking(null)}
        walletBalance={walletBalance}
        onConfirmBooking={onConfirmBooking}
        onLaunchVirtualCall={(booking) => setActiveCallBooking(booking)}
      />

      <TeleconsultSimulatorModal
        booking={activeCallBooking}
        onClose={() => setActiveCallBooking(null)}
      />

      <Footer setActiveTab={(tab) => setActiveTab(tab as any)} />
      </div>
    </div>
  );
};
