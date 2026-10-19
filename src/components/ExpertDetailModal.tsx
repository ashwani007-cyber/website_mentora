import React, { useState } from 'react';
import type { RetiredProfessional } from '../types';
import { 
  X, 
  ShieldCheck, 
  Star, 
  MapPin, 
  Video, 
  Building2, 
  Briefcase, 
  ArrowRight
} from 'lucide-react';

interface DetailModalProps {
  expert: RetiredProfessional | null;
  onClose: () => void;
  onBook: (expert: RetiredProfessional) => void;
}

export const ExpertDetailModal: React.FC<DetailModalProps> = ({
  expert,
  onClose,
  onBook,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'career' | 'reviews'>('overview');
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  if (!expert) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-8 text-white">
        
        {/* Banner */}
        <div className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 p-6 sm:p-8 border-b border-white/10">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative">
              <img
                src={expert.avatarUrl}
                alt={expert.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-4 border-amber-500/40 shadow-2xl"
              />
              {expert.isVerified && (
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-slate-950 p-1.5 rounded-full border-2 border-slate-900 shadow-md">
                  <ShieldCheck className="w-5 h-5 fill-slate-950 text-emerald-500" />
                </div>
              )}
            </div>

            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-black text-white">{expert.name}</h2>
                <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
                  {expert.domain}
                </span>
              </div>
              <p className="text-sm font-semibold text-amber-400">{expert.title}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1 font-bold text-white bg-slate-950 px-3 py-1 rounded-xl border border-white/10">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" /> {expert.exCompany}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {expert.location}
                </span>
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Background History Verified
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-slate-950 px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-4 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'overview' ? 'border-amber-500 text-amber-400 font-extrabold' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Overview & Video Intro
          </button>
          <button
            onClick={() => setActiveTab('career')}
            className={`px-5 py-4 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'career' ? 'border-amber-500 text-amber-400 font-extrabold' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Career Timeline ({expert.yearsOfExperience} Yrs)
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-5 py-4 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'reviews' ? 'border-amber-500 text-amber-400 font-extrabold' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Reviews ({expert.reviewCount})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              <div className="space-y-2">
                <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">Professional Biography</h3>
                <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/80 p-4 rounded-2xl border border-white/5 font-medium">
                  {expert.bio}
                </p>
              </div>

              {/* Video Player */}
              <div className="bg-slate-950 rounded-2xl p-5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Video className="w-4 h-4" /> 60-Second Video Introduction
                  </span>
                  <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded font-bold border border-emerald-500/30">
                    Verified Authentic
                  </span>
                </div>

                {!isPlayingVideo ? (
                  <div
                    onClick={() => setIsPlayingVideo(true)}
                    className="relative h-48 sm:h-56 bg-slate-900 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center cursor-pointer group"
                  >
                    <img
                      src={expert.avatarUrl}
                      alt={expert.name}
                      className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="relative z-10 w-16 h-16 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform">
                      <Video className="w-8 h-8 fill-slate-950" />
                    </div>
                    <span className="absolute bottom-3 left-4 text-xs font-bold text-white bg-slate-950/90 px-3 py-1 rounded-xl border border-white/10">
                      Watch {expert.name}'s Advisory Message
                    </span>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-900 rounded-xl border border-amber-500/50 text-center space-y-3">
                    <Video className="w-10 h-10 text-amber-400 mx-auto animate-bounce" />
                    <p className="text-sm font-bold text-white">Playing Video Preview...</p>
                    <p className="text-xs text-slate-300 italic max-w-md mx-auto">
                      "Namaste! I am {expert.name}. After {expert.yearsOfExperience} years at {expert.exCompany}, I am excited to help your startup achieve sustainable growth."
                    </p>
                    <button
                      onClick={() => setIsPlayingVideo(false)}
                      className="text-xs text-amber-400 underline font-bold"
                    >
                      Close Preview
                    </button>
                  </div>
                )}
              </div>

              {/* Skills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expertise & Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {expert.skills.map((skill, idx) => (
                      <span key={idx} className="bg-slate-950 text-amber-300 text-xs font-bold px-3 py-1 rounded-xl border border-white/10">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Languages Spoken</h4>
                  <div className="flex flex-wrap gap-2">
                    {expert.languages.map((lang, idx) => (
                      <span key={idx} className="bg-slate-950 text-slate-300 text-xs font-bold px-3 py-1 rounded-xl border border-white/10">
                        🗣️ {lang}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'career' && (
            <div className="space-y-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-amber-400" />
                30+ Years Corporate Leadership Timeline
              </h3>

              <div className="space-y-4 relative border-l-2 border-slate-800 pl-6 ml-2">
                <div className="relative">
                  <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-amber-500 border-4 border-slate-900" />
                  <span className="text-xs text-amber-400 font-bold">2023 - Present</span>
                  <h4 className="font-bold text-white text-base">Senior Advisor on Mentora</h4>
                  <p className="text-xs text-slate-300 mt-1">Completed {expert.totalSessionsCompleted}+ advisory sessions for Indian SMEs, seed startups, and educational institutions.</p>
                </div>

                <div className="relative pt-4">
                  <span className="absolute -left-[31px] top-5 w-4 h-4 rounded-full bg-slate-600 border-4 border-slate-900" />
                  <span className="text-xs text-slate-400 font-bold">2008 - 2023</span>
                  <h4 className="font-bold text-white text-base">{expert.exRole} @ {expert.exCompany}</h4>
                  <p className="text-xs text-slate-300 mt-1">Led national teams, oversaw multi-crore operational budgets, risk mitigation, and executive strategy.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3">
                  <Star className="w-8 h-8 fill-amber-400 text-amber-400" />
                  <div>
                    <p className="text-xl font-black text-white">{expert.rating} out of 5.0</p>
                    <p className="text-xs text-slate-400 font-medium">Based on {expert.reviewCount} verified client feedback reviews</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-slate-950/60 rounded-2xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400">Founder, FinTech Seed Startup</span>
                    <span className="text-slate-500">2 weeks ago</span>
                  </div>
                  <div className="flex items-center text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    "{expert.name}'s advice on our cap table saved us from making a major dilution mistake. Decades of wisdom condensed into a 1-hour session!"
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 bg-slate-950 border-t border-white/10">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Affordable Rate</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-amber-400">₹{expert.hourlyRate}</span>
              <span className="text-xs text-slate-400 font-bold">/ hour</span>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onBook(expert);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 text-slate-950 px-6 py-3.5 rounded-2xl font-black text-base shadow-xl transition-all transform hover:scale-[1.02]"
          >
            <span>Book Advisory Session</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );
};
