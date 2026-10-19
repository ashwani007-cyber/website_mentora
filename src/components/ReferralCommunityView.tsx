import React, { useState } from 'react';
import { Users, Share2, Copy, Check, ShieldCheck, Heart, Award, Building } from 'lucide-react';

export const ReferralCommunityView: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const refLink = 'https://mentora.com/ref/SENIOR-SENIORS-2026';

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const communityPartners = [
    { name: 'All-India Senior Citizens Confederation', type: 'Senior Welfare Org', count: '14,000 Members' },
    { name: 'RWAs & Gated Community Associations', type: 'Local Neighborhood Hubs', count: '350 RWAs' },
    { name: 'IIT & IIM Alumni Veteran Network', type: 'Academic Alumni', count: '8,500 Alum' },
    { name: 'Indian Armed Forces Veterans Forum', type: 'Defense Veterans', count: '6,200 Officers' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white space-y-12">
      
      {/* Title */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="bg-amber-500/10 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30 uppercase tracking-wider">
          PDF Spec Section 5 Marketing & Referral Strategy
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
          Community Partnerships & Referrals
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Building ground-level trust through Senior Citizen Clubs, Resident Welfare Associations (RWAs), and peer referral rewards.
        </p>
      </div>

      {/* Referral Link Engine Box */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 p-8 rounded-3xl border border-amber-500/40 shadow-2xl max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Your Personal Senior Referral Link</h3>
            <p className="text-xs text-slate-400">Earn ₹500 wallet credit for every retired professional or client you introduce to Mentora.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
          <input
            type="text"
            readOnly
            value={refLink}
            className="w-full bg-transparent text-amber-300 font-mono text-xs sm:text-sm px-3 focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap shadow transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy Link
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center text-xs border-t border-slate-800/80 pt-4">
          <div>
            <span className="text-amber-400 font-bold text-lg block">12</span>
            <span className="text-slate-400">Total Referrals</span>
          </div>
          <div>
            <span className="text-emerald-400 font-bold text-lg block">₹6,000</span>
            <span className="text-slate-400">Bonus Earned</span>
          </div>
          <div>
            <span className="text-amber-400 font-bold text-lg block">8 Verified</span>
            <span className="text-slate-400">Active Senior Pros</span>
          </div>
        </div>
      </div>

      {/* Community Partner Hubs */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-white text-center flex items-center justify-center gap-2">
          <Building className="w-5 h-5 text-amber-400" />
          Partnered Senior Citizen Clubs & RWAs
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {communityPartners.map((partner, idx) => (
            <div key={idx} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-3">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
              <h4 className="font-bold text-white text-sm">{partner.name}</h4>
              <p className="text-xs text-amber-400 font-semibold">{partner.type}</p>
              <span className="inline-block text-[11px] bg-slate-950 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
                {partner.count}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
