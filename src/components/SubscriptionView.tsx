import React, { useState } from 'react';
import { MOCK_SUBSCRIPTION_TIERS } from '../data/mockData';
import { TrendingUp, CheckCircle2, Building2, Sparkles, Award, ShieldCheck, ArrowRight, Layers, DollarSign } from 'lucide-react';

export const SubscriptionView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pro' | 'client'>('pro');
  const [showCorporateModal, setShowCorporateModal] = useState(false);
  const [corpName, setCorpName] = useState('');
  const [corpEmail, setCorpEmail] = useState('');

  const tiers = MOCK_SUBSCRIPTION_TIERS.filter((t) =>
    activeTab === 'pro' ? t.userType === 'professional' : t.userType === 'client'
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white space-y-12">
      
      {/* Title Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="bg-amber-500/10 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30 uppercase tracking-wider">
          PDF Spec Section 4 Revenue Streams
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
          Monetization & Subscription Tiers
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Mentora powers a sustainable social business model through subscriptions, commission splits, corporate partnerships, and sponsored expert listings.
        </p>
      </div>

      {/* 5 Revenue Streams Summary Bar (PDF Section 4) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
        <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-xs text-amber-400 font-bold block">1. Commission</span>
          <p className="text-sm font-extrabold text-white">10–15% Per Booking</p>
        </div>
        <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-xs text-amber-400 font-bold block">2. Subscriptions</span>
          <p className="text-sm font-extrabold text-white">₹499 & ₹999 / mo</p>
        </div>
        <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-xs text-amber-400 font-bold block">3. Corporate</span>
          <p className="text-sm font-extrabold text-white">B2B Retainers</p>
        </div>
        <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-xs text-amber-400 font-bold block">4. Training Upsell</span>
          <p className="text-sm font-extrabold text-white">Remote Skills</p>
        </div>
        <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1 col-span-2 md:col-span-1">
          <span className="text-xs text-amber-400 font-bold block">5. Sponsored</span>
          <p className="text-sm font-extrabold text-white">Homepage Ads</p>
        </div>
      </div>

      {/* User Type Toggle */}
      <div className="flex justify-center">
        <div className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 inline-flex gap-2 text-sm font-bold">
          <button
            onClick={() => setActiveTab('pro')}
            className={`px-6 py-2.5 rounded-xl transition-all ${
              activeTab === 'pro' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            For Retired Professionals (₹499/mo)
          </button>
          <button
            onClick={() => setActiveTab('client')}
            className={`px-6 py-2.5 rounded-xl transition-all ${
              activeTab === 'client' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            For Clients & Startups (₹999/mo)
          </button>
        </div>
      </div>

      {/* Subscription Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={`relative bg-slate-900 rounded-3xl p-8 border ${
              tier.isPopular ? 'border-amber-500 shadow-2xl shadow-amber-500/10' : 'border-slate-800'
            } flex flex-col justify-between space-y-6`}
          >
            {tier.isPopular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-xs font-black px-4 py-1 rounded-full shadow-lg border border-amber-300">
                ⭐ MOST POPULAR SPEC PLAN
              </div>
            )}

            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {tier.userType === 'professional' ? 'Higher visibility & premium advisory features' : 'Unlimited matching & zero booking fees'}
                  </p>
                </div>
              </div>

              <div className="flex items-baseline gap-1 my-6">
                <span className="text-4xl sm:text-5xl font-black text-amber-400">
                  {tier.priceMonthly === 0 ? 'Free' : `₹${tier.priceMonthly}`}
                </span>
                {tier.priceMonthly > 0 && <span className="text-sm text-slate-400 font-bold">/ month</span>}
              </div>

              <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                {tier.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => alert(`Subscribed to ${tier.name}! (Simulated)`)}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all ${
                tier.isPopular
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 shadow-xl'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {tier.priceMonthly === 0 ? 'Current Free Plan' : `Upgrade to ${tier.name}`}
            </button>

          </div>
        ))}
      </div>

      {/* Corporate Partnerships Banner (PDF Section 4 #3) */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <h3 className="text-xl font-extrabold text-white">Corporate Partnerships & Short-Term Consultancies</h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Collaborate with Mentora to deploy retired domain experts for short-term corporate projects, independent audit committees, and executive mentorship programs.
          </p>
        </div>

        <button
          onClick={() => setShowCorporateModal(true)}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-3.5 rounded-2xl font-bold text-sm whitespace-nowrap shadow-xl flex items-center gap-2"
        >
          <span>Partner with Us</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Corporate Modal */}
      {showCorporateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              Corporate Partnership Request
            </h3>
            <p className="text-xs text-slate-400">Deploy verified ex-CXOs and domain experts for your enterprise.</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert(`Thank you ${corpName}! Our Corporate Partnership desk will contact ${corpEmail} within 24 hours.`);
                setShowCorporateModal(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={corpName}
                  onChange={(e) => setCorpName(e.target.value)}
                  placeholder="e.g. Tata Consultancy / Startup India"
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Corporate Email</label>
                <input
                  type="email"
                  required
                  value={corpEmail}
                  onChange={(e) => setCorpEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs"
              >
                Submit Enterprise Request
              </button>
            </form>

            <button
              onClick={() => setShowCorporateModal(false)}
              className="w-full py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
