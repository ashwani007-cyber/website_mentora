import React from 'react';
import { Type, Eye, Volume2, ShieldCheck, Sparkles } from 'lucide-react';

interface AccessibilityProps {
  fontSize: 'standard' | 'large' | 'xlarge';
  setFontSize: (size: 'standard' | 'large' | 'xlarge') => void;
  isHighContrast: boolean;
  setIsHighContrast: (val: boolean) => void;
}

export const AccessibilityToolbar: React.FC<AccessibilityProps> = ({
  fontSize,
  setFontSize,
  isHighContrast,
  setIsHighContrast,
}) => {
  const handleVoiceAssist = () => {
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance("Welcome to Mentora Executive Advisory Platform. Connecting retired CXOs, Board Members, and Industry Veterans with high-growth organizations.");
      msg.rate = 0.95;
      window.speechSynthesis.speak(msg);
    } else {
      alert("Text-to-speech narration is not supported in your browser.");
    }
  };

  return (
    <div className="bg-slate-950 text-slate-300 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 border-b border-white/10 backdrop-blur-md">
      <div className="flex items-center gap-2 font-semibold">
        <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-blue-500/20">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Executive Accessibility Suite
        </span>
        <span className="hidden sm:inline text-slate-400 font-medium">
          Optimized for Senior Advisory Leaders & Corporate Boards
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Text Size Controls */}
        <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-white/10">
          <Type className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline font-semibold">Typography:</span>
          <button
            onClick={() => setFontSize('standard')}
            className={`px-2 py-0.5 text-xs rounded-lg font-bold transition-all ${
              fontSize === 'standard' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="Standard Text Size"
          >
            A
          </button>
          <button
            onClick={() => setFontSize('large')}
            className={`px-2 py-0.5 text-xs rounded-lg font-bold transition-all ${
              fontSize === 'large' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="Large Text (+12%)"
          >
            A+
          </button>
          <button
            onClick={() => setFontSize('xlarge')}
            className={`px-2 py-0.5 text-xs rounded-lg font-bold transition-all ${
              fontSize === 'xlarge' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="Extra Large Text (+25%)"
          >
            A++
          </button>
        </div>

        {/* High Contrast */}
        <button
          onClick={() => setIsHighContrast(!isHighContrast)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
            isHighContrast
              ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow'
              : 'bg-slate-900 border-white/10 text-slate-300 hover:border-slate-700'
          }`}
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" />
          <span>{isHighContrast ? 'Contrast: High' : 'High Contrast'}</span>
        </button>

        {/* Voice Assistant */}
        <button
          onClick={handleVoiceAssist}
          className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 px-3 py-1 rounded-xl text-xs font-bold transition-all border border-blue-500/30"
          title="Narrate platform summary"
        >
          <Volume2 className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden md:inline">Voice Assistant</span>
        </button>
      </div>
    </div>
  );
};
