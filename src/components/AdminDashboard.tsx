import React, { useState, useEffect } from 'react';
import type { AuthUser, ReviewItem } from '../types';
import { MOCK_PROFESSIONALS } from '../data/mockData';
import { Footer } from './Footer';
import { NotificationCenter } from './NotificationCenter';
import { notificationService } from '../services/notificationService';
import { 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  DollarSign, 
  CheckCircle2, 
  LogOut, 
  Building2, 
  Activity, 
  PieChart,
  Star,
  Eye,
  EyeOff,
  Home,
  Trash2,
  Check,
  MessageSquare
} from 'lucide-react';

interface AdminDashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

const DEFAULT_INITIAL_REVIEWS: ReviewItem[] = [
  {
    id: 'rev-1',
    clientName: 'Priya Sharma',
    clientAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    expertName: 'Sunita Rao',
    expertEmail: 'sunita.rao@registry.com',
    rating: 5,
    comment: 'Sunita explained our corporate GST exposure clearly without any fluff or expensive law firm rates. We booked her again the exact same week for our valuation audit.',
    date: '2026-09-01',
    status: 'approved',
    visibleToExpert: true,
    featuredOnLanding: true,
  }
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [verificationQueue, setVerificationQueue] = useState(
    MOCK_PROFESSIONALS.map(p => ({ ...p, status: 'verified' }))
  );

  const [reviews, setReviews] = useState<ReviewItem[]>(() => {
    try {
      const saved = localStorage.getItem('app_platform_reviews');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    localStorage.setItem('app_platform_reviews', JSON.stringify(DEFAULT_INITIAL_REVIEWS));
    return DEFAULT_INITIAL_REVIEWS;
  });

  const syncReviews = (updated: ReviewItem[]) => {
    setReviews(updated);
    localStorage.setItem('app_platform_reviews', JSON.stringify(updated));
  };

  const toggleVisibleToExpert = (id: string) => {
    const updated = reviews.map(r => {
      if (r.id === id) {
        const nextState = !r.visibleToExpert;
        if (nextState) {
          notificationService.add({
            target: 'expert',
            recipientId: r.expertName,
            type: 'review',
            title: 'Client Review Approved & Published!',
            message: `${r.clientName} left you a ${r.rating}★ review: "${r.comment.slice(0, 60)}..."`,
            actionLink: 'expert'
          });
        }
        return { ...r, visibleToExpert: nextState, status: nextState ? ('approved' as const) : r.status };
      }
      return r;
    });
    syncReviews(updated);
  };

  const toggleFeaturedOnLanding = (id: string) => {
    const updated = reviews.map(r => {
      if (r.id === id) {
        const nextState = !r.featuredOnLanding;
        if (nextState) {
          notificationService.add({
            target: 'all',
            type: 'announcement',
            title: 'Client Review Spotlighted on Homepage!',
            message: `Review for ${r.expertName} from ${r.clientName} is now featured.`,
            actionLink: 'landing'
          });
        }
        return { ...r, featuredOnLanding: nextState };
      }
      return r;
    });
    syncReviews(updated);
  };

  const deleteReview = (id: string) => {
    if (confirm('Are you sure you want to reject/delete this review?')) {
      const updated = reviews.filter(r => r.id !== id);
      syncReviews(updated);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b132b] text-white flex flex-col font-sans">
      
      {/* Admin Executive Header */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-amber-500/40 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            <div className="flex items-center gap-3.5">
              <img
                src="/mentora-logo-horizontal-dark.png"
                alt="Mentora — Empowering Future Leaders"
                className="h-10 sm:h-11 w-auto object-contain drop-shadow-md brightness-[1.02] contrast-[1.05]"
              />
              <div className="hidden sm:block border-l border-white/10 pl-3.5">
                <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                  ADMIN DESK
                </span>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Logged in as: <strong className="text-white">{user.name}</strong></p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold">
                <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                <span>Executive Admin Console</span>
              </div>

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

      {/* Main Admin Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 w-full">
        
        {/* KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900 p-6 rounded-3xl border border-white/10 space-y-2 shadow-xl">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Gross Merchandise Value (GMV)</span>
            <p className="text-3xl font-black text-amber-400">₹1,85,400</p>
            <span className="text-[11px] text-emerald-400 font-bold">+24% month-over-month</span>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-white/10 space-y-2 shadow-xl">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Platform Commission (12.5% avg)</span>
            <p className="text-3xl font-black text-emerald-400">₹23,175</p>
            <span className="text-[11px] text-slate-400">Primary Revenue Stream</span>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-white/10 space-y-2 shadow-xl">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Verified Senior Pros</span>
            <p className="text-3xl font-black text-white">142 Seniors</p>
            <span className="text-[11px] text-amber-300 font-bold">98% History Verified</span>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-white/10 space-y-2 shadow-xl">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Client Reviews Moderated</span>
            <p className="text-3xl font-black text-white">{reviews.length} Reviews</p>
            <span className="text-[11px] text-emerald-400 font-bold">Admin Governance Active</span>
          </div>
        </div>

        {/* Client Review Audit & Governance Desk */}
        <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-400" />
                Client Consultation Review Moderation Desk
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Admin controls which client reviews are published on the Expert's profile and featured on the Main Landing Page.
              </p>
            </div>
            <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-3.5 py-1.5 rounded-full border border-amber-500/30">
              Admin Governance System
            </span>
          </div>

          <div className="space-y-4">
            {reviews.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No client reviews submitted yet.</p>
            ) : (
              reviews.map((rev) => (
                <div key={rev.id} className="p-5 rounded-2xl bg-slate-950 border border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img src={rev.clientAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'} className="w-10 h-10 rounded-full object-cover border border-amber-400/40" alt={rev.clientName} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">{rev.clientName}</h4>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">For: {rev.expertName}</span>
                        </div>
                        <div className="flex items-center gap-1 text-amber-400 text-xs mt-0.5">
                          {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          ))}
                          <span className="text-slate-400 text-[11px] ml-2">{rev.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${rev.visibleToExpert ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        {rev.visibleToExpert ? '✓ Visible to Expert' : '❌ Hidden from Expert'}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${rev.featuredOnLanding ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        {rev.featuredOnLanding ? '★ Featured on Landing Page' : 'Normal'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-900/70 p-3 rounded-xl border border-white/5 leading-relaxed italic">
                    "{rev.comment}"
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                    <span className="text-[11px] text-slate-400">Admin Action Controls:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleVisibleToExpert(rev.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          rev.visibleToExpert 
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400' 
                            : 'bg-slate-800 text-emerald-300 border-emerald-500/40 hover:bg-slate-700'
                        }`}
                      >
                        {rev.visibleToExpert ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {rev.visibleToExpert ? 'Hide from Expert' : 'Approve for Expert'}
                      </button>

                      <button
                        onClick={() => toggleFeaturedOnLanding(rev.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          rev.featuredOnLanding 
                            ? 'bg-amber-500 text-slate-950 border-amber-400' 
                            : 'bg-slate-800 text-amber-300 border-amber-500/40 hover:bg-slate-700'
                        }`}
                      >
                        <Home className="w-3.5 h-3.5" />
                        {rev.featuredOnLanding ? 'Remove from Landing' : 'Feature on Landing'}
                      </button>

                      <button
                        onClick={() => deleteReview(rev.id)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-white/10 transition-colors"
                        title="Delete Review"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Verification Desk */}
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Senior Advisor Background Verification Desk
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Approve corporate employment history and background verification badges.</p>
            </div>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-3 py-1 rounded-full border border-emerald-500/30">
              Trust Over Tech Model
            </span>
          </div>

          <div className="divide-y divide-white/10">
            {verificationQueue.slice(0, 4).map((prof) => (
              <div key={prof.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img src={prof.avatarUrl} alt={prof.name} className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-400/40" />
                  <div>
                    <h3 className="font-bold text-white text-base">{prof.name}</h3>
                    <p className="text-xs text-amber-400 font-semibold">{prof.exRole} @ {prof.exCompany} ({prof.yearsOfExperience} Yrs)</p>
                    <p className="text-[11px] text-slate-400">{prof.domain} • ₹{prof.hourlyRate}/hr</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => alert(`Verified background history badge granted to ${prof.name}!`)}
                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-black shadow"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Grant Verified Badge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      <Footer setActiveTab={() => {}} />
    </div>
  );
};
