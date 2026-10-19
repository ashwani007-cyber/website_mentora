import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Briefcase, 
  Wallet, 
  Search, 
  CalendarCheck, 
  ClipboardCheck 
} from 'lucide-react';

export interface FeatureAccordionShowcaseProps {
  isLight: boolean;
  trophyGraphic: React.ReactNode;
  vaultGraphic: React.ReactNode;
}

const displayFont = { fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700 };
const bodyFont = { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" };

const panels = [
  {
    id: 0,
    numberStr: "01",
    heading: "Verify your history",
    desc: "Upload verified certificates & relieving letters for Admin audit.",
    accent: "#EA580C",
    accentDark: "#FB923C",
    pastelBg: "#FFF7ED",
    icon: ShieldCheck,
    category: "Senior",
    categoryColor: "amber",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: 1,
    numberStr: "02",
    heading: "List your advisory domains",
    desc: "Choose your fields — finance, governance, HR, technology, and operations.",
    accent: "#2563EB",
    accentDark: "#60A5FA",
    pastelBg: "#EFF6FF",
    icon: Briefcase,
    category: "Senior",
    categoryColor: "amber",
    image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: 2,
    numberStr: "03",
    heading: "Set your hourly payout",
    desc: "Price sessions transparently, keeping 100% of your chosen base rate.",
    accent: "#059669",
    accentDark: "#34D399",
    pastelBg: "#ECFDF5",
    icon: Wallet,
    category: "Senior",
    categoryColor: "amber",
    image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: 3,
    numberStr: "01",
    heading: "Explore verified dossiers",
    desc: "Filter by domain, budget limit, and client satisfaction rating.",
    accent: "#0284C7",
    accentDark: "#38BDF8",
    pastelBg: "#F0F9FF",
    icon: Search,
    category: "Client",
    categoryColor: "cyan",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: 4,
    numberStr: "02",
    heading: "Instant slot reservation",
    desc: "Reserve 1-on-1 consultations with built-in Google Meet links.",
    accent: "#0D9488",
    accentDark: "#2DD4BF",
    pastelBg: "#F0FDFA",
    icon: CalendarCheck,
    category: "Client",
    categoryColor: "cyan",
    image: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: 5,
    numberStr: "03",
    heading: "Audit-backed reviews",
    desc: "Submit post-session reviews audited by Platform Governance.",
    accent: "#7C3AED",
    accentDark: "#C084FC",
    pastelBg: "#FAF5FF",
    icon: ClipboardCheck,
    category: "Client",
    categoryColor: "cyan",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&auto=format&fit=crop&q=80"
  }
];

export function FeatureAccordionShowcase({ isLight, trophyGraphic, vaultGraphic }: FeatureAccordionShowcaseProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setBreakpoint('desktop');
      else if (window.innerWidth >= 768) setBreakpoint('tablet');
      else setBreakpoint('mobile');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getFlexStyle = (idx: number) => {
    if (breakpoint === 'mobile') return { flex: 'none' };
    
    if (breakpoint === 'desktop') {
      if (hoverIdx === null) return { flex: '1 1 0%' };
      return hoverIdx === idx ? { flex: '2.85 1 0%' } : { flex: '0.83 1 0%' };
    }
    
    // Tablet row logic - uses activeIdx (tap-to-expand)
    const expandRef = activeIdx;
    if (expandRef === null) return { flex: '1 1 0%' };
    const myRow = idx < 3 ? 0 : 1;
    const expandRow = expandRef < 3 ? 0 : 1;
    if (myRow !== expandRow) return { flex: '1 1 0%' };
    
    return expandRef === idx ? { flex: '2.85 1 0%' } : { flex: '0.83 1 0%' };
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (breakpoint === 'mobile' || breakpoint === 'tablet') {
        setActiveIdx(activeIdx === idx ? null : idx);
      } else {
        setHoverIdx(hoverIdx === idx ? null : idx);
      }
    }
  };

  const renderPanel = (panel: typeof panels[0]) => {
    const idx = panel.id;
    const isMobileOrTablet = breakpoint === 'mobile' || breakpoint === 'tablet';
    const isMobile = breakpoint === 'mobile';
    const isExpanded = activeIdx === idx || (!isMobileOrTablet && hoverIdx === idx);
    const activeAccent = isLight ? panel.accent : (panel.accentDark || panel.accent);
    
    const panelStyle = {
      ...getFlexStyle(idx),
      background: isExpanded 
        ? `linear-gradient(145deg, ${panel.accent} 0%, ${panel.accentDark || panel.accent} 100%)` 
        : isLight 
          ? 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)' 
          : 'linear-gradient(180deg, rgba(17, 26, 39, 0.95) 0%, rgba(13, 20, 32, 0.9) 100%)',
      borderColor: isExpanded ? (isLight ? panel.accent : activeAccent) : (isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.1)'),
      boxShadow: isExpanded 
        ? (isLight 
            ? `0 16px 36px -4px ${panel.accent}35, 0 8px 16px -4px rgba(0,0,0,0.1)` 
            : `0 16px 40px -4px ${activeAccent}35, 0 8px 20px -4px rgba(0,0,0,0.5)`)
        : (isLight 
            ? '0 4px 14px -2px rgba(0, 0, 0, 0.04), 0 2px 6px -1px rgba(0, 0, 0, 0.02)' 
            : '0 4px 20px rgba(0, 0, 0, 0.3)'),
    };

    const focusColor = panel.categoryColor === 'amber' ? 'focus-visible:ring-amber-500' : 'focus-visible:ring-cyan-500';

    return (
      <div
        key={panel.id}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`Feature ${panel.numberStr}: ${panel.heading}`}
        onMouseEnter={() => !isMobileOrTablet && setHoverIdx(idx)}
        onMouseLeave={() => !isMobileOrTablet && setHoverIdx(null)}
        onClick={() => setActiveIdx(activeIdx === idx ? null : idx)}
        onKeyDown={(e) => handleKeyDown(e, idx)}
        style={panelStyle}
        className={`relative overflow-hidden flex flex-col items-center cursor-pointer transition-all duration-[380ms] ease-out rounded-2xl border p-5 sm:p-6 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${isLight ? 'focus-visible:ring-offset-white' : 'focus-visible:ring-offset-slate-900'} ${focusColor} ${!isMobile ? 'min-h-[350px]' : ''}`}
      >
        {/* Decorative SVG arc */}
        <div className={`absolute bottom-0 right-0 w-32 h-32 pointer-events-none transition-opacity duration-[380ms] ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="80" stroke="white" strokeWidth="4" strokeOpacity="0.1" />
            <circle cx="100" cy="100" r="60" stroke="white" strokeWidth="4" strokeOpacity="0.15" />
            <circle cx="100" cy="100" r="40" stroke="white" strokeWidth="4" strokeOpacity="0.2" />
          </svg>
        </div>

        {/* Category badge - centered */}
        <div className="flex justify-between items-start w-full mb-4 z-10 relative">
          <span 
            style={bodyFont}
            className={`text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full transition-all duration-[380ms] ${
              isExpanded 
                ? 'bg-white/20 text-white border border-white/30 shadow-sm' 
                : (panel.categoryColor === 'amber' 
                    ? (isLight 
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold' 
                        : 'bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]') 
                    : (isLight 
                        ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 font-extrabold' 
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'))
            }`}
          >
            {panel.category}
          </span>
          <span 
            style={{ 
              ...displayFont, 
              letterSpacing: '0.04em', 
              color: isExpanded ? '#FFFFFF' : activeAccent,
              textShadow: isExpanded 
                ? '0 2px 10px rgba(0,0,0,0.3)' 
                : isLight 
                  ? 'none' 
                  : `0 0 16px ${activeAccent}40`
            }}
            className="text-[26px] font-black transition-all duration-[380ms]"
          >
            {panel.numberStr}
          </span>
        </div>

        {/* Image - centered, rounded with dynamic expansion */}
        <div 
          className="z-10 relative mb-4 transition-all duration-[380ms] ease-out overflow-hidden rounded-xl flex-shrink-0"
          style={{
            width: isExpanded ? 130 : 84,
            height: isExpanded ? 86 : 58,
            border: isExpanded ? '2px solid rgba(255,255,255,0.6)' : (isLight ? `2px solid ${panel.pastelBg}` : `2px solid ${activeAccent}40`),
            boxShadow: isExpanded 
              ? '0 6px 22px rgba(0,0,0,0.3)' 
              : isLight 
                ? '0 2px 8px rgba(0,0,0,0.06)' 
                : `0 2px 12px ${activeAccent}20`,
          }}
        >
          <img 
            src={panel.image} 
            alt={panel.heading}
            className="w-full h-full object-cover transition-transform duration-500 ease-out"
            style={{ transform: isExpanded ? 'scale(1.08)' : 'scale(1)' }}
            loading="lazy"
          />
          {isExpanded && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
          )}
        </div>

        {/* Icon badge - centered */}
        <div 
          className="w-[52px] h-[52px] rounded-full flex items-center justify-center mb-3 z-10 relative transition-all duration-[380ms]"
          style={{ 
            backgroundColor: isExpanded ? '#FFFFFF' : (isLight ? panel.pastelBg : `${activeAccent}18`),
            color: isExpanded ? panel.accent : activeAccent,
            border: isLight ? 'none' : `1px solid ${activeAccent}35`,
            boxShadow: isExpanded ? '0 4px 14px rgba(0,0,0,0.2)' : (isLight ? '0 1px 4px rgba(0,0,0,0.05)' : `0 0 12px ${activeAccent}20`),
          }}
        >
          <panel.icon size={22} strokeWidth={2.5} />
        </div>

        {/* Heading - centered */}
        <div className="z-10 relative flex-1 flex flex-col items-center justify-end w-full">
          <h4 
            style={{ 
              ...displayFont, 
              color: isExpanded ? '#FFFFFF' : isLight ? '#0F172A' : '#FFFFFF',
              textShadow: isExpanded 
                ? '0 2px 10px rgba(0,0,0,0.3)' 
                : isLight 
                  ? 'none' 
                  : '0 2px 8px rgba(0,0,0,0.6)'
            }} 
            className="text-[17px] font-black transition-colors duration-[380ms] leading-snug text-center tracking-tight"
          >
            {panel.heading}
          </h4>
          
          {/* Description - centered */}
          <div className={`grid transition-all duration-[380ms] ease-out w-full ${isExpanded || !isMobile ? 'grid-rows-[1fr] mt-2.5' : 'grid-rows-[0fr] mt-0'}`}>
            <div className="overflow-hidden">
              <p 
                style={{ 
                  ...bodyFont,
                  color: isExpanded ? 'rgba(255,255,255,0.96)' : isLight ? '#475569' : '#CBD5E1',
                  textShadow: isExpanded ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                }} 
                className={`text-[13.5px] leading-relaxed transition-colors duration-[380ms] text-center font-normal
                  ${isExpanded ? 'line-clamp-none font-medium' : ''}
                  ${!isExpanded && !isMobile ? 'line-clamp-2' : ''}
                `}
              >
                {panel.desc}
              </p>
            </div>
          </div>

          {/* Expanded Step Status Badge */}
          {isExpanded && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-white/90">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              <span>Step {panel.numberStr} Verified</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderHeaderLeft = () => (
    <div className="flex items-center gap-4">
      <div 
        className="flex-shrink-0 rounded-2xl overflow-hidden"
        style={{
          width: 52,
          height: 52,
          background: isLight 
            ? 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)' 
            : 'linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(245,158,11,0.08) 100%)',
          border: isLight ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(245,158,11,0.45)',
          boxShadow: isLight ? '0 2px 14px rgba(245,158,11,0.15)' : '0 0 24px rgba(245,158,11,0.25)',
        }}
      >
        {trophyGraphic}
      </div>
      <div className="flex flex-col items-start text-left">
        <span 
          style={{ ...bodyFont }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-widest uppercase mb-1 ${
            isLight 
              ? 'bg-amber-100 text-amber-900 border border-amber-300/80 shadow-xs' 
              : 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_#F59E0B]"></span>
          How It Works
        </span>
        <h3 
          style={{ ...displayFont }} 
          className={`text-xl sm:text-2xl font-black tracking-tight ${
            isLight 
              ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-600 to-orange-700 drop-shadow-xs' 
              : 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 drop-shadow-[0_2px_12px_rgba(245,158,11,0.35)]'
          }`}
        >
          For Senior Professionals
        </h3>
      </div>
    </div>
  );

  const renderHeaderRight = () => (
    <div className="flex items-center gap-4">
      <div 
        className="flex-shrink-0 rounded-2xl overflow-hidden"
        style={{
          width: 52,
          height: 52,
          background: isLight 
            ? 'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(6,182,212,0.05) 100%)' 
            : 'linear-gradient(135deg, rgba(6,182,212,0.22) 0%, rgba(6,182,212,0.08) 100%)',
          border: isLight ? '1px solid rgba(6,182,212,0.35)' : '1px solid rgba(6,182,212,0.45)',
          boxShadow: isLight ? '0 2px 14px rgba(6,182,212,0.15)' : '0 0 24px rgba(6,182,212,0.25)',
        }}
      >
        {vaultGraphic}
      </div>
      <div className="flex flex-col items-start text-left">
        <span 
          style={{ ...bodyFont }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-widest uppercase mb-1 ${
            isLight 
              ? 'bg-cyan-100 text-cyan-900 border border-cyan-300/80 shadow-xs' 
              : 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06B6D4]"></span>
          How It Works
        </span>
        <h3 
          style={{ ...displayFont }} 
          className={`text-xl sm:text-2xl font-black tracking-tight ${
            isLight 
              ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-700 via-teal-700 to-emerald-800 drop-shadow-xs' 
              : 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-sky-300 to-cyan-500 drop-shadow-[0_2px_12px_rgba(6,182,212,0.35)]'
          }`}
        >
          For Organizations & Clients
        </h3>
      </div>
    </div>
  );

  if (breakpoint === 'tablet' || breakpoint === 'mobile') {
    return (
      <section className="w-full max-w-7xl mx-auto flex flex-col gap-8 md:gap-10 p-4">
        <div className="flex flex-col gap-4">
          <div className="px-2">{renderHeaderLeft()}</div>
          <div className={`flex ${breakpoint === 'tablet' ? 'flex-row gap-4' : 'flex-col gap-3'}`}>
            {panels.slice(0, 3).map(renderPanel)}
          </div>
        </div>
        
        {breakpoint === 'mobile' && (
          <div className={`h-px w-full my-2 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />
        )}
        
        <div className="flex flex-col gap-4">
          <div className="px-2">{renderHeaderRight()}</div>
          <div className={`flex ${breakpoint === 'tablet' ? 'flex-row gap-4' : 'flex-col gap-3'}`}>
            {panels.slice(3, 6).map(renderPanel)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section 
      className="w-full max-w-[1400px] mx-auto p-4 flex flex-col"
      onMouseLeave={() => setHoverIdx(null)}
    >
      <div 
        className="flex items-center mb-8 mx-2 rounded-2xl"
        style={{
          padding: '20px 32px',
          background: isLight 
            ? 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.94) 100%)' 
            : 'linear-gradient(135deg, rgba(15,23,42,0.75) 0%, rgba(11,17,26,0.85) 100%)',
          border: isLight ? '1px solid rgba(148,163,184,0.25)' : '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(16px)',
          boxShadow: isLight 
            ? '0 4px 20px -2px rgba(0,0,0,0.06), 0 2px 6px -1px rgba(0,0,0,0.03)' 
            : '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex-1 flex items-center justify-start pl-2">
          {renderHeaderLeft()}
        </div>

        {/* Center divider matching the panel divider below */}
        <div className="flex items-center justify-center mx-6 lg:mx-8">
          <div 
            className="flex flex-col items-center justify-center h-12"
            style={{ width: 20 }}
          >
            <div 
              style={{
                width: 2,
                flex: 1,
                background: isLight 
                  ? 'linear-gradient(180deg, transparent, #CBD5E1)' 
                  : 'linear-gradient(180deg, transparent, rgba(255,255,255,0.25))',
                borderRadius: 1,
              }}
            />
            <div 
              style={{
                width: 6,
                height: 6,
                transform: 'rotate(45deg)',
                background: isLight ? '#94A3B8' : 'rgba(255,255,255,0.4)',
                margin: '4px 0',
                borderRadius: 1,
              }}
            />
            <div 
              style={{
                width: 2,
                flex: 1,
                background: isLight 
                  ? 'linear-gradient(180deg, #CBD5E1, transparent)' 
                  : 'linear-gradient(180deg, rgba(255,255,255,0.25), transparent)',
                borderRadius: 1,
              }}
            />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-start pl-2">
          {renderHeaderRight()}
        </div>
      </div>

      <div className="flex flex-row gap-[10px] items-stretch">
        {panels.slice(0, 3).map(renderPanel)}
        
        <div className={`flex w-[2px] mx-1 lg:mx-3 self-stretch items-center justify-center rounded-full ${isLight ? 'bg-slate-200' : 'bg-white/10'}`}>
          <div className={`w-1.5 h-1.5 rotate-45 rounded-[1px] ${isLight ? 'bg-slate-400' : 'bg-white/40'}`} />
        </div>
        
        {panels.slice(3, 6).map(renderPanel)}
      </div>
    </section>
  );
}
