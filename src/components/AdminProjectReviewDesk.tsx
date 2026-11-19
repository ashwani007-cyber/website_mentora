import { startVisibleInterval } from '../lib/polling'; // egress-safe polling (skips hidden tabs)
import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, ShieldCheck, IndianRupee, Video, MessageSquare, History, Save,
  Search, Filter, CheckCircle2, AlertCircle, Clock, ExternalLink,
  Eye, RefreshCw, ChevronRight, User, Award, Layers, Sparkles
} from 'lucide-react';
import { ProjectReviewRecord } from '../types';
import { mongoDB } from '../mongoDBService';

interface AdminProjectReviewDeskProps {
  isLight?: boolean;
  onInspectReview: (reviewId: string) => void;
}

export const AdminProjectReviewDesk: React.FC<AdminProjectReviewDeskProps> = ({
  isLight = false,
  onInspectReview
}) => {
  const [reviews, setReviews] = useState<ProjectReviewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<
    'requests' | 'active' | 'completed' | 'meetings' | 'financials' | 'audit' | 'pricing'
  >('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'PendingExpertAcceptance' | 'Accepted' | 'Declined'>('ALL');


  // Dynamic Pricing & Platform Fee Governance State
  const [expertsList, setExpertsList] = useState<any[]>([]);
  const [platformFeeConfig, setPlatformFeeConfig] = useState<{ feeType: 'percentage' | 'fixed'; feeValue: number }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('mongo_platform_charge') || localStorage.getItem('mongo_project_review_config');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.feeValue === 'number') {
            return { feeType: parsed.feeType || 'fixed', feeValue: parsed.feeValue };
          }
        }
      } catch {}
    }
    return { feeType: 'fixed', feeValue: 200 };
  });
  const [feeTypeInput, setFeeTypeInput] = useState<'percentage' | 'fixed'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('mongo_platform_charge') || localStorage.getItem('mongo_project_review_config');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.feeType === 'percentage' || parsed.feeType === 'fixed')) return parsed.feeType;
        }
      } catch {}
    }
    return 'fixed';
  });
  const [feeValueInput, setFeeValueInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('mongo_platform_charge') || localStorage.getItem('mongo_project_review_config');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.feeValue === 'number') return String(parsed.feeValue);
        }
      } catch {}
    }
    return '200';
  });
  const isFeeDirtyRef = useRef(false);
  const [expertPriceInputs, setExpertPriceInputs] = useState<Record<string, number>>({});
  const [isUpdatingFee, setIsUpdatingFee] = useState(false);
  const [isUpdatingPriceId, setIsUpdatingPriceId] = useState<string | null>(null);
  const [priceFeedback, setPriceFeedback] = useState<Record<string, string>>({});
  const [feeFeedback, setFeeFeedback] = useState<string | null>(null);

  const loadPricingAndFees = async () => {
    try {
      const feeRes = await mongoDB.getProjectReviewPlatformFee();
      if (feeRes.success && (feeRes.config || feeRes.platformCharge)) {
        const cfg = feeRes.config || feeRes.platformCharge;
        setPlatformFeeConfig(cfg);
        if (!isFeeDirtyRef.current) {
          setFeeTypeInput(cfg.feeType || 'fixed');
          setFeeValueInput(String(cfg.feeValue ?? 200));
        }
      }

      const res = await mongoDB.getProjectReviewPricing(undefined, true, 'admin');
      if (res.success && Array.isArray(res.experts)) {
        setExpertsList(res.experts);
        const inputs: Record<string, number> = {};
        res.experts.forEach((e: any) => {
          inputs[e.id] = typeof e.projectRate === 'number' ? e.projectRate : (e.rate ? Math.min(2000, e.rate * 3) : 1000);
        });
        setExpertPriceInputs(prev => ({ ...inputs, ...prev }));
        const pCfg = res.platformFeeConfig || (res as any).platformCharge;
        if (pCfg && (!feeRes || (!feeRes.config && !feeRes.platformCharge))) {
          setPlatformFeeConfig(pCfg);
          if (!isFeeDirtyRef.current) {
            setFeeTypeInput(pCfg.feeType || 'fixed');
            setFeeValueInput(String(pCfg.feeValue ?? 200));
          }
        }
      }
    } catch (e) {
      console.error('Failed to load pricing:', e);
    }
  };

  useEffect(() => {
    loadPricingAndFees();
    const handlePricingUpdate = () => loadPricingAndFees();
    window.addEventListener('project_review_updated', handlePricingUpdate);
    window.addEventListener('platform_fee_updated', handlePricingUpdate);
    window.addEventListener('mongo_db_updated', handlePricingUpdate);
    window.addEventListener('storage', handlePricingUpdate);
    // EGRESS FIX: was every 2 s; pricing changes also arrive via the events above.
    const stopPricingPoll = startVisibleInterval(loadPricingAndFees, 60_000);
    return () => {
      window.removeEventListener('project_review_updated', handlePricingUpdate);
      window.removeEventListener('platform_fee_updated', handlePricingUpdate);
      window.removeEventListener('mongo_db_updated', handlePricingUpdate);
      window.removeEventListener('storage', handlePricingUpdate);
      stopPricingPoll();
    };
  }, []);

  const handleAdminUpdatePrice = async (expertId: string) => {
    const val = expertPriceInputs[expertId];
    if (val === undefined || val < 0 || val > 2000 || isNaN(val)) {
      setPriceFeedback(prev => ({ ...prev, [expertId]: '❌ Price must be between ₹0 and ₹2,000.' }));
      setTimeout(() => setPriceFeedback(prev => { const n = { ...prev }; delete n[expertId]; return n; }), 4000);
      return;
    }
    setIsUpdatingPriceId(expertId);
    const res = await mongoDB.updateProjectReviewPrice(expertId, val, 'admin', 'admin-governance');
    setIsUpdatingPriceId(null);
    if (res.success) {
      setPriceFeedback(prev => ({ ...prev, [expertId]: '✅ Synced: ₹' + (res.projectRate ?? val) }));
      loadPricingAndFees();
      setTimeout(() => setPriceFeedback(prev => { const n = { ...prev }; delete n[expertId]; return n; }), 4000);
    } else {
      setPriceFeedback(prev => ({ ...prev, [expertId]: '❌ ' + (res.error || 'Failed') }));
    }
  };

  const handleAdminUpdateFee = async () => {
    const rawVal = feeValueInput.trim();
    const num = Number(rawVal);
    if (rawVal === '' || isNaN(num) || num < 0) {
      setFeeFeedback('❌ Fee value must be a non-negative number.');
      return;
    }
    if (feeTypeInput === 'percentage' && num > 100) {
      setFeeFeedback('❌ Percentage fee cannot exceed 100%.');
      return;
    }
    setIsUpdatingFee(true);
    setFeeFeedback(null);
    const res = await mongoDB.updateProjectReviewPlatformFee(feeTypeInput, num, 'admin-governance');
    setIsUpdatingFee(false);
    if (res.success && (res.config || (res as any).platformCharge)) {
      const cfg = res.config || (res as any).platformCharge;
      isFeeDirtyRef.current = false;
      setPlatformFeeConfig(cfg);
      setFeeTypeInput(cfg.feeType || 'fixed');
      setFeeValueInput(String(cfg.feeValue ?? num));
      setFeeFeedback('✓ Platform charge updated successfully');
      loadPricingAndFees();
      setTimeout(() => setFeeFeedback(null), 4000);
    } else {
      setFeeFeedback('❌ ' + (res.error || 'Failed to update fee'));
    }
  };

  const loadReviews = async () => {
    try {
      const list = await mongoDB.getProjectReviews({ includeArchived: true });
      setReviews(Array.isArray(list) ? list : (Array.isArray((list as any)?.projectReviews) ? (list as any).projectReviews : []));
    } catch (e) {
      console.error('Failed to load project reviews for admin:', e);
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
    // EGRESS FIX: was every 3 s.
    const stopReviewsPoll = startVisibleInterval(loadReviews, 60_000);
    const handleUpdate = () => loadReviews();
    window.addEventListener('project_review_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      stopReviewsPoll();
      window.removeEventListener('project_review_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Filtered lists
  const filteredReviews = reviews.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      r.projectReviewId.toLowerCase().includes(q) ||
      r.clientName.toLowerCase().includes(q) ||
      r.clientEmail.toLowerCase().includes(q) ||
      r.expertName.toLowerCase().includes(q) ||
      r.expertEmail.toLowerCase().includes(q) ||
      (r.reviewType && r.reviewType.toLowerCase().includes(q))
    );
  });

  const requestsList = filteredReviews.filter((r) => {
    if (requestFilter === 'ALL') return true;
    return r.status === requestFilter;
  });

  const activeReviewsList = filteredReviews.filter((r) =>
    ['Accepted', 'ProjectSubmitted', 'InReview', 'MeetingRequested', 'MeetingScheduled'].includes(r.status)
  );

  const completedReviewsList = filteredReviews.filter((r) => r.status === 'Completed');

  // All meetings flattened
  const allMeetings = filteredReviews.flatMap((r) =>
    (r.meetings || []).map((m) => ({
      ...m,
      reviewId: r.projectReviewId,
      clientName: r.clientName,
      expertName: r.expertName
    }))
  );

  // All activity events flattened
  const allAuditEvents = filteredReviews
    .flatMap((r) =>
      (r.activityTimeline || []).map((a) => ({
        ...a,
        reviewId: r.projectReviewId,
        clientName: r.clientName,
        expertName: r.expertName
      }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Metrics
  const totalVolume = reviews.reduce((sum, r) => sum + (r.paymentStatus === 'PaymentSuccessful' ? r.price : 0), 0);
  const totalPayouts = reviews.reduce((sum, r) => sum + (r.expertEarningStatus === 'EarningReleased' ? r.expertEarning : 0), 0);
  const totalPlatformFees = reviews.reduce((sum, r) => sum + (r.paymentStatus === 'PaymentSuccessful' ? r.platformFee : 0), 0);
  const pendingRequestsCount = reviews.filter((r) => r.status === 'PendingExpertAcceptance').length;

  const requestsTableRef = useRef<HTMLDivElement>(null);

  const handleRequestsTableWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = requestsTableRef.current;
    if (!el) return;

    const canScrollHorizontally = el.scrollWidth > el.clientWidth;
    const canScrollVertically = el.scrollHeight > el.clientHeight;

    if (e.shiftKey || Math.abs(e.deltaX) > 0) {
      return;
    }

    const target = e.target as HTMLElement;
    const isOverHeader = Boolean(target && target.closest('thead'));

    if (canScrollHorizontally) {
      const atTop = el.scrollTop <= 0 && e.deltaY < 0;
      const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight && e.deltaY > 0;

      if (isOverHeader || !canScrollVertically || atTop || atBottom) {
        el.scrollLeft += e.deltaY;
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Desk Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className={`text-xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Project Review Operations & Governance Desk
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Dedicated Workflow B
            </span>
          </div>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Authoritative multi-party management across Client Portal, Expert Portal, Meetings, Wallets, and Audit Trail
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadReviews}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-700' : 'border-white/10 hover:bg-white/5 text-slate-300'
            }`}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh State</span>
          </button>
        </div>
      </div>

      {/* Top Financial & Operational Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-2xl border space-y-1 ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111A] border-white/10'}`}>
          <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Pending Requests
          </span>
          <p className="text-2xl font-bold font-mono text-amber-400">{pendingRequestsCount}</p>
          <span className="text-[11px] text-slate-400">Awaiting Expert Decision</span>
        </div>

        <div className={`p-4 rounded-2xl border space-y-1 ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111A] border-white/10'}`}>
          <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Active Reviews
          </span>
          <p className="text-2xl font-bold font-mono text-cyan-400">{activeReviewsList.length}</p>
          <span className="text-[11px] text-slate-400">In Workspaces / Scheduling</span>
        </div>

        <div className={`p-4 rounded-2xl border space-y-1 ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111A] border-white/10'}`}>
          <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Completed Reviews
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-400">{completedReviewsList.length}</p>
          <span className="text-[11px] text-slate-400">Audit Finalized & Released</span>
        </div>

        <div className={`p-4 rounded-2xl border space-y-1 ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111A] border-white/10'}`}>
          <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Settled Volume (GMV)
          </span>
          <p className="text-2xl font-bold font-mono text-amber-400">₹{totalVolume.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-slate-400">
            Platform Cut: <strong className="text-white">₹{totalPlatformFees.toLocaleString('en-IN')}</strong>
          </span>
        </div>
      </div>

      {/* Sub-Desk Navigation Tabs */}
      <div className={`flex items-center justify-between border-b pb-3 flex-wrap gap-3 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { id: 'requests', label: 'Requests', count: requestsList.length },
            { id: 'active', label: 'Active Reviews', count: activeReviewsList.length },
            { id: 'completed', label: 'Completed Reviews', count: completedReviewsList.length },
            { id: 'meetings', label: 'Meetings Monitor', count: allMeetings.length },
            { id: 'financials', label: 'Payments & Earnings' },
            { id: 'pricing', label: 'Dynamic Pricing & Platform Fee' },
            { id: 'audit', label: 'Audit Trail', count: allAuditEvents.length },
          ].map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : isLight
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-[#111A27] text-slate-300 hover:bg-white/5'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-black/20 text-black' : isLight ? 'bg-slate-200 text-slate-700' : 'bg-white/10 text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Global Search */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border max-w-xs w-full text-xs ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'
        }`}>
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search review ID, client, expert..."
            className="bg-transparent outline-none flex-1 text-xs"
          />
        </div>
      </div>

      {/* SUBTAB 1: REQUESTS */}
      {activeSubTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Filter Requests:</span>
            {(['ALL', 'PendingExpertAcceptance', 'Accepted', 'Declined'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setRequestFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  requestFilter === st
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : isLight ? 'border-slate-200 text-slate-600' : 'border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {st === 'PendingExpertAcceptance' ? 'Pending' : st}
              </button>
            ))}
          </div>

          <div className={`rounded-2xl border overflow-hidden shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
            <div
              ref={requestsTableRef}
              onWheel={handleRequestsTableWheel}
              className="overflow-x-auto overflow-y-auto max-h-[min(620px,70vh)] select-text"
            >
              <table className="w-full min-w-[1050px] text-left text-xs border-collapse">
                <thead className={`sticky top-0 z-10 ${isLight ? 'bg-slate-50' : 'bg-[#070C15]'}`}>
                  <tr className={`border-b ${isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'}`}>
                    <th className="p-3.5 font-bold uppercase tracking-wider whitespace-nowrap">Review ID</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider whitespace-nowrap">Client</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider whitespace-nowrap">Assigned Expert</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider whitespace-nowrap">Scope / Review Type</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-right whitespace-nowrap">Price</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider whitespace-nowrap">Status</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider whitespace-nowrap">Created</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {requestsList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No project review requests matching the current filter.
                      </td>
                    </tr>
                  ) : (
                    requestsList.map((r) => (
                      <tr key={r.projectReviewId} className={`transition-colors hover:bg-white/[0.02]`}>
                        <td className="p-3.5 font-mono font-bold text-amber-400 whitespace-nowrap">{r.projectReviewId}</td>
                        <td className="p-3.5 whitespace-nowrap">
                          <p className="font-bold">{r.clientName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{r.clientEmail}</p>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <p className="font-bold">{r.expertName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{r.expertEmail}</p>
                        </td>
                        <td className="p-3.5 max-w-xs truncate" title={r.expectedScope}>
                          <p className="font-medium truncate">{r.reviewType}</p>
                          <p className="text-[11px] text-slate-400 truncate">{r.expectedScope}</p>
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-amber-400 whitespace-nowrap">
                          ₹{r.price.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            r.status === 'Accepted'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : r.status === 'Declined'
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-[11px] text-slate-400 font-mono whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => onInspectReview(r.projectReviewId)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer flex items-center gap-1 ml-auto"
                          >
                            <Eye size={12} /> Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: ACTIVE REVIEWS */}
      {activeSubTab === 'active' && (
        <div className={`rounded-2xl border overflow-hidden shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b ${isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#070C15] border-white/10 text-slate-400'}`}>
                <th className="p-3.5 font-bold uppercase tracking-wider">Review ID</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Client ↔ Expert</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Submission Status</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-center">Meetings Used</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">State</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Chat Count</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activeReviewsList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No active project reviews in progress.
                  </td>
                </tr>
              ) : (
                activeReviewsList.map((r) => (
                  <tr key={r.projectReviewId} className="transition-colors hover:bg-white/[0.02]">
                    <td className="p-3.5 font-mono font-bold text-amber-400">{r.projectReviewId}</td>
                    <td className="p-3.5">
                      <p className="font-bold">{r.clientName} ↔ {r.expertName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">₹{r.price.toLocaleString('en-IN')}</p>
                    </td>
                    <td className="p-3.5">
                      {r.submission ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 size={13} /> Submitted (v{r.submission.version})
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Awaiting Submission</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-amber-400">
                      {r.completedMeetingCount} / 2
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">
                      {r.chat?.length || 0} messages
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onInspectReview(r.projectReviewId)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow transition-all cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <span>Workspace</span> <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBTAB 3: COMPLETED REVIEWS */}
      {activeSubTab === 'completed' && (
        <div className={`rounded-2xl border overflow-hidden shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b ${isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#070C15] border-white/10 text-slate-400'}`}>
                <th className="p-3.5 font-bold uppercase tracking-wider">Review ID</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Client ↔ Expert</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-right">Total Charged</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-right">Expert Payout</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Payout Status</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Completed Date</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {completedReviewsList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No completed project reviews yet.
                  </td>
                </tr>
              ) : (
                completedReviewsList.map((r) => (
                  <tr key={r.projectReviewId} className="transition-colors hover:bg-white/[0.02]">
                    <td className="p-3.5 font-mono font-bold text-amber-400">{r.projectReviewId}</td>
                    <td className="p-3.5">
                      <p className="font-bold">{r.clientName} ↔ {r.expertName}</p>
                      <p className="text-[11px] text-slate-400">{r.reviewType}</p>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-amber-400">
                      ₹{r.price.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-400">
                      ₹{r.expertEarning.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {r.expertEarningStatus}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-400">
                      {r.reviewFeedback?.completedAt ? new Date(r.reviewFeedback.completedAt).toLocaleDateString() : 'Finalized'}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onInspectReview(r.projectReviewId)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <Award size={13} /> View Findings
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBTAB 4: MEETINGS MONITOR */}
      {activeSubTab === 'meetings' && (
        <div className={`rounded-2xl border overflow-hidden shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b ${isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#070C15] border-white/10 text-slate-400'}`}>
                <th className="p-3.5 font-bold uppercase tracking-wider">Review ID</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Session</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Participants</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Scheduled Date & Time</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Google Meet Link</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Status</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allMeetings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No project review meetings scheduled across any active review.
                  </td>
                </tr>
              ) : (
                allMeetings.map((m, idx) => (
                  <tr key={idx} className="transition-colors hover:bg-white/[0.02]">
                    <td className="p-3.5 font-mono font-bold text-amber-400">{m.reviewId}</td>
                    <td className="p-3.5 font-bold">Meeting #{m.meetingNumber} of 2</td>
                    <td className="p-3.5">{m.clientName} ↔ {m.expertName}</td>
                    <td className="p-3.5 font-mono">{m.date} · {m.startTime} - {m.endTime}</td>
                    <td className="p-3.5 max-w-xs truncate font-mono">
                      {m.googleMeetLink ? (
                        <a href={m.googleMeetLink} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">
                          {m.googleMeetLink}
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">Awaiting Generation</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        m.meetingStatus === 'Completed'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : m.googleMeetLink
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {m.meetingStatus}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onInspectReview(m.reviewId)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer ml-auto"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBTAB 5: PAYMENTS & FINANCIALS */}
      {activeSubTab === 'financials' && (
        <div className={`rounded-2xl border overflow-hidden shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b ${isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#070C15] border-white/10 text-slate-400'}`}>
                <th className="p-3.5 font-bold uppercase tracking-wider">Review ID</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Client ↔ Expert</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-right">Price Charged</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Client Wallet Tx</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-right">Expert Earning</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-right">Platform Cut</th>
                <th className="p-3.5 font-bold uppercase tracking-wider">Earning Status</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No financial transaction records found.
                  </td>
                </tr>
              ) : (
                reviews.map((r) => (
                  <tr key={r.projectReviewId} className="transition-colors hover:bg-white/[0.02]">
                    <td className="p-3.5 font-mono font-bold text-amber-400">{r.projectReviewId}</td>
                    <td className="p-3.5">{r.clientName} ↔ {r.expertName}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-amber-400">₹{r.price.toLocaleString('en-IN')}</td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-400">{r.clientWalletTxId || 'Pending'}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-400">₹{r.expertEarning.toLocaleString('en-IN')}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-cyan-400">₹{r.platformFee.toLocaleString('en-IN')}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        r.expertEarningStatus === 'EarningReleased'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}>
                        {r.expertEarningStatus}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onInspectReview(r.projectReviewId)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer ml-auto"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      
      {/* SUBTAB 7: DYNAMIC PRICING & PLATFORM FEE MANAGEMENT */}
      {activeSubTab === 'pricing' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Section 1: Platform Fee Governance (Admin Only) */}
          <div className={`p-6 rounded-2xl border shadow-sm space-y-4 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">Platform Charge</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Governance Rule
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Currently active fee: <strong className="font-mono text-cyan-400 font-bold">{platformFeeConfig.feeType === 'percentage' ? `${platformFeeConfig.feeValue}%` : `₹${platformFeeConfig.feeValue} (Fixed)`}</strong>. Applies strictly to Project Review engagements; 1-Hour Call rates remain isolated.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 text-xs">
              <div className="w-full sm:w-auto flex items-center gap-2">
                <label className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">Fee Type:</label>
                <select
                  value={feeTypeInput}
                  onChange={(e) => {
                    isFeeDirtyRef.current = true;
                    setFeeTypeInput(e.target.value as any);
                  }}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold outline-none ${isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#111A27] border-white/10 text-white'}`}
                >
                  <option value="fixed">Fixed Amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <label className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">Fee Value:</label>
                <input
                  type="number"
                  min={0}
                  max={feeTypeInput === 'percentage' ? 100 : 5000}
                  value={feeValueInput}
                  onFocus={() => {
                    isFeeDirtyRef.current = true;
                  }}
                  onChange={(e) => {
                    isFeeDirtyRef.current = true;
                    setFeeValueInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdminUpdateFee();
                    }
                  }}
                  className={`w-28 px-3 py-2 rounded-xl border text-xs font-mono font-bold outline-none ${isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#111A27] border-white/10 text-white'}`}
                />
                <span className="font-bold text-slate-400">{feeTypeInput === 'percentage' ? '%' : '₹'}</span>
              </div>

              <button
                onClick={handleAdminUpdateFee}
                disabled={isUpdatingFee}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Save size={13} />
                <span>{isUpdatingFee ? 'Saving...' : 'Save Platform Charge'}</span>
              </button>

              {(feeValueInput !== String(platformFeeConfig.feeValue) || feeTypeInput !== platformFeeConfig.feeType) && (
                <button
                  type="button"
                  onClick={() => {
                    isFeeDirtyRef.current = false;
                    setFeeTypeInput(platformFeeConfig.feeType || 'fixed');
                    setFeeValueInput(String(platformFeeConfig.feeValue ?? 200));
                    setFeeFeedback(null);
                  }}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-all cursor-pointer text-center"
                >
                  Reset
                </button>
              )}
            </div>

            {feeFeedback && (
              <p className={`text-xs font-bold ${feeFeedback.startsWith('✓') || feeFeedback.startsWith('✅') ? 'text-emerald-400' : 'text-rose-400'}`}>
                {feeFeedback}
              </p>
            )}
          </div>

          {/* Section 2: Expert Project Review Price Directory */}
          <div className={`rounded-2xl border overflow-hidden shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
            <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <IndianRupee size={16} className="text-amber-400" />
                  Authoritative Expert Project Review Pricing Directory ({expertsList.length})
                </h3>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Single authoritative backend source of truth. Both Expert and Admin price changes automatically synchronize across all portals. Limit: ₹0 to ₹2,000.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b text-[11px] ${isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-white/[0.02] border-white/5 text-slate-400'}`}>
                    <th className="p-3.5 font-bold uppercase tracking-wider">Expert</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider">Field</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-right">Expert Charge</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-right">Platform Charge</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-right text-emerald-400">Client Final Price</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-right">Last Updated</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-right">Set Price (₹0 - ₹2,000)</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {expertsList.map((exp) => {
                    const activePrice = typeof exp.projectRate === 'number' ? exp.projectRate : (exp.rate ? Math.min(2000, exp.rate * 3) : 1000);
                    const inputVal = expertPriceInputs[exp.id] !== undefined ? expertPriceInputs[exp.id] : activePrice;
                    const feedback = priceFeedback[exp.id];

                    const pCharge = platformFeeConfig.feeType === 'fixed'
                      ? (typeof platformFeeConfig.feeValue === 'number' ? platformFeeConfig.feeValue : 200)
                      : Math.round(activePrice * ((Number(platformFeeConfig.feeValue) || 15) / 100));
                    const clientFinalPrice = activePrice + pCharge;
                    const dateDisplay = (exp as any).updatedAt ? new Date((exp as any).updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '30 Sep 2026';

                    return (
                      <tr key={exp.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                              {(exp.name || 'EX').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <strong className="block text-slate-200">{exp.name}</strong>
                              <span className="text-[10px] font-mono text-slate-500">{exp.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-400">{exp.field || 'Consultancy'}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-amber-400 text-sm">
                          ₹{activePrice.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3.5 text-right font-mono text-slate-400">
                          ₹{pCharge.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-emerald-400 text-sm">
                          ₹{clientFinalPrice.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3.5 text-right font-mono text-[11px] text-slate-400">
                          {dateDisplay}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <span className="text-slate-400">₹</span>
                            <input
                              type="number"
                              min={0}
                              max={2000}
                              value={inputVal}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setExpertPriceInputs(prev => ({ ...prev, [exp.id]: val }));
                              }}
                              className={`w-24 px-2.5 py-1 text-xs rounded-lg border font-mono font-bold outline-none ${isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#111A27] border-white/10 text-white'}`}
                            />
                          </div>
                          {feedback && (
                            <span className={`block text-[10px] mt-1 font-bold ${feedback.startsWith('✅') ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {feedback}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleAdminUpdatePrice(exp.id)}
                            disabled={isUpdatingPriceId === exp.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow flex items-center gap-1 ml-auto disabled:opacity-50"
                          >
                            <Save size={12} />
                            <span>{isUpdatingPriceId === exp.id ? 'Saving...' : 'Update Price'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 6: AUDIT TRAIL */}
      {activeSubTab === 'audit' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Immutable system audit log of all Project Review state transitions</span>
            <span className="font-mono">{allAuditEvents.length} events logged</span>
          </div>

          <div className={`rounded-2xl border divide-y divide-white/5 overflow-hidden shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
            {allAuditEvents.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No audit events recorded yet.
              </div>
            ) : (
              allAuditEvents.slice(0, 50).map((act, i) => (
                <div key={i} className="p-3.5 flex items-center justify-between text-xs hover:bg-white/[0.02] transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">{act.reviewId}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/10 uppercase font-mono">
                        {act.eventType}
                      </span>
                    </div>
                    <p className="font-medium">{act.description}</p>
                    <p className="text-[11px] text-slate-400">
                      User: <strong className="text-white">{act.userName || act.userId || 'System'}</strong> ({act.role}) · Participants: {act.clientName} ↔ {act.expertName}
                    </p>
                  </div>
                  <div className="text-right whitespace-nowrap ml-4">
                    <span className="font-mono text-[10px] text-slate-500 block">
                      {new Date(act.timestamp).toLocaleString()}
                    </span>
                    <button
                      onClick={() => onInspectReview(act.reviewId)}
                      className="text-amber-400 hover:underline text-[11px] font-bold mt-1 cursor-pointer"
                    >
                      View Workspace →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
