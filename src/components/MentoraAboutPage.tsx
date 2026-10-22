import React, { useState } from "react";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Handshake,
  Users,
  Search,
  CalendarCheck,
  TrendingUp,
  ShieldCheck,
  Star,
  FileCheck2,
  Lock,
  ArrowRight,
  Sparkles,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  Building2,
  BriefcaseBusiness,
  Award
} from "lucide-react";

import mentoraLogoHorizontalLight from "../assets/mentora-logo-horizontal-light.png";
import mentoraLogoHorizontalDark from "../assets/mentora-logo-horizontal-dark.png";

interface MentoraAboutPageProps {
  setPage: (page: string) => void;
  onOpenAuth: (mode: "signup" | "login", role?: string) => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  userRole?: string | null;
  onLogout?: () => void;
}

export const MentoraAboutPage: React.FC<MentoraAboutPageProps> = ({
  setPage,
  onOpenAuth,
  theme = "dark",
  onToggleTheme,
  userRole,
  onLogout,
}) => {
  const isLight = theme === "light";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // High-Contrast, Vibrant Design Tokens
  const colors = isLight
    ? {
        bg: "#F4F8F3",
        bgHeroGrad: "linear-gradient(180deg, #F4F8F3 0%, #EBF3EA 100%)",
        bgSectionAlt: "#EDF5ED",
        primaryText: "#16382D",
        secondaryText: "#49665A",
        mutedText: "#608072",
        accent: "#6FA34E",
        accentGrad: "linear-gradient(135deg, #6FA34E 0%, #4D802E 100%)",
        accentLight: "#86BF62",
        cardBg: "#FFFFFF",
        cardBgElevated: "#FFFFFF",
        cardBorder: "#C9D8CD",
        cardBorderHover: "#A4C2AB",
        cardShadow: "0 10px 30px -5px rgba(22, 56, 45, 0.05), 0 4px 12px -2px rgba(22, 56, 45, 0.03)",
        cardShadowHover: "0 20px 40px -10px rgba(22, 56, 45, 0.1), 0 8px 16px -4px rgba(22, 56, 45, 0.05)",
        divider: "#C9D8CD",
        pillBg: "rgba(111, 163, 78, 0.12)",
        pillText: "#4E7B35",
        pillBorder: "rgba(111, 163, 78, 0.3)",
        headerBg: "rgba(244, 248, 243, 0.92)",
        headerBorder: "#C9D8CD",
        ctaBg: "#16382D",
        ctaText: "#FFFFFF",
        ctaBorder: "#16382D",
        ctaSecBg: "#FFFFFF",
        ctaSecText: "#16382D",
        ctaSecBorder: "#C9D8CD",
        stepNumBg: "rgba(111, 163, 78, 0.12)",
        stepNumText: "#4E7B35",
        accentGlow: "none",
        statGlow: "none",
        iconBoxGlow: "none",
        dotGlow: "0 0 6px #6FA34E",
      }
    : {
        // Vibrant Cyber-Emerald & Deep Obsidian Night Mode (High Contrast & Radiant Glow)
        bg: "#050B08",
        bgHeroGrad: "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(34, 197, 94, 0.22) 0%, rgba(13, 40, 29, 0.85) 50%, #050B08 100%)",
        bgSectionAlt: "#07130E",
        primaryText: "#FFFFFF",
        secondaryText: "#CBD5E1",
        mutedText: "#94A3B8",
        accent: "#4ADE80",
        accentGrad: "linear-gradient(135deg, #A7F3D0 0%, #4ADE80 45%, #A3E635 100%)",
        accentLight: "#86EFAC",
        cardBg: "linear-gradient(145deg, rgba(16, 42, 31, 0.85) 0%, rgba(9, 24, 18, 0.95) 100%)",
        cardBgElevated: "linear-gradient(145deg, rgba(22, 58, 43, 0.9) 0%, rgba(12, 32, 24, 0.95) 100%)",
        cardBorder: "rgba(74, 222, 128, 0.25)",
        cardBorderHover: "rgba(74, 222, 128, 0.65)",
        cardShadow: "0 16px 40px -10px rgba(0, 0, 0, 0.8), 0 0 25px rgba(74, 222, 128, 0.08)",
        cardShadowHover: "0 24px 55px -10px rgba(0, 0, 0, 0.9), 0 0 35px rgba(74, 222, 128, 0.25)",
        divider: "rgba(74, 222, 128, 0.2)",
        pillBg: "rgba(74, 222, 128, 0.12)",
        pillText: "#86EFAC",
        pillBorder: "rgba(74, 222, 128, 0.4)",
        headerBg: "rgba(5, 11, 8, 0.88)",
        headerBorder: "rgba(74, 222, 128, 0.2)",
        ctaBg: "linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)",
        ctaText: "#041409",
        ctaBorder: "#4ADE80",
        ctaSecBg: "rgba(16, 42, 31, 0.9)",
        ctaSecText: "#FFFFFF",
        ctaSecBorder: "rgba(74, 222, 128, 0.45)",
        stepNumBg: "rgba(74, 222, 128, 0.15)",
        stepNumText: "#4ADE80",
        accentGlow: "drop-shadow(0 0 22px rgba(74, 222, 128, 0.45))",
        statGlow: "drop-shadow(0 0 40px rgba(74, 222, 128, 0.6))",
        iconBoxGlow: "0 0 20px rgba(74, 222, 128, 0.25)",
        dotGlow: "0 0 10px #4ADE80",
      };

  const fontHeading = { fontFamily: "'Bricolage Grotesque', 'Plus Jakarta Sans', system-ui, sans-serif" };
  const fontBody = { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" };

  // Subtle Animation variants
  const fadeIn: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55 } }
  };

  const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.6 } }
  };

  return (
    <div
      className="min-h-screen transition-colors duration-300 relative overflow-hidden"
      style={{
        backgroundColor: colors.bg,
        color: colors.primaryText,
        ...fontBody,
      }}
    >
      {/* ============================================================== */}
      {/* 1. MENTORA HEADER (WITH ACTIVE "ABOUT" STATE & BACK NAVIGATION) */}
      {/* ============================================================== */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 sm:px-10 md:px-14 py-4 border-b backdrop-blur-2xl transition-all shadow-md"
        style={{
          borderColor: colors.headerBorder,
          backgroundColor: colors.headerBg,
        }}
      >
        {/* Brand Logo & Back indicator */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPage("landing")}
            className="bg-transparent border-0 p-0 cursor-pointer hover:opacity-95 transition-opacity flex items-center gap-2 group"
            title="Return to Mentora Home"
          >
            <img
              src={isLight ? mentoraLogoHorizontalLight : mentoraLogoHorizontalDark}
              alt="Mentora — Empowering Future Leaders"
              className="h-9 sm:h-10 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = isLight
                  ? "/mentora-logo-horizontal-light.png"
                  : "/mentora-logo-horizontal-dark.png";
              }}
            />
          </button>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
          <button
            onClick={() => setPage("landing")}
            className="transition-colors cursor-pointer"
            style={{ color: colors.secondaryText }}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.secondaryText)}
          >
            Home
          </button>

          <button
            onClick={() => {
              setPage("landing");
              setTimeout(() => {
                document.getElementById("stories")?.scrollIntoView({ behavior: "smooth" });
              }, 120);
            }}
            className="transition-colors cursor-pointer"
            style={{ color: colors.secondaryText }}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.secondaryText)}
          >
            Stories
          </button>

          {/* ACTIVE STATE FOR "ABOUT" ITEM */}
          <div className="relative py-1">
            <span
              className="font-bold cursor-default select-none transition-colors"
              style={{
                color: colors.accent,
                filter: !isLight ? "drop-shadow(0 0 10px rgba(74, 222, 128, 0.5))" : undefined,
              }}
            >
              About
            </span>
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all"
              style={{
                backgroundColor: colors.accent,
                boxShadow: !isLight ? "0 0 8px #4ADE80" : undefined,
              }}
            />
          </div>

          <button
            onClick={() => setPage("blogs")}
            className="transition-colors cursor-pointer"
            style={{ color: colors.secondaryText }}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.secondaryText)}
          >
            Blogs & Articles
          </button>
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {/* Quick "Back to Home" badge link on desktop */}
          <button
            onClick={() => setPage("landing")}
            className="hidden lg:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer hover:brightness-110 active:scale-95"
            style={{
              backgroundColor: colors.pillBg,
              borderColor: colors.pillBorder,
              color: colors.pillText,
            }}
            title="Return to Landing Page"
          >
            <ArrowLeft size={13} />
            <span>Back to Home</span>
          </button>

          {/* Theme Toggle */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-300 border select-none shadow-xs hover:brightness-110"
              style={{
                backgroundColor: isLight ? "#FFFFFF" : "rgba(16, 42, 31, 0.85)",
                borderColor: colors.cardBorder,
                color: colors.primaryText,
              }}
              title={isLight ? "Switch to Night Mode 🌙" : "Switch to Light Mode ☀️"}
            >
              {isLight ? (
                <>
                  <Sun size={13} className="text-amber-500 fill-amber-500/30" />
                  <span className="text-[11px] font-medium tracking-wide">Light</span>
                </>
              ) : (
                <>
                  <Moon size={13} className="text-[#4ADE80] fill-[#4ADE80]/30" />
                  <span className="text-[11px] font-medium tracking-wide">Dark</span>
                </>
              )}
            </button>
          )}

          {/* Auth / Portal Navigation Buttons */}
          {userRole ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setPage(userRole === "client" ? "client" : userRole === "expert" ? "expert" : "owner")
                }
                className="text-xs px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer shadow-md hover:brightness-110"
                style={{
                  background: colors.ctaBg,
                  color: colors.ctaText,
                }}
              >
                Go to {userRole === "client" ? "Client Portal" : userRole === "expert" ? "Expert Portal" : "Admin Desk"} →
              </button>
              {onLogout && (
                <button
                  onClick={() => {
                    if (window.confirm("Sign out of active account?")) {
                      onLogout();
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-bold border transition-all cursor-pointer text-rose-400 hover:text-rose-300 bg-rose-950/30 border-rose-800/50"
                  title="Sign out"
                >
                  <LogOut size={13} />
                </button>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => onOpenAuth("login")}
                className="text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer border hover:brightness-110"
                style={{
                  backgroundColor: "transparent",
                  borderColor: colors.cardBorder,
                  color: colors.primaryText,
                }}
              >
                Sign in
              </button>
              <button
                onClick={() => onOpenAuth("signup", "expert")}
                className="text-xs font-black px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md hover:brightness-110 active:scale-95"
                style={{
                  background: colors.ctaBg,
                  color: colors.ctaText,
                  boxShadow: !isLight ? "0 0 20px rgba(74, 222, 128, 0.35)" : undefined,
                }}
              >
                Register as expert
              </button>
            </div>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border transition-colors cursor-pointer"
            style={{
              borderColor: colors.cardBorder,
              backgroundColor: colors.cardBg,
              color: colors.primaryText,
            }}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Dropdown Navigation */}
      {mobileMenuOpen && (
        <div
          className="md:hidden border-b px-6 py-4 space-y-3 transition-all backdrop-blur-xl"
          style={{
            background: colors.cardBg,
            borderColor: colors.cardBorder,
          }}
        >
          <div className="flex flex-col space-y-2 text-sm font-semibold">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setPage("landing");
              }}
              className="flex items-center gap-2 py-2 text-left cursor-pointer transition-colors"
              style={{ color: colors.secondaryText }}
            >
              <ArrowLeft size={16} />
              <span>← Back to Home</span>
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setPage("landing");
                setTimeout(() => {
                  document.getElementById("stories")?.scrollIntoView({ behavior: "smooth" });
                }, 120);
              }}
              className="py-2 text-left cursor-pointer transition-colors"
              style={{ color: colors.secondaryText }}
            >
              Stories
            </button>

            <div
              className="py-2 text-left font-bold border-l-2 pl-3"
              style={{
                color: colors.accent,
                borderColor: colors.accent,
              }}
            >
              About Mentora (Active)
            </div>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setPage("blogs");
              }}
              className="py-2 text-left cursor-pointer transition-colors"
              style={{ color: colors.secondaryText }}
            >
              Blogs & Articles
            </button>
          </div>

          <div className="pt-3 border-t flex flex-col gap-2" style={{ borderColor: colors.divider }}>
            {!userRole && (
              <>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth("login");
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-center border cursor-pointer"
                  style={{
                    borderColor: colors.cardBorder,
                    color: colors.primaryText,
                    backgroundColor: colors.cardBgElevated,
                  }}
                >
                  Sign in
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth("signup", "expert");
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-black text-center cursor-pointer shadow-md"
                  style={{
                    background: colors.ctaBg,
                    color: colors.ctaText,
                  }}
                >
                  Register as expert
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. HERO SECTION */}
      {/* ============================================================== */}
      <section
        className="relative overflow-hidden pt-12 pb-18 sm:pt-16 sm:pb-24 px-6 sm:px-10 md:px-14 border-b"
        style={{
          background: colors.bgHeroGrad,
          borderColor: colors.divider,
        }}
      >
        {/* Luminous Ambient Glow Orbs in Dark Mode */}
        {!isLight && (
          <>
            <div
              className="absolute -top-32 right-1/4 w-[650px] h-[450px] rounded-full blur-[160px] pointer-events-none opacity-30"
              style={{ backgroundColor: "#22C55E" }}
            />
            <div
              className="absolute top-1/3 left-0 w-[500px] h-[400px] rounded-full blur-[180px] pointer-events-none opacity-25"
              style={{ backgroundColor: "#10B981" }}
            />
          </>
        )}

        <div className="max-w-6xl mx-auto relative z-10">
          {/* Breadcrumb / Back Navigation */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            className="mb-8"
          >
            <button
              onClick={() => setPage("landing")}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold px-4 py-1.5 rounded-full border transition-all cursor-pointer group hover:-translate-x-0.5 hover:brightness-110"
              style={{
                backgroundColor: colors.pillBg,
                borderColor: colors.pillBorder,
                color: colors.pillText,
              }}
            >
              <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
              <span>Back to Home</span>
            </button>
          </motion.div>

          {/* Hero Content Grid */}
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Column: Heading & Text */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeIn}
              className="lg:col-span-7 space-y-6"
            >
              {/* Small Label */}
              <div className="inline-flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase border shadow-xs"
                  style={{
                    backgroundColor: colors.pillBg,
                    borderColor: colors.pillBorder,
                    color: colors.pillText,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{
                      backgroundColor: colors.accent,
                      boxShadow: colors.dotGlow,
                    }}
                  />
                  ABOUT MENTORA
                </span>
              </div>

              {/* Main Heading */}
              <h1
                className="text-3xl sm:text-5xl lg:text-5xl xl:text-[3.5rem] font-black tracking-tight leading-[1.12]"
                style={{
                  ...fontHeading,
                  color: colors.primaryText,
                }}
              >
                Experience Doesn't Retire.{" "}
                <span
                  style={{
                    backgroundImage: !isLight ? colors.accentGrad : undefined,
                    color: isLight ? colors.accent : undefined,
                    WebkitBackgroundClip: !isLight ? "text" : undefined,
                    WebkitTextFillColor: !isLight ? "transparent" : undefined,
                    filter: colors.accentGlow,
                    display: "inline-block",
                  }}
                >
                  It Continues to Create Value.
                </span>
              </h1>

              {/* Supporting Text */}
              <p
                className="text-base sm:text-lg lg:text-xl font-normal leading-relaxed max-w-2xl"
                style={{ color: colors.secondaryText }}
              >
                Mentora connects experienced professionals with people, businesses, and organizations
                looking for practical knowledge, guidance, mentorship, and expertise.
              </p>

              {/* Quick Hero Value Points */}
              <div className="pt-2 flex flex-wrap gap-4 text-xs font-semibold">
                <div
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl border backdrop-blur-md"
                  style={{
                    background: colors.cardBg,
                    borderColor: colors.cardBorder,
                    color: colors.primaryText,
                    boxShadow: !isLight ? "0 4px 20px rgba(0, 0, 0, 0.4)" : undefined,
                  }}
                >
                  <ShieldCheck size={16} style={{ color: colors.accent }} />
                  <span>100% Verified Senior Backgrounds</span>
                </div>
                <div
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl border backdrop-blur-md"
                  style={{
                    background: colors.cardBg,
                    borderColor: colors.cardBorder,
                    color: colors.primaryText,
                    boxShadow: !isLight ? "0 4px 20px rgba(0, 0, 0, 0.4)" : undefined,
                  }}
                >
                  <BriefcaseBusiness size={16} style={{ color: colors.accent }} />
                  <span>Strategic & Project Advisory</span>
                </div>
              </div>
            </motion.div>

            {/* Right Column: Hero Visual Showcase */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={scaleIn}
              className="lg:col-span-5 relative"
            >
              <div
                className="relative rounded-3xl overflow-hidden border p-2.5 transition-all duration-300 group backdrop-blur-xl"
                style={{
                  background: colors.cardBg,
                  borderColor: colors.cardBorder,
                  boxShadow: colors.cardShadow,
                }}
              >
                {/* Visual Image */}
                <div className="relative rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-[16/11]">
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=900&auto=format&fit=crop&q=80"
                    alt="Senior professional mentor advising client"
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    loading="eager"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t"
                    style={{
                      backgroundImage: isLight
                        ? "linear-gradient(180deg, rgba(22, 56, 45, 0.05) 0%, rgba(22, 56, 45, 0.45) 100%)"
                        : "linear-gradient(180deg, rgba(5, 11, 8, 0.1) 0%, rgba(5, 11, 8, 0.75) 100%)",
                    }}
                  />
                  
                  {/* Floating Overlay Badge */}
                  <div
                    className="absolute bottom-4 left-4 right-4 p-3.5 rounded-xl backdrop-blur-md border flex items-center justify-between"
                    style={{
                      background: isLight ? "rgba(255, 255, 255, 0.92)" : "rgba(8, 22, 16, 0.92)",
                      borderColor: colors.cardBorder,
                      boxShadow: !isLight ? "0 8px 25px rgba(0,0,0,0.6)" : undefined,
                    }}
                  >
                    <div>
                      <p className="text-xs font-bold" style={{ color: colors.primaryText }}>
                        Silver Workforce Model
                      </p>
                      <p className="text-[11px]" style={{ color: colors.secondaryText }}>
                        Active Knowledge Transfer & Mentorship
                      </p>
                    </div>
                    <span
                      className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
                      style={{
                        backgroundColor: colors.pillBg,
                        color: colors.pillText,
                        border: `1px solid ${colors.pillBorder}`,
                      }}
                    >
                      30+ YRS EXP
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 3. OUR MISSION SECTION */}
      {/* ============================================================== */}
      <section
        className="py-20 sm:py-24 px-6 sm:px-10 md:px-14 relative"
        style={{
          backgroundColor: colors.bg,
        }}
      >
        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="space-y-4"
          >
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: colors.pillBg,
                color: colors.pillText,
                border: `1px solid ${colors.pillBorder}`,
              }}
            >
              PURPOSE & VISION
            </span>

            <h2
              className="text-3xl sm:text-4xl lg:text-4xl font-bold tracking-tight"
              style={{
                ...fontHeading,
                color: colors.primaryText,
              }}
            >
              Our Mission
            </h2>

            {/* Visually strong divider with radiant glow */}
            <div className="flex items-center justify-center gap-2 py-2">
              <span
                className="w-12 h-1 rounded-full"
                style={{
                  backgroundColor: colors.accent,
                  boxShadow: !isLight ? "0 0 10px rgba(74, 222, 128, 0.6)" : undefined,
                }}
              />
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: colors.accent,
                  boxShadow: !isLight ? "0 0 10px rgba(74, 222, 128, 0.7)" : undefined,
                }}
              />
              <span
                className="w-12 h-1 rounded-full"
                style={{
                  backgroundColor: colors.accent,
                  boxShadow: !isLight ? "0 0 10px rgba(74, 222, 128, 0.6)" : undefined,
                }}
              />
            </div>

            <p
              className="text-lg sm:text-xl lg:text-2xl font-medium leading-relaxed max-w-3xl mx-auto"
              style={{ color: colors.secondaryText }}
            >
              Mentora exists to make valuable professional experience more accessible.
              We help experienced professionals continue sharing what they know while
              giving clients access to practical guidance and specialized expertise.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 4. TWO FEATURE CARDS */}
      {/* ============================================================== */}
      <section
        className="py-18 sm:py-22 px-6 sm:px-10 md:px-14 border-t relative"
        style={{
          backgroundColor: colors.bgSectionAlt,
          borderColor: colors.divider,
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ ...fontHeading, color: colors.primaryText }}
            >
              Pillars of the Mentora Platform
            </h2>
            <p className="text-sm sm:text-base" style={{ color: colors.secondaryText }}>
              Designed around professional credibility, high-trust matchmaking, and sustainable advisory partnerships.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-10">
            {/* FEATURE 01: Verified Experience */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="rounded-3xl p-8 sm:p-10 border transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1.5 backdrop-blur-xl"
              style={{
                background: colors.cardBg,
                borderColor: colors.cardBorder,
                boxShadow: colors.cardShadow,
              }}
            >
              <div className="space-y-6">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-105"
                  style={{
                    backgroundColor: colors.pillBg,
                    borderColor: colors.pillBorder,
                    color: colors.accent,
                    boxShadow: colors.iconBoxGlow,
                  }}
                >
                  <BadgeCheck size={28} />
                </div>

                <div className="space-y-3">
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest font-mono"
                    style={{ color: colors.mutedText }}
                  >
                    FEATURE 01
                  </span>
                  <h3
                    className="text-2xl font-bold tracking-tight"
                    style={{ ...fontHeading, color: colors.primaryText }}
                  >
                    Verified Experience
                  </h3>
                  <p
                    className="text-sm sm:text-base leading-relaxed"
                    style={{ color: colors.secondaryText }}
                  >
                    Professionals can showcase their expertise and professional background,
                    helping clients discover experienced people they can trust.
                  </p>
                </div>
              </div>

              <div
                className="pt-6 mt-8 border-t flex items-center gap-3 text-xs font-semibold"
                style={{ borderColor: colors.divider, color: colors.mutedText }}
              >
                <ShieldCheck size={16} style={{ color: colors.accent }} />
                <span>Career dossiers, corporate credentials & verified tenure</span>
              </div>
            </motion.div>

            {/* FEATURE 02: Meaningful Connections */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              transition={{ delay: 0.15 }}
              className="rounded-3xl p-8 sm:p-10 border transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1.5 backdrop-blur-xl"
              style={{
                background: colors.cardBg,
                borderColor: colors.cardBorder,
                boxShadow: colors.cardShadow,
              }}
            >
              <div className="space-y-6">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-105"
                  style={{
                    backgroundColor: colors.pillBg,
                    borderColor: colors.pillBorder,
                    color: colors.accent,
                    boxShadow: colors.iconBoxGlow,
                  }}
                >
                  <Handshake size={28} />
                </div>

                <div className="space-y-3">
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest font-mono"
                    style={{ color: colors.mutedText }}
                  >
                    FEATURE 02
                  </span>
                  <h3
                    className="text-2xl font-bold tracking-tight"
                    style={{ ...fontHeading, color: colors.primaryText }}
                  >
                    Meaningful Connections
                  </h3>
                  <p
                    className="text-sm sm:text-base leading-relaxed"
                    style={{ color: colors.secondaryText }}
                  >
                    Clients can connect with experienced professionals for mentoring,
                    consulting, teaching, advisory work, and project-based support.
                  </p>
                </div>
              </div>

              <div
                className="pt-6 mt-8 border-t flex items-center gap-3 text-xs font-semibold"
                style={{ borderColor: colors.divider, color: colors.mutedText }}
              >
                <Users size={16} style={{ color: colors.accent }} />
                <span>One-on-one sessions, project reviews & long-term advisory</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 5. HOW MENTORA WORKS */}
      {/* ============================================================== */}
      <section
        className="py-20 sm:py-24 px-6 sm:px-10 md:px-14 border-t relative"
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.divider,
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: colors.pillBg,
                color: colors.pillText,
                border: `1px solid ${colors.pillBorder}`,
              }}
            >
              SIMPLE THREE-STEP PROCESS
            </span>
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              style={{ ...fontHeading, color: colors.primaryText }}
            >
              How Mentora Works
            </h2>
            <p className="text-sm sm:text-base leading-relaxed" style={{ color: colors.secondaryText }}>
              A frictionless pathway from discovering veteran expertise to actionable business outcomes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {/* Step 01 — Discover */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="rounded-3xl p-8 border transition-all duration-300 relative group hover:-translate-y-1.5 flex flex-col justify-between backdrop-blur-xl"
              style={{
                background: colors.cardBg,
                borderColor: colors.cardBorder,
                boxShadow: colors.cardShadow,
              }}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className="text-3xl sm:text-4xl font-black font-mono"
                    style={{
                      backgroundImage: !isLight ? colors.accentGrad : undefined,
                      color: isLight ? colors.accent : undefined,
                      WebkitBackgroundClip: !isLight ? "text" : undefined,
                      WebkitTextFillColor: !isLight ? "transparent" : undefined,
                      filter: !isLight ? "drop-shadow(0 0 12px rgba(74, 222, 128, 0.4))" : undefined,
                    }}
                  >
                    01
                  </span>
                  <span
                    className="p-2.5 rounded-xl border"
                    style={{
                      backgroundColor: colors.pillBg,
                      borderColor: colors.pillBorder,
                      color: colors.accent,
                    }}
                  >
                    <Search size={18} />
                  </span>
                </div>
                <h3
                  className="text-xl font-bold tracking-tight"
                  style={{ ...fontHeading, color: colors.primaryText }}
                >
                  Discover
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: colors.secondaryText }}>
                  Find experienced professionals based on expertise and your specific needs.
                </p>
              </div>

              <div
                className="mt-6 pt-4 border-t text-[11px] font-semibold"
                style={{ borderColor: colors.divider, color: colors.mutedText }}
              >
                Filtered by domain, years of tenure & advisory focus
              </div>
            </motion.div>

            {/* Step 02 — Connect */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              transition={{ delay: 0.12 }}
              className="rounded-3xl p-8 border transition-all duration-300 relative group hover:-translate-y-1.5 flex flex-col justify-between backdrop-blur-xl"
              style={{
                background: colors.cardBg,
                borderColor: colors.cardBorder,
                boxShadow: colors.cardShadow,
              }}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className="text-3xl sm:text-4xl font-black font-mono"
                    style={{
                      backgroundImage: !isLight ? colors.accentGrad : undefined,
                      color: isLight ? colors.accent : undefined,
                      WebkitBackgroundClip: !isLight ? "text" : undefined,
                      WebkitTextFillColor: !isLight ? "transparent" : undefined,
                      filter: !isLight ? "drop-shadow(0 0 12px rgba(74, 222, 128, 0.4))" : undefined,
                    }}
                  >
                    02
                  </span>
                  <span
                    className="p-2.5 rounded-xl border"
                    style={{
                      backgroundColor: colors.pillBg,
                      borderColor: colors.pillBorder,
                      color: colors.accent,
                    }}
                  >
                    <CalendarCheck size={18} />
                  </span>
                </div>
                <h3
                  className="text-xl font-bold tracking-tight"
                  style={{ ...fontHeading, color: colors.primaryText }}
                >
                  Connect
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: colors.secondaryText }}>
                  Choose the right professional and book a session or project.
                </p>
              </div>

              <div
                className="mt-6 pt-4 border-t text-[11px] font-semibold"
                style={{ borderColor: colors.divider, color: colors.mutedText }}
              >
                Direct calendar booking or authoritative project review
              </div>
            </motion.div>

            {/* Step 03 — Grow */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              transition={{ delay: 0.24 }}
              className="rounded-3xl p-8 border transition-all duration-300 relative group hover:-translate-y-1.5 flex flex-col justify-between backdrop-blur-xl"
              style={{
                background: colors.cardBg,
                borderColor: colors.cardBorder,
                boxShadow: colors.cardShadow,
              }}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className="text-3xl sm:text-4xl font-black font-mono"
                    style={{
                      backgroundImage: !isLight ? colors.accentGrad : undefined,
                      color: isLight ? colors.accent : undefined,
                      WebkitBackgroundClip: !isLight ? "text" : undefined,
                      WebkitTextFillColor: !isLight ? "transparent" : undefined,
                      filter: !isLight ? "drop-shadow(0 0 12px rgba(74, 222, 128, 0.4))" : undefined,
                    }}
                  >
                    03
                  </span>
                  <span
                    className="p-2.5 rounded-xl border"
                    style={{
                      backgroundColor: colors.pillBg,
                      borderColor: colors.pillBorder,
                      color: colors.accent,
                    }}
                  >
                    <TrendingUp size={18} />
                  </span>
                </div>
                <h3
                  className="text-xl font-bold tracking-tight"
                  style={{ ...fontHeading, color: colors.primaryText }}
                >
                  Grow
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: colors.secondaryText }}>
                  Gain practical knowledge, guidance, mentorship, and experience-based support.
                </p>
              </div>

              <div
                className="mt-6 pt-4 border-t text-[11px] font-semibold"
                style={{ borderColor: colors.divider, color: colors.mutedText }}
              >
                Direct board-level foresight & lasting strategic value
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 6. TRUST SECTION */}
      {/* ============================================================== */}
      <section
        className="py-20 sm:py-24 px-6 sm:px-10 md:px-14 border-t relative"
        style={{
          backgroundColor: colors.bgSectionAlt,
          borderColor: colors.divider,
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: colors.pillBg,
                color: colors.pillText,
                border: `1px solid ${colors.pillBorder}`,
              }}
            >
              CREDIBILITY FIRST
            </span>
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              style={{ ...fontHeading, color: colors.primaryText }}
            >
              Built Around Trust
            </h2>
            <p className="text-sm sm:text-base leading-relaxed" style={{ color: colors.secondaryText }}>
              Every feature on Mentora is engineered around authentic accountability, transparent evaluation, and security.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Trust Point 1 */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 backdrop-blur-xl"
              style={{
                background: colors.cardBg,
                borderColor: colors.cardBorder,
                boxShadow: colors.cardShadow,
              }}
            >
              <div className="flex items-center gap-3.5 mb-3">
                <div
                  className="p-2.5 rounded-xl border"
                  style={{
                    backgroundColor: colors.pillBg,
                    borderColor: colors.pillBorder,
                    color: colors.accent,
                    boxShadow: colors.iconBoxGlow,
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <h3 className="text-base font-bold" style={{ color: colors.primaryText }}>
                  Professional Verification
                </h3>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: colors.secondaryText }}>
                Multi-point verification of credentials, prior corporate designations, and career achievements.
              </p>
            </motion.div>

            {/* Trust Point 2 */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              transition={{ delay: 0.08 }}
              className="rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 backdrop-blur-xl"
              style={{
                background: colors.cardBg,
                borderColor: colors.cardBorder,
                boxShadow: colors.cardShadow,
              }}
            >
              <div className="flex items-center gap-3.5 mb-3">
                <div
                  className="p-2.5 rounded-xl border"
                  style={{
                    backgroundColor: colors.pillBg,
                    borderColor: colors.pillBorder,
                    color: colors.accent,
                    boxShadow: colors.iconBoxGlow,
                  }}
                >
                  <Star size={20} />
                </div>
                <h3 className="text-base font-bold" style={{ color: colors.primaryText }}>
                  Ratings & Reviews
                </h3>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: colors.secondaryText }}>
                Authentic feedback loops and star ratings posted solely by verified consultation clients.
              </p>
            </motion.div>

            {/* Trust Point 3 */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              transition={{ delay: 0.16 }}
              className="rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 backdrop-blur-xl"
              style={{
                background: colors.cardBg,
                borderColor: colors.cardBorder,
                boxShadow: colors.cardShadow,
              }}
            >
              <div className="flex items-center gap-3.5 mb-3">
                <div
                  className="p-2.5 rounded-xl border"
                  style={{
                    backgroundColor: colors.pillBg,
                    borderColor: colors.pillBorder,
                    color: colors.accent,
                    boxShadow: colors.iconBoxGlow,
                  }}
                >
                  <Award size={20} />
                </div>
                <h3 className="text-base font-bold" style={{ color: colors.primaryText }}>
                  Experience-Based Expertise
                </h3>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: colors.secondaryText }}>
                Rooted in 20 to 35+ years of practical leadership, battle-tested decisions, and operational nuance.
              </p>
            </motion.div>

            {/* Trust Point 4 */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              transition={{ delay: 0.24 }}
              className="rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 sm:col-span-1 lg:col-span-1 sm:col-start-1 lg:col-start-auto backdrop-blur-xl"
              style={{
                background: colors.cardBg,
                borderColor: colors.cardBorder,
                boxShadow: colors.cardShadow,
              }}
            >
              <div className="flex items-center gap-3.5 mb-3">
                <div
                  className="p-2.5 rounded-xl border"
                  style={{
                    backgroundColor: colors.pillBg,
                    borderColor: colors.pillBorder,
                    color: colors.accent,
                    boxShadow: colors.iconBoxGlow,
                  }}
                >
                  <FileCheck2 size={20} />
                </div>
                <h3 className="text-base font-bold" style={{ color: colors.primaryText }}>
                  Transparent Profiles
                </h3>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: colors.secondaryText }}>
                Clear, upfront pricing with comprehensive bios, executive background, and no hidden charges.
              </p>
            </motion.div>

            {/* Trust Point 5 */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              transition={{ delay: 0.32 }}
              className="rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 sm:col-span-1 lg:col-span-2 backdrop-blur-xl"
              style={{
                background: colors.cardBg,
                borderColor: colors.cardBorder,
                boxShadow: colors.cardShadow,
              }}
            >
              <div className="flex items-center gap-3.5 mb-3">
                <div
                  className="p-2.5 rounded-xl border"
                  style={{
                    backgroundColor: colors.pillBg,
                    borderColor: colors.pillBorder,
                    color: colors.accent,
                    boxShadow: colors.iconBoxGlow,
                  }}
                >
                  <Lock size={20} />
                </div>
                <h3 className="text-base font-bold" style={{ color: colors.primaryText }}>
                  Secure Digital Transactions
                </h3>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: colors.secondaryText }}>
                Encrypted payment gateways, milestone verification, and structured settlement workflows ensuring total peace of mind.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 7. MARKET / IMPACT STATISTIC */}
      {/* ============================================================== */}
      <section
        className="py-18 sm:py-24 px-6 sm:px-10 md:px-14 border-t relative overflow-hidden"
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.divider,
        }}
      >
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={scaleIn}
            className="rounded-3xl p-8 sm:p-14 border text-center relative overflow-hidden backdrop-blur-xl"
            style={{
              background: colors.cardBg,
              borderColor: colors.cardBorder,
              boxShadow: colors.cardShadow,
            }}
          >
            {/* Background accent glow */}
            <div
              className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full blur-[100px] pointer-events-none opacity-25"
              style={{ backgroundColor: colors.accent }}
            />

            <span
              className="text-[11px] font-bold uppercase tracking-widest font-mono"
              style={{ color: colors.mutedText }}
            >
              NATIONAL MARKET CONTEXT
            </span>

            {/* 120M+ Big Stat */}
            <div className="my-4">
              <span
                className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight"
                style={{
                  ...fontHeading,
                  backgroundImage: !isLight ? colors.accentGrad : undefined,
                  color: isLight ? colors.accent : undefined,
                  WebkitBackgroundClip: !isLight ? "text" : undefined,
                  WebkitTextFillColor: !isLight ? "transparent" : undefined,
                  filter: colors.statGlow,
                  display: "inline-block",
                }}
              >
                120M+
              </span>
            </div>

            <h3
              className="text-xl sm:text-2xl font-bold tracking-tight mb-4"
              style={{ color: colors.primaryText }}
            >
              Retired Professionals in India
            </h3>

            <p
              className="text-sm sm:text-base leading-relaxed max-w-2xl mx-auto"
              style={{ color: colors.secondaryText }}
            >
              India has a large pool of retired professionals with decades of
              experience, skills, and knowledge that can continue creating value.
            </p>

            <div
              className="mt-6 pt-6 border-t inline-flex items-center gap-2 text-xs font-semibold"
              style={{ borderColor: colors.divider, color: colors.mutedText }}
            >
              <Building2 size={14} style={{ color: colors.accent }} />
              <span>Demographic market perspective powering Mentora's Silver Workforce initiative</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 8. CALL TO ACTION (CTA) */}
      {/* ============================================================== */}
      <section
        className="py-20 sm:py-26 px-6 sm:px-10 md:px-14 border-t relative overflow-hidden"
        style={{
          background: isLight
            ? "linear-gradient(180deg, #EDF5ED 0%, #E3EFE3 100%)"
            : "linear-gradient(180deg, #07130E 0%, #030805 100%)",
          borderColor: colors.divider,
        }}
      >
        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="space-y-4"
          >
            <span
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase border shadow-xs"
              style={{
                backgroundColor: colors.pillBg,
                borderColor: colors.pillBorder,
                color: colors.pillText,
              }}
            >
              <Sparkles size={13} />
              JOIN THE REVOLUTION
            </span>

            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight"
              style={{ ...fontHeading, color: colors.primaryText }}
            >
              Ready to Turn Experience Into Opportunity?
            </h2>

            <p
              className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed"
              style={{ color: colors.secondaryText }}
            >
              Discover experienced professionals or share your expertise with the
              people and organizations that need it.
            </p>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2"
          >
            <button
              onClick={() => {
                setPage("landing");
              }}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-95 cursor-pointer"
              style={{
                background: colors.ctaBg,
                color: colors.ctaText,
                boxShadow: !isLight ? "0 0 35px rgba(74, 222, 128, 0.45)" : undefined,
              }}
            >
              <Search size={16} />
              <span>Explore Experts</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => onOpenAuth("signup", "expert")}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-sm border transition-all duration-300 flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 cursor-pointer"
              style={{
                backgroundColor: colors.ctaSecBg,
                borderColor: colors.ctaSecBorder,
                color: colors.ctaSecText,
              }}
            >
              <BriefcaseBusiness size={16} />
              <span>Become an Expert</span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 9. FOOTER */}
      {/* ============================================================== */}
      <footer
        className="px-6 sm:px-10 md:px-14 py-12 border-t flex flex-col md:flex-row justify-between items-center gap-6 text-xs transition-colors"
        style={{
          backgroundColor: isLight ? "#EBF3EA" : "#040806",
          borderColor: colors.divider,
          color: colors.secondaryText,
        }}
      >
        <div className="flex items-center gap-3">
          <img
            src={isLight ? mentoraLogoHorizontalLight : mentoraLogoHorizontalDark}
            alt="Mentora"
            className="h-8 w-auto object-contain cursor-pointer"
            onClick={() => setPage("landing")}
          />
          <span className="opacity-40">|</span>
          <span className="text-[11px]">Empowering Senior Wisdom & Enterprise Leadership</span>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <button
            onClick={() => setPage("landing")}
            className="hover:underline transition-all cursor-pointer font-semibold"
            style={{ color: colors.primaryText }}
          >
            ← Back to Home
          </button>
          <button
            onClick={() => onOpenAuth("signup", "client")}
            className="hover:underline transition-all cursor-pointer"
          >
            Find an Expert
          </button>
          <button
            onClick={() => onOpenAuth("signup", "expert")}
            className="hover:underline transition-all cursor-pointer"
          >
            Register as Expert
          </button>
          <button
            onClick={() => {
              window.location.href = "/?portal=admin";
            }}
            className="hover:underline transition-all cursor-pointer opacity-70 hover:opacity-100 flex items-center gap-1"
          >
            <Lock size={12} /> Executive Desk
          </button>
        </div>

        <p className="text-[11px] opacity-70">
          © {new Date().getFullYear()} Mentora Platform. All rights reserved.
        </p>
      </footer>
    </div>
  );
};
