import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldCheck, Search, ArrowRight, Star, TrendingUp, CheckCircle2 } from 'lucide-react';
import { DomainCategory } from '../types';
import { expertiseService } from '../services/expertiseService';

interface HeroProps {
  selectedDomain: DomainCategory;
  setSelectedDomain: (domain: DomainCategory) => void;
  openAIMatchmaker: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const Hero: React.FC<HeroProps> = ({
  selectedDomain,
  setSelectedDomain,
  openAIMatchmaker,
  searchQuery,
  setSearchQuery,
}) => {
  const [expertiseFields, setExpertiseFields] = useState<string[]>(() => expertiseService.getAll());

  useEffect(() => {
    return expertiseService.subscribe(setExpertiseFields);
  }, []);

  const categories: { name: DomainCategory; count: string }[] = [
    { name: 'All', count: '100+' },
    ...expertiseFields.map((f) => ({
      name: f,
      count: 'Active'
    }))
  ];

  return (
    <section className="relative overflow-hidden bg-slate-950 text-white pt-12 pb-16 px-4 sm:px-6 lg:px-8 border-b border-white/10">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-r from-amber-500/15 via-amber-600/10 to-emerald-500/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <span className="inline-flex items-center gap-1.5 bg-slate-900/90 border border-amber-500/30 text-amber-300 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg shadow-amber-500/5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            The Silver Workforce Model
          </span>
          <span className="inline-flex items-center gap-1.5 bg-slate-900/90 border border-emerald-500/30 text-emerald-300 px-3.5 py-1 rounded-full text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            100% Background Verified Retired Experts
          </span>
        </div>

        {/* Main Title & Tagline */}
        <div className="text-center max-w-4xl mx-auto mb-10 space-y-4">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
            Unlocking India’s <span className="gradient-text-gold">120 Million</span> Retired Professionals
          </h1>
          <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            <strong className="text-amber-300 font-bold">“LinkedIn meets UrbanClap”</strong> — Connecting experienced ex-CFOs, HR VPs, Scientists & Legal Veterans with startups and businesses at affordable advisory rates.
          </p>
        </div>

        {/* Search & AI Bar */}
        <div className="max-w-3xl mx-auto bg-slate-900/80 p-3 sm:p-4 rounded-3xl border border-white/15 shadow-2xl backdrop-blur-xl mb-10">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by skill (e.g. ESOP, POSH, Cloud Architecture, FMCG)..."
                className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium transition-all"
              />
            </div>

            <button
              onClick={openAIMatchmaker}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 px-6 py-3.5 rounded-2xl font-black text-sm whitespace-nowrap shadow-xl shadow-amber-500/20 transition-all transform hover:scale-[1.02]"
            >
              <Sparkles className="w-4 h-4 fill-slate-950" />
              <span>AI Matchmaker</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 pt-2 no-scrollbar justify-start sm:justify-center">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedDomain(cat.name)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 border ${
                selectedDomain === cat.name
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 font-extrabold scale-105'
                  : 'bg-slate-900/70 text-slate-300 border-white/10 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {cat.name}
              <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full ${
                selectedDomain === cat.name ? 'bg-slate-950 text-amber-300 font-black' : 'bg-slate-950 text-slate-400'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto mt-10 pt-8 border-t border-white/10 text-center">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md">
            <p className="text-2xl sm:text-3xl font-black gradient-text-gold">120M+</p>
            <p className="text-xs text-slate-400 mt-1 font-semibold">Retired Professionals Pool</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md">
            <p className="text-2xl sm:text-3xl font-black text-amber-400">₹499 / hr</p>
            <p className="text-xs text-slate-400 mt-1 font-semibold">Affordable Starting Rate</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md">
            <p className="text-2xl sm:text-3xl font-black text-emerald-400">10-15%</p>
            <p className="text-xs text-slate-400 mt-1 font-semibold">Platform Commission Split</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md">
            <p className="text-2xl sm:text-3xl font-black text-amber-400">4.94 ★</p>
            <p className="text-xs text-slate-400 mt-1 font-semibold">Verified Rating Index</p>
          </div>
        </div>

      </div>
    </section>
  );
};
