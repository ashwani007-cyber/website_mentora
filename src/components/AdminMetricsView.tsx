import React from 'react';
import { TrendingUp, Users, DollarSign, Award, ShieldCheck, PieChart, Activity } from 'lucide-react';

export const AdminMetricsView: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white space-y-10">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30 uppercase tracking-wider mb-2 inline-block">
            Platform Admin Metrics • PDF Business Model Overview
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Mentora Platform Executive Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time tracking of GMV, commission payouts, subscriber monetization, and verification throughput.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-2 rounded-2xl text-xs font-bold">
          <Activity className="w-4 h-4 animate-pulse" />
          <span>System Healthy • Live Production</span>
        </div>
      </div>

      {/* Admin KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Gross Merchandise Value (GMV)</span>
          <p className="text-3xl font-black text-amber-400">₹1,85,400</p>
          <span className="text-[11px] text-emerald-400 font-semibold">+24% growth this month</span>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Commission Earned (12.5% avg)</span>
          <p className="text-3xl font-black text-emerald-400">₹23,175</p>
          <span className="text-[11px] text-slate-400">PDF Spec Section 4 Revenue Stream #1</span>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Verified Senior Professionals</span>
          <p className="text-3xl font-black text-white">142 Pros</p>
          <span className="text-[11px] text-amber-300 font-semibold">98% Verification Pass Rate</span>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Active Client Startups</span>
          <p className="text-3xl font-black text-white">310 Clients</p>
          <span className="text-[11px] text-slate-400">4.94★ Satisfaction Index</span>
        </div>

      </div>

      {/* Revenue Stream Breakdown Matrix */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <PieChart className="w-5 h-5 text-amber-400" />
            Revenue Streams Breakdown Matrix (per PDF Spec)
          </h3>
          <span className="text-xs text-amber-400 font-mono font-bold">Total ARR: ₹34.8 Lakhs</span>
        </div>

        <div className="space-y-4 text-xs">
          
          <div>
            <div className="flex justify-between font-bold text-slate-300 mb-1">
              <span>1. Booking Commissions (10-15%)</span>
              <span className="text-amber-400">45% of total revenue (₹15.6L)</span>
            </div>
            <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full w-[45%]" />
            </div>
          </div>

          <div>
            <div className="flex justify-between font-bold text-slate-300 mb-1">
              <span>2. Subscriptions (₹499 Pro / ₹999 Client)</span>
              <span className="text-amber-400">30% of total revenue (₹10.4L)</span>
            </div>
            <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-[30%]" />
            </div>
          </div>

          <div>
            <div className="flex justify-between font-bold text-slate-300 mb-1">
              <span>3. Corporate Partnerships & Consultancies</span>
              <span className="text-amber-400">15% of total revenue (₹5.2L)</span>
            </div>
            <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden">
              <div className="bg-sky-500 h-full w-[15%]" />
            </div>
          </div>

          <div>
            <div className="flex justify-between font-bold text-slate-300 mb-1">
              <span>4. Training Upsell & Sponsored Listings</span>
              <span className="text-amber-400">10% of total revenue (₹3.6L)</span>
            </div>
            <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden">
              <div className="bg-purple-500 h-full w-[10%]" />
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
