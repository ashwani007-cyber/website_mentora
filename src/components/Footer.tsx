import React, { useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Mail,
  FileText
} from 'lucide-react';
import mentoraLogoHorizontalDark from '../assets/mentora-logo-horizontal-dark.png';
import mentoraLogoHorizontalLight from '../assets/mentora-logo-horizontal-light.png';

export interface FooterProps {
  theme?: 'dark' | 'light';
  setPage?: (page: string) => void;
  onOpenAuth?: (mode: 'signup' | 'login', role?: string) => void;
  userRole?: string | null;
  setActiveTab?: (tab: string) => void;
  includeCta?: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  theme = 'dark',
  setPage,
  onOpenAuth,
  userRole,
  setActiveTab,
  includeCta = true,
}) => {
  const isLight = theme === 'light';

  // Newsletter form state
  const [email, setEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [newsletterMessage, setNewsletterMessage] = useState('');

  // Legal modal state
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'terms' | null>(null);

  // Exact Social Media Links
  const LINKEDIN_URL = 'https://www.linkedin.com/in/ashwani-kushwaha-11998a327';
  const INSTAGRAM_URL = 'https://www.instagram.com/ashwanikushwaha386';

  // Email validation regex (standard RFC 5322 compatible)
  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();

    if (!trimmed) {
      setNewsletterStatus('error');
      setNewsletterMessage('Please enter your email address.');
      return;
    }

    if (!EMAIL_REGEX.test(trimmed)) {
      setNewsletterStatus('error');
      setNewsletterMessage('Please enter a valid email address.');
      return;
    }

    setNewsletterStatus('loading');
    setNewsletterMessage('');

    // Isolated client-side submission with clean feedback
    setTimeout(() => {
      setNewsletterStatus('success');
      setNewsletterMessage("Thank you for subscribing! You're now connected to Mentora updates.");
      setEmail('');
    }, 600);
  };

  const smoothScrollTo = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else if (setPage) {
      setPage('landing');
      setTimeout(() => {
        document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  };

  const handleFindExpert = () => {
    if (userRole === 'client' && setPage) {
      setPage('client');
    } else if (onOpenAuth) {
      onOpenAuth('signup', 'client');
    } else if (setActiveTab) {
      setActiveTab('directory');
    }
  };

  const handleBecomeExpert = () => {
    if (onOpenAuth) {
      onOpenAuth('signup', 'expert');
    } else if (setActiveTab) {
      setActiveTab('training');
    }
  };

  const handleExpertSignIn = () => {
    if (onOpenAuth) {
      onOpenAuth('login', 'expert');
    } else if (setPage) {
      setPage('login');
    }
  };

  const handleClientPortal = () => {
    if (userRole === 'client' && setPage) {
      setPage('client');
    } else if (onOpenAuth) {
      onOpenAuth('login', 'client');
    } else if (setActiveTab) {
      setActiveTab('directory');
    }
  };

  const handleExpertPortal = () => {
    if (userRole === 'expert' && setPage) {
      setPage('expert');
    } else if (onOpenAuth) {
      onOpenAuth('login', 'expert');
    } else if (setActiveTab) {
      setActiveTab('training');
    }
  };

  const handleBrowseExperts = () => {
    smoothScrollTo('featured-advisors');
  };

  const handleLogoClick = () => {
    if (setPage) {
      setPage('landing');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      className={`relative z-20 w-full transition-colors duration-300 font-sans ${
        isLight ? 'text-slate-800' : 'text-slate-300'
      }`}
      aria-label="Mentora Footer"
    >
      {/* -------------------------------------------------------------
          1. PRE-FOOTER CTA AREA
          Subtle, enterprise-grade CTA transition before the organic wave
      -------------------------------------------------------------- */}
      {includeCta && (
        <section
          className={`px-4 sm:px-8 md:px-14 py-16 sm:py-20 relative transition-colors duration-300 border-t ${
            isLight
              ? 'bg-gradient-to-b from-white via-[#FAF8F5] to-[#F5F1EA] border-slate-200/80'
              : 'bg-gradient-to-b from-[#080D16] via-[#060910] to-[#05080E] border-white/10'
          }`}
          aria-label="Experience Call to Action"
        >
          {/* Subtle Ambient Gold Glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] rounded-full blur-[120px] pointer-events-none transition-opacity duration-500"
            style={{
              background: isLight ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.12)',
            }}
          />

          <div className="relative max-w-5xl mx-auto text-center space-y-6">
            {/* Headline */}
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              <span className={isLight ? 'text-slate-900' : 'text-white'}>
                Experience That Moves{' '}
              </span>
              <span
                style={{
                  color: isLight ? '#D97706' : '#FBBF24',
                  backgroundImage: isLight
                    ? 'linear-gradient(135deg, #D97706 0%, #EA580C 50%, #B45309 100%)'
                    : 'linear-gradient(135deg, #FDE68A 0%, #FBBF24 50%, #F59E0B 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'inline-block',
                }}
              >
                You Forward.
              </span>
            </h2>

            {/* Supporting Copy */}
            <p
              className={`text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-normal ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Find trusted expertise or share your experience with the next generation.
              Bridging senior wisdom with modern startups, enterprises, and ambitious individuals.
            </p>

            {/* CTA Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={handleFindExpert}
                className="group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide text-slate-950 transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98] shadow-md"
                style={{
                  background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 50%, #D97706 100%)',
                  border: '1px solid rgba(254, 240, 138, 0.7)',
                  boxShadow: isLight
                    ? '0 8px 20px -4px rgba(245, 158, 11, 0.35)'
                    : '0 10px 24px -4px rgba(245, 158, 11, 0.45)',
                }}
              >
                <span>Find an Expert</span>
                <ArrowUpRight
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </button>

              <button
                type="button"
                onClick={handleBecomeExpert}
                className={`inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98] border shadow-xs ${
                  isLight
                    ? 'bg-white hover:bg-slate-50 text-slate-900 border-slate-300/80 shadow-slate-200/50'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-100 border-white/15'
                }`}
              >
                <span>Become an Expert</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------
          2. ANIMATED FOOTER TOP WAVE SEPARATOR (Interactive Fluid Edition)
          Two-layer organic continuous flowing wave animation with high-contrast,
          interactive luminous gradients, dual-layer contours, and hover glow
      -------------------------------------------------------------- */}
      <div 
        className="relative w-full overflow-hidden leading-none select-none -mb-[1px] h-20 sm:h-24 md:h-32 lg:h-36 group cursor-pointer transition-colors duration-300"
        style={{
          backgroundColor: isLight ? '#F5F1EA' : '#05080E',
        }}
        aria-label="Interactive flowing wave animation"
      >
        <style>{`
          @keyframes mentoraWavePrimary {
            0% {
              transform: translate3d(0, 0, 0);
            }
            50% {
              transform: translate3d(-25%, -3px, 0);
            }
            100% {
              transform: translate3d(-50%, 0, 0);
            }
          }

          @keyframes mentoraWaveSecondary {
            0% {
              transform: translate3d(-50%, 0, 0);
            }
            50% {
              transform: translate3d(-25%, 4px, 0);
            }
            100% {
              transform: translate3d(0, 0, 0);
            }
          }

          .mentora-wave-layer-primary {
            animation: mentoraWavePrimary 14s linear infinite;
            will-change: transform;
            transition: filter 0.4s ease, opacity 0.4s ease;
          }

          .mentora-wave-layer-secondary {
            animation: mentoraWaveSecondary 19s linear infinite;
            will-change: transform;
            transition: filter 0.4s ease, opacity 0.4s ease;
          }

          /* Interactive hover glow & illumination */
          .group:hover .mentora-wave-layer-primary path {
            filter: drop-shadow(0 0 14px rgba(245, 158, 11, 0.65));
            stroke-width: 3.2px;
          }

          .group:hover .mentora-wave-layer-secondary {
            opacity: 1 !important;
            filter: drop-shadow(0 0 20px rgba(245, 158, 11, 0.5));
          }

          @media (prefers-reduced-motion: reduce) {
            .mentora-wave-layer-primary,
            .mentora-wave-layer-secondary {
              animation: none !important;
              transform: translate3d(0, 0, 0) !important;
            }
          }
        `}</style>

        {/* LAYER 2: SECONDARY WAVE (Vibrant, multi-tone glowing wave flowing behind primary wave) */}
        <div className="absolute inset-0 w-full h-full overflow-hidden opacity-90 transition-opacity duration-300">
          <svg
            viewBox="0 0 2880 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            className="mentora-wave-layer-secondary absolute top-0 left-0 h-full"
            style={{
              width: '200%',
              minWidth: '200%',
              maxWidth: 'none',
            }}
          >
            <defs>
              {/* Light Mode: Luminous Sunset Amber-Coral Aurora fading to footer cream */}
              <linearGradient id="mentoraWaveSecondaryLight" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FF5722" stopOpacity="0.65" />
                <stop offset="30%" stopColor="#F59E0B" stopOpacity="0.80" />
                <stop offset="65%" stopColor="#FDE68A" stopOpacity="0.90" />
                <stop offset="100%" stopColor="#FAF8F5" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="mentoraWaveSecondaryStrokeLight" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#EA580C" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#EA580C" stopOpacity="0.85" />
              </linearGradient>

              {/* Dark Mode: Quantum Cyber Aurora (Amber Gold + Cyan Blue + Violet) fading to footer obsidian */}
              <linearGradient id="mentoraWaveSecondaryDark" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.85" />
                <stop offset="30%" stopColor="#6366F1" stopOpacity="0.60" />
                <stop offset="55%" stopColor="#0EA5E9" stopOpacity="0.55" />
                <stop offset="80%" stopColor="#0D1524" stopOpacity="0.90" />
                <stop offset="100%" stopColor="#060A10" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="mentoraWaveSecondaryStrokeDark" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.90" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            {/* Secondary wave fill (extends past bottom to blend seamlessly into footer) */}
            <path
              d="M0,48 C260,78 520,15 800,32 C1060,50 1280,20 1440,48 C1700,78 1960,15 2240,32 C2500,50 2720,20 2880,48 L2880,160 L0,160 Z"
              fill={isLight ? 'url(#mentoraWaveSecondaryLight)' : 'url(#mentoraWaveSecondaryDark)'}
              stroke="none"
              className="transition-colors duration-700 ease-in-out"
            />
            {/* Secondary wave crest stroke (pure top curve, no bottom line) */}
            <path
              d="M0,48 C260,78 520,15 800,32 C1060,50 1280,20 1440,48 C1700,78 1960,15 2240,32 C2500,50 2720,20 2880,48"
              fill="none"
              stroke={isLight ? 'url(#mentoraWaveSecondaryStrokeLight)' : 'url(#mentoraWaveSecondaryStrokeDark)'}
              strokeWidth="2"
              className="transition-colors duration-700 ease-in-out"
            />
          </svg>
        </div>

        {/* LAYER 1: PRIMARY WAVE (Foreground wave with glowing contour crest seamlessly attaching to footer body) */}
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <svg
            viewBox="0 0 2880 140"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            className="mentora-wave-layer-primary absolute top-0 left-0"
            style={{
              width: '200%',
              minWidth: '200%',
              maxWidth: 'none',
              height: 'calc(100% + 20px)',
            }}
          >
            <defs>
              {/* Light Mode: Warm pearlescent cream-gold fill with vivid amber-gold glowing crest stroke */}
              <linearGradient id="mentoraWavePrimaryLight" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFF3E0" stopOpacity="1" />
                <stop offset="25%" stopColor="#FFE8C8" stopOpacity="1" />
                <stop offset="60%" stopColor="#FAF8F5" stopOpacity="1" />
                <stop offset="100%" stopColor="#FAF8F5" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="mentoraWaveStrokeLight" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#EA580C" />
                <stop offset="25%" stopColor="#F59E0B" />
                <stop offset="50%" stopColor="#FBBF24" />
                <stop offset="75%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#EA580C" />
              </linearGradient>

              {/* Dark Mode: Deep cyber twilight fill with multi-hued neon contour crest stroke */}
              <linearGradient id="mentoraWavePrimaryDark" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1E2B45" stopOpacity="1" />
                <stop offset="30%" stopColor="#10192A" stopOpacity="1" />
                <stop offset="65%" stopColor="#060A10" stopOpacity="1" />
                <stop offset="100%" stopColor="#060A10" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="mentoraWaveStrokeDark" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FCD34D" />
                <stop offset="25%" stopColor="#38BDF8" />
                <stop offset="50%" stopColor="#A855F7" />
                <stop offset="75%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#FCD34D" />
              </linearGradient>
            </defs>
            {/* Primary wave fill (seamlessly merges with footer body at bottom) */}
            <path
              d="M0,65 C220,25 440,95 720,70 C980,45 1220,90 1440,65 C1660,25 1880,95 2160,70 C2420,45 2660,90 2880,65 L2880,160 L0,160 Z"
              fill={isLight ? 'url(#mentoraWavePrimaryLight)' : 'url(#mentoraWavePrimaryDark)'}
              stroke="none"
              className="transition-colors duration-700 ease-in-out"
            />
            {/* Primary wave crest stroke (pure top curve with glow filter) */}
            <path
              d="M0,65 C220,25 440,95 720,70 C980,45 1220,90 1440,65 C1660,25 1880,95 2160,70 C2420,45 2660,90 2880,65"
              fill="none"
              stroke={isLight ? 'url(#mentoraWaveStrokeLight)' : 'url(#mentoraWaveStrokeDark)'}
              strokeWidth="2.5"
              style={{
                filter: isLight 
                  ? 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.45))' 
                  : 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.70)) drop-shadow(0 0 18px rgba(56, 189, 248, 0.40))',
                transition: 'stroke-width 0.3s ease, filter 0.3s ease',
              }}
              className="transition-colors duration-700 ease-in-out"
            />
          </svg>
        </div>
      </div>

      {/* -------------------------------------------------------------
          3. MAIN FOOTER CONTENT BODY
          Spacious 5-column layout on Desktop, 2-column tablet, 1-column mobile
      -------------------------------------------------------------- */}
      <div
        className="w-full transition-colors duration-300"
        style={{
          backgroundColor: isLight ? '#FAF8F5' : '#060A10',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 sm:pt-14 sm:pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 items-start">
            
            {/* =========================================================
                COLUMN 1: MENTORA BRAND, MISSION, NEWSLETTER & SOCIAL
                Spans 4 columns on large desktop
            ========================================================== */}
            <div className="lg:col-span-4 space-y-6">
              {/* Mentora Brand Logo */}
              <div
                onClick={handleLogoClick}
                className="inline-flex items-center cursor-pointer group select-none"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleLogoClick();
                  }
                }}
                aria-label="Mentora Home"
              >
                <img
                  src={isLight ? mentoraLogoHorizontalLight : mentoraLogoHorizontalDark}
                  alt="Mentora — Empowering Future Leaders"
                  className="h-9 sm:h-10 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = isLight
                      ? '/mentora-logo-horizontal-light.png'
                      : '/mentora-logo-horizontal-dark.png';
                  }}
                />
              </div>

              {/* Tagline & Positioning Copy */}
              <div className="space-y-2">
                <p
                  className={`text-xs sm:text-[13px] leading-relaxed font-normal ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Mentora connects decades of professional experience with the people and organizations building what comes next.
                </p>
                <p
                  className="text-xs font-semibold tracking-wide flex items-center gap-1.5"
                  style={{ color: isLight ? '#B45309' : '#FBBF24' }}
                >
                  <span>Empowering Future Leaders</span>
                </p>
              </div>

              {/* Verified Trust Badge */}
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  isLight
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>100% Background-Verified Senior Advisors</span>
              </div>

              {/* -------------------------------------------------------
                  NEWSLETTER / UPDATES AREA ("Stay Connected")
              -------------------------------------------------------- */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  isLight
                    ? 'bg-white/80 border-slate-200/80 shadow-xs'
                    : 'bg-slate-900/50 border-white/10'
                }`}
              >
                <div className="space-y-1 mb-3">
                  <h4
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isLight ? 'text-slate-900' : 'text-slate-100'
                    }`}
                  >
                    Stay Connected
                  </h4>
                  <p
                    className={`text-[11px] leading-relaxed ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Get Mentora updates, expert stories, insights and platform news.
                  </p>
                </div>

                <form onSubmit={handleNewsletterSubmit} className="space-y-2" noValidate>
                  <div className="relative flex items-center">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (newsletterStatus === 'error') {
                          setNewsletterStatus('idle');
                          setNewsletterMessage('');
                        }
                      }}
                      placeholder="Enter your email"
                      aria-label="Enter your email for Mentora updates"
                      disabled={newsletterStatus === 'loading'}
                      className={`w-full text-xs rounded-xl pl-3.5 pr-11 py-2.5 transition-all outline-none border ${
                        isLight
                          ? 'bg-slate-50 hover:bg-white focus:bg-white text-slate-900 placeholder:text-slate-400 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                          : 'bg-slate-950/80 hover:bg-slate-950 focus:bg-slate-950 text-slate-100 placeholder:text-slate-500 border-white/10 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={newsletterStatus === 'loading'}
                      aria-label="Subscribe to updates"
                      className="absolute right-1.5 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 disabled:opacity-50 text-slate-950 font-bold shadow-xs"
                      style={{
                        background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                      }}
                    >
                      {newsletterStatus === 'loading' ? (
                        <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ArrowRight size={14} />
                      )}
                    </button>
                  </div>

                  {/* Feedback Message */}
                  {newsletterStatus === 'error' && (
                    <div
                      className="flex items-center gap-1.5 text-[11px] text-rose-500 font-medium pt-1 animate-fadeIn"
                      role="alert"
                    >
                      <AlertCircle size={13} className="shrink-0" />
                      <span>{newsletterMessage}</span>
                    </div>
                  )}

                  {newsletterStatus === 'success' && (
                    <div
                      className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-medium pt-1 animate-fadeIn"
                      role="status"
                    >
                      <CheckCircle2 size={13} className="shrink-0" />
                      <span>{newsletterMessage}</span>
                    </div>
                  )}
                </form>
              </div>

              {/* -------------------------------------------------------
                  CONNECT WITH US / SOCIAL MEDIA ICONS
                  Only verified LinkedIn & Instagram exact URLs
              -------------------------------------------------------- */}
              <div className="space-y-2.5 pt-1">
                <p
                  className={`text-[10px] font-black uppercase tracking-widest ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Connect With Us
                </p>
                <div className="flex items-center gap-3">
                  {/* LinkedIn */}
                  <a
                    href={LINKEDIN_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Mentora on LinkedIn"
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 hover:-translate-y-0.5 shadow-xs ${
                      isLight
                        ? 'bg-white hover:bg-amber-50/50 text-slate-700 hover:text-amber-700 border-slate-200 hover:border-amber-300'
                        : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border-white/10 hover:border-amber-400/40'
                    }`}
                  >
                    <svg
                      className="w-4 h-4 fill-current shrink-0"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.3a1.64 1.64 0 0 0-1.66 1.64 1.66 1.66 0 0 0 3.32 0A1.64 1.64 0 0 0 7.86 6.3z" />
                    </svg>
                    <span>LinkedIn</span>
                  </a>

                  {/* Instagram */}
                  <a
                    href={INSTAGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Mentora on Instagram"
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 hover:-translate-y-0.5 shadow-xs ${
                      isLight
                        ? 'bg-white hover:bg-amber-50/50 text-slate-700 hover:text-amber-700 border-slate-200 hover:border-amber-300'
                        : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border-white/10 hover:border-amber-400/40'
                    }`}
                  >
                    <svg
                      className="w-4 h-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                    </svg>
                    <span>Instagram</span>
                  </a>
                </div>
              </div>
            </div>

            {/* =========================================================
                COLUMNS 2-5: NAVIGATION GROUPS (Explore, Clients, Experts, Company)
                Spans 8 columns on desktop (4 columns), 4 columns on tablet, 2 columns on mobile
            ========================================================== */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8 items-start">
              
              {/* COLUMN 2: EXPLORE */}
              <div className="space-y-4">
                <h3
                  className={`text-xs font-black uppercase tracking-wider ${
                    isLight ? 'text-slate-900' : 'text-slate-100'
                  }`}
                >
                  Explore
                </h3>
                <ul className="space-y-2.5 text-xs">
                  <li>
                    <button
                      type="button"
                      onClick={() => smoothScrollTo('how')}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>How It Works</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => smoothScrollTo('organizations')}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>For Organizations</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => smoothScrollTo('stories')}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Stories & Impact</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        if (setPage) setPage('about');
                        else if (setActiveTab) setActiveTab('stories');
                      }}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>About Mentora</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        if (setPage) setPage('blogs');
                      }}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Blogs & Articles</span>
                    </button>
                  </li>
                </ul>
              </div>

              {/* COLUMN 3: FOR CLIENTS & ORGANIZATIONS */}
              <div className="space-y-4">
                <h3
                  className={`text-xs font-black uppercase tracking-wider ${
                    isLight ? 'text-slate-900' : 'text-slate-100'
                  }`}
                >
                  For Clients
                </h3>
                <ul className="space-y-2.5 text-xs">
                  <li>
                    <button
                      type="button"
                      onClick={handleFindExpert}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Find an Expert</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={handleBrowseExperts}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Browse Advisors</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={handleFindExpert}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Book a Session</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={handleFindExpert}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Project Review</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={handleClientPortal}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Client Portal</span>
                    </button>
                  </li>
                </ul>
              </div>

              {/* COLUMN 4: FOR EXPERTS */}
              <div className="space-y-4">
                <h3
                  className={`text-xs font-black uppercase tracking-wider ${
                    isLight ? 'text-slate-900' : 'text-slate-100'
                  }`}
                >
                  For Experts
                </h3>
                <ul className="space-y-2.5 text-xs">
                  <li>
                    <button
                      type="button"
                      onClick={handleBecomeExpert}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Become an Expert</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={handleExpertSignIn}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Expert Sign In</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={handleExpertPortal}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Expert Portal</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => smoothScrollTo('how')}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Advisory Guidelines</span>
                    </button>
                  </li>
                </ul>
              </div>

              {/* COLUMN 5: COMPANY & RESOURCES */}
              <div className="space-y-4">
                <h3
                  className={`text-xs font-black uppercase tracking-wider ${
                    isLight ? 'text-slate-900' : 'text-slate-100'
                  }`}
                >
                  Company & Desk
                </h3>
                <ul className="space-y-2.5 text-xs">
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        if (setPage) setPage('about');
                      }}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Our Mission</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        if (setPage) setPage('blogs');
                      }}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Knowledge Hub</span>
                    </button>
                  </li>
                  <li>
                    <a
                      href="mailto:support@mentora.com"
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <Mail size={12} className="shrink-0" />
                      <span>Contact Support</span>
                    </a>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setLegalModalType('privacy')}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Privacy Policy</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setLegalModalType('terms')}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-amber-600 hover:translate-x-1'
                          : 'text-slate-400 hover:text-amber-400 hover:translate-x-1'
                      }`}
                    >
                      <span>Terms & Conditions</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = '/?portal=admin';
                      }}
                      className={`group inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer opacity-75 hover:opacity-100 ${
                        isLight
                          ? 'text-slate-500 hover:text-amber-700'
                          : 'text-slate-400 hover:text-amber-400'
                      }`}
                    >
                      <Lock size={11} />
                      <span>Executive Desk</span>
                    </button>
                  </li>
                </ul>
              </div>

            </div>

          </div>
        </div>

        {/* -------------------------------------------------------------
            4. FOOTER BOTTOM BAR
            Divider line, dynamic year, legal links & floating UI clearance
        -------------------------------------------------------------- */}
        <div
          className={`border-t transition-colors duration-300 ${
            isLight ? 'border-slate-200/80 bg-slate-50/70' : 'border-white/10 bg-slate-950/60'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 sm:pb-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            {/* Copyright with dynamic year */}
            <p className={isLight ? 'text-slate-500' : 'text-slate-400'}>
              © {new Date().getFullYear()} Mentora. All rights reserved.
            </p>

            {/* Legal shortcuts with clearance for the bottom-right AI assistant floating button */}
            <div
              className={`flex items-center gap-6 sm:pr-24 md:mr-64 lg:mr-56 font-medium ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              <button
                type="button"
                onClick={() => setLegalModalType('privacy')}
                className={`transition-colors cursor-pointer ${
                  isLight ? 'hover:text-slate-900' : 'hover:text-white'
                }`}
              >
                Privacy Policy
              </button>
              <span className="opacity-30" aria-hidden="true">
                •
              </span>
              <button
                type="button"
                onClick={() => setLegalModalType('terms')}
                className={`transition-colors cursor-pointer ${
                  isLight ? 'hover:text-slate-900' : 'hover:text-white'
                }`}
              >
                Terms & Conditions
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          5. ACCESSIBLE LEGAL POLICY MODAL (Privacy Policy & Terms)
      -------------------------------------------------------------- */}
      {legalModalType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
          onClick={() => setLegalModalType(null)}
        >
          <div
            className={`w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl border p-6 sm:p-8 shadow-2xl relative transition-all ${
              isLight ? 'bg-white text-slate-800 border-slate-200' : 'bg-slate-900 text-slate-100 border-white/15'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                <h3
                  id="legal-modal-title"
                  className={`text-lg font-black tracking-tight ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  {legalModalType === 'privacy' ? 'Mentora Privacy Policy' : 'Terms & Conditions'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLegalModalType(null)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            {legalModalType === 'privacy' ? (
              <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <p>
                  At Mentora, safeguarding the intellectual capital and confidentiality of both our
                  senior executive advisors and clients is central to our platform.
                </p>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  1. Information We Collect
                </h4>
                <p>
                  We collect professional credentials, work histories, verified domain expertise, and
                  engagement preferences strictly to facilitate advisory matchmaking and project reviews.
                </p>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  2. Data Protection & Confidentiality
                </h4>
                <p>
                  We do not sell, rent, or trade your personal data. All advisory notes, project review
                  dossiers, and consultation recordings remain strictly confidential between the client
                  and the advisor under platform non-disclosure safeguards.
                </p>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  3. Contact Our Privacy Officer
                </h4>
                <p>
                  Inquiries regarding your stored information can be directed to{' '}
                  <a href="mailto:support@mentora.com" className="text-amber-600 underline font-semibold">
                    support@mentora.com
                  </a>
                  .
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <p>
                  Welcome to Mentora. By accessing our platform or booking consultation sessions, you
                  agree to abide by these terms.
                </p>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  1. Advisory Nature of Engagements
                </h4>
                <p>
                  Mentora connects clients with experienced senior professionals for strategic guidance,
                  mentorship, and executive review. Consultations do not constitute statutory audits or
                  attorney-client legal privilege unless explicitly executed under separate retainer.
                </p>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  2. Verification & Escrow Protection
                </h4>
                <p>
                  All senior experts undergo rigorous credential verification. Session fees are protected
                  via platform escrow until the scheduled consultation or project review deliverables
                  are completed.
                </p>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  3. Code of Conduct
                </h4>
                <p>
                  All participants must maintain professionalism, mutual respect, and confidentiality.
                  Mentora reserves the right to suspend any account violating ethical standards.
                </p>
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModalType(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 transition-all hover:scale-105 active:scale-95 shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
