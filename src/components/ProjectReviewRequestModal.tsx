import { startVisibleInterval } from '../lib/polling'; // egress-safe polling (skips hidden tabs)
import React, { useState } from 'react';
import { X, ShieldCheck, FileText, Send, Sparkles, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { ProjectReviewRecord } from '../types';
import { mongoDB } from '../mongoDBService';
import { notificationService } from '../services/notificationService';

interface ProjectReviewRequestModalProps {
  expert: any;
  clientProfile: any;
  isOpen: boolean;
  onClose: () => void;
  onRequestSuccess: (review: ProjectReviewRecord) => void;
  theme?: 'dark' | 'light';
  walletBalance?: number;
  onWalletUpdate?: (newBalance: number) => void;
}

export const ProjectReviewRequestModal: React.FC<ProjectReviewRequestModalProps> = ({
  expert,
  clientProfile,
  isOpen,
  onClose,
  onRequestSuccess,
  theme = 'dark',
  walletBalance,
  onWalletUpdate
}) => {
  const isLight = theme === 'light';

  // Dynamic Authoritative Pricing States (Additive Model: Expert Charge + Platform Charge = Total Amount)
  const [expertCharge, setExpertCharge] = useState<number>(() => {
    if (typeof expert?.projectRate === 'number') return Math.min(2000, Math.max(0, expert.projectRate));
    return expert?.rate ? Math.min(2000, Math.max(0, expert.rate * 3)) : 1000;
  });
  const [platformFee, setPlatformFee] = useState<number>(() => {
    const expBase = typeof expert?.projectRate === 'number' ? Math.min(2000, Math.max(0, expert.projectRate)) : (expert?.rate ? Math.min(2000, Math.max(0, expert.rate * 3)) : 1000);
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('mongo_platform_charge') || localStorage.getItem('mongo_project_review_config');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (typeof parsed.feeValue === 'number') {
            return parsed.feeType === 'percentage'
              ? Math.round(expBase * (parsed.feeValue / 100))
              : parsed.feeValue;
          }
        }
      } catch {}
    }
    return 200;
  });
  const [totalAmount, setTotalAmount] = useState<number>(() => {
    const initialExp = typeof expert?.projectRate === 'number' ? Math.min(2000, Math.max(0, expert.projectRate)) : (expert?.rate ? Math.min(2000, Math.max(0, expert.rate * 3)) : 1000);
    let initialFee = 200;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('mongo_platform_charge') || localStorage.getItem('mongo_project_review_config');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (typeof parsed.feeValue === 'number') {
            initialFee = parsed.feeType === 'percentage'
              ? Math.round(initialExp * (parsed.feeValue / 100))
              : parsed.feeValue;
          }
        }
      } catch {}
    }
    return initialExp + initialFee;
  });

  React.useEffect(() => {
    if (!isOpen || !expert?.id) return;
    const fetchPricing = async () => {
      try {
        const res = await mongoDB.getProjectReviewPricing(expert.id, false, 'client');
        if (res.success) {
          const rate = typeof res.projectRate === 'number' ? res.projectRate : (expert?.projectRate ?? 1000);
          const fee = typeof res.platformFee === 'number' ? res.platformFee : 200;
          const total = typeof res.clientPrice === 'number' ? res.clientPrice : (rate + fee);
          setExpertCharge(rate);
          setPlatformFee(fee);
          setTotalAmount(total);
        }
      } catch {}
    };

    fetchPricing();
    const handlePlatformFeeUpdate = () => fetchPricing();
    window.addEventListener('platform_fee_updated', handlePlatformFeeUpdate);
    window.addEventListener('storage', handlePlatformFeeUpdate);
    window.addEventListener('mongo_db_updated', handlePlatformFeeUpdate);
    // EGRESS FIX: was a 1.5 s poll. Price changes arrive via the platform_fee_updated / storage /
    // mongo_db_updated events above; a slow 60 s refresh is kept as a safety net while open.
    const stopPricingPoll = startVisibleInterval(fetchPricing, 60_000);
    return () => {
      window.removeEventListener('platform_fee_updated', handlePlatformFeeUpdate);
      window.removeEventListener('storage', handlePlatformFeeUpdate);
      window.removeEventListener('mongo_db_updated', handlePlatformFeeUpdate);
      stopPricingPoll();
    };
  }, [isOpen, expert?.id, expert?.projectRate]);

  const [reviewType, setReviewType] = useState('Full Architecture & Code Review');
  const [expectedScope, setExpectedScope] = useState('Comprehensive Document Audit + 2 Strategic Consultation Calls');
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !expert) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const clientId = clientProfile?.id || `cli-${Date.now()}`;
      const clientName = clientProfile?.name || 'Enterprise Client';
      const clientEmail = (clientProfile?.email || 'client@example.com').toLowerCase().trim();

      const result = await mongoDB.requestProjectReview({
        clientId,
        clientName,
        clientEmail,
        expertId: expert.id || 'exp-1',
        expertName: expert.name || 'Expert',
        expertEmail: (expert.email || '').toLowerCase().trim(),
        expectedScope,
        reviewType,
        requestNotes,
        clientWalletBalance: typeof walletBalance === 'number' ? walletBalance : undefined
      });

      if (result.success && result.projectReview) {
        if (typeof result.clientWalletBalance === 'number' && onWalletUpdate) {
          onWalletUpdate(result.clientWalletBalance);
        }

        // Multi-party notifications
        notificationService.add({
          target: 'expert',
          recipientId: expert.email || expert.name,
          type: 'booking',
          title: 'New Dedicated Project Review Request!',
          message: `${clientName} requested a Dedicated Project Review (${reviewType}) for ₹${expertCharge.toLocaleString('en-IN')}.`,
          actionLink: 'expert'
        });

        notificationService.add({
          target: 'client',
          recipientId: clientEmail,
          type: 'booking',
          title: 'Project Review Request Sent',
          message: `Your request for ${expert.name} has been submitted (ID: ${result.projectReview.projectReviewId}). Escrow of ₹${totalAmount.toLocaleString('en-IN')} has been placed. Awaiting Expert decision.`,
          actionLink: 'client'
        });

        notificationService.add({
          target: 'admin',
          type: 'booking',
          title: 'New Project Review Request',
          message: `${clientName} requested Project Review from ${expert.name} (Total: ₹${totalAmount.toLocaleString('en-IN')}, Platform Fee: ₹${platformFee.toLocaleString('en-IN')}). Escrow funded.`,
          actionLink: 'owner'
        });

        onRequestSuccess(result.projectReview);
        onClose();
      } else {
        setErrorMessage(result.error || 'Failed to submit Project Review request.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 max-h-[90vh] flex flex-col my-auto ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#0B111A] border-white/10 text-white'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-5 border-b shrink-0 ${isLight ? 'border-slate-200 bg-slate-50/80' : 'border-white/10 bg-[#0F1724]'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">Request Dedicated Project Review</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Dedicated Workflow
                </span>
              </div>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Independent client-expert project audit with 2 strategy meetings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Project Review Modal"
            title="Close Project Review Modal"
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isLight ? 'border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 scrollbar-thin select-text">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Expert Summary Card */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/10'}`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm bg-gradient-to-br from-amber-500 to-amber-700 text-black">
                {expert.initials || expert.name?.slice(0, 2).toUpperCase() || 'EX'}
              </div>
              <div>
                <p className="font-bold text-sm flex items-center gap-1.5">
                  {expert.name}
                  {expert.verified !== false && <ShieldCheck size={14} className="text-emerald-400" />}
                </p>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{expert.field} · {expert.years || 15}+ yrs exp</p>
              </div>
            </div>

            <div className="text-right">
              <span className={`text-[10px] uppercase font-mono block ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Total Review Fee</span>
              <span className="text-lg font-mono font-bold text-amber-400">
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
              <span className={`text-[10px] block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Audit + 2 Calls</span>
            </div>
          </div>

          {/* Transparent Project Review Pricing Breakdown */}
          <div className={`p-4 rounded-xl border space-y-2.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/10'}`}>
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Pricing Breakdown
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                Authoritative Active Rate
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Project Price:</span>
                <span className="font-mono font-semibold text-slate-200">₹{expertCharge.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Platform Charge:</span>
                <span className="font-mono font-semibold text-cyan-400">₹{platformFee.toLocaleString('en-IN')}</span>
              </div>

              <div className="pt-2 border-t border-dashed border-white/10 flex items-center justify-between text-sm font-bold">
                <span className={isLight ? 'text-slate-900' : 'text-white'}>Total:</span>
                <span className="font-mono text-lg font-black text-amber-400">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className={`text-[10px] pt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Transparent billing: Expert receives Expert Review Charge upon completion; Platform Charge covers escrow & session infrastructure.
            </div>
          </div>

          {/* Client Wallet Escrow Indicator */}
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
            isLight ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}>
            <div className="flex items-center gap-2">
              <span className="font-bold">Client Wallet Balance:</span>
              <span className="font-mono font-bold text-sm text-emerald-400">
                ₹{(walletBalance ?? 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] opacity-80 block">Held in Escrow:</span>
              <strong className="font-mono text-amber-400">₹{totalAmount.toLocaleString('en-IN')}</strong>
            </div>
          </div>

          {/* Review Type Selection */}
          <div className="space-y-1.5">
            <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Review Type
            </label>
            <select
              value={reviewType}
              onChange={(e) => setReviewType(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium outline-none transition-all ${
                isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#070C15] border-white/10 text-white focus:border-amber-400'
              }`}
            >
              <option value="Full Architecture & Code Review">Full Architecture & Code Review</option>
              <option value="Security, Vulnerability & Compliance Audit">Security, Vulnerability & Compliance Audit</option>
              <option value="High-Throughput Scalability & Database Assessment">High-Throughput Scalability & Database Assessment</option>
              <option value="DevOps, CI/CD Pipeline & Cloud Cost Optimization">DevOps, CI/CD Pipeline & Cloud Cost Optimization</option>
              <option value="Strategic Product & Technical Feasibility Audit">Strategic Product & Technical Feasibility Audit</option>
            </select>
          </div>

          {/* Expected Scope */}
          <div className="space-y-1.5">
            <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Expected Scope
            </label>
            <input
              type="text"
              value={expectedScope}
              onChange={(e) => setExpectedScope(e.target.value)}
              placeholder="e.g. Document audit + 2 strategic calls"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium outline-none transition-all ${
                isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#070C15] border-white/10 text-white focus:border-amber-400'
              }`}
              required
            />
          </div>

          {/* Project Details & Questions */}
          <div className="space-y-1.5">
            <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Project Summary & Specific Problems to Review
            </label>
            <textarea
              rows={4}
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              placeholder="Describe your project, technology stack, and specific architectural bottlenecks or goals you want the expert to evaluate..."
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium outline-none transition-all resize-none ${
                isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#070C15] border-white/10 text-white focus:border-amber-400'
              }`}
              required
            />
          </div>

          {/* Workflow Guarantee Banner */}
          <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
            <div className="flex items-center gap-1.5 font-bold">
              <Sparkles size={14} className="text-amber-500" />
              <span>Dedicated Project Review Workflow Guarantee</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Upon expert acceptance, a dedicated project workspace opens with private chat, document upload, slot scheduling, and up to 2 Google Meet sessions.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-700' : 'border-white/10 hover:bg-white/5 text-slate-300'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Submitting Request...</span>
              ) : (
                <>
                  <Send size={14} />
                  <span>Request Project Review (₹{totalAmount.toLocaleString('en-IN')})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
