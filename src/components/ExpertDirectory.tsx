import React, { useState } from 'react';
import type { RetiredProfessional, DomainCategory } from '../types';
import { MOCK_PROFESSIONALS } from '../data/mockData';
import { ExpertCard } from './ExpertCard';
import { Sparkles, ShieldCheck, RefreshCw, Award } from 'lucide-react';

interface DirectoryProps {
  selectedDomain: DomainCategory;
  setSelectedDomain: (domain: DomainCategory) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onViewDetails: (expert: RetiredProfessional) => void;
  onBook: (expert: RetiredProfessional) => void;
}

export const ExpertDirectory: React.FC<DirectoryProps> = ({
  selectedDomain,
  setSelectedDomain,
  searchQuery,
  setSearchQuery,
  onViewDetails,
  onBook,
}) => {
  const [maxRate, setMaxRate] = useState<number>(1000);
  const [minExp, setMinExp] = useState<number>(20);

  // Filter logic
  const filteredPros = MOCK_PROFESSIONALS.filter((prof) => {
    if (selectedDomain !== 'All' && prof.domain !== selectedDomain) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = prof.name.toLowerCase().includes(q);
      const titleMatch = prof.title.toLowerCase().includes(q);
      const companyMatch = prof.exCompany.toLowerCase().includes(q);
      const skillMatch = prof.skills.some((s) => s.toLowerCase().includes(q));
      if (!nameMatch && !titleMatch && !companyMatch && !skillMatch) return false;
    }

    if (prof.hourlyRate > maxRate) return false;
    if (prof.yearsOfExperience < minExp) return false;

    return true;
  });

  const sponsoredPros = MOCK_PROFESSIONALS.filter((p) => p.isSponsored);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white">
      
      {/* Title & Filter Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
              Verified Retired Talent Directory
            </span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            Connect With India's Leading Retired Minds
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
            Browse verified ex-CFOs, HR VPs, Scientists, Advocates & Industry Veterans.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/90 p-2.5 rounded-2xl border border-white/10 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 rounded-xl border border-white/5">
            <span className="text-slate-400 font-medium">Max Rate:</span>
            <select
              value={maxRate}
              onChange={(e) => setMaxRate(Number(e.target.value))}
              className="bg-transparent text-amber-400 font-black focus:outline-none cursor-pointer"
            >
              <option value={1000} className="bg-slate-900 text-white">All Rates (&lt; ₹1000)</option>
              <option value={800} className="bg-slate-900 text-white">&lt; ₹800 / hr</option>
              <option value={650} className="bg-slate-900 text-white">&lt; ₹650 / hr</option>
              <option value={500} className="bg-slate-900 text-white">&lt; ₹500 / hr</option>
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 rounded-xl border border-white/5">
            <span className="text-slate-400 font-medium">Min Experience:</span>
            <select
              value={minExp}
              onChange={(e) => setMinExp(Number(e.target.value))}
              className="bg-transparent text-amber-400 font-black focus:outline-none cursor-pointer"
            >
              <option value={20} className="bg-slate-900 text-white">20+ Years</option>
              <option value={28} className="bg-slate-900 text-white">28+ Years</option>
              <option value={32} className="bg-slate-900 text-white">32+ Years</option>
            </select>
          </div>

          <button
            onClick={() => {
              setMaxRate(1000);
              setMinExp(20);
              setSelectedDomain('All');
              setSearchQuery('');
            }}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white px-3 py-1.5 rounded-xl hover:bg-slate-800 transition-colors font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Featured Sponsored Section */}
      {selectedDomain === 'All' && !searchQuery && (
        <div className="mb-12 bg-gradient-to-r from-amber-500/10 via-slate-900/90 to-emerald-500/10 p-6 sm:p-8 rounded-3xl border border-amber-500/30 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xl shadow">
              <Sparkles className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <h3 className="text-xl font-black text-amber-300">Featured Sponsored Experts</h3>
              <p className="text-xs text-slate-400">PDF Spec #4.5 • Premium Visibility Tier</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sponsoredPros.slice(0, 3).map((prof) => (
              <ExpertCard
                key={prof.id}
                expert={prof}
                onViewDetails={onViewDetails}
                onBook={onBook}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Grid */}
      {filteredPros.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPros.map((expert) => (
            <ExpertCard
              key={expert.id}
              expert={expert}
              onViewDetails={onViewDetails}
              onBook={onBook}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-white/10 p-8 space-y-4">
          <Award className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-xl font-bold text-white">No Matching Retired Experts Found</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Try adjusting your search query, rate filter, or launch SilverMatch AI for custom pairing.
          </p>
          <button
            onClick={() => {
              setMaxRate(1000);
              setMinExp(20);
              setSelectedDomain('All');
              setSearchQuery('');
            }}
            className="inline-flex items-center gap-2 bg-amber-500 text-slate-950 px-6 py-3 rounded-2xl font-bold text-sm shadow-lg"
          >
            Clear All Filters
          </button>
        </div>
      )}

    </div>
  );
};
