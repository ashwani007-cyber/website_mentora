import React from 'react';
import type { RetiredProfessional } from '../types';
import { ShieldCheck, Star, MapPin, ArrowRight, Sparkles } from 'lucide-react';

interface ExpertCardProps {
  expert: RetiredProfessional;
  onViewDetails: (expert: RetiredProfessional) => void;
  onBook: (expert: RetiredProfessional) => void;
}

export const ExpertCard: React.FC<ExpertCardProps> = ({
  expert,
  onViewDetails,
  onBook,
}) => {
  return (
    <div className={`relative bg-slate-900/90 rounded-3xl border ${
      expert.isSponsored ? 'border-amber-500/60 shadow-2xl shadow-amber-500/10' : 'border-white/10 hover:border-amber-500/40'
    } p-6 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-2xl group backdrop-blur-xl`}>
      
      {/* Sponsored Badge */}
      {expert.isSponsored && (
        <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-[10px] font-black px-3.5 py-1 rounded-full shadow-lg flex items-center gap-1 border border-amber-300 uppercase tracking-wider">
          <Sparkles className="w-3 h-3 fill-slate-950" /> Sponsored Expert
        </div>
      )}

      <div>
        {/* Header Avatar & Info */}
        <div className="flex items-start gap-4 mb-4">
          <div className="relative">
            <img
              src={expert.avatarUrl}
              alt={expert.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-amber-400/40 shadow-xl group-hover:scale-105 transition-transform duration-300"
            />
            {expert.isVerified && (
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-slate-950 p-1 rounded-full border-2 border-slate-950 shadow-md" title="Background & Credentials Verified">
                <ShieldCheck className="w-4 h-4 text-slate-950 fill-emerald-500" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                {expert.name}
              </h3>
            </div>
            <p className="text-xs text-amber-400 font-semibold mt-0.5 truncate">{expert.title}</p>
            
            <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
              <span className="bg-slate-950 text-slate-300 px-2.5 py-0.5 rounded-lg border border-white/10 font-bold truncate">
                {expert.exCompany}
              </span>
              <span className="flex items-center gap-1 text-slate-400 shrink-0">
                <MapPin className="w-3 h-3 text-slate-500" /> {expert.location.split(',')[0]}
              </span>
            </div>
          </div>
        </div>

        {/* Rating & Stats Meter */}
        <div className="flex items-center justify-between py-2.5 px-3.5 bg-slate-950/80 rounded-2xl border border-white/5 mb-4 text-xs">
          <div className="flex items-center gap-1.5 text-amber-400 font-extrabold">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>{expert.rating}</span>
            <span className="text-slate-500 font-normal">({expert.reviewCount} reviews)</span>
          </div>
          <div className="text-slate-300 font-medium text-right">
            <strong className="text-white font-black">{expert.yearsOfExperience}+ Yrs</strong> Experience
          </div>
        </div>

        {/* Quote Snippet */}
        <p className="text-xs text-slate-300 line-clamp-2 italic mb-4 leading-relaxed bg-slate-950/40 p-3 rounded-2xl border border-white/5">
          "{expert.featuredQuote}"
        </p>

        {/* Skills & Badges */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {expert.badges.map((badge, idx) => (
            <span
              key={idx}
              className="text-[10px] font-bold bg-slate-950 text-slate-300 border border-white/10 px-2.5 py-1 rounded-lg"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* Pricing & Footer Actions */}
      <div className="pt-4 border-t border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Affordable Advisory</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-amber-400">₹{expert.hourlyRate}</span>
              <span className="text-xs text-slate-400 font-bold">/ hr</span>
            </div>
          </div>
          {typeof expert.projectRate === 'number' && (
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Project Pack</span>
              <span className="text-sm font-bold text-slate-200">₹{expert.projectRate}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onViewDetails(expert)}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-white/10 transition-colors text-center"
          >
            View Profile
          </button>
          <button
            onClick={() => onBook(expert)}
            className="w-full flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg transition-all transform hover:scale-[1.02]"
          >
            <span>Book Session</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
};
