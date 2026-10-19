import React, { useState } from 'react';
import { RetiredProfessional, AIMatchResult } from '../types';
import { MOCK_PROFESSIONALS } from '../data/mockData';
import { Sparkles, X, CheckCircle2, ArrowRight, Bot, Star, ShieldCheck, Zap } from 'lucide-react';

interface AIMatchmakerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExpertToBook: (expert: RetiredProfessional) => void;
}

export const AIMatchmakerModal: React.FC<AIMatchmakerProps> = ({
  isOpen,
  onClose,
  onSelectExpertToBook,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [matchResults, setMatchResults] = useState<AIMatchResult[] | null>(null);

  if (!isOpen) return null;

  const samplePrompts = [
    'Need a retired CFO to review my startup seed raise financial model and ESOP pool',
    'Looking for an ex-VP HR to draft POSH policies and performance appraisal framework',
    'Need an ex-ISRO scientist or tech architect for deep-tech sensor quality assurance',
    'Seeking a legal veteran to draft founder shareholder agreement (SHA) and IP protection',
    'Need a logistics veteran to audit warehouse supply chain and cut last-mile delivery costs'
  ];

  const handleRunAIMatch = (queryText: string) => {
    const textToMatch = queryText || prompt;
    if (!textToMatch.trim()) return;

    setIsAnalyzing(true);
    setMatchResults(null);
    setStepIndex(1);

    setTimeout(() => {
      setStepIndex(2);
    }, 700);

    setTimeout(() => {
      setStepIndex(3);
    }, 1400);

    setTimeout(() => {
      setIsAnalyzing(false);

      // Intelligent keyword matching logic
      const queryLower = textToMatch.toLowerCase();

      let ranked = MOCK_PROFESSIONALS.map((prof) => {
        let score = 75; // baseline

        // check domain matches
        if (queryLower.includes('finance') || queryLower.includes('cfo') || queryLower.includes('esop') || queryLower.includes('tax') || queryLower.includes('audit')) {
          if (prof.domain === 'Finance & Audit') score += 23;
        }
        if (queryLower.includes('hr') || queryLower.includes('posh') || queryLower.includes('hiring') || queryLower.includes('appraisal') || queryLower.includes('talent')) {
          if (prof.domain === 'HR & Talent') score += 23;
        }
        if (queryLower.includes('tech') || queryLower.includes('isro') || queryLower.includes('cloud') || queryLower.includes('ai') || queryLower.includes('architecture') || queryLower.includes('software')) {
          if (prof.domain === 'Tech & Digital') score += 23;
        }
        if (queryLower.includes('logistics') || queryLower.includes('supply') || queryLower.includes('warehouse') || queryLower.includes('delivery') || queryLower.includes('navy')) {
          if (prof.domain === 'Operations & Logistics') score += 23;
        }
        if (queryLower.includes('legal') || queryLower.includes('court') || queryLower.includes('sha') || queryLower.includes('contract') || queryLower.includes('ip') || queryLower.includes('trademark')) {
          if (prof.domain === 'Legal & Compliance') score += 23;
        }
        if (queryLower.includes('marketing') || queryLower.includes('fmcg') || queryLower.includes('brand') || queryLower.includes('growth')) {
          if (prof.domain === 'Marketing & Growth') score += 23;
        }

        // Skill keyword bonus
        prof.skills.forEach(skill => {
          if (queryLower.includes(skill.toLowerCase())) score += 5;
        });

        // Cap score at 99%
        score = Math.min(99, Math.max(78, score));

        let reason = `Decades of leadership at ${prof.exCompany} in ${prof.domain}. Direct domain alignment with verified credentials.`;
        if (prof.domain === 'Finance & Audit') reason = `Ex-CFO with 34 years guiding corporate valuations, ESOPs, and fundraising preparation.`;
        if (prof.domain === 'HR & Talent') reason = `Ex-HDFC VP HR specializing in POSH compliance, appraisal structuring, and startup team scaling.`;
        if (prof.domain === 'Tech & Digital') reason = `Ex-ISRO / IIT leader offering precision failure-proof architecture review and deep tech advice.`;
        if (prof.domain === 'Legal & Compliance') reason = `Senior Advocate with 27 years in commercial agreements, SHA drafting, and IP protection.`;
        if (prof.domain === 'Operations & Logistics') reason = `Defense Logistics Veteran with proven 20%+ cost reduction frameworks for startups.`;

        return {
          expert: prof,
          matchPercentage: score,
          reason,
          recommendedService: score > 90 ? '1-on-1 Advisory Session (1 Hour)' : 'Project Review Consultation'
        };
      });

      // Sort descending by score
      ranked.sort((a, b) => b.matchPercentage - a.matchPercentage);

      setMatchResults(ranked.slice(0, 3));
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 text-white">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-amber-500/20 via-slate-800 to-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-2xl shadow-md">
              <Sparkles className="w-6 h-6 fill-slate-950" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                SilverMatch AI Assistant
                <span className="text-xs bg-amber-500/20 text-amber-300 font-semibold px-2 py-0.5 rounded-full border border-amber-500/30">
                  PDF Specification Model
                </span>
              </h2>
              <p className="text-xs text-slate-400">Describe your project needs for instant AI matching with verified retired professionals.</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          
          {/* Prompt Input Box */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">
              What assistance do you need today?
            </label>
            <div className="relative">
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. I need an experienced HR leader to help design POSH policies and set up an appraisal system for my 25-member remote startup team..."
                className="w-full p-4 bg-slate-950 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm leading-relaxed"
              />
            </div>
          </div>

          {/* Quick Prompts Suggestions */}
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Try an Example Prompt:
            </span>
            <div className="flex flex-wrap gap-2">
              {samplePrompts.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPrompt(sample);
                    handleRunAIMatch(sample);
                  }}
                  className="text-xs bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700 hover:border-amber-500/50 px-3 py-1.5 rounded-xl transition-all text-left"
                >
                  ✨ "{sample.substring(0, 50)}..."
                </button>
              ))}
            </div>
          </div>

          {/* Action Button */}
          {!isAnalyzing && (
            <button
              onClick={() => handleRunAIMatch(prompt)}
              disabled={!prompt.trim()}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-500 text-slate-950 py-3.5 px-6 rounded-2xl font-bold text-base shadow-xl shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01]"
            >
              <Zap className="w-5 h-5 fill-slate-950" />
              <span>Find Best AI Matches Now</span>
            </button>
          )}

          {/* Analyzing Progress State */}
          {isAnalyzing && (
            <div className="py-8 bg-slate-950/60 rounded-2xl border border-slate-800 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-base font-bold text-amber-400 animate-pulse">
                  {stepIndex === 1 && "Analyzing project requirements..."}
                  {stepIndex === 2 && "Searching 120M+ retired expert profile records..."}
                  {stepIndex === 3 && "Evaluating verified experience & matching score..."}
                </p>
                <p className="text-xs text-slate-400">SilverMatch AI algorithm applying domain verification filters...</p>
              </div>
            </div>
          )}

          {/* Match Results Display */}
          {matchResults && !isAnalyzing && (
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Bot className="w-5 h-5 text-amber-400" />
                  Top Recommended Senior Experts ({matchResults.length})
                </h3>
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> AI Match Complete
                </span>
              </div>

              <div className="space-y-3">
                {matchResults.map(({ expert, matchPercentage, reason, recommendedService }) => (
                  <div
                    key={expert.id}
                    className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 hover:border-amber-500/60 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={expert.avatarUrl}
                        alt={expert.name}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-500/40"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-base">{expert.name}</h4>
                          {expert.isVerified && (
                            <span title="Verified Background"><ShieldCheck className="w-4 h-4 text-emerald-400" /></span>
                          )}
                          <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                            {matchPercentage}% Match
                          </span>
                        </div>
                        <p className="text-xs text-amber-400 font-medium">{expert.title} • {expert.yearsOfExperience} Yrs Exp</p>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{reason}</p>
                      </div>
                    </div>

                    <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      <div className="text-left sm:text-right">
                        <span className="text-sm font-extrabold text-amber-400">₹{expert.hourlyRate}/hr</span>
                        <span className="text-[10px] text-slate-400 block">Affordable Senior Rate</span>
                      </div>
                      <button
                        onClick={() => {
                          onClose();
                          onSelectExpertToBook(expert);
                        }}
                        className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-colors whitespace-nowrap"
                      >
                        <span>Book Session</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
