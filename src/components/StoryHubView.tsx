import React, { useState } from 'react';
import { MOCK_REHIRED_STORIES } from '../data/mockData';
import { RehiredStory } from '../types';
import { Award, Volume2, Quote, MapPin, Heart, Sparkles, ArrowRight, X } from 'lucide-react';

export const StoryHubView: React.FC = () => {
  const [activeStory, setActiveStory] = useState<RehiredStory | null>(null);

  const playQuoteAudio = (text: string) => {
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance(text);
      msg.rate = 0.95;
      window.speechSynthesis.speak(msg);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white space-y-10">
      
      {/* Title Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="bg-amber-500/10 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30 uppercase tracking-wider">
          PDF Marketing Strategy • Section 5
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
          "Retired but Rehired" Stories
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Emotional, inspiring real-life journeys of India's veteran minds finding fresh purpose and creating massive impact for modern businesses.
        </p>
      </div>

      {/* Stories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {MOCK_REHIRED_STORIES.map((story) => (
          <div
            key={story.id}
            className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden flex flex-col justify-between hover:border-amber-500/50 transition-all shadow-xl group"
          >
            <div>
              <div className="relative h-56 overflow-hidden">
                <img
                  src={story.imageUrl}
                  alt={story.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-800">
                  {story.domain}
                </div>
                <div className="absolute bottom-3 left-3 right-3 text-xs bg-slate-950/90 backdrop-blur-md text-white p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="font-bold">{story.name}, {story.age}</span>
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> {story.location}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-3">
                <div className="text-xs space-y-1">
                  <span className="text-slate-400 block">Former: <strong className="text-white">{story.formerRole}</strong></span>
                  <span className="text-amber-400 font-bold block">Now: {story.newRole}</span>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs italic text-slate-300 space-y-2">
                  <p>"{story.quote}"</p>
                  <button
                    onClick={() => playQuoteAudio(story.quote)}
                    className="flex items-center gap-1 text-[11px] text-amber-400 font-bold hover:underline"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Listen to Audio Story Quote
                  </button>
                </div>

                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-xs text-emerald-300 font-medium">
                  <strong>Impact Delivered:</strong> {story.companyImpact}
                </div>
              </div>
            </div>

            <div className="p-6 pt-0">
              <button
                onClick={() => setActiveStory(story)}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-2xl text-xs font-bold border border-slate-700 transition-colors"
              >
                <span>Read Full Inspiring Journey</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        ))}
      </div>

      {/* Story Reader Modal */}
      {activeStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 text-white shadow-2xl">
            <button
              onClick={() => setActiveStory(null)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <img
                src={activeStory.imageUrl}
                alt={activeStory.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-500/40"
              />
              <div>
                <h3 className="text-xl font-bold text-white">{activeStory.name}, {activeStory.age}</h3>
                <p className="text-xs text-amber-400 font-medium">{activeStory.newRole}</p>
                <p className="text-xs text-slate-400">{activeStory.formerRole}</p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-sm italic text-amber-300 leading-relaxed">
              "{activeStory.quote}"
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">The Journey & Impact</h4>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
                {activeStory.fullStory}
              </p>
            </div>

            <button
              onClick={() => setActiveStory(null)}
              className="w-full py-3 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
            >
              Close Story
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
