import React, { useState, useRef, useEffect, useMemo } from "react";
import { ExpertAvailability } from "./types";
import * as THREE from "three";
import {
  Search, SlidersHorizontal, Star, ShieldCheck, Wallet, Bell, ChevronRight, ChevronLeft,
  Check, Clock, TrendingUp, Users, Briefcase, GraduationCap, ArrowUpRight,
  IndianRupee, X, Menu, UserCheck, CalendarDays, MessageSquare, Award, Building2,
  Sparkles, ChevronDown, Video, Mic, MicOff, VideoOff, Monitor, Send, PlayCircle, Plus,
  Share2, Copy, LogOut, Lock, Mail, User, Layers, Info, ExternalLink, Download, FileText,
  Edit3, Save, Phone, MapPin, Upload, FileCheck, Eye, EyeOff, DollarSign, Calculator, AlertCircle,
  Database, Bot, Zap, Filter, ArrowDown, UserX, Trash2, Sun, Moon, CheckCircle2, RefreshCw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, LineChart, Line, ResponsiveContainer, CartesianGrid, Tooltip
} from "recharts";
import confetti from "canvas-confetti";

import { supabase } from "./supabaseClient";
import { mongoDB, ExpertDoc, ExpertDocumentsRecord, ExpertDocumentItem, getDocFile } from "./mongoDBService";
import { DocumentViewerModal, DocumentViewerItem } from "./components/DocumentViewerModal";
import {
  ExpertDocType,
  ExpertDocumentItem as SupabaseExpertDoc,
  REQUIRED_DOC_TYPES,
  DOC_TYPE_META,
  validateDocumentFile,
  formatDocumentSize,
  cleanupLegacyExpertDocsLocalStorage,
  uploadSingleExpertDocument,
  fetchExpertDocuments,
  deleteExpertDocument,
  getDocumentSignedUrl
} from "./services/expertDocumentsService";
import { processRazorpayPayment } from "./services/razorpayService";
import { MetalButton } from "./components/ui/metal-button";
import { NotificationCenter } from "./components/NotificationCenter";
import { notificationService, NOTIFICATION_EVENT_NAME } from "./services/notificationService";
import { notificationEngine } from "./services/notificationEngine";
import { useDomains } from "./context/DomainsContext";
import { AdminGovernancePortal } from "./components/AdminGovernancePortal";
import { ExpertAvailabilityManager } from "./components/ExpertAvailabilityManager";
import { ProjectReviewRequestModal } from "./components/ProjectReviewRequestModal";
import { ProjectReviewWorkspace } from "./components/ProjectReviewWorkspace";
import { ProjectReviewRecord, ProjectReviewStatus } from "./types";
import { FeatureAccordionShowcase } from "./components/FeatureAccordionShowcase";
import { MentoraAboutPage } from "./components/MentoraAboutPage";
import { MentoraBlogsPage } from "./components/MentoraBlogsPage";
import { LandingBackgroundVideo } from "./components/LandingBackgroundVideo";
import { Footer } from "./components/Footer";
import { PremiumNavigationDock, NavItemConfig } from "./components/PremiumNavigationDock";
import { fetchExpertDynamicStats } from "./services/reviewService";
import { FlowWallpaper } from "./components/FlowWallpaper";
import { ExpertBackgroundVideo } from "./components/ExpertBackgroundVideo";
import { motion } from "framer-motion";
import { GlobalButtonMagnification } from "./components/GlobalButtonMagnification";
import {
  createConsultationBooking,
  fetchClientBookings,
  fetchExpertBookings,
  fetchAllBookingsForAdmin,
  updateBookingStatus,
  deleteBooking,
  subscribeToBookingsRealtime,
  normalizeBooking,
  broadcastBookingDecision,
  broadcastBookingUpdate,
  ConsultationBooking,
  isClientRoleDeleted,
  isExpertRoleDeleted,
  recordRoleDeleted
} from "./services/consultationBookingService";
import {
  fetchWalletBalance,
  depositWallet,
  deductWallet
} from "./services/walletService";

import mentoraLogoHorizontalLight from "./assets/mentora-logo-horizontal-light.png";
import mentoraLogoHorizontalDark from "./assets/mentora-logo-horizontal-dark.png";
import mentoraLogoLight from "./assets/mentora-logo-light.png";
import mentoraLogoDark from "./assets/mentora-logo-dark.png";
import mentoraSymbol from "./assets/mentora-symbol.png";
// Egress-safe polling helpers (skip ticks in hidden tabs, collapse event bursts)
import { startVisibleInterval, debounce } from "./lib/polling";
import { getExpertSlimByKey } from "./services/supabaseExpertiseService";
import { uploadAvatarImage } from "./lib/imageUpload";


/* ---------------------------------------------------------------
   Neo-Executive Cyber-Obsidian & Quantum Gold Design Tokens
---------------------------------------------------------------- */
const T = {
  // Deep Space & Obsidian Canvas
  void: "#05080E",
  surface: "#0B111A",
  surfaceElevated: "#111A27",
  surfaceGlass: "rgba(17, 26, 39, 0.75)",
  cardGlass: "rgba(13, 20, 32, 0.85)",
  cardGlassBorder: "rgba(255, 255, 255, 0.08)",
  
  // Quantum Cyber Gold & Luminescent Accents
  gold: "#F59E0B",
  goldLight: "#FCD34D",
  goldGlow: "rgba(245, 158, 11, 0.25)",
  cyan: "#06B6D4",
  cyanGlow: "rgba(6, 182, 212, 0.25)",
  emerald: "#10B981",
  emeraldLight: "#34D399",
  emeraldGlow: "rgba(16, 185, 129, 0.25)",
  rose: "#EF4444",

  // High-Contrast Modern Typography
  textPrimary: "#FFFFFF",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",

  // High-fidelity Backward Compatibility mappings for seamless rendering
  ink: "#0B111A",
  ink2: "#05080E",
  paper: "#06090E",
  parchment: "#0F1724",
  parchment2: "#141F30",
  brass: "#F59E0B",
  brassLight: "#FCD34D",
  moss: "#10B981",
  mossLight: "#34D399",
  rust: "#EF4444",
  cream: "#FFFFFF",
  line: "rgba(255, 255, 255, 0.08)",
  lineInk: "rgba(255, 255, 255, 0.12)",
  
  // Gradient Presets
  gradientGold: "linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #B45309 100%)",
  gradientGlass: "linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%)",
  gradientCard: "linear-gradient(145deg, rgba(17, 26, 39, 0.9) 0%, rgba(11, 17, 26, 0.95) 100%)",
};

const display = { fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700 };
const body = { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" };

const DEFAULT_AVATARS: Record<string, string> = {
  "exp-1": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
  "exp-2": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80",
  "exp-3": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
  "exp-4": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
  "exp-5": "https://images.unsplash.com/photo-1580894732413-80c749a0a033?w=300&auto=format&fit=crop&q=80",
  "exp-6": "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&auto=format&fit=crop&q=80",
};

function getExpertPhoto(exp: any): string {
  if (exp?.img && typeof exp.img === "string" && exp.img.trim().length > 10) return exp.img.trim();
  if (exp?.id && DEFAULT_AVATARS[exp.id]) return DEFAULT_AVATARS[exp.id];
  return "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80";
}

function handleImgError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  e.currentTarget.onerror = null;
  e.currentTarget.src = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80";
}

function sanitizeBookings(items: any[]): any[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((b) => 
      b && 
      b.id !== "sess-1" && 
      b.id !== "sess-2" && 
      b.id !== "book-101" && 
      b.id !== "book-102" &&
      b.topic !== "GST filing review" && 
      b.topic !== "Q3 marketing plan"
    )
    .map(b => {
      // Eliminate any legacy/test fallback link so client never retains mock links
      if (b && typeof b.meetUrl === "string" && b.meetUrl.includes("test-live-sync")) {
        const { meetUrl, meet_link, meeting_link, meetCode, ...clean } = b;
        return clean;
      }
      return b;
    });
}

const INITIAL_UPCOMING_CLIENT: any[] = [];

const INITIAL_REQUESTS_EXPERT = [
  { id: "req-1", client: "Northwind Retail Pvt Ltd", topic: "Inventory cost audit", when: "Fri, 2:00 PM", type: "Project" },
  { id: "req-2", client: "Rohan Bhatia", topic: "Career mentorship, 1 hour", when: "Sat, 10:00 AM", type: "Hourly" },
];

const EARNINGS_TREND = [
  { week: "W1", amount: 4200 }, { week: "W2", amount: 5100 }, { week: "W3", amount: 4700 }, { week: "W4", amount: 6300 },
];

const REVIEWS = [
  { from: "Priya S.", note: "Explained our tax exposure clearly, no jargon. Booked her again the same week.", stars: 5 },
  { from: "Northwind Retail", note: "Brought thirty years of shop-floor sense to a problem our own team was stuck on.", stars: 5 },
];

const REVENUE_STREAMS = [
  { name: "Platform Rate Markup", value: 412000 },
  { name: "Subscriptions (₹499/₹999)", value: 186000 },
  { name: "Corporate Partnerships", value: 265000 },
  { name: "Digital Training Upsell", value: 74000 },
  { name: "Sponsored Listings", value: 38000 },
];

const GROWTH = [
  { month: "Mar", professionals: 320, clients: 540 },
  { month: "Apr", professionals: 410, clients: 690 },
  { month: "May", professionals: 505, clients: 890 },
  { month: "Jun", professionals: 640, clients: 1120 },
  { month: "Jul", professionals: 790, clients: 1430 },
  { month: "Aug", professionals: 980, clients: 1810 },
];

const INITIAL_PENDING_VERIFICATION = [
  { 
    id: "ver-1", 
    name: "Deepak Nair", 
    field: "Civil Engineering", 
    years: 33, 
    applied: "2 days ago",
    company: "L&T Infrastructure Construction",
    role: "Chief Project Engineer",
    documents: {
      expCert: "LT_Construction_Experience_33yrs.pdf",
      offerLetter: "LT_Relieving_Letter_Offer.pdf",
      resume: "Deepak_Nair_Civil_CV.pdf"
    }
  },
  { 
    id: "ver-2", 
    name: "Lakshmi Pillai", 
    field: "Banking & Credit", 
    years: 30, 
    applied: "3 days ago",
    company: "State Bank of India (SBI)",
    role: "Chief General Manager Credit",
    documents: {
      expCert: "SBI_Service_Certificate_30yrs.pdf",
      offerLetter: "SBI_Executive_Appointment.pdf",
      resume: "Lakshmi_Pillai_Banking_CV.pdf"
    }
  },
  { 
    id: "ver-3", 
    name: "George Thomas", 
    field: "Textile Manufacturing", 
    years: 26, 
    applied: "5 days ago",
    company: "Arvind Mills Ltd",
    role: "VP Plant Operations",
    documents: {
      expCert: "Arvind_Mills_Ops_Cert.pdf",
      offerLetter: "Arvind_Relieving_Deed.pdf",
      resume: "George_Thomas_Textile_CV.pdf"
    }
  },
];

const TRANSACTIONS = [
  { id: "TXN-8841", desc: "Sunita Rao — GST review", amount: 750, cut: 150, expertPay: 600, date: "31 Aug" },
  { id: "TXN-8840", desc: "Meera Chatterjee — Strategy session", amount: 850, cut: 150, expertPay: 700, date: "31 Aug" },
  { id: "TXN-8839", desc: "Anjali Menon — Maths tuition ×4", amount: 1600, cut: 400, expertPay: 1200, date: "30 Aug" },
];

const TRAINING_COURSES = [
  { id: "tc-1", title: "Remote Workspace Mastery (Zoom & Slack)", price: 0, category: "Remote Tools", duration: "2 Hours" },
  { id: "tc-2", title: "AI Prompt Engineering for Advisory Reports", price: 399, category: "AI Productivity", duration: "3 Hours" },
  { id: "tc-3", title: "Effective Teleconsulting & Pitching for Executives", price: 299, category: "Communication", duration: "1.5 Hours" },
];

/* ---------------------------------------------------------------
   Shared Visual Components
---------------------------------------------------------------- */
function Logo({
  ink,
  theme = "dark",
  variant = "horizontal",
  className = "",
  size = "md",
}: {
  ink?: boolean;
  theme?: "dark" | "light";
  variant?: "horizontal" | "stacked" | "symbol";
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const isLight = ink || theme === "light";
  const src =
    variant === "symbol"
      ? mentoraSymbol
      : variant === "stacked"
      ? (isLight ? mentoraLogoLight : mentoraLogoDark)
      : (isLight ? mentoraLogoHorizontalLight : mentoraLogoHorizontalDark);

  const heightClass =
    size === "sm" ? "h-7 sm:h-8" :
    size === "lg" ? "h-12 sm:h-14" :
    "h-9 sm:h-10";

  return (
    <div className={`inline-flex items-center group select-none ${className}`}>
      <img
        src={src}
        alt="Mentora — Empowering Future Leaders"
        className={`${heightClass} w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]`}
        style={{
          filter: isLight 
            ? "drop-shadow(0 1px 2px rgba(0,0,0,0.06)) contrast(1.05) brightness(1.02)" 
            : "drop-shadow(0 2px 6px rgba(0,0,0,0.5)) contrast(1.05) brightness(1.03)",
        }}
        loading="eager"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = isLight ? "/mentora-logo-horizontal-light.png" : "/mentora-logo-horizontal-dark.png";
        }}
      />
    </div>
  );
}

function ThemeToggle({ theme = "dark", onToggle, className = "" }: { theme?: "dark" | "light"; onToggle?: () => void; className?: string }) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-300 border select-none ${
        isDark
          ? "bg-[#111A27] text-slate-200 border-white/15 hover:border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
          : "bg-white text-slate-700 border-slate-300 hover:border-amber-500 shadow-sm"
      } ${className}`}
      title={isDark ? "Switch to Light Mode ☀️" : "Switch to Dark Mode 🌙"}
      aria-label="Toggle Theme Mode"
    >
      {isDark ? (
        <>
          <Moon size={13} className="text-cyan-400 fill-cyan-400/30" />
          <span className="text-[11px] font-medium tracking-wide">Dark</span>
        </>
      ) : (
        <>
          <Sun size={13} className="text-amber-500 fill-amber-500/30" />
          <span className="text-[11px] font-medium tracking-wide">Light</span>
        </>
      )}
    </button>
  );
}

function Pill({ children, tone = "brass" }: { children: React.ReactNode; tone?: "brass" | "moss" | "rust" | "cyan" }) {
  const configs = {
    brass: { bg: "rgba(245, 158, 11, 0.12)", text: "#FCD34D", border: "rgba(245, 158, 11, 0.35)", dot: "#F59E0B" },
    moss: { bg: "rgba(16, 185, 129, 0.12)", text: "#6EE7B7", border: "rgba(16, 185, 129, 0.35)", dot: "#10B981" },
    rust: { bg: "rgba(239, 68, 68, 0.12)", text: "#FCA5A5", border: "rgba(239, 68, 68, 0.35)", dot: "#EF4444" },
    cyan: { bg: "rgba(6, 182, 212, 0.12)", text: "#67E8F9", border: "rgba(6, 182, 212, 0.35)", dot: "#06B6D4" },
  };
  const c = configs[tone] || configs.brass;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold backdrop-blur-md transition-all shadow-sm"
      style={{ ...body, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c.dot, boxShadow: `0 0 6px ${c.dot}` }}></span>
      {children}
    </span>
  );
}

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  const safeRating = Math.max(0, Math.min(5, Number(n) || 0));
  const isZero = safeRating === 0;

  return (
    <span className="inline-flex items-center gap-0.5" title={`${safeRating.toFixed(1)} / 5.0`}>
      {Array.from({ length: 5 }).map((_, i) => {
        if (isZero) {
          return (
            <Star
              key={i}
              size={size}
              fill="none"
              stroke="#64748B"
              strokeWidth={1.5}
              className="text-slate-500 opacity-60"
            />
          );
        }

        const fillAmount = Math.max(0, Math.min(1, safeRating - i));

        if (fillAmount >= 0.85) {
          return (
            <Star
              key={i}
              size={size}
              fill="#F59E0B"
              stroke="#F59E0B"
              strokeWidth={1.5}
              className="drop-shadow-[0_0_4px_rgba(245,158,11,0.4)] text-amber-500"
            />
          );
        } else if (fillAmount <= 0.15) {
          return (
            <Star
              key={i}
              size={size}
              fill="none"
              stroke="#64748B"
              strokeWidth={1.5}
              className="text-slate-500 opacity-60"
            />
          );
        } else {
          const fillPercent = Math.round(fillAmount * 100);
          return (
            <span key={i} className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
              <Star
                size={size}
                fill="none"
                stroke="#64748B"
                strokeWidth={1.5}
                className="text-slate-500 opacity-60 absolute inset-0"
              />
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fillPercent}%` }}
              >
                <Star
                  size={size}
                  fill="#F59E0B"
                  stroke="#F59E0B"
                  strokeWidth={1.5}
                  className="drop-shadow-[0_0_4px_rgba(245,158,11,0.4)] text-amber-500"
                />
              </span>
            </span>
          );
        }
      })}
    </span>
  );
}

function Button3D({ 
  children, 
  onClick, 
  type = "button", 
  variant = "brass", 
  size = "md", 
  full = false, 
  className = "", 
  disabled = false 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  type?: "button" | "submit" | "reset"; 
  variant?: "brass" | "ink" | "moss" | "ghost" | "ghostDark" | "rust"; 
  size?: "sm" | "md" | "lg"; 
  full?: boolean; 
  className?: string; 
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const [hover, setHover] = useState(false);

  const palette = {
    brass: {
      bg: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
      text: "#05080E",
      border: "1px solid rgba(254, 240, 138, 0.4)",
      glow: "0 0 20px rgba(245, 158, 11, 0.45)",
    },
    ink: {
      bg: "linear-gradient(135deg, #162232 0%, #0D1623 100%)",
      text: "#FFFFFF",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      glow: "0 4px 20px rgba(0, 0, 0, 0.6)",
    },
    moss: {
      bg: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
      text: "#FFFFFF",
      border: "1px solid rgba(110, 231, 183, 0.4)",
      glow: "0 0 18px rgba(16, 185, 129, 0.4)",
    },
    rust: {
      bg: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
      text: "#FFFFFF",
      border: "1px solid rgba(252, 165, 165, 0.4)",
      glow: "0 0 18px rgba(239, 68, 68, 0.4)",
    },
    ghost: {
      bg: "var(--btn-ghost-bg, rgba(255, 255, 255, 0.05))",
      text: "var(--btn-ghost-text, #F1F5F9)",
      border: "1px solid var(--btn-ghost-border, rgba(255, 255, 255, 0.14))",
      glow: "none",
    },
    ghostDark: {
      bg: "var(--btn-ghostdark-bg, rgba(245, 158, 11, 0.08))",
      text: "var(--btn-ghostdark-text, #FCD34D)",
      border: "1px solid var(--btn-ghostdark-border, rgba(245, 158, 11, 0.35))",
      glow: "0 0 15px rgba(245, 158, 11, 0.15)",
    },
  };
  const p = palette[variant] || palette.brass;
  const pad = size === "sm" ? "px-3 py-1.5 text-xs font-semibold" : size === "lg" ? "px-7 py-3.5 text-sm font-bold tracking-wide" : "px-5 py-2.5 text-sm font-semibold";

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={!disabled ? { scale: size === "lg" ? 1.04 : size === "sm" ? 1.08 : 1.06, y: -1.5 } : undefined}
      whileTap={!disabled ? { scale: 0.97, y: 0 } : undefined}
      transition={{ type: "spring", mass: 0.1, stiffness: 150, damping: 12 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      className={`relative inline-flex items-center justify-center gap-2 rounded-xl select-none transition-colors duration-200 cursor-pointer ${pad} ${full ? "w-full" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      style={{
        background: p.bg,
        color: p.text,
        border: p.border,
        boxShadow: hover && !disabled ? p.glow : "none",
        transformOrigin: "center center",
      }}
      data-dock-animated="true"
    >
      {children}
    </motion.button>
  );
}

/* ---------------------------------------------------------------
   THREE.JS 3D GRAPHICS COMPONENTS
---------------------------------------------------------------- */

function NetworkGraphic() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 400;
    let height = mount.clientHeight || 400;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const NODE_COUNT = 30;
    const radius = 2.3;
    const positions: THREE.Vector3[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const phi = Math.acos(-1 + (2 * i) / NODE_COUNT);
      const theta = Math.sqrt(NODE_COUNT * Math.PI) * phi;
      positions.push(
        new THREE.Vector3(
          radius * Math.cos(theta) * Math.sin(phi),
          radius * Math.sin(theta) * Math.sin(phi),
          radius * Math.cos(phi)
        )
      );
    }

    const brass = new THREE.Color("#F59E0B");
    const moss = new THREE.Color("#06B6D4");
    const nodeGeo = new THREE.SphereGeometry(0.065, 16, 16);
    const nodeMeshes: THREE.Mesh[] = [];
    positions.forEach((pos, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? moss : brass });
      const mesh = new THREE.Mesh(nodeGeo, mat);
      mesh.position.copy(pos);
      group.add(mesh);
      nodeMeshes.push(mesh);
    });

    const lineMat = new THREE.LineBasicMaterial({ color: "#06B6D4", transparent: true, opacity: 0.45 });
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        if (positions[i].distanceTo(positions[j]) < 1.35) {
          const geo = new THREE.BufferGeometry().setFromPoints([positions[i], positions[j]]);
          group.add(new THREE.Line(geo, lineMat));
        }
      }
    }

    let raf: number;
    const startTime = performance.now();
    const animate = () => {
      const t = (performance.now() - startTime) * 0.001;
      group.rotation.y = t * 0.22;
      group.rotation.x = Math.sin(t * 0.3) * 0.18;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!mount) return;
      width = mount.clientWidth || width;
      height = mount.clientHeight || height;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      nodeGeo.dispose();
      nodeMeshes.forEach((m) => (m.material as THREE.Material).dispose());
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}

function ParticleField({ count = 120, colorA = "#F59E0B", colorB = "#06B6D4" }: { count?: number; colorA?: string; colorB?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 400;
    let height = mount.clientHeight || 300;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 50);
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(count * 3);
    const colorArr = new Float32Array(count * 3);
    const cA = new THREE.Color(colorA);
    const cB = new THREE.Color(colorB);
    for (let i = 0; i < count; i++) {
      posArr[i * 3] = (Math.random() - 0.5) * 13;
      posArr[i * 3 + 1] = (Math.random() - 0.5) * 8;
      posArr[i * 3 + 2] = (Math.random() - 0.5) * 8;
      const c = Math.random() > 0.6 ? cB : cA;
      colorArr[i * 3] = c.r; colorArr[i * 3 + 1] = c.g; colorArr[i * 3 + 2] = c.b;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colorArr, 3));
    const mat = new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0.85 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    let mouseX = 0, mouseY = 0;
    const handleMouse = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) / rect.width - 0.5;
      mouseY = (e.clientY - rect.top) / rect.height - 0.5;
    };
    mount.addEventListener("mousemove", handleMouse);

    let raf: number;
    const startTime = performance.now();
    const animate = () => {
      const t = (performance.now() - startTime) * 0.001;
      points.rotation.y = t * 0.025 + mouseX * 0.3;
      points.rotation.x = mouseY * 0.2;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      width = mount.clientWidth || width;
      height = mount.clientHeight || height;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      mount.removeEventListener("mousemove", handleMouse);
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    };
  }, [count, colorA, colorB]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}

function GlobeGraphic() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 280;
    let height = mount.clientHeight || 180;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
    camera.position.z = 4.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const geo = new THREE.IcosahedronGeometry(1.6, 2);
    const mat = new THREE.MeshBasicMaterial({ color: "#F59E0B", wireframe: true, transparent: true, opacity: 0.55 });
    const globe = new THREE.Mesh(geo, mat);
    scene.add(globe);

    const coreGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: "#06B6D4", wireframe: true, transparent: true, opacity: 0.45 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    let raf: number;
    const startTime = performance.now();
    const animate = () => {
      const t = (performance.now() - startTime) * 0.001;
      globe.rotation.y = t * 0.18;
      core.rotation.y = -t * 0.25;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      geo.dispose();
      mat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}

function TrophyGraphic() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 240;
    let height = mount.clientHeight || 160;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const torusGeo = new THREE.TorusGeometry(1.2, 0.22, 16, 32);
    const torusMat = new THREE.MeshBasicMaterial({ color: "#F59E0B", wireframe: true, transparent: true, opacity: 0.7 });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    scene.add(torus);

    let raf: number;
    const startTime = performance.now();
    const animate = () => {
      const t = (performance.now() - startTime) * 0.001;
      torus.rotation.x = t * 0.3;
      torus.rotation.y = t * 0.4;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      torusGeo.dispose();
      torusMat.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}

function VaultGraphic() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 240;
    let height = mount.clientHeight || 160;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
    camera.position.z = 4.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const cubeGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const cubeMat = new THREE.MeshBasicMaterial({ color: "#06B6D4", wireframe: true, transparent: true, opacity: 0.7 });
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    scene.add(cube);

    let raf: number;
    const startTime = performance.now();
    const animate = () => {
      const t = (performance.now() - startTime) * 0.001;
      cube.rotation.x = t * 0.25;
      cube.rotation.y = t * 0.35;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      cubeGeo.dispose();
      cubeMat.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}

/* ---------------------------------------------------------------
   Scroll reveal wrapper
---------------------------------------------------------------- */
function Reveal({ children, delay = 0, className = "", style = {} }: { children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(26px)",
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------
   Prototype Bar with MongoDB Connection Status
---------------------------------------------------------------- */
function ProtoBar({ page, setPage, userRole, recipientId, onOpenMongoModal, theme = "dark", onToggleTheme, isAdminPortal, onLogout }: any) {
  const isLight = theme === "light";
  const tabs: NavItemConfig[] = [
    {
      id: "landing",
      label: "Home",
      shortLabel: "Home",
      ariaLabel: "Navigate to Landing Page",
    },
    {
      id: "client",
      label: "Client Portal",
      shortLabel: "Client",
      ariaLabel: "Navigate to Client Portal",
    },
    {
      id: "expert",
      label: "Expert Portal",
      shortLabel: "Expert",
      ariaLabel: "Navigate to Senior Expert Executive Portal",
    },
    {
      id: "login",
      label: userRole ? "Switch Account" : "Sign In / Register",
      shortLabel: userRole ? "Switch" : "Sign In",
      ariaLabel: userRole ? "Switch Account or Log In" : "Sign In or Register",
    },
  ];
  return (
    <div
      className={`w-full flex items-center justify-between gap-3 py-2 px-4 sm:px-6 sticky top-0 z-50 backdrop-blur-xl border-b shadow-2xl transition-colors duration-300 ${
        isLight ? "bg-white/90 border-slate-200" : "bg-[#05080E]/85 border-white/10"
      }`}
      style={{ ...body }}
    >
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span className="text-xs font-bold tracking-wide" style={{ color: isLight ? "#B45309" : "#FCD34D" }}>
            Mentora <span className="hidden lg:inline opacity-60 text-[10px] uppercase tracking-widest font-mono">Advisory Engine</span>
          </span>
        </div>

        {isAdminPortal ? (
          <span
            className="text-[11px] px-2.5 py-0.5 rounded-full font-medium hidden xl:flex items-center gap-1.5"
            style={{
              background: isLight ? "rgba(245, 158, 11, 0.12)" : "rgba(245, 158, 11, 0.15)",
              color: isLight ? "#B45309" : "#FCD34D",
              border: isLight ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid rgba(245, 158, 11, 0.35)"
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Active: <strong className="capitalize text-amber-500">
              {userRole === "expert" ? "Expert (Admin Portal)" : (userRole === "client" ? "Client (Admin Portal)" : "Admin Governance")}
            </strong>
          </span>
        ) : (userRole && userRole !== "admin" && (
          <span
            className="text-[11px] px-2.5 py-0.5 rounded-full font-medium hidden xl:flex items-center gap-1.5"
            style={{
              background: isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.06)",
              color: isLight ? "#0F172A" : "#FFFFFF",
              border: isLight ? "1px solid rgba(0, 0, 0, 0.1)" : "1px solid rgba(255, 255, 255, 0.12)"
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            Active: <strong className="capitalize text-amber-500">{userRole}</strong>
          </span>
        ))}


      </div>

      <div className="flex items-center gap-2">
        <PremiumNavigationDock
          activeTab={page}
          onSelectTab={setPage}
          items={tabs}
          isLight={isLight}
        />

        <div className={`ml-1 pl-2 border-l ${isLight ? "border-slate-300" : "border-white/15"}`}>
          <NotificationCenter role={userRole} recipientId={recipientId} darkTheme={!isLight} onNavigate={setPage} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   CHATGPT-STYLE INTELLIGENT AI ASSISTANT CHATBOT
   Ranked Strictly by: Highest Rating DESC & Lowest Price ASC
---------------------------------------------------------------- */
function AIChatbotWidget({ 
  userRole, 
  onBookExpert, 
  onViewDossier, 
  onRequireAuth,
  theme = "dark"
}: { 
  userRole: string | null; 
  onBookExpert: (exp: ExpertDoc) => void; 
  onViewDossier: (exp: ExpertDoc) => void;
  onRequireAuth: () => void;
  theme?: "dark" | "light";
}) {
  const isLight = theme === "light";
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ sender: "ai" | "user"; text: string; experts?: ExpertDoc[] }[]>([
    {
      sender: "ai",
      text: "Hello! I am your AI Advisory Assistant. Ask me any question (e.g. 'Need a tax expert for GST audit' or 'Looking for HR POSH compliance leader'). I search our MongoDB database and rank experts strictly by Highest Rating ⭐ and Lowest Price 💰!"
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userText = prompt;
    setPrompt("");
    setMessages(prev => [...prev, { sender: "user", text: userText }]);
    setLoading(true);

    setTimeout(async () => {
      // Query MongoDB Service with strict ranking: Highest Rating + Lowest Price
      const rankedExperts = await mongoDB.searchAndRankExperts(userText);
      setLoading(false);

      if (rankedExperts.length === 0) {
        setMessages(prev => [
          ...prev,
          {
            sender: "ai",
            text: `⚠️ Not Available in MongoDB Database: Currently, no verified expert is registered for "${userText}". Would you like our Admin Governance Desk to onboard a senior professional in this field?`,
            experts: []
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            sender: "ai",
            text: `I searched our live MongoDB database for "${userText}". Found ${rankedExperts.length} expert(s), ranked by Highest Rating ⭐ and Most Affordable Price 💰:`,
            experts: rankedExperts
          }
        ]);
      }
    }, 600);
  };

  const handleBook = (exp: ExpertDoc) => {
    if (!userRole) {
      alert("Registration Required: Please sign in or register your account first before booking an expert.");
      onRequireAuth();
    } else {
      onBookExpert(exp);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-full shadow-[0_0_25px_rgba(245,158,11,0.45)] flex items-center gap-2 font-bold cursor-pointer transition-all hover:scale-105 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border border-amber-300/40"
      >
        <Bot size={20} />
        <span className="text-xs uppercase tracking-wider font-extrabold hidden sm:inline">AI Expert Assistant</span>
      </button>

      {/* Chatbot Drawer Panel */}
      {isOpen && (
        <div
          className={`fixed bottom-20 right-6 z-50 w-full max-w-md h-[550px] rounded-2xl overflow-hidden flex flex-col shadow-2xl border transition-all ${
            isLight ? "bg-white border-slate-200 text-slate-900 shadow-2xl" : "border-white/15 bg-[#0B111A] text-white"
          }`}
          style={{ ...body }}
        >
          {/* Header */}
          <div className={`p-4 flex justify-between items-center border-b ${isLight ? "bg-slate-50 border-slate-100" : "border-white/10 bg-[#070C15]"}`}>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              <div>
                <p style={{ ...display }} className={`text-base font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Mentora AI Assistant</p>
                <p className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>Ranked by Highest Rating ⭐ & Lowest Price 💰</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className={`p-1.5 rounded-full cursor-pointer transition-colors ${
                isLight ? "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200" : "bg-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Body */}
          <div className={`flex-1 p-4 overflow-y-auto space-y-4 text-xs ${isLight ? "bg-slate-50/40" : "bg-[#0B111A]"}`}>
            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[88%] p-3.5 rounded-2xl leading-relaxed text-xs ${
                    m.sender === "user"
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-medium shadow-md"
                      : (isLight ? "bg-white text-slate-800 border border-slate-200 shadow-sm" : "bg-[#111A27] text-slate-200 border border-white/10")
                  }`}
                >
                  <p>{m.text}</p>
                </div>

                {/* Ranked Expert Response Cards */}
                {m.experts && m.experts.length > 0 && (
                  <div className="w-full mt-3 space-y-3">
                    <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      <Filter size={11} className="text-amber-500" /> Ranked Results (Highest Rating → Lowest Price)
                    </p>
                    {m.experts.map((exp, rankIdx) => (
                      <div key={exp.id} className={`p-3.5 rounded-xl border shadow-sm space-y-2.5 ${
                        isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#070C15] border-white/10 text-white"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                              isLight ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                            }`}>
                              #{rankIdx + 1}
                            </span>
                            <span className={`font-bold text-sm ${isLight ? "text-slate-900" : "text-white"}`}>{exp.name}</span>
                            {exp.verified && <ShieldCheck size={14} className={isLight ? "text-emerald-600" : "text-emerald-400"} />}
                          </div>
                          <span className={`font-bold text-xs font-mono ${isLight ? "text-amber-700" : "text-amber-400"}`}>₹{exp.rate}/hr</span>
                        </div>

                        <p className={`text-[11px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>{exp.title || exp.field} · {exp.years} Yrs Exp</p>

                        <div className="flex items-center justify-between text-[11px]">
                          <div className={`flex items-center gap-1 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                            <Stars n={exp.rating} />
                            <span className={`font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{exp.rating}</span>
                          </div>
                          <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>({exp.sessions} sessions)</span>
                        </div>

                        <div className="flex gap-1.5 pt-1">
                          <Button3D 
                            size="sm" 
                            variant="ghost" 
                            className={`flex-1 ${isLight ? "border-slate-200 text-slate-700 hover:bg-slate-100" : ""}`} 
                            onClick={() => onViewDossier(exp)}
                          >
                            Profile
                          </Button3D>
                          <Button3D size="sm" variant="brass" className="flex-1" onClick={() => handleBook(exp)}>
                            Book Session (₹{exp.rate})
                          </Button3D>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className={`flex items-center gap-2 font-medium italic text-xs ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span>Searching MongoDB Atlas and ranking experts...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Suggestions */}
          <div className={`px-3 py-2 border-t border-b flex gap-1.5 overflow-x-auto text-[10px] ${
            isLight ? "bg-slate-50 border-slate-200" : "bg-[#070C15] border-white/10"
          }`}>
            <button 
              onClick={() => setPrompt("Need GST tax audit expert")} 
              className={`px-2.5 py-1 rounded-lg cursor-pointer shrink-0 transition-colors border ${
                isLight 
                  ? "bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 shadow-sm" 
                  : "bg-white/[0.04] text-slate-300 border-white/10 hover:bg-amber-500/20 hover:text-amber-300"
              }`}
            >
              💡 "GST Tax Expert"
            </button>
            <button 
              onClick={() => setPrompt("POSH compliance HR leader")} 
              className={`px-2.5 py-1 rounded-lg cursor-pointer shrink-0 transition-colors border ${
                isLight 
                  ? "bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 shadow-sm" 
                  : "bg-white/[0.04] text-slate-300 border-white/10 hover:bg-amber-500/20 hover:text-amber-300"
              }`}
            >
              💡 "POSH HR Leader"
            </button>
            <button 
              onClick={() => setPrompt("School Maths teacher")} 
              className={`px-2.5 py-1 rounded-lg cursor-pointer shrink-0 transition-colors border ${
                isLight 
                  ? "bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 shadow-sm" 
                  : "bg-white/[0.04] text-slate-300 border-white/10 hover:bg-amber-500/20 hover:text-amber-300"
              }`}
            >
              💡 "Maths Teacher"
            </button>
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className={`p-3 flex gap-2 border-t ${isLight ? "bg-slate-50 border-slate-200" : "bg-[#070C15] border-white/10"}`}>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask anything (e.g. Need finance expert for audit)..."
              className={`flex-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                isLight 
                  ? "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 shadow-sm" 
                  : "bg-[#111A27] border-white/10 text-white placeholder-slate-500 focus:border-amber-500/60"
              }`}
            />
            <Button3D type="submit" size="sm" variant="brass">
              <Send size={14} />
            </Button3D>
          </form>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------
   MONGODB STATUS & ATLAS CONNECTION SETUP MODAL
---------------------------------------------------------------- */
function MongoDBSetupModal({ onClose }: { onClose: () => void }) {
  const [uri, setUri] = useState(mongoDB.getMongoUri());

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    mongoDB.setMongoUri(uri);
    alert("MongoDB Atlas Connection URI saved successfully! All platform collections synced.");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div className="w-full max-w-xl p-6 rounded-2xl shadow-2xl space-y-5 border border-white/15 backdrop-blur-2xl bg-[#0B111A] text-white" style={{ ...body }}>
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Database size={20} className="text-amber-400" />
            <span style={{ ...display }} className="text-xl font-bold text-white">MongoDB Atlas Connection & Schema Desk</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/10 text-slate-400 hover:text-white cursor-pointer"><X size={16} /></button>
        </div>

        <div className="p-3.5 rounded-xl text-xs flex items-center justify-between bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
          <span className="font-semibold flex items-center gap-1.5"><Check size={16} className="text-emerald-400" /> MongoDB Atlas Status: Active & Connected</span>
          <span className="font-mono text-[10px] bg-white/10 px-2 py-0.5 rounded border border-white/15 text-slate-200">db: silver_workforce</span>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">MongoDB Connection String (URI)</label>
            <input
              type="text"
              required
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              className="w-full mt-1.5 p-3 text-xs rounded-xl outline-none border border-white/10 bg-[#111A27] text-white font-mono focus:border-amber-500/60"
            />
          </div>

          <div className="space-y-2 text-xs text-slate-300 bg-[#070C15] p-3.5 rounded-xl border border-white/10">
            <p className="font-bold text-white">How to connect your own MongoDB Atlas Database:</p>
            <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-400">
              <li>Sign in to <a href="https://www.mongodb.com/cloud/atlas" target="_blank" rel="noreferrer" className="text-amber-400 underline font-bold">MongoDB Atlas Cloud</a>.</li>
              <li>Create a database cluster named <code className="bg-white/10 px-1 py-0.5 rounded text-amber-300 font-mono">silver_workforce</code>.</li>
              <li>Copy your Connection String: <code className="bg-white/10 px-1 py-0.5 rounded text-cyan-300 font-mono">mongodb+srv://&lt;username&gt;:&lt;password&gt;@cluster0.mongodb.net/silver_workforce</code>.</li>
              <li>Paste your URI above and click <strong>"Save Connection URI"</strong>.</li>
            </ol>
          </div>

          <Button3D full type="submit" variant="brass">
            <Save size={14} /> Save Connection URI
          </Button3D>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   ADMIN DOCUMENT INSPECTION MODAL (Document Audit Desk)
---------------------------------------------------------------- */
function AdminDocInspectionModal({ item, onClose, onApprove }: { item: any; onClose: () => void; onApprove: (id: string) => void }) {
  const [viewerDoc, setViewerDoc] = useState<DocumentViewerItem | null>(null);

  if (!item) return null;

  const expertDocsRecord = mongoDB.getExpertDocuments(item.id) ||
    (item.email ? mongoDB.getExpertDocuments(item.email) : null) ||
    (item.name ? mongoDB.getExpertDocuments(item.name) : null);
  const pendingItems = (item.documents as any)?.items;

  const findDirectBinary = (fn?: string, slot?: string) => {
    if (typeof window === "undefined") return undefined;
    try {
      if (fn) {
        const cleanFn = fn.toLowerCase().trim();
        const b = localStorage.getItem(`doc_bin_${cleanFn}`) || sessionStorage.getItem(`doc_bin_${cleanFn}`);
        if (b && (b.startsWith("data:") || b.startsWith("/uploaded_docs/"))) return b;
        return undefined;
      }
      if (slot && item?.id) {
        const b = localStorage.getItem(`doc_bin_${item.id}_${slot}`) || sessionStorage.getItem(`doc_bin_${item.id}_${slot}`);
        if (b && (b.startsWith("data:") || b.startsWith("/uploaded_docs/"))) return b;
      }
      if (slot && item?.name) {
        const cleanName = item.name.toLowerCase().trim();
        const b = localStorage.getItem(`doc_bin_${cleanName}_${slot}`) || sessionStorage.getItem(`doc_bin_${cleanName}_${slot}`);
        if (b && (b.startsWith("data:") || b.startsWith("/uploaded_docs/"))) return b;
      }
      if (slot && item?.email) {
        const cleanEmail = item.email.toLowerCase().trim();
        const b = localStorage.getItem(`doc_bin_${cleanEmail}_${slot}`) || sessionStorage.getItem(`doc_bin_${cleanEmail}_${slot}`);
        if (b && (b.startsWith("data:") || b.startsWith("/uploaded_docs/"))) return b;
      }
    } catch {}
    return undefined;
  };

  const expCertItem = expertDocsRecord?.docs?.expCert || pendingItems?.expCert;
  const offerLetterItem = expertDocsRecord?.docs?.offerLetter || pendingItems?.offerLetter;
  const resumeItem = expertDocsRecord?.docs?.resume || pendingItems?.resume;

  const docs = {
    expCert: expCertItem?.fileName || item.documents?.expCert || "Experience_Certificate.pdf",
    offerLetter: offerLetterItem?.fileName || item.documents?.offerLetter || "Company_Offer_Relieving_Letter.pdf",
    resume: resumeItem?.fileName || item.documents?.resume || "Executive_Bio_CV.pdf"
  };

  const handleOpenDoc = async (type: "expCert" | "offerLetter" | "resume", title: string, fileName: string) => {
    const docSlot = type === "expCert" ? expCertItem : (type === "offerLetter" ? offerLetterItem : resumeItem);
    const docId = docSlot?.id || `doc-${item.id}-${type}`;
    let fileData = docSlot?.fileData || findDirectBinary(fileName, type);

    // Direct static server check (authoritative file reference matching Expert Portal)
    if (fileName && (!fileData || !fileData.startsWith("data:"))) {
      try {
        const staticUrl = `/uploaded_docs/${encodeURIComponent(fileName)}`;
        const chk = await fetch(staticUrl, { method: "HEAD" });
        if (chk.ok) {
          fileData = staticUrl;
        }
      } catch {}
    }

    if (!fileData || (!fileData.startsWith("data:") && !fileData.startsWith("/") && !fileData.startsWith("http") && !fileData.startsWith("blob:"))) {
      fileData = (await getDocFile(docId, {
        id: docId,
        type,
        title,
        fileName,
        expertId: docSlot?.expertId || item.id,
        expertName: item.name,
        expertEmail: item.email,
        status: "Pending Audit"
      })) || undefined;
    }
    setViewerDoc({
      id: docId,
      title,
      fileName,
      fileSize: docSlot?.fileSize || "1.8 MB",
      fileData,
      uploadedAt: docSlot?.uploadedAt || item.applied,
      status: "Pending Audit",
      expertName: item.name,
      expertEmail: item.email,
      expertField: item.field
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <div className="w-full max-w-xl p-6 rounded-2xl shadow-2xl space-y-5 border border-white/15 backdrop-blur-2xl bg-[#0B111A] text-white" style={{ ...body }}>
          <div className="flex justify-between items-center pb-3 border-b border-white/10">
            <div>
              <span style={{ ...display }} className="text-xl font-bold text-white block">Document Verification Audit</span>
              <span className="text-xs text-slate-400">Applicant: {item.name} ({item.field} · {item.years} Years Experience)</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full bg-white/10 text-slate-400 hover:text-white cursor-pointer"><X size={16} /></button>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Uploaded Verification Proof PDF Documents</p>
            
            <div className="p-3.5 bg-[#111A27] border border-white/10 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText size={18} className="text-amber-400" />
                <div>
                  <p className="text-xs font-bold text-white">Work Experience & Tenure Certificate</p>
                  <p className="text-[11px] font-mono text-slate-400">{docs.expCert}</p>
                </div>
              </div>
              <button 
                onClick={() => handleOpenDoc("expCert", "Work Experience & Tenure Certificate", docs.expCert)} 
                className="text-xs font-bold text-amber-400 flex items-center gap-1 hover:text-amber-300 cursor-pointer"
                title="View Document"
              >
                <Eye size={13} /> View Document
              </button>
            </div>

            <div className="p-3.5 bg-[#111A27] border border-white/10 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileCheck size={18} className="text-emerald-400" />
                <div>
                  <p className="text-xs font-bold text-white">Company Offer Letter / Relieving Certificate</p>
                  <p className="text-[11px] font-mono text-slate-400">{docs.offerLetter}</p>
                </div>
              </div>
              <button 
                onClick={() => handleOpenDoc("offerLetter", "Company Offer Letter / Relieving Certificate", docs.offerLetter)} 
                className="text-xs font-bold text-amber-400 flex items-center gap-1 hover:text-amber-300 cursor-pointer"
                title="View Document"
              >
                <Eye size={13} /> View Document
              </button>
            </div>

            <div className="p-3.5 bg-[#111A27] border border-white/10 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText size={18} className="text-cyan-400" />
                <div>
                  <p className="text-xs font-bold text-white">Detailed Resume & Executive Dossier Bio</p>
                  <p className="text-[11px] font-mono text-slate-400">{docs.resume}</p>
                </div>
              </div>
              <button 
                onClick={() => handleOpenDoc("resume", "Detailed Resume & Executive Dossier Bio", docs.resume)} 
                className="text-xs font-bold text-amber-400 flex items-center gap-1 hover:text-amber-300 cursor-pointer"
                title="View Document"
              >
                <Eye size={13} /> View Document
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl text-xs space-y-1 bg-[#070C15] border border-white/10">
            <p className="font-semibold text-white">Audit Summary & Validity Check:</p>
            <p className="text-slate-400">Verified company tenure at {item.company || "Corporate Firm"} for {item.years} years. Verified valid for platform listing.</p>
          </div>

          <div className="flex gap-2 pt-2 border-t border-white/10">
            <Button3D full variant="moss" onClick={() => { onApprove(item.id); onClose(); }}>
              <Check size={14} /> Approve Documents & Grant Verified Badge
            </Button3D>
          </div>
        </div>
      </div>

      {viewerDoc && (
        <DocumentViewerModal
          document={viewerDoc}
          onClose={() => setViewerDoc(null)}
          theme="dark"
        />
      )}
    </>
  );
}

/* ---------------------------------------------------------------
   EDIT PROFILE MODALS
---------------------------------------------------------------- */

function EditClientProfileModal({ profile, onClose, onSave, theme = "dark" }: { profile: any; onClose: () => void; onSave: (p: any) => void; theme?: "dark" | "light" }) {
  const isLight = theme === "light";
  const [name, setName] = useState(profile?.name || "Vikramaditya Singh");
  const [company, setCompany] = useState(profile?.company || "Northwind Retail Pvt Ltd");
  const [email, setEmail] = useState(profile?.email || "vikram@northwindretail.com");
  const [phone, setPhone] = useState(profile?.phone || "+91 98123 45678");
  const [field, setField] = useState(profile?.field || "Retail & E-commerce");
  const [bio, setBio] = useState(profile?.bio || "Managing Director seeking advisory for GST compliance, supply chain optimization, and POSH audits.");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...profile,
      name,
      company,
      email,
      phone,
      field,
      bio,
      initials: name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    };
    onSave(updated);
    confetti({ particleCount: 50, spread: 50, origin: { y: 0.5 } });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div 
        className={`w-full max-w-md p-6 rounded-2xl shadow-2xl space-y-4 border backdrop-blur-2xl transition-all ${
          isLight ? "bg-white border-slate-200 text-slate-900 shadow-2xl" : "bg-[#0B111A] border-white/15 text-white"
        }`} 
        style={{ ...body }}
      >
        <div className={`flex justify-between items-center pb-3 border-b ${isLight ? "border-slate-100" : "border-white/10"}`}>
          <div className="flex items-center gap-2">
            <Edit3 size={18} className="text-amber-500" />
            <span style={{ ...display }} className={`text-xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Edit Client Profile Details</span>
          </div>
          <button 
            onClick={onClose} 
            className={`p-1.5 rounded-full cursor-pointer transition-colors ${
              isLight ? "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200" : "bg-white/10 text-slate-400 hover:text-white"
            }`}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                isLight 
                  ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                  : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
              }`}
            />
          </div>

          <div>
            <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Organization / Business Name</label>
            <input
              type="text"
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                isLight 
                  ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                  : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                  isLight 
                    ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                    : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
                }`}
              />
            </div>
            <div>
              <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Phone Number</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                  isLight 
                    ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                    : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Industry Domain</label>
            <input
              type="text"
              value={field}
              onChange={(e) => setField(e.target.value)}
              className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                isLight 
                  ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                  : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
              }`}
            />
          </div>

          <div>
            <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Organization Bio / Advisory Requirement</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                isLight 
                  ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                  : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
              }`}
            />
          </div>

          <Button3D full type="submit" variant="brass" className="mt-2">
            <Save size={14} /> Save Profile Changes
          </Button3D>
        </form>
      </div>
    </div>
  );
}

function EditExpertProfileModal({ profile, onClose, onSave, theme = "dark" }: { profile: any; onClose: () => void; onSave: (p: any) => void; theme?: "dark" | "light" }) {
  const isLight = theme === "light";
  const { domains, getDomainName } = useDomains();
  const availableFields = useMemo(() => domains.filter(d => d.is_active !== false).map(d => d.name), [domains]);
  const [name, setName] = useState(profile?.name || "Sunita Rao");
  const [title, setTitle] = useState(profile?.title || "Former Chief Financial Officer (Ex-CFO)");
  const [field, setField] = useState(profile?.field ? getDomainName(profile.field) : (availableFields[0] || "Finance & Taxation"));
  const [years, setYears] = useState(profile?.years || 34);

  useEffect(() => {
    if (availableFields.length > 0 && !availableFields.includes(field)) {
      setField(availableFields[0]);
    }
  }, [availableFields, field]);
  const [baseRate, setBaseRate] = useState(profile?.baseRate || 600);
  const [projectRate, setProjectRate] = useState(typeof profile?.projectRate === "number" ? profile.projectRate : 1000);
  const [email, setEmail] = useState(profile?.email || "sunita.rao@registry.com");
  const [phone, setPhone] = useState(profile?.phone || "+91 98765 43210");
  const [bio, setBio] = useState(profile?.bio || "Ex-CFO with 34 years in corporate tax audits, ESOP design, valuation readiness, and M&A compliance.");
  const [img, setImg] = useState(profile?.img || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80");
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [imgUploadError, setImgUploadError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Don't save while the photo is still uploading (the preview URL is only temporary).
    if (isUploadingImg) {
      alert("Please wait — your photo is still uploading.");
      return;
    }
    const updated = {
      ...profile,
      name,
      title,
      field,
      years,
      baseRate,
      projectRate: Math.max(0, Math.min(2000, Number(projectRate) || 0)),
      rate: baseRate + (profile?.adminMarkup || 150),
      email,
      phone,
      bio,
      img,
      initials: name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    };
    onSave(updated);
    confetti({ particleCount: 50, spread: 50, origin: { y: 0.5 } });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div 
        className={`w-full max-w-lg p-6 rounded-2xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border backdrop-blur-2xl transition-all ${
          isLight ? "bg-white border-slate-200 text-slate-900 shadow-2xl" : "bg-[#0B111A] border-white/15 text-white"
        }`} 
        style={{ ...body }}
      >
        <div className={`flex justify-between items-center pb-3 border-b ${isLight ? "border-slate-100" : "border-white/10"}`}>
          <div className="flex items-center gap-2">
            <Edit3 size={18} className="text-amber-500" />
            <span style={{ ...display }} className={`text-xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Edit Senior Professional Profile</span>
          </div>
          <button 
            onClick={onClose} 
            className={`p-1.5 rounded-full cursor-pointer transition-colors ${
              isLight ? "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200" : "bg-white/10 text-slate-400 hover:text-white"
            }`}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Profile Photo Upload Field */}
          <div>
            <label className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-600" : "text-slate-400"}`}>Executive Profile Photo (Upload or Paste Image URL)</label>
            <div className="flex items-center gap-3 mt-1.5">
              {img ? (
                <img src={img} alt={name} className="w-12 h-12 rounded-xl object-cover border-2 border-amber-400/80 shadow-md shrink-0" />
              ) : (
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                  isLight ? "bg-slate-100 text-amber-700 border-slate-200" : "bg-slate-800 text-amber-300 border-white/10"
                }`}>
                  {(name || "SR").slice(0, 2)}
                </div>
              )}
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={img}
                  onChange={(e) => setImg(e.target.value)}
                  placeholder="Paste image URL (https://...)"
                  className={`flex-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                    isLight 
                      ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                      : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
                  }`}
                />
                <label className={`px-3 py-2 text-xs rounded-xl font-semibold border cursor-pointer flex items-center gap-1 shrink-0 transition-colors ${
                  isLight 
                    ? "border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800" 
                    : "border-white/15 bg-white/10 hover:bg-white/15 text-white"
                }`}>
                  <Upload size={13} />
                  <span>Browse</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isUploadingImg}
                    onChange={async (e) => {
                      // EGRESS FIX: the photo used to be saved as a full-size base64 string inside
                      // the experts table. Now it is resized to WebP in the browser, uploaded to
                      // Supabase Storage, and only the short URL is saved.
                      const file = e.target.files?.[0];
                      e.target.value = ""; // allow choosing the same file again
                      if (!file) return;
                      const previous = img;
                      const preview = URL.createObjectURL(file);
                      setImg(preview); // instant preview while uploading
                      setIsUploadingImg(true);
                      setImgUploadError(null);
                      try {
                        const url = await uploadAvatarImage(file, profile?.id || profile?.email || email || "expert");
                        setImg(url);
                      } catch (err: any) {
                        setImg(previous);
                        setImgUploadError(err?.message || "Photo upload failed. Please try again.");
                      } finally {
                        URL.revokeObjectURL(preview);
                        setIsUploadingImg(false);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <p className={`text-[10px] mt-1 ${isLight ? "text-slate-500" : "text-slate-500"}`}>Upload your professional headshot image to showcase on the Mentora landing page.</p>
            {isUploadingImg && <p className="text-[10px] mt-1 text-amber-500">Optimising and uploading photo…</p>}
            {imgUploadError && <p role="alert" className="text-[10px] mt-1 text-red-500">❌ {imgUploadError}</p>}
          </div>

          <div>
            <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                isLight 
                  ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                  : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
              }`}
            />
          </div>

          <div>
            <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Professional Executive Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Former Chief Financial Officer (Ex-CFO)"
              className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                isLight 
                  ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                  : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Expertise Domain Field</label>
              <select
                value={field}
                onChange={(e) => setField(e.target.value)}
                className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border cursor-pointer transition-colors ${
                  isLight 
                    ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                    : "bg-[#111A27] border-white/10 text-white"
                }`}
              >
                {availableFields.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Demanded Expert Base Rate (₹/hr)</label>
              <input
                type="number"
                min={0}
                max={1000}
                required
                value={baseRate}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setBaseRate(0);
                    return;
                  }
                  const num = Number(raw);
                  if (num > 1000) setBaseRate(1000);
                  else if (num < 0) setBaseRate(0);
                  else setBaseRate(num);
                }}
                className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border font-bold font-mono transition-colors ${
                  isLight 
                    ? "bg-slate-50 border-slate-200 text-amber-700 focus:bg-white focus:border-amber-500" 
                    : "bg-[#111A27] border-white/10 text-amber-400 focus:border-amber-500/60"
                }`}
              />
            </div>
          </div>


          <div>
            <label className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Project Review Rate (₹0 to ₹2,000)
            </label>
            <input
              type="number"
              min={0}
              max={2000}
              required
              value={projectRate}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setProjectRate(0);
                  return;
                }
                const num = Number(raw);
                if (num > 2000) setProjectRate(2000);
                else if (num < 0) setProjectRate(0);
                else setProjectRate(num);
              }}
              className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border font-bold font-mono transition-colors ${
                isLight 
                  ? "bg-slate-50 border-slate-200 text-cyan-700 focus:bg-white focus:border-cyan-500" 
                  : "bg-[#111A27] border-white/10 text-cyan-400 focus:border-cyan-500/60"
              }`}
            />
            <p className="text-[10px] mt-0.5 text-slate-400">Authoritative Project Review price synchronized across Client, Expert & Admin.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Years Experience</label>
              <input
                type="number"
                required
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                  isLight 
                    ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                    : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
                }`}
              />
            </div>

            <div>
              <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Phone Number</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                  isLight 
                    ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                    : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                isLight 
                  ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                  : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
              }`}
            />
          </div>

          <div>
            <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Executive Dossier Overview / Bio</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={`w-full mt-1 px-3 py-2 text-xs rounded-xl outline-none border transition-colors ${
                isLight 
                  ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                  : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
              }`}
            />
          </div>

          <Button3D full type="submit" variant="brass" className="mt-2">
            <Save size={14} /> Save Profile Changes
          </Button3D>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   EXPERT FULL PROFILE MODAL (Detailed Executive Dossier)
---------------------------------------------------------------- */
function ExpertProfileModal({ expert, onClose, onBook, theme = "dark" }: { expert: any; onClose: () => void; onBook: (e: any) => void; theme?: "dark" | "light" }) {
  if (!expert) return null;
  const isLight = theme === "light";
  const { getDomainName } = useDomains();
  const domainName = getDomainName(expert);

  const [liveStats, setLiveStats] = useState<{
    avgRating: number;
    reviewCount: number;
    completedConsultations: number;
  }>({
    avgRating: Number(expert.rating) || 0.0,
    reviewCount: Number(expert.reviewCount) || 0,
    completedConsultations: Number(expert.sessions ?? expert.total_sessions ?? expert.completedSessions) || 0
  });

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      try {
        const stats = await fetchExpertDynamicStats(expert);
        if (isMounted) {
          setLiveStats(stats);
        }
      } catch {}
    };

    loadStats();

    const handleUpdate = () => {
      loadStats();
    };

    window.addEventListener("app_platform_reviews_updated", handleUpdate);
    window.addEventListener("mongo_kv_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("app_platform_reviews_updated", handleUpdate);
      window.removeEventListener("mongo_kv_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [expert.id, expert.email, expert.name]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div 
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl space-y-6 p-7 border transition-all ${
          isLight ? "bg-white border-slate-200 text-slate-900 shadow-2xl" : "bg-[#0B111A] border-white/15 text-white"
        }`} 
        style={{ ...body }}
      >
        
        {/* Header */}
        <div className={`flex items-start justify-between pb-5 border-b ${isLight ? "border-slate-100" : "border-white/10"}`}>
          <div className="flex gap-4 items-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 bg-gradient-to-tr from-amber-500 to-amber-700 text-slate-950 shadow-md">
              {expert.initials || expert.name?.slice(0, 2).toUpperCase() || "EX"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 style={{ ...display }} className={`text-2xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{expert.name}</h2>
                {expert.verified ? (
                  <span title="Verified Professional History" className="flex items-center gap-1 text-emerald-500">
                    <ShieldCheck size={18} />
                    <span className="text-[11px] font-bold">Verified Pro</span>
                  </span>
                ) : (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    isLight ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  }`} title="Profile verification pending Admin Governance audit">
                    <Clock size={11} /> Verification Pending
                  </span>
                )}
              </div>
              <p className={`text-xs font-bold mt-0.5 ${isLight ? "text-amber-700" : "text-amber-400"}`}>{expert.title || domainName || "Executive Advisor"}</p>
              <p className={`text-xs mt-0.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                {expert.years && Number(expert.years) > 0 
                  ? `${expert.years} Years Executive Experience` 
                  : "Executive experience: Not provided yet"} · {domainName || "Advisory"}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            aria-label="Close Dossier"
            title="Close Dossier"
            className={`p-1.5 rounded-full cursor-pointer transition-colors ${
              isLight ? "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200" : "bg-white/10 text-slate-400 hover:text-white"
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Bio & Ratings */}
        <div className="space-y-3">
          <div className={`flex items-center justify-between text-xs p-3.5 rounded-xl border ${
            isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-[#111A27] border-white/10 text-slate-300"
          }`}>
            <div className="flex flex-wrap items-center gap-2">
              <Stars n={liveStats.avgRating} size={14} />
              <span className={`font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                {liveStats.avgRating.toFixed(1)} / 5.0 Rating
              </span>

              {liveStats.reviewCount === 0 ? (
                <>
                  <span className={isLight ? "text-slate-500" : "text-slate-400"}>
                    ({liveStats.completedConsultations} Consultations Completed)
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                    isLight ? "bg-slate-200/70 text-slate-600 border-slate-300" : "bg-slate-800/80 text-slate-400 border-slate-700/60"
                  }`}>
                    New Expert – No reviews yet
                  </span>
                </>
              ) : (
                <span className={isLight ? "text-slate-500" : "text-slate-400"}>
                  ({liveStats.reviewCount} {liveStats.reviewCount === 1 ? "Review" : "Reviews"}, {liveStats.completedConsultations} Consultation{liveStats.completedConsultations === 1 ? "" : "s"} Completed)
                </span>
              )}
            </div>
            <div className={`font-bold text-base font-mono shrink-0 ${isLight ? "text-amber-700" : "text-amber-400"}`}>
              ₹{expert.rate || expert.baseRate || 0} <span className={`text-xs font-normal ${isLight ? "text-slate-500" : "text-slate-400"}`}>/ hr</span>
            </div>
          </div>

          <p className={`text-sm leading-relaxed ${isLight ? "text-slate-700" : "text-slate-300"}`}>
            {(() => {
              const bioText = (expert.bio || '').trim();
              if (!bioText || bioText.toLowerCase() === 'decades of executive expertise.' || bioText.toLowerCase() === 'executive expertise.') {
                return <span className={`italic ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Executive bio not provided yet.</span>;
              }
              return bioText;
            })()}
          </p>
        </div>

        {/* Core Expertise Skills */}
        <div className="space-y-2.5">
          <p className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Specialized Competencies</p>
          <div className="flex flex-wrap gap-2">
            {expert.skills && expert.skills.length > 0 ? expert.skills.map((s: string, idx: number) => (
              <span key={idx} className={`text-xs px-3 py-1 rounded-full font-medium border ${
                isLight ? "bg-slate-100 text-slate-700 border-slate-200" : "bg-white/[0.04] text-slate-300 border-white/10"
              }`}>
                {s}
              </span>
            )) : (
              <div className="flex items-center gap-2">
                <span className={`text-xs px-3 py-1 rounded-full font-medium border ${
                  isLight ? "bg-slate-100 text-slate-700 border-slate-200" : "bg-white/[0.04] text-slate-300 border-white/10"
                }`}>{domainName || "Advisory"}</span>
                <span className={`text-xs italic ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  (Additional competencies not provided yet)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Executive Work History */}
        <div className="space-y-3">
          <p className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Executive Work History & Leadership</p>
          <div className="space-y-2">
            {expert.experience && expert.experience.length > 0 ? expert.experience.map((exp: any, idx: number) => (
              <div key={idx} className={`p-3.5 rounded-xl border flex justify-between items-center ${
                isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-[#111A27] border-white/10 text-white"
              }`}>
                <div>
                  <p className={`text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{exp.role}</p>
                  <p className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>{exp.company}</p>
                </div>
                <span className={`text-xs font-mono font-bold ${isLight ? "text-amber-700" : "text-amber-400"}`}>{exp.period}</span>
              </div>
            )) : (
              <div className={`p-3.5 rounded-xl border text-xs ${
                isLight ? "bg-slate-50 border-slate-200 text-slate-500" : "bg-[#111A27] border-white/10 text-slate-400"
              }`}>
                <p className="italic">Work history and leadership background not provided yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Action CTAs */}
        <div className={`pt-4 border-t flex items-center justify-between gap-3 ${isLight ? "border-slate-100" : "border-white/10"}`}>
          <button
            onClick={() => alert(`Simulated PDF Download: Verified Dossier for ${expert.name}.pdf`)}
            className={`text-xs px-4 py-2.5 rounded-xl border font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              isLight ? "border-slate-200 text-slate-700 hover:bg-slate-100" : "border-white/15 text-slate-300 hover:text-white hover:bg-white/10"
            }`}
          >
            <Download size={14} /> Download Dossier PDF
          </button>

          <div className="flex gap-2">
            <Button3D 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className={isLight ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100" : ""}
            >
              Close Dossier
            </Button3D>
            <Button3D variant="brass" size="sm" onClick={() => { onClose(); onBook(expert); }}>
              Book Advisory Call (₹{expert.rate || expert.baseRate || 0}/hr)
            </Button3D>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   ADMIN MEETING & SESSION OPS REAL-TIME SYNCHRONIZER
---------------------------------------------------------------- */

export const syncSessionToAdminOps = (sessionItem: {
  id: string;
  client?: string;
  clientEmail?: string;
  expert?: string;
  expertEmail?: string;
  topic?: string;
  when?: string;
  type?: string;
  rate?: number;
  payout?: number;
  status?: string;
  isLive?: boolean;
  completed?: boolean;
  completedAt?: string;
  meetUrl?: string;
  meet_link?: string;
  meeting_link?: string;
  meeting_link_sent_at?: string;
  meetCode?: string;
  reviewed?: boolean;
  payoutTransferred?: boolean;
}) => {
  try {
    const raw = localStorage.getItem("app_platform_sessions");
    const list: any[] = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) {
      const idx = list.findIndex((s: any) => s && s.id === sessionItem.id);
      let updated: any[];
      if (idx >= 0) {
        const existing = list[idx];
        const merged = {
          ...existing,
          ...sessionItem,
          client: sessionItem.client || existing.client || "Client ABC",
          clientEmail: sessionItem.clientEmail || existing.clientEmail || "client@company.com",
          expert: sessionItem.expert || existing.expert || "Senior Expert",
          expertEmail: sessionItem.expertEmail || existing.expertEmail || "",
          meetUrl: sessionItem.meetUrl !== undefined ? sessionItem.meetUrl : (existing.meetUrl || ""),
          meetCode: sessionItem.meetCode !== undefined ? sessionItem.meetCode : (existing.meetCode || "")
        };
        updated = [...list];
        updated[idx] = merged;
      } else {
        const newItem = {
          id: sessionItem.id,
          client: sessionItem.client || "Client ABC",
          clientEmail: sessionItem.clientEmail || "client@company.com",
          expert: sessionItem.expert || "Senior Expert",
          expertEmail: sessionItem.expertEmail || "",
          topic: sessionItem.topic || "Executive Advisory Consultation",
          when: sessionItem.when || "Scheduled Time",
          type: sessionItem.type || "Hourly Consultation",
          rate: sessionItem.rate || 600,
          payout: sessionItem.payout || Math.round((sessionItem.rate || 600) * 0.85),
          status: sessionItem.status || "Pending Expert Acceptance",
          isLive: sessionItem.isLive || false,
          completed: sessionItem.completed || false,
          completedAt: sessionItem.completedAt || "",
          meetUrl: sessionItem.meetUrl || "",
          meetCode: sessionItem.meetCode || "",
          reviewed: sessionItem.reviewed || false,
          payoutTransferred: sessionItem.payoutTransferred || false
        };
        updated = [newItem, ...list];
      }
      localStorage.setItem("app_platform_sessions", JSON.stringify(updated));
      mongoDB.syncKv("app_platform_sessions", updated);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app_platform_sessions_updated", { detail: updated }));
        window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: "app_platform_sessions" } }));
        window.dispatchEvent(new CustomEvent("mongo_db_updated"));
        window.dispatchEvent(new Event("storage"));
      }
    }
  } catch (err) {
    console.error("Failed to sync session to Admin OPS:", err);
  }
};

/* ---------------------------------------------------------------
   MODALS: Booking, Teleconsult Video, SilverMatch AI, Wallet Top-up
---------------------------------------------------------------- */

function BookingModal({ expert, onClose, onBookSuccess, walletBalance, theme = "dark", clientProfile, onSwitchToProjectReview }: any) {
  const isLight = theme === "light";
  const [serviceType, setServiceType] = useState<"hourly" | "project">("hourly");
  const todayStr = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  const [expertAvailabilities, setExpertAvailabilities] = useState<ExpertAvailability[]>([]);
  const [isLoadingAvailabilities, setIsLoadingAvailabilities] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Load expert's explicit availability
  const loadAvailabilities = async () => {
    if (!expert) return;
    setIsLoadingAvailabilities(true);
    try {
      const data = await mongoDB.getAvailabilities(expert.id);
      setExpertAvailabilities(data);
    } catch {
      setExpertAvailabilities(mongoDB.getLocalAvailabilities(expert.id));
    } finally {
      setIsLoadingAvailabilities(false);
    }
  };

  useEffect(() => {
    loadAvailabilities();
  }, [expert?.id]);

  const dynamicProjectRate = typeof expert?.projectRate === "number" ? Math.min(2000, Math.max(0, expert.projectRate)) : (expert?.rate ? Math.min(2000, expert.rate * 3) : 1000);
  const [dynamicPlatformFee, setDynamicPlatformFee] = useState<number>(() => {
    try {
      const c = typeof window !== "undefined" ? (localStorage.getItem("mongo_platform_charge") || localStorage.getItem("mongo_project_review_config")) : null;
      if (c) {
        const p = JSON.parse(c);
        if (typeof p.feeValue === "number") {
          return p.feeType === "percentage" ? Math.round(dynamicProjectRate * (p.feeValue / 100)) : p.feeValue;
        }
      }
    } catch {}
    return 200;
  });

  useEffect(() => {
    const syncFee = () => {
      try {
        const c = typeof window !== "undefined" ? (localStorage.getItem("mongo_platform_charge") || localStorage.getItem("mongo_project_review_config")) : null;
        if (c) {
          const p = JSON.parse(c);
          if (typeof p.feeValue === "number") {
            setDynamicPlatformFee(p.feeType === "percentage" ? Math.round(dynamicProjectRate * (p.feeValue / 100)) : p.feeValue);
          }
        }
      } catch {}
    };
    window.addEventListener("platform_fee_updated", syncFee);
    window.addEventListener("storage", syncFee);
    return () => {
      window.removeEventListener("platform_fee_updated", syncFee);
      window.removeEventListener("storage", syncFee);
    };
  }, [dynamicProjectRate]);

  const dynamicProjectTotal = dynamicProjectRate + dynamicPlatformFee;
  const price = expert ? (serviceType === "hourly" ? expert.rate : dynamicProjectTotal) : 0;

  // Check if a time slot has already passed for today
  const isSlotInPast = (slotDateStr: string, slotStr: string): boolean => {
    if (!slotDateStr || !slotStr) return false;
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
      const currentDay = String(now.getDate()).padStart(2, "0");
      const currentToday = `${currentYear}-${currentMonth}-${currentDay}`;

      if (slotDateStr < currentToday) return true;
      if (slotDateStr > currentToday) return false;

      // Date is today: check if start time of slot has already elapsed
      const startTimePart = slotStr.split(" - ")[0].trim();
      const match = startTimePart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!match) return false;

      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();

      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;

      const slotStartMinutes = hours * 60 + minutes;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      return slotStartMinutes <= currentMinutes;
    } catch {
      return false;
    }
  };

  // 1. Valid upcoming slots configured for this expert (exclude disabled)
  const upcomingSlots = useMemo(() => {
    return expertAvailabilities.filter(s => s.availabilityDate >= todayStr && s.status !== "DISABLED");
  }, [expertAvailabilities, todayStr]);

  // 2. Only show dates where expert has explicit availability configured
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(upcomingSlots.map(s => s.availabilityDate))).sort();
    return dates;
  }, [upcomingSlots]);

  // Keep selectedDate valid
  useEffect(() => {
    if (availableDates.length > 0) {
      if (!selectedDate || !availableDates.includes(selectedDate)) {
        setSelectedDate(availableDates[0]);
      }
    } else {
      setSelectedDate("");
    }
  }, [availableDates, selectedDate]);

  // 3. Configured slots for current selectedDate
  const slotsOnDate = useMemo(() => {
    if (!selectedDate) return [];
    return upcomingSlots
      .filter(s => s.availabilityDate === selectedDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [upcomingSlots, selectedDate]);

  // Available (unbooked, active, non-past) slots
  const bookableSlotsOnDate = useMemo(() => {
    return slotsOnDate.filter(s => {
      if (s.status !== "AVAILABLE") return false;
      if (isSlotInPast(selectedDate, `${s.startTime} - ${s.endTime}`)) return false;
      return true;
    });
  }, [slotsOnDate, selectedDate]);

  // Auto-select first available slot when date or slots change
  useEffect(() => {
    const current = slotsOnDate.find(s => s.id === selectedSlotId);
    if (current && current.status === "AVAILABLE" && !isSlotInPast(selectedDate, `${current.startTime} - ${current.endTime}`)) {
      return;
    }
    if (bookableSlotsOnDate.length > 0) {
      setSelectedSlotId(bookableSlotsOnDate[0].id);
    } else {
      setSelectedSlotId("");
    }
  }, [slotsOnDate, bookableSlotsOnDate, selectedDate, selectedSlotId]);

  const chosenSlot = slotsOnDate.find(s => s.id === selectedSlotId);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setConflictError(null);

    if (availableDates.length === 0) {
      alert("⚠️ No Availability: This expert has not configured any upcoming available dates.");
      return;
    }

    if (!selectedDate) {
      alert("⚠️ Please select an available date.");
      return;
    }

    if (!chosenSlot || chosenSlot.status !== "AVAILABLE") {
      alert("⚠️ Please select an available time slot.");
      return;
    }

    if (isSlotInPast(selectedDate, `${chosenSlot.startTime} - ${chosenSlot.endTime}`)) {
      alert("⚠️ Invalid Time Slot: The selected time slot has already passed for today.");
      return;
    }

    if (walletBalance < price) {
      alert(`Insufficient Wallet Balance (Required: ₹${price}, Available: ₹${walletBalance}). Please top up your wallet.`);
      return;
    }

    setIsSubmitting(true);
    const bookingId = `book-${Date.now()}`;
    const clientId = clientProfile?.id || clientProfile?.email || "client-1";
    const clientName = clientProfile?.name || "Client ABC";

    try {
      // Concurrency lock call to backend atomic /api/availability/book
      const bookRes = await mongoDB.bookAvailability(chosenSlot.id, {
        bookingId,
        clientId,
        clientName,
        expertId: expert.id
      });

      if (!bookRes.success) {
        setIsSubmitting(false);
        setConflictError(bookRes.error || "Time slot clash: This slot was just booked by another client. Please select another slot.");
        await loadAvailabilities();
        return;
      }

      const slotStr = `${chosenSlot.startTime} - ${chosenSlot.endTime}`;
      const newBooking = {
        id: bookingId,
        client: clientName,
        clientEmail: clientProfile?.email || "client@company.com",
        expert: expert.name,
        expertEmail: expert.email,
        expertId: expert.id,
        topic: topic || `${expert.field || 'Expert'} Consultation`,
        when: `${selectedDate}, ${chosenSlot.startTime}`,
        timeSlot: slotStr,
        date: selectedDate,
        type: serviceType === "hourly" ? "Hourly" : "Project",
        status: "Pending Expert Acceptance",
        rate: price,
        meetUrl: "",
        completed: false,
        availabilitySlotId: chosenSlot.id
      };

      // FIX 2: Await persistence in onBookSuccess before closing modal or triggering confetti!
      const bookSuccessResult = await onBookSuccess(newBooking, price);
      if (bookSuccessResult && bookSuccessResult.success === false) {
        setIsSubmitting(false);
        setConflictError(bookSuccessResult.error || "Booking failed to save. Please choose another time.");
        if (chosenSlot?.id) {
          try {
            await mongoDB.releaseAvailability(chosenSlot.id, bookingId);
          } catch {}
        }
        await loadAvailabilities();
        return;
      }

      setIsSubmitting(false);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setConflictError(err.message || "Failed to confirm booking due to concurrency conflict.");
      if (chosenSlot?.id) {
        try {
          await mongoDB.releaseAvailability(chosenSlot.id, bookingId);
        } catch {}
      }
      await loadAvailabilities();
    }
  };

  if (!expert) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
      <div 
        className={`w-full max-w-lg p-7 rounded-2xl space-y-5 shadow-2xl border transition-all max-h-[90vh] overflow-y-auto my-auto ${
          isLight ? "bg-white border-slate-200 text-slate-900 shadow-2xl" : "bg-[#0B111A] border-white/15 text-white"
        }`} 
        style={{ ...body }}
      >
        <div className={`flex justify-between items-center pb-3 border-b ${isLight ? "border-slate-100" : "border-white/10"}`}>
          <div>
            <span style={{ ...display }} className={`text-xl font-bold block ${isLight ? "text-slate-900" : "text-white"}`}>Schedule Consultation</span>
            <span className={`text-xs ${isLight ? "text-amber-700 font-semibold" : "text-amber-400"}`}>with {expert.name} ({expert.field})</span>
          </div>
          <button 
            onClick={onClose} 
            aria-label="Close Booking Modal"
            title="Close Booking Modal"
            className={`p-1.5 rounded-full cursor-pointer transition-colors ${
              isLight ? "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200" : "bg-white/10 text-slate-400 hover:text-white"
            }`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2.5">
          <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>1. Select Service Package</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setServiceType("hourly")}
              className={`p-3.5 text-left rounded-xl border transition-all cursor-pointer ${
                serviceType === "hourly"
                  ? (isLight ? "border-amber-500 bg-amber-50/90 shadow-sm ring-1 ring-amber-500/30" : "border-amber-500/80 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]")
                  : (isLight ? "border-slate-200 bg-slate-50 hover:bg-slate-100" : "border-white/10 bg-[#111A27] hover:bg-white/[0.04]")
              }`}
            >
              <div className="flex justify-between font-bold text-xs">
                <span className={isLight ? "text-slate-900" : "text-white"}>1-Hour Call</span>
                <span className={`font-mono ${isLight ? "text-amber-700" : "text-amber-400"}`}>₹{expert.rate}</span>
              </div>
              <p className={`text-[11px] mt-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>60-min Google Meet session</p>
            </button>

            <button
              onClick={() => {
                if (onSwitchToProjectReview) {
                  onClose();
                  onSwitchToProjectReview(expert);
                } else {
                  setServiceType("project");
                }
              }}
              className={`p-3.5 text-left rounded-xl border transition-all cursor-pointer ${
                serviceType === "project"
                  ? (isLight ? "border-cyan-500 bg-cyan-50/90 shadow-sm ring-1 ring-cyan-500/30" : "border-cyan-500/80 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.2)]")
                  : (isLight ? "border-slate-200 bg-slate-50 hover:bg-slate-100" : "border-white/10 bg-[#111A27] hover:bg-white/[0.04]")
              }`}
            >
              <div className="flex justify-between font-bold text-xs">
                <span className={isLight ? "text-slate-900" : "text-white"}>Project Review</span>
                <span className={`font-mono ${isLight ? "text-amber-700" : "text-amber-400"}`}>₹{dynamicProjectTotal}</span>
              </div>
              <p className={`text-[11px] mt-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>Document audit + 2 calls</p>
              <p className={`text-[10px] mt-0.5 font-semibold ${isLight ? "text-cyan-700" : "text-cyan-400"}`}>→ Opens Dedicated Review Request</p>
            </button>
          </div>
        </div>

        {/* 2. Interactive Date Selection Strip */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              2. Select Consultation Date
            </label>
            {availableDates.length > 0 && (
              <span className="text-[10px] text-slate-400 font-mono">
                {availableDates.length} date{availableDates.length > 1 ? 's' : ''} with published schedules
              </span>
            )}
          </div>

          {isLoadingAvailabilities ? (
            <div className="p-4 rounded-xl border border-white/10 text-center text-xs text-slate-400">
              Loading available schedule...
            </div>
          ) : availableDates.length === 0 ? (
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-center text-xs text-amber-300">
              No dates configured by expert
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
              {availableDates.map((d) => {
                const daySlots = upcomingSlots.filter((s) => s.availabilityDate === d);
                const openCount = daySlots.filter((s) => s.status === "AVAILABLE" && !isSlotInPast(d, `${s.startTime} - ${s.endTime}`)).length;
                const isSelected = selectedDate === d;
                const isFull = openCount === 0;

                let weekday = "";
                let monthDay = "";
                try {
                  const [y, m, dayNum] = d.split('-');
                  const dt = new Date(Number(y), Number(m) - 1, Number(dayNum));
                  weekday = dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                  monthDay = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } catch {
                  weekday = "DATE";
                  monthDay = d;
                }

                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setSelectedDate(d);
                      setConflictError(null);
                    }}
                    className={`shrink-0 px-3.5 py-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center min-w-[85px] ${
                      isSelected
                        ? "bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25 border-amber-400 scale-[1.03]"
                        : isFull
                        ? (isLight ? "bg-slate-100 border-slate-200 opacity-60 text-slate-400" : "bg-[#0E1724] border-white/5 opacity-50 text-slate-500")
                        : (isLight ? "bg-slate-50 hover:bg-amber-50/60 border-slate-200 text-slate-800" : "bg-[#111A27] hover:bg-white/10 border-white/10 text-white")
                    }`}
                  >
                    <span className={`text-[10px] font-black tracking-widest ${isSelected ? "text-slate-950" : "text-amber-500"}`}>
                      {weekday}
                    </span>
                    <span className="text-xs font-black mt-0.5 whitespace-nowrap">
                      {monthDay}
                    </span>
                    <span className={`text-[9px] font-mono mt-1 px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected
                        ? "bg-slate-950/20 text-slate-950"
                        : isFull
                        ? "bg-slate-500/20 text-slate-400"
                        : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    }`}>
                      {isFull ? "Full" : `${openCount} slot${openCount > 1 ? 's' : ''}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Interactive Time Slot Matrix */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              3. Select Consultation Time Window
            </label>
            {selectedDate && slotsOnDate.length > 0 && (
              <span className="text-[10px] text-slate-400 font-mono">
                {bookableSlotsOnDate.length} of {slotsOnDate.length} available
              </span>
            )}
          </div>

          {isLoadingAvailabilities ? (
            <div className="p-4 rounded-xl border border-white/10 text-center text-xs text-slate-400">
              Loading available time slots...
            </div>
          ) : slotsOnDate.length === 0 ? (
            <div className={`p-4 rounded-xl border text-center text-xs ${
              isLight ? "bg-slate-50 border-slate-200 text-slate-500" : "bg-[#111A27] border-white/10 text-slate-400"
            }`}>
              No time slots configured for {selectedDate || 'this date'}.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
              {slotsOnDate.map((s) => {
                const isPast = isSlotInPast(selectedDate, `${s.startTime} - ${s.endTime}`);
                const isBooked = s.status === "BOOKED";
                const isDisabled = s.status === "DISABLED";
                const isAvailable = s.status === "AVAILABLE" && !isPast;
                const isSelected = selectedSlotId === s.id;

                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => {
                      setSelectedSlotId(s.id);
                      setConflictError(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all relative ${
                      !isAvailable
                        ? (isLight ? "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed text-slate-400" : "bg-[#070C15] border-white/5 opacity-40 cursor-not-allowed text-slate-500")
                        : isSelected
                        ? "bg-amber-500/15 border-amber-500 text-white font-extrabold shadow-md ring-2 ring-amber-500/40"
                        : (isLight ? "bg-white hover:border-amber-400 border-slate-200 text-slate-800" : "bg-[#111A27] hover:border-amber-500/40 border-white/10 text-white")
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className={isSelected ? "text-amber-400" : isAvailable ? "text-emerald-400" : "text-slate-500"} />
                        <span className="text-xs font-bold font-mono">
                          {s.startTime}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="text-slate-400 font-mono">to {s.endTime}</span>
                      <span className={`px-1.5 py-0.2 rounded font-mono font-bold ${
                        isSelected
                          ? "bg-amber-500 text-slate-950"
                          : isBooked
                          ? "bg-amber-500/15 text-amber-400"
                          : isPast
                          ? "bg-slate-500/20 text-slate-400"
                          : "bg-emerald-500/15 text-emerald-400"
                      }`}>
                        {isBooked ? "Booked" : isPast ? "Passed" : isDisabled ? "Off" : "Open"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Real-Time Conflict Alert Banner */}
        {conflictError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-start gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">❌ Double-Booking Prevented</p>
              <p className="text-[11px] mt-0.5 text-rose-200 leading-relaxed">
                {conflictError}
              </p>
            </div>
          </div>
        )}

        {/* No Availability Notice Banner */}
        {availableDates.length === 0 && !isLoadingAvailabilities && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">No Availability Configured</p>
              <p className="text-[11px] mt-0.5 text-slate-300 leading-relaxed">
                Expert <strong>{expert.name}</strong> has not published any upcoming availability slots. Unavailable dates cannot be selected.
              </p>
            </div>
          </div>
        )}

        {/* Date Fully Reserved Notice Banner */}
        {availableDates.length > 0 && bookableSlotsOnDate.length === 0 && !isLoadingAvailabilities && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">All Slots Reserved for {selectedDate}</p>
              <p className="text-[11px] mt-0.5 text-slate-300 leading-relaxed">
                All configured time slots for this date have either concluded or are already booked. Please select another date.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>Session Note / Agenda</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Reviewing GST audit exposure and compliance timeline..."
            className={`w-full mt-1.5 px-3.5 py-2 text-xs rounded-xl outline-none border transition-colors ${
              isLight ? "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-amber-500" : "border-white/10 bg-[#111A27] text-white placeholder-slate-500"
            }`}
          />
        </div>

        {/* Google Meet Video Consultation Callout */}
        <div className={`p-3 rounded-xl border flex items-center justify-between ${
          isLight ? "bg-emerald-50/70 border-emerald-200 text-emerald-900 shadow-sm" : "bg-[#070C15] border-white/10 text-slate-200 shadow-inner"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? "bg-emerald-100 text-emerald-700" : "bg-white/10 text-emerald-400"}`}>
              <Video size={16} />
            </div>
            <div>
              <p className={`text-xs font-bold flex items-center gap-1.5 ${isLight ? "text-slate-900" : "text-white"}`}>
                Google Meet Video Consultation
              </p>
              <p className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>Direct Google Meet URL will be auto-generated for session</p>
            </div>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
            isLight ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
          }`}>
            Meet Ready
          </span>
        </div>

        <div className={`p-3.5 rounded-xl space-y-1.5 text-xs border ${
          isLight ? "bg-slate-50 border-slate-200" : "bg-[#111A27] border-white/10"
        }`}>
          <div className={`flex justify-between ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            <span>Expert Base Pay:</span>
            <span className={isLight ? "text-slate-900 font-semibold" : ""}>₹{expert.baseRate || expert.rate - 150}</span>
          </div>
          <div className={`flex justify-between text-[11px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            <span>Admin Platform Profit:</span>
            <span className={`font-bold ${isLight ? "text-amber-700" : "text-amber-400"}`}>+₹{expert.adminMarkup || 150}</span>
          </div>
          <div className={`flex justify-between pt-1.5 border-t font-bold text-sm ${isLight ? "border-slate-200 text-slate-900" : "border-white/10 text-white"}`}>
            <span>Total Payable:</span>
            <span className={`font-mono text-base ${isLight ? "text-amber-700" : "text-amber-400"}`}>₹{price}</span>
          </div>
        </div>

        <Button3D
          full
          variant={bookableSlotsOnDate.length === 0 || !chosenSlot ? "ghost" : "brass"}
          onClick={handleConfirm}
          disabled={isSubmitting || isLoadingAvailabilities || bookableSlotsOnDate.length === 0 || !chosenSlot}
        >
          <Check size={14} />{" "}
          {isSubmitting
            ? "Securing Atomic Booking..."
            : bookableSlotsOnDate.length === 0
            ? "❌ No Slots Available"
            : `Confirm & Pay ₹${price} via Smart Wallet`}
        </Button3D>
      </div>
    </div>
  );
}

function UPIPaymentGatewayModal({ 
  amount, 
  app, 
  upiId, 
  onClose, 
  onSuccess 
}: { 
  amount: number; 
  app: { id: string; name: string; color: string; bg: string; logo: string }; 
  upiId?: string; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const [status, setStatus] = useState<"processing" | "success">("processing");
  const creditedRef = useRef(false);

  const triggerSuccess = () => {
    if (!creditedRef.current) {
      creditedRef.current = true;
      onSuccess();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setStatus("success");
      triggerSuccess();
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleDone = () => {
    triggerSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,15,22,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-sm p-6 rounded-sm space-y-5 shadow-2xl text-center relative bg-white border" style={{ borderColor: T.line, ...body }}>
        
        <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: T.line }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: app.color }}>
              {app.logo.slice(0, 2)}
            </div>
            <span className="text-xs font-bold text-slate-800">{app.name} Instant UPI</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={16} /></button>
        </div>

        {status === "processing" ? (
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center animate-pulse" style={{ background: app.bg }}>
              <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: app.color, borderTopColor: "transparent" }} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Authorizing ₹{amount.toLocaleString("en-IN")}</p>
              <p className="text-xs text-slate-500 mt-1">Connecting to {app.name} UPI Gateway...</p>
              {upiId && <p className="text-[11px] font-mono mt-1 text-slate-600">VPA: {upiId}</p>}
            </div>
            <div className="p-3 rounded bg-slate-50 border text-[11px] text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">NPCI Fast Track Settlement</p>
              <p className="text-[10px]">Reference: UPI/{Date.now().toString().slice(-8)}</p>
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full mx-auto flex items-center justify-center text-emerald-600 animate-bounce">
              <Check size={32} />
            </div>
            <div>
              <p className="text-base font-extrabold text-emerald-800">Payment Successful!</p>
              <p className="text-xs text-slate-600 mt-1">Added <strong className="text-slate-900 font-bold">₹{amount.toLocaleString("en-IN")}</strong> to your Client Wallet via {app.name}.</p>
            </div>
            <Button3D full variant="brass" onClick={handleDone}>
              Continue & Book Consultation
            </Button3D>
          </div>
        )}
      </div>
    </div>
  );
}

function TeleconsultSimulatorModal({ session, onClose }: { session: any; onClose: () => void }) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [notes, setNotes] = useState("• Audit GST filings for Q2\n• Dilution cap set at 10%\n• Next review on Friday");
  const [chat, setChat] = useState<{ sender: string; text: string }[]>([
    { sender: session?.expert || "Expert", text: "Welcome to our advisory session." },
    { sender: "You", text: "Thank you! We want to discuss our audit exposure." }
  ]);
  const [msg, setMsg] = useState("");
  const [sec, setSec] = useState(184);

  useEffect(() => {
    const t = setInterval(() => setSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!session) return null;

  const fmt = (s: number) => `${Math.floor(s/60).toString().padStart(2, '0')}:${(s%60).toString().padStart(2, '0')}`;

  const sendMsg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim()) return;
    setChat(prev => [...prev, { sender: "You", text: msg }]);
    setMsg("");
    setTimeout(() => {
      setChat(prev => [...prev, { sender: session.expert, text: "Understood. I will cross-verify this with tax guidelines." }]);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(10,15,22,0.92)", backdropFilter: "blur(10px)" }}>
      <div className="w-full max-w-5xl h-[85vh] rounded-sm overflow-hidden flex flex-col shadow-2xl" style={{ background: T.ink, border: `1px solid ${T.lineInk}`, ...body }}>
        
        <div className="flex items-center justify-between px-6 py-3 border-b" style={{ background: T.ink2, borderColor: T.lineInk }}>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: T.moss }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: T.cream }}>Teleconsult Room: {session.topic}</p>
              <p className="text-xs" style={{ color: "#8A93A0" }}>with {session.expert} · Room Code: {session.roomCode || "ROOM-88"}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs px-3 py-1 rounded-sm font-mono" style={{ background: T.ink, color: T.brassLight, border: `1px solid ${T.lineInk}` }}>
              <Clock size={12} className="inline mr-1" /> {fmt(sec)} / 60:00
            </span>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 grid md:grid-cols-3 gap-0 overflow-hidden">
          
          <div className="md:col-span-2 p-4 flex flex-col justify-between relative" style={{ background: "#0D141F" }}>
            <div className="flex-1 rounded-sm relative overflow-hidden flex flex-col items-center justify-center" style={{ background: T.ink, border: `1px solid ${T.lineInk}` }}>
              {!isVideoOff ? (
                <div className="text-center space-y-3">
                  <div className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-2xl font-bold" style={{ background: T.parchment2, color: T.ink, ...display }}>
                    {session.expert.split(" ").map((n: string) => n[0]).join("")}
                  </div>
                  <p style={{ ...display, color: T.cream }} className="text-xl">{session.expert}</p>
                  <Pill tone="brass">Senior Expert · HD Video Stream</Pill>
                </div>
              ) : (
                <div className="text-xs text-slate-400 flex items-center gap-2"><VideoOff size={18} /> Camera Muted</div>
              )}

              <div className="absolute bottom-3 right-3 w-32 h-24 rounded-sm flex items-center justify-center text-xs shadow-md" style={{ background: T.ink2, border: `1px solid ${T.lineInk}`, color: "#8A93A0" }}>
                <span>Client Feed</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button onClick={() => setIsMuted(!isMuted)} className="p-3 rounded-full text-xs font-semibold cursor-pointer" style={{ background: isMuted ? T.rust : T.ink, color: T.cream, border: `1px solid ${T.lineInk}` }}>
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button onClick={() => setIsVideoOff(!isVideoOff)} className="p-3 rounded-full text-xs font-semibold cursor-pointer" style={{ background: isVideoOff ? T.rust : T.ink, color: T.cream, border: `1px solid ${T.lineInk}` }}>
                {isVideoOff ? <VideoOff size={16} /> : <Video size={16} />}
              </button>
              <Button3D variant="rust" size="sm" onClick={() => { alert("Session completed! Escrows released and ratings logged."); onClose(); }}>
                End Advisory Call
              </Button3D>
            </div>
          </div>

          <div className="p-4 flex flex-col justify-between border-l" style={{ background: T.ink2, borderColor: T.lineInk }}>
            <div className="space-y-4">
              <p className="text-xs font-semibold" style={{ color: T.brassLight }}>Session Notes & Action Items</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="w-full p-3 text-xs rounded-sm outline-none font-mono resize-none"
                style={{ background: T.ink, border: `1px solid ${T.lineInk}`, color: T.cream }}
              />
            </div>

            <div className="space-y-3 pt-3 border-t" style={{ borderColor: T.lineInk }}>
              <p className="text-xs font-semibold" style={{ color: T.brassLight }}>Meeting Chat</p>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1 text-xs">
                {chat.map((c, i) => (
                  <div key={i} className="p-2 rounded-sm" style={{ background: T.ink }}>
                    <span className="font-semibold block text-[10px]" style={{ color: T.brassLight }}>{c.sender}</span>
                    <span style={{ color: T.cream }}>{c.text}</span>
                  </div>
                ))}
              </div>
              <form onSubmit={sendMsg} className="flex gap-2">
                <input
                  type="text"
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder="Type note..."
                  className="flex-1 p-2 text-xs rounded-sm outline-none"
                  style={{ background: T.ink, border: `1px solid ${T.lineInk}`, color: T.cream }}
                />
                <Button3D type="submit" size="sm" variant="brass">
                  <Send size={14} />
                </Button3D>
              </form>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   LANDING PAGE (Rich 3D Graphics, Executive Avatars & Interactive Motion)
---------------------------------------------------------------- */
function Landing({ setPage, onOpenAuth, experts, theme = "dark", onToggleTheme, userRole, onLogout, onViewDossier }: { setPage: (p: string) => void; onOpenAuth: (mode: "signup" | "login", role?: string) => void; experts?: ExpertDoc[]; theme?: "dark" | "light"; onToggleTheme?: () => void; userRole?: string | null; onLogout?: () => void; onViewDossier?: (expert: any) => void }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const { domains, selectedDomain: activeCategory, setSelectedDomain: setActiveCategory, getDomainName, refreshDomains } = useDomains();
  const expertiseFields = useMemo(() => domains.filter(d => d.is_active !== false).map(d => d.name), [domains]);
  const isLight = theme === "light";
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -260 : 260,
        behavior: 'smooth'
      });
    }
  };

  const [landingAnnouncements, setLandingAnnouncements] = useState<any[]>(() => 
    notificationService.getForUser('landing').filter(n => !n.read)
  );

  useEffect(() => {
    notificationService.syncWithBackend('landing');
    const handleUpdate = () => {
      setLandingAnnouncements(notificationService.getForUser('landing').filter(n => !n.read));
    };
    window.addEventListener(NOTIFICATION_EVENT_NAME, handleUpdate);
    return () => {
      window.removeEventListener(NOTIFICATION_EVENT_NAME, handleUpdate);
    };
  }, []);

  const handleTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTilt({
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5,
    });
  };

  const FEATURED_ADVISORS: (ExpertDoc | { id: string; name: string; title: string; field: string; years: number; rate: number; rating: number; sessions: number; img: string; company?: string })[] = (experts && experts.length > 0)
    ? experts.filter(e => 
        e.verified === true && 
        e.verificationStatus !== "pending" && 
        e.verificationStatus !== "rejected" && 
        !(e as any).rejected
      )
    : [];

  const filteredAdvisors = activeCategory === "All" 
    ? FEATURED_ADVISORS 
    : FEATURED_ADVISORS.filter(a => {
        const dName = getDomainName(a);
        return dName && (
          dName.toLowerCase() === activeCategory.toLowerCase() ||
          dName.toLowerCase().includes(activeCategory.toLowerCase()) ||
          activeCategory.toLowerCase().includes(dName.toLowerCase())
        );
      });

  return (
    <div 
      className="relative overflow-hidden transition-colors duration-300 min-h-screen"
      style={{ 
        background: isLight ? "#F8FAFC" : "#05080E", 
        color: isLight ? "#0F172A" : "#F8FAFC", 
        ...body 
      }}
    >
      {/* Mentora Landing Page Background Video & Theme Overlays (Layer 1 + Layer 2) */}
      <LandingBackgroundVideo theme={theme} />

      {/* High-Precision Architectural Geometric Matrix */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: isLight
            ? "linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.08) 1px, transparent 1px)"
            : "linear-gradient(to right, rgba(245, 158, 11, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(245, 158, 11, 0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at 50% 30%, black 40%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 40%, transparent 85%)",
          zIndex: 0,
        }}
      />

      {/* Ambient Quantum Gold & Cyan Executive Spotlight Blooms */}
      <div 
        className="absolute top-[-80px] left-1/4 w-[750px] h-[550px] rounded-full blur-[140px] pointer-events-none transition-colors duration-500"
        style={{
          background: isLight ? "rgba(245, 158, 11, 0.10)" : "rgba(245, 158, 11, 0.16)",
          zIndex: 0,
        }}
      />
      <div 
        className="absolute top-[340px] right-[-120px] w-[650px] h-[650px] rounded-full blur-[160px] pointer-events-none transition-colors duration-500"
        style={{
          background: isLight ? "rgba(6, 182, 212, 0.08)" : "rgba(6, 182, 212, 0.14)",
          zIndex: 0,
        }}
      />

      {/* Sticky Navigation Header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-8 md:px-14 py-4.5 border-b backdrop-blur-xl transition-all shadow-lg"
        style={{
          borderColor: isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)",
          background: isLight ? "rgba(255, 255, 255, 0.92)" : "rgba(5, 8, 14, 0.85)"
        }}
      >
        <button onClick={() => setPage("landing")} className="bg-transparent border-0 p-0 cursor-pointer hover:opacity-95 transition-opacity">
          <Logo theme={theme} />
        </button>
        <nav className={`hidden md:flex items-center gap-6 lg:gap-8 text-sm font-semibold ${isLight ? "text-slate-700" : "text-slate-300"}`}>
          <a
            href="#how"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("how")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="hover:text-amber-500 transition-colors"
          >
            How it works
          </a>
          <a
            href="#stories"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("stories")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="hover:text-amber-500 transition-colors"
          >
            Stories
          </a>
          <button
            onClick={() => setPage("about")}
            className="hover:text-amber-500 transition-colors cursor-pointer"
          >
            About
          </button>
          <button
            onClick={() => setPage("blogs")}
            className="hover:text-amber-500 transition-colors cursor-pointer"
          >
            Blogs & Articles
          </button>
        </nav>
        <div className="flex items-center gap-3">
          {onToggleTheme && (
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          )}
          <NotificationCenter role="landing" recipientId={undefined} darkTheme={!isLight} onNavigate={setPage} />
          {userRole ? (
            <div className="flex items-center gap-2">
              <Button3D variant="ghost" onClick={() => setPage(userRole === "client" ? "client" : (userRole === "expert" ? "expert" : "owner"))}>
                Go to {userRole === "client" ? "Client Portal" : (userRole === "expert" ? "Expert Portal" : "Admin Desk")} →
              </Button3D>
              <button
                onClick={() => {
                  if (window.confirm("Sign out of active account?")) {
                    if (onLogout) onLogout();
                  }
                }}
                className={`flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                  isLight 
                    ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 shadow-sm" 
                    : "bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/50"
                }`}
                title="Sign out of current account"
              >
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Button3D variant="ghost" onClick={() => onOpenAuth("login")}>Sign in</Button3D>
              <Button3D variant="brass" onClick={() => onOpenAuth("signup", "expert")}>Register as expert</Button3D>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden p-2 rounded-xl border transition-colors cursor-pointer ${
              isLight ? "bg-slate-100 border-slate-300 text-slate-700" : "bg-white/5 border-white/10 text-white"
            }`}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden px-6 py-4 border-b space-y-3 backdrop-blur-xl transition-all ${
            isLight ? "bg-white/95 border-slate-200" : "bg-[#05080E]/95 border-white/10"
          }`}
        >
          <div className="flex flex-col space-y-2 text-sm font-semibold">
            <a
              href="#how"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                document.getElementById("how")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="py-2 text-left cursor-pointer hover:text-amber-500 transition-colors"
            >
              How it works
            </a>
            <a
              href="#stories"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                document.getElementById("stories")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="py-2 text-left cursor-pointer hover:text-amber-500 transition-colors"
            >
              Stories
            </a>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setPage("about");
              }}
              className="py-2 text-left cursor-pointer hover:text-amber-500 transition-colors font-bold text-amber-500"
            >
              About
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setPage("blogs");
              }}
              className="py-2 text-left cursor-pointer hover:text-amber-500 transition-colors font-bold text-amber-500"
            >
              Blogs & Articles
            </button>
          </div>
          <div className="pt-3 border-t flex flex-col gap-2" style={{ borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)" }}>
            {userRole ? (
              <Button3D full variant="ghost" onClick={() => { setMobileMenuOpen(false); setPage(userRole === "client" ? "client" : (userRole === "expert" ? "expert" : "owner")); }}>
                Go to {userRole === "client" ? "Client Portal" : (userRole === "expert" ? "Expert Portal" : "Admin Desk")} →
              </Button3D>
            ) : (
              <>
                <Button3D full variant="ghost" onClick={() => { setMobileMenuOpen(false); onOpenAuth("login"); }}>Sign in</Button3D>
                <Button3D full variant="brass" onClick={() => { setMobileMenuOpen(false); onOpenAuth("signup", "expert"); }}>Register as expert</Button3D>
              </>
            )}
          </div>
        </div>
      )}

      {/* Active Public Notification & Platform Announcement Banner */}
      {landingAnnouncements.length > 0 && (
        <div className={`px-8 md:px-14 py-2.5 border-b flex items-center justify-between gap-4 transition-all ${
          isLight 
            ? "bg-amber-500/10 border-amber-500/30 text-amber-950" 
            : "bg-amber-500/15 border-amber-500/30 text-amber-200"
        }`}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="p-1 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <Sparkles size={14} className="animate-pulse" />
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 shrink-0">
                {landingAnnouncements[0].title}
              </span>
              <span className={`text-xs font-medium truncate ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                {landingAnnouncements[0].message}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => {
                notificationService.markAsRead(landingAnnouncements[0].id);
                setLandingAnnouncements(prev => prev.filter(n => n.id !== landingAnnouncements[0].id));
              }}
              className="text-[11px] font-bold text-slate-400 hover:text-white px-2 py-0.5 rounded cursor-pointer transition-colors"
              title="Dismiss announcement"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Hero Section with Interactive 3D Canvas & Floating Executive Cards */}
      <section className="grid md:grid-cols-2 gap-10 lg:gap-14 px-8 md:px-14 pt-16 pb-20 items-center relative overflow-hidden">
        {/* Particle Canvas */}
        <div className="absolute inset-0 opacity-50 pointer-events-none">
          <ParticleField count={110} colorA={isLight ? "#D97706" : "#F59E0B"} colorB={isLight ? "#0284C7" : "#06B6D4"} />
        </div>

        {/* Ambient Backing Plate for Text Readability & Contrast */}
        <div 
          className="absolute -left-10 top-0 w-full md:w-[65%] h-full pointer-events-none -z-10 transition-opacity duration-500"
          style={{
            background: isLight 
              ? "radial-gradient(ellipse at 25% 45%, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.82) 50%, rgba(248, 250, 252, 0) 100%)" 
              : "radial-gradient(ellipse at 25% 45%, rgba(8, 13, 22, 0.92) 0%, rgba(8, 13, 22, 0.70) 50%, rgba(8, 13, 22, 0) 100%)"
          }}
        />

        {/* Left Column: Hero Content & Call to Actions */}
        <div className="relative z-10 space-y-6 max-w-2xl">
          {/* Eyebrow Platform Badge */}
          <div 
            className="inline-flex items-center gap-2.5 text-xs px-4 py-2 rounded-full uppercase tracking-wider font-extrabold backdrop-blur-xl border shadow-sm transition-all duration-300"
            style={{ 
              background: isLight 
                ? "linear-gradient(135deg, rgba(254, 243, 199, 0.9) 0%, rgba(255, 251, 235, 0.95) 100%)" 
                : "linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(245, 158, 11, 0.08) 100%)", 
              color: isLight ? "#92400E" : "#FBBF24", 
              borderColor: isLight ? "rgba(245, 158, 11, 0.45)" : "rgba(245, 158, 11, 0.35)", 
              boxShadow: isLight ? "0 2px 10px rgba(245, 158, 11, 0.15)" : "0 0 20px rgba(245, 158, 11, 0.2)"
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <Sparkles size={13} className={isLight ? "text-amber-700" : "text-amber-400"} />
            <span className="tracking-widest text-[11px] font-black">The Silver Workforce Platform</span>
            <span 
              className="ml-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-normal uppercase"
              style={{
                backgroundColor: isLight ? "rgba(217, 119, 6, 0.15)" : "rgba(245, 158, 11, 0.25)",
                color: isLight ? "#92400E" : "#FDE68A"
              }}
            >
              Elite Network
            </span>
          </div>

          {/* Primary High-Impact Executive Headline */}
          <h1 style={{ ...display }} className="text-4xl sm:text-5xl lg:text-[3.65rem] font-black leading-[1.08] tracking-tight">
            <span className="block" style={{ color: isLight ? "#0F172A" : "#FFFFFF" }}>
              Forty Years of Mastery.
            </span>
            <span 
              className="block mt-2"
              style={{
                color: isLight ? "#B45309" : "#FBBF24",
                backgroundImage: isLight 
                  ? "linear-gradient(135deg, #B45309 0%, #D97706 40%, #0369A1 100%)" 
                  : "linear-gradient(135deg, #FDE68A 0%, #FBBF24 45%, #38BDF8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                display: "inline-block",
                filter: isLight ? "drop-shadow(0 2px 8px rgba(217, 119, 6, 0.12))" : "drop-shadow(0 2px 18px rgba(245, 158, 11, 0.35))"
              }}
            >
              Supercharged for Modern Enterprise.
            </span>
          </h1>

          {/* Enhanced Value Proposition Paragraph */}
          <p 
            className="text-base sm:text-lg leading-relaxed max-w-xl font-normal transition-colors"
            style={{ color: isLight ? "#334155" : "#CBD5E1" }}
          >
            India has over <strong style={{ color: isLight ? "#0F172A" : "#FFFFFF" }} className="font-bold">120 million senior professionals</strong> sitting outside the formal workforce. Mentora connects their veteran strategic foresight directly with modern enterprises and ambitious founders — at <strong style={{ color: isLight ? "#B45309" : "#FBBF24" }} className="font-bold">transparent, escrow-verified rates</strong>.
          </p>

          {/* Call to Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => onOpenAuth("signup", "client")}
              className="group relative inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide text-slate-950 transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              style={{
                background: "linear-gradient(135deg, #FBBF24 0%, #F59E0B 50%, #D97706 100%)",
                border: "1px solid rgba(254, 240, 138, 0.6)",
                boxShadow: isLight 
                  ? "0 10px 25px -5px rgba(245, 158, 11, 0.4), 0 0 15px rgba(245, 158, 11, 0.2)" 
                  : "0 12px 28px -5px rgba(245, 158, 11, 0.5), 0 0 20px rgba(245, 158, 11, 0.3)"
              }}
            >
              <span>Find an Expert</span>
              <ArrowUpRight size={18} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>

            <button
              onClick={() => onOpenAuth("signup", "expert")}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98] border shadow-xs"
              style={{
                backgroundColor: isLight ? "#FFFFFF" : "rgba(15, 23, 42, 0.75)",
                borderColor: isLight ? "#CBD5E1" : "rgba(255, 255, 255, 0.16)",
                color: isLight ? "#0F172A" : "#F8FAFC",
                boxShadow: isLight ? "0 4px 14px rgba(0, 0, 0, 0.06)" : "0 4px 20px rgba(0, 0, 0, 0.4)"
              }}
            >
              <span>Register as Expert</span>
            </button>
          </div>

          {/* Quick Trust Badges */}
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <div 
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-bold backdrop-blur-md shadow-xs transition-colors"
              style={{
                backgroundColor: isLight ? "rgba(255, 255, 255, 0.88)" : "rgba(15, 23, 42, 0.6)",
                borderColor: isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.1)",
                color: isLight ? "#1E293B" : "#E2E8F0"
              }}
            >
              <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
              <span>Verified Backgrounds</span>
            </div>
            <div 
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-bold backdrop-blur-md shadow-xs transition-colors"
              style={{
                backgroundColor: isLight ? "rgba(255, 255, 255, 0.88)" : "rgba(15, 23, 42, 0.6)",
                borderColor: isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.1)",
                color: isLight ? "#1E293B" : "#E2E8F0"
              }}
            >
              <Award size={14} className="text-amber-500 shrink-0" />
              <span>25+ Yrs Leadership</span>
            </div>
            <div 
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-bold backdrop-blur-md shadow-xs transition-colors"
              style={{
                backgroundColor: isLight ? "rgba(255, 255, 255, 0.88)" : "rgba(15, 23, 42, 0.6)",
                borderColor: isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.1)",
                color: isLight ? "#1E293B" : "#E2E8F0"
              }}
            >
              <Lock size={14} className="text-sky-500 shrink-0" />
              <span>Escrow Protected</span>
            </div>
          </div>
        </div>

        {/* 3D Interactive Parallax Canvas with Floating Executive Cards */}
        <div
          className="relative h-[430px] md:h-[480px] rounded-3xl overflow-hidden backdrop-blur-md transition-all duration-300 border"
          style={{
            backgroundColor: isLight ? "rgba(255, 255, 255, 0.75)" : "rgba(8, 13, 22, 0.6)",
            borderColor: isLight ? "rgba(226, 232, 240, 0.9)" : "rgba(255, 255, 255, 0.12)",
            boxShadow: isLight 
              ? "0 25px 50px -12px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.8) inset" 
              : "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06) inset"
          }}
          onMouseMove={handleTilt}
          onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        >
          {/* Live Interactive Three.js 3D Network Scene */}
          <div className="absolute inset-0">
            <NetworkGraphic />
          </div>
          
          {/* Floating Executive Card 1 (Admin Top Hero Spotlight) */}
          {(() => {
            const card1 = experts?.find(e => e.verified && e.heroSpotlight && e.heroPosition === "top") 
              || experts?.find(e => e.verified && e.id === "exp-6") 
              || { name: "Ravi Subramaniam", field: "Legal & Compliance", years: 38, rate: 950, rating: 4.8, id: "exp-6" };
            
            return (
              <div
                className="absolute right-4 top-6 w-72 p-4 rounded-2xl backdrop-blur-xl shadow-2xl transition-all border"
                style={{
                  background: isLight ? "rgba(255, 255, 255, 0.98)" : "rgba(11, 17, 26, 0.92)",
                  borderColor: isLight ? "rgba(245, 158, 11, 0.4)" : "rgba(255, 255, 255, 0.15)",
                  boxShadow: isLight 
                    ? "0 20px 40px -10px rgba(0,0,0,0.12), 0 0 20px rgba(245,158,11,0.15)" 
                    : "0 15px 35px rgba(0,0,0,0.7), 0 0 20px rgba(245,158,11,0.15)",
                  transform: `rotate(2deg) translate3d(${tilt.x * 18}px, ${tilt.y * 18}px, 0)`,
                  transition: "transform 0.2s ease-out",
                }}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={getExpertPhoto(card1)}
                    onError={handleImgError}
                    alt={card1.name}
                    className="w-12 h-12 rounded-full object-cover border-2 shrink-0 shadow-md border-amber-500/80"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p style={{ ...display, color: isLight ? "#0F172A" : "#FFFFFF" }} className="text-base font-bold">{card1.name}</p>
                      <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                    </div>
                    <p className={`text-[11px] font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>{card1.field} · {card1.years} yrs</p>
                  </div>
                </div>

                <div className={`mt-3 pt-2.5 border-t ${isLight ? "border-slate-100" : "border-white/10"} flex items-center justify-between text-xs`}>
                  <div className="flex items-center gap-1.5">
                    <Stars n={card1.rating || 0} />
                    <span className="font-bold text-xs" style={{ color: isLight ? "#0F172A" : "#FFFFFF" }}>{(Number(card1.rating) || 0).toFixed(1)}</span>
                  </div>
                  <span className="font-bold font-mono text-sm" style={{ color: isLight ? "#B45309" : "#FBBF24" }}>₹{card1.rate}/hr</span>
                </div>
              </div>
            );
          })()}

          {/* Floating Executive Card 2 (Admin Bottom Hero Spotlight) */}
          {(() => {
            const card2 = experts?.find(e => e.verified && e.heroSpotlight && e.heroPosition === "bottom") 
              || experts?.find(e => e.verified && e.id === "exp-5") 
              || { name: "Anjali Menon", field: "School Mathematics", years: 27, rate: 400, rating: 0, id: "exp-5" };

            return (
              <div
                className="absolute left-4 bottom-5 w-72 p-4 rounded-2xl backdrop-blur-xl shadow-2xl transition-all border"
                style={{
                  background: isLight ? "rgba(255, 255, 255, 0.98)" : "rgba(11, 17, 26, 0.92)",
                  borderColor: isLight ? "rgba(6, 182, 212, 0.4)" : "rgba(255, 255, 255, 0.15)",
                  boxShadow: isLight 
                    ? "0 20px 40px -10px rgba(0,0,0,0.12), 0 0 20px rgba(6,182,212,0.15)" 
                    : "0 15px 35px rgba(0,0,0,0.7), 0 0 20px rgba(6,182,212,0.15)",
                  transform: `rotate(-3deg) translate3d(${tilt.x * -20}px, ${tilt.y * -20}px, 0)`,
                  transition: "transform 0.2s ease-out",
                }}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={getExpertPhoto(card2)}
                    onError={handleImgError}
                    alt={card2.name}
                    className="w-12 h-12 rounded-full object-cover border-2 shrink-0 shadow-md border-cyan-500/80"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p style={{ ...display, color: isLight ? "#0F172A" : "#FFFFFF" }} className="text-base font-bold">{card2.name}</p>
                      <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                    </div>
                    <p className={`text-[11px] font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>{card2.field} · {card2.years} yrs</p>
                  </div>
                </div>

                <div className={`mt-3 pt-2.5 border-t ${isLight ? "border-slate-100" : "border-white/10"} flex items-center justify-between text-xs`}>
                  <div className="flex items-center gap-1.5">
                    <Stars n={card2.rating || 0} />
                    <span className="font-bold text-xs" style={{ color: isLight ? "#0F172A" : "#FFFFFF" }}>{(Number(card2.rating) || 0).toFixed(1)}</span>
                  </div>
                  <span className="font-bold font-mono text-sm" style={{ color: isLight ? "#0284C7" : "#38BDF8" }}>₹{card2.rate}/hr</span>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Featured Mentora Senior Advisors Spotlight Section */}
      <section id="featured-advisors" className={`px-4 sm:px-8 md:px-14 py-16 border-y relative transition-colors duration-300 ${isLight ? "border-slate-200" : "border-white/10"}`} style={{ background: isLight ? "#F8FAFC" : "#080D16" }}>
        {/* Header Title Row */}
        <div className="mb-6">
          <div>
            <span 
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-widest uppercase mb-2.5 transition-all duration-300 border shadow-xs"
              style={{
                backgroundColor: isLight ? "rgba(245, 158, 11, 0.12)" : "rgba(245, 158, 11, 0.18)",
                borderColor: isLight ? "#FCD34D" : "rgba(245, 158, 11, 0.4)",
                color: isLight ? "#B45309" : "#FBBF24"
              }}
            >
              <span 
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  backgroundColor: isLight ? "#D97706" : "#F59E0B",
                  boxShadow: isLight ? "0 0 8px rgba(217, 119, 6, 0.6)" : "0 0 10px #FBBF24"
                }}
              />
              Verified Executive Talent
            </span>
            <h2 style={{ ...display }} className="text-3xl sm:text-4xl lg:text-[2.65rem] font-black tracking-tight leading-tight">
              <span style={{ color: isLight ? "#0F172A" : "#FFFFFF" }}>
                Featured Senior{" "}
              </span>
              <span 
                style={{
                  color: isLight ? "#D97706" : "#FBBF24",
                  backgroundImage: isLight 
                    ? "linear-gradient(135deg, #D97706 0%, #EA580C 50%, #B45309 100%)" 
                    : "linear-gradient(135deg, #FDE68A 0%, #FBBF24 50%, #F59E0B 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  display: "inline-block",
                  filter: isLight ? "drop-shadow(0 1px 1px rgba(0,0,0,0.05))" : "drop-shadow(0 2px 14px rgba(245, 158, 11, 0.35))"
                }}
              >
                Executive Advisors
              </span>
            </h2>
          </div>
        </div>

        {/* Category Filter Pills - Full-Width Row with Mouse Wheel & Arrow Button Scrolling */}
        <div className="relative mb-8 group/scroll">
          {/* Left Arrow Button */}
          <button
            onClick={() => scrollCategories('left')}
            className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full items-center justify-center transition-all duration-200 cursor-pointer shadow-md hover:scale-105 active:scale-95 border"
            style={{
              backgroundColor: isLight ? "#FFFFFF" : "#0F172A",
              borderColor: isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.15)",
              color: isLight ? "#0F172A" : "#F8FAFC"
            }}
            aria-label="Scroll categories left"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Scrollable Pills Container */}
          <div 
            ref={categoryScrollRef}
            onWheel={(e) => {
              if (e.deltaY === 0) return;
              if (e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
                e.currentTarget.scrollLeft += e.deltaY * 1.2;
              }
            }}
            className="flex items-center gap-2.5 overflow-x-auto pb-2 text-xs no-scrollbar md:px-6"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <style>{`
              .no-scrollbar::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
              .no-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
            `}</style>
            {["All", ...expertiseFields].map((cat) => {
              const active = activeCategory === cat;
              // Distinct domain color code configuration for each category
              const catColorMap: Record<string, { light: string; dark: string; dot: string; bgLight: string; bgDark: string; borderLight: string; borderDark: string }> = {
                "All": {
                  light: "#D97706",
                  dark: "#FBBF24",
                  dot: "#F59E0B",
                  bgLight: "#FEF3C7",
                  bgDark: "rgba(245, 158, 11, 0.18)",
                  borderLight: "#FCD34D",
                  borderDark: "rgba(245, 158, 11, 0.4)"
                },
                "Finance & Taxation": {
                  light: "#047857",
                  dark: "#34D399",
                  dot: "#10B981",
                  bgLight: "#ECFDF5",
                  bgDark: "rgba(16, 185, 129, 0.16)",
                  borderLight: "#A7F3D0",
                  borderDark: "rgba(16, 185, 129, 0.35)"
                },
                "HR & Talent": {
                  light: "#7C3AED",
                  dark: "#C084FC",
                  dot: "#8B5CF6",
                  bgLight: "#F5F3FF",
                  bgDark: "rgba(139, 92, 246, 0.16)",
                  borderLight: "#DDD6FE",
                  borderDark: "rgba(139, 92, 246, 0.35)"
                },
                "Tech & Digital": {
                  light: "#0284C7",
                  dark: "#38BDF8",
                  dot: "#0EA5E9",
                  bgLight: "#F0F9FF",
                  bgDark: "rgba(14, 165, 233, 0.16)",
                  borderLight: "#BAE6FD",
                  borderDark: "rgba(14, 165, 233, 0.35)"
                },
                "Legal & Compliance": {
                  light: "#B45309",
                  dark: "#FBBF24",
                  dot: "#F59E0B",
                  bgLight: "#FFFBEB",
                  bgDark: "rgba(245, 158, 11, 0.16)",
                  borderLight: "#FDE68A",
                  borderDark: "rgba(245, 158, 11, 0.35)"
                },
                "Marketing Strategy": {
                  light: "#E11D48",
                  dark: "#FB7185",
                  dot: "#F43F5E",
                  bgLight: "#FFF1F2",
                  bgDark: "rgba(244, 63, 94, 0.16)",
                  borderLight: "#FECDD3",
                  borderDark: "rgba(244, 63, 94, 0.35)"
                },
                "Operations & Logistics": {
                  light: "#0D9488",
                  dark: "#2DD4BF",
                  dot: "#14B8A6",
                  bgLight: "#F0FDFA",
                  bgDark: "rgba(20, 184, 166, 0.16)",
                  borderLight: "#99F6E4",
                  borderDark: "rgba(20, 184, 166, 0.35)"
                },
                "School Mathematics": {
                  light: "#4338CA",
                  dark: "#818CF8",
                  dot: "#6366F1",
                  bgLight: "#EEF2FF",
                  bgDark: "rgba(99, 102, 241, 0.16)",
                  borderLight: "#C7D2FE",
                  borderDark: "rgba(99, 102, 241, 0.35)"
                },
                "Teaching & Academia": {
                  light: "#1D4ED8",
                  dark: "#60A5FA",
                  dot: "#3B82F6",
                  bgLight: "#EFF6FF",
                  bgDark: "rgba(59, 130, 246, 0.16)",
                  borderLight: "#BFDBFE",
                  borderDark: "rgba(59, 130, 246, 0.35)"
                },
                "Manufacturing Ops": {
                  light: "#C2410C",
                  dark: "#FB923C",
                  dot: "#F97316",
                  bgLight: "#FFF7ED",
                  bgDark: "rgba(249, 115, 22, 0.16)",
                  borderLight: "#FED7AA",
                  borderDark: "rgba(249, 115, 22, 0.35)"
                },
                "Healthcare & Biotech": {
                  light: "#DC2626",
                  dark: "#F87171",
                  dot: "#EF4444",
                  bgLight: "#FEF2F2",
                  bgDark: "rgba(239, 68, 68, 0.16)",
                  borderLight: "#FECACA",
                  borderDark: "rgba(239, 68, 68, 0.35)"
                }
              };
              const colorConfig = catColorMap[cat] || {
                light: "#0284C7",
                dark: "#38BDF8",
                dot: "#0EA5E9",
                bgLight: "#F0F9FF",
                bgDark: "rgba(14, 165, 233, 0.16)",
                borderLight: "#BAE6FD",
                borderDark: "rgba(14, 165, 233, 0.35)"
              };
              const catTextColor = isLight ? colorConfig.light : colorConfig.dark;

              return (
                <button
                  key={cat}
                  onClick={(e) => {
                    setActiveCategory(cat);
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                  }}
                  className="group/btn px-4 py-2 rounded-full font-bold transition-all duration-200 cursor-pointer border shrink-0 tracking-tight flex items-center gap-2"
                  style={{
                    backgroundColor: active 
                      ? "#F59E0B"
                      : (isLight ? "#FFFFFF" : "rgba(15, 23, 42, 0.85)"),
                    borderColor: active
                      ? (isLight ? "#D97706" : "#FCD34D")
                      : (isLight ? colorConfig.borderLight : colorConfig.borderDark),
                    color: active
                      ? "#0F172A"
                      : catTextColor,
                    boxShadow: active
                      ? (isLight ? "0 4px 14px rgba(245, 158, 11, 0.35)" : "0 0 20px rgba(245, 158, 11, 0.45)")
                      : (isLight ? "0 1px 3px rgba(0, 0, 0, 0.05)" : "none"),
                    transform: active ? "scale(1.03)" : "scale(1)"
                  }}
                >
                  <span 
                    className="w-2 h-2 rounded-full inline-block shrink-0 transition-transform duration-200 group-hover/btn:scale-125"
                    style={{ 
                      backgroundColor: active ? "#0F172A" : colorConfig.dot,
                      boxShadow: `0 0 8px ${colorConfig.dot}66`
                    }}
                  />
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>

          {/* Right Arrow Button */}
          <button
            onClick={() => scrollCategories('right')}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full items-center justify-center transition-all duration-200 cursor-pointer shadow-md hover:scale-105 active:scale-95 border"
            style={{
              backgroundColor: isLight ? "#FFFFFF" : "#0F172A",
              borderColor: isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.15)",
              color: isLight ? "#0F172A" : "#F8FAFC"
            }}
            aria-label="Scroll categories right"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Advisors Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {filteredAdvisors.map((adv, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1.5 ${
                isLight 
                  ? "hover:border-amber-400/70 hover:shadow-xl hover:shadow-amber-500/10" 
                  : "hover:border-amber-400/60 hover:shadow-[0_16px_40px_rgba(245,158,11,0.18)]"
              }`}
              style={{
                background: isLight 
                  ? "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)" 
                  : "linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(11, 17, 28, 0.98) 100%)",
                borderColor: isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.12)",
                boxShadow: isLight 
                  ? "0 10px 25px -5px rgba(0, 0, 0, 0.04), 0 8px 10px -6px rgba(0, 0, 0, 0.02)" 
                  : "0 14px 35px -5px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)",
                backdropFilter: "blur(16px)",
              }}
            >
              <div className="space-y-3.5 flex-1 flex flex-col">
                <div className={`relative overflow-hidden rounded-xl h-48 border ${isLight ? "border-slate-200/80" : "border-white/15"}`}>
                  <img
                    src={getExpertPhoto(adv)}
                    onError={handleImgError}
                    alt={adv.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[10px] backdrop-blur-md flex items-center gap-1.5 font-bold border shadow-xs ${
                    isLight 
                      ? "bg-white/95 text-emerald-800 border-emerald-300/80" 
                      : "bg-emerald-950/90 text-emerald-300 border-emerald-400/50 shadow-[0_0_14px_rgba(16,185,129,0.35)]"
                  }`}>
                    <ShieldCheck size={12} className={isLight ? "text-emerald-600" : "text-emerald-400"} /> Verified
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-between min-h-[76px]">
                  <div>
                    <h3 style={{ ...display, color: isLight ? "#0F172A" : "#FFFFFF" }} className={`text-[19px] font-black tracking-tight transition-colors ${isLight ? "group-hover:text-amber-600" : "group-hover:text-amber-300"}`}>
                      {adv.name}
                    </h3>
                    <p className={`text-xs font-bold mt-1 line-clamp-2 leading-snug ${isLight ? "text-amber-700" : "text-amber-400"}`}>
                      {adv.title}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 text-[11.5px] mt-2 font-medium ${isLight ? "text-slate-600" : "text-slate-300"}`}>
                    <span className={`font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{adv.years} Years Exp</span>
                    <span className={isLight ? "text-slate-400" : "text-slate-600"}>·</span>
                    <span className={`truncate ${isLight ? "text-slate-600" : "text-slate-300"}`}>{adv.company ? `Ex-${adv.company}` : "Senior Executive"}</span>
                  </div>

                  {onViewDossier && (
                    <button 
                      onClick={() => onViewDossier(adv)} 
                      className={`text-xs mt-2 font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                        isLight ? "text-amber-600 hover:text-amber-700" : "text-amber-400 hover:text-amber-300"
                      }`}
                    >
                      <FileText size={12} /> View Complete Dossier →
                    </button>
                  )}
                </div>
              </div>

              <div className={`pt-3.5 mt-4 border-t space-y-3 ${isLight ? "border-slate-100" : "border-white/10"}`}>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Stars n={adv.rating || 0} />
                    <span className={`font-bold text-xs ${isLight ? "text-slate-800" : "text-white"}`}>
                      {adv.rating && Number(adv.rating) > 0 ? Number(adv.rating).toFixed(1) : "0.0"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-0.5 font-mono">
                    <span className={`text-xs font-bold ${isLight ? "text-amber-600" : "text-amber-400"}`}>₹</span>
                    <span className={`font-mono font-black text-base tracking-tight ${isLight ? "text-slate-950" : "text-white"}`}>{adv.rate}</span>
                    <span className={`text-xs font-medium ${isLight ? "text-slate-500" : "text-slate-400"}`}>/hr</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {onViewDossier && (
                    <Button3D size="sm" variant="ghost" onClick={() => onViewDossier(adv)}>
                      Dossier
                    </Button3D>
                  )}
                  <Button3D size="sm" variant="brass" className="flex-1" onClick={() => onOpenAuth("signup", "client")}>
                    Book
                  </Button3D>
                  <button
                    type="button"
                    onClick={() => onOpenAuth("signup", "client")}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                      isLight
                        ? "bg-cyan-50 text-cyan-800 border-cyan-300 hover:bg-cyan-100"
                        : "bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25 hover:border-cyan-400"
                    }`}
                    title="Request Dedicated Project Review (Audit, Written Report & 2 Meetings)"
                  >
                    <Briefcase size={11} className={isLight ? "text-cyan-700" : "text-cyan-400"} /> Review
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Statistics Section with Embedded 3D Spinning Globe Graphic */}
      <Reveal>
        <section id="organizations" className={`px-4 sm:px-8 md:px-14 py-16 grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch border-b transition-colors duration-300 ${isLight ? "border-slate-200" : "border-white/10"}`}>
          {/* Card 1: 120M+ Scale Metric */}
          <div className={`group flex flex-col items-center text-center justify-between p-6 sm:p-8 rounded-2xl border backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 ${
            isLight 
              ? "bg-white/95 border-slate-200/90 shadow-xl shadow-amber-500/5 hover:border-amber-400/70 hover:shadow-amber-500/10" 
              : "bg-slate-900/60 border-white/10 shadow-2xl shadow-black/40 hover:border-amber-500/40"
          }`}>
            {/* Top: Eyebrow badge */}
            <div className="w-full flex justify-center">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${
                isLight ? "bg-amber-100 text-amber-900 border border-amber-300/80 shadow-xs" : "bg-amber-500/15 text-amber-300 border border-amber-400/30"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_#F59E0B]"></span>
                Senior Workforce
              </span>
            </div>

            {/* Center: Visual centerpiece + Headline */}
            <div className="flex flex-col items-center justify-center my-5 min-h-[140px]">
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110"
                style={{
                  background: isLight ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.18)',
                  border: isLight ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(245, 158, 11, 0.4)',
                  boxShadow: isLight ? '0 2px 10px rgba(245, 158, 11, 0.12)' : '0 0 16px rgba(245, 158, 11, 0.25)',
                }}
              >
                <Users size={28} className={isLight ? "text-amber-600" : "text-amber-400"} />
              </div>
              <p style={{ ...display }} className={`text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r ${
                isLight ? "from-amber-600 via-amber-700 to-orange-700" : "from-amber-300 via-amber-400 to-amber-500"
              } drop-shadow-xs`}>
                120M+
              </p>
            </div>

            {/* Bottom: Description */}
            <div className="w-full">
              <p className={`text-[13.5px] leading-relaxed font-medium ${isLight ? "text-slate-600" : "text-slate-300"}`}>
                retired professionals in India — many with decades of sharp, senior-level intuition that the job market currently overlooks.
              </p>
            </div>
          </div>

          {/* Card 2: Underused Potential with 3D Globe */}
          <div className={`group flex flex-col items-center text-center justify-between p-6 sm:p-8 rounded-2xl border backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 ${
            isLight 
              ? "bg-white/95 border-slate-200/90 shadow-xl shadow-cyan-500/5 hover:border-cyan-400/70 hover:shadow-cyan-500/10" 
              : "bg-slate-900/70 border-white/10 shadow-2xl shadow-black/40 hover:border-cyan-500/40"
          }`}>
            {/* Top: Eyebrow badge */}
            <div className="w-full flex justify-center">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${
                isLight ? "bg-slate-100 text-slate-800 border border-slate-300/80 shadow-xs" : "bg-white/10 text-white border border-white/20"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06B6D4]"></span>
                Opportunity Gap
              </span>
            </div>

            {/* Center: Visual centerpiece (3D Globe) + Headline */}
            <div className="flex flex-col items-center justify-center my-5 min-h-[140px]">
              <div className="h-20 w-full flex items-center justify-center mb-1">
                <GlobeGraphic />
              </div>
              <p style={{ ...display, color: isLight ? "#0F172A" : "#FFFFFF" }} className="text-2xl sm:text-3xl font-black tracking-tight">
                Underused Potential
              </p>
            </div>

            {/* Bottom: Description */}
            <div className="w-full">
              <p className={`text-[13.5px] leading-relaxed font-medium ${isLight ? "text-slate-600" : "text-slate-300"}`}>
                Most are either sitting idle or entirely outside the digital economy, despite desiring active advisory roles.
              </p>
            </div>
          </div>

          {/* Card 3: In Demand */}
          <div className={`group flex flex-col items-center text-center justify-between p-6 sm:p-8 rounded-2xl border backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 ${
            isLight 
              ? "bg-white/95 border-slate-200/90 shadow-xl shadow-teal-500/5 hover:border-teal-400/70 hover:shadow-teal-500/10" 
              : "bg-slate-900/60 border-white/10 shadow-2xl shadow-black/40 hover:border-teal-500/40"
          }`}>
            {/* Top: Eyebrow badge */}
            <div className="w-full flex justify-center">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${
                isLight ? "bg-cyan-100 text-cyan-900 border border-cyan-300/80 shadow-xs" : "bg-cyan-500/15 text-cyan-300 border border-cyan-400/30"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06B6D4]"></span>
                Market Demand
              </span>
            </div>

            {/* Center: Visual centerpiece + Headline */}
            <div className="flex flex-col items-center justify-center my-5 min-h-[140px]">
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110"
                style={{
                  background: isLight ? 'rgba(6, 182, 212, 0.12)' : 'rgba(6, 182, 212, 0.18)',
                  border: isLight ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(6, 182, 212, 0.4)',
                  boxShadow: isLight ? '0 2px 10px rgba(6, 182, 212, 0.12)' : '0 0 16px rgba(6, 182, 212, 0.25)',
                }}
              >
                <TrendingUp size={28} className={isLight ? "text-teal-600" : "text-teal-400"} />
              </div>
              <p style={{ ...display }} className={`text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r ${
                isLight ? "from-cyan-600 via-teal-600 to-emerald-700" : "from-cyan-300 via-teal-300 to-emerald-400"
              } drop-shadow-xs`}>
                In Demand
              </p>
            </div>

            {/* Bottom: Description */}
            <div className="w-full">
              <p className={`text-[13.5px] leading-relaxed font-medium ${isLight ? "text-slate-600" : "text-slate-300"}`}>
                Founders, enterprise teams, and students seek veteran mentors and cost-effective strategic advisors daily.
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* How It Works Section — Premium Horizontal Accordion Feature Showcase */}
      <section id="how" className="px-4 md:px-8 lg:px-14 py-20 relative">
        <Reveal>
          <FeatureAccordionShowcase
            isLight={isLight}
            trophyGraphic={<TrophyGraphic />}
            vaultGraphic={<VaultGraphic />}
          />
        </Reveal>
      </section>

      {/* Stories / Testimonials Section */}
      <section id="stories" className={`px-4 sm:px-8 md:px-14 py-20 border-t relative z-10 transition-colors duration-300 ${isLight ? "border-slate-200" : "border-white/10"}`} style={{ background: isLight ? "linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)" : "linear-gradient(180deg, #080D16 0%, #05080E 100%)" }}>
        {/* Section Header */}
        <div className="mb-12 text-center max-w-2xl mx-auto space-y-3">
          <span 
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-widest uppercase transition-all duration-300 border shadow-xs"
            style={{
              backgroundColor: isLight ? "rgba(245, 158, 11, 0.12)" : "rgba(245, 158, 11, 0.18)",
              borderColor: isLight ? "#FCD34D" : "rgba(245, 158, 11, 0.4)",
              color: isLight ? "#B45309" : "#FBBF24"
            }}
          >
            <span 
              className="w-2 h-2 rounded-full animate-pulse"
              style={{
                backgroundColor: isLight ? "#D97706" : "#F59E0B",
                boxShadow: isLight ? "0 0 8px rgba(217, 119, 6, 0.6)" : "0 0 10px #FBBF24"
              }}
            />
            Real Executive Impact
          </span>
          <h2 style={{ ...display }} className="text-3xl sm:text-4xl lg:text-[2.65rem] font-black tracking-tight leading-tight">
            <span style={{ color: isLight ? "#0F172A" : "#FFFFFF" }}>Stories from </span>
            <span 
              style={{
                color: isLight ? "#D97706" : "#FBBF24",
                backgroundImage: isLight 
                  ? "linear-gradient(135deg, #D97706 0%, #EA580C 50%, #B45309 100%)" 
                  : "linear-gradient(135deg, #FDE68A 0%, #FBBF24 50%, #F59E0B 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                display: "inline-block",
                filter: isLight ? "drop-shadow(0 1px 2px rgba(217, 119, 6, 0.12))" : "drop-shadow(0 2px 14px rgba(245, 158, 11, 0.35))"
              }}
            >
              Mentora
            </span>
          </h2>
          <p className="text-sm sm:text-base font-normal max-w-xl mx-auto leading-relaxed" style={{ color: isLight ? "#475569" : "#94A3B8" }}>
            Unvarnished accounts of veteran strategic foresight delivering high-stakes governance, tax audits, and operational breakthroughs.
          </p>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-xs"
              style={{
                backgroundColor: isLight ? "#FFFFFF" : "rgba(15, 23, 42, 0.8)",
                borderColor: isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.12)",
                color: isLight ? "#0F172A" : "#F8FAFC"
              }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"></span>
              <span>4.9 / 5.0 Average Rating</span>
            </div>
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-xs"
              style={{
                backgroundColor: isLight ? "#FFFFFF" : "rgba(15, 23, 42, 0.8)",
                borderColor: isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.12)",
                color: isLight ? "#0F172A" : "#F8FAFC"
              }}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]"></span>
              <span>100% Verified Engagements</span>
            </div>
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-xs"
              style={{
                backgroundColor: isLight ? "#FFFFFF" : "rgba(15, 23, 42, 0.8)",
                borderColor: isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.12)",
                color: isLight ? "#0F172A" : "#F8FAFC"
              }}
            >
              <span className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.6)]"></span>
              <span>Direct Board Level Results</span>
            </div>
          </div>
        </div>

        {(() => {
          let featuredReviews: any[] = [];
          try {
            const raw = localStorage.getItem('app_platform_reviews');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                featuredReviews = parsed.filter((r: any) => r.featuredOnLanding === true);
              }
            }
          } catch {}

          if (featuredReviews.length === 0) {
            featuredReviews = [
              {
                id: 'rev-1',
                clientName: 'Priya Sharma',
                clientAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
                expertName: 'Sunita Rao',
                comment: 'Sunita explained our corporate GST exposure clearly without any fluff or expensive law firm rates. We booked her again the exact same week for our valuation audit.',
                rating: 5
              },
              {
                id: 'rev-3',
                clientName: 'InfraCorp Logistics',
                clientAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
                expertName: 'Ravi Subramaniam',
                comment: 'Advised on our board compliance and contract arbitration. Resolved an outstanding vendor dispute cleanly in two sessions.',
                rating: 5
              },
              {
                id: 'rev-4',
                clientName: 'Apex Healthtech',
                clientAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
                expertName: 'Anjali Menon',
                comment: 'Helped our engineering leadership structure our algorithmic IP and curriculum licensing model with incredible clarity.',
                rating: 5
              }
            ];
          }

          // Dynamic grid layout based on number of cards to guarantee symmetry
          const gridLayoutClass = featuredReviews.length === 1
            ? "max-w-xl mx-auto"
            : featuredReviews.length === 2
            ? "grid md:grid-cols-2 gap-6 max-w-4xl mx-auto"
            : "grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch";

          return (
            <div className={gridLayoutClass}>
              {featuredReviews.map((rev: any, idx: number) => (
                <div 
                  key={rev.id || idx} 
                  className="p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1.5"
                  style={{
                    background: isLight 
                      ? "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)" 
                      : "linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(11, 17, 28, 0.98) 100%)",
                    borderColor: isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.12)",
                    boxShadow: isLight 
                      ? "0 10px 25px -5px rgba(0, 0, 0, 0.04), 0 8px 10px -6px rgba(0, 0, 0, 0.02)" 
                      : "0 14px 35px -5px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)",
                    backdropFilter: "blur(16px)"
                  }}
                >
                  <div className="space-y-4 flex-1 flex flex-col">
                    {/* Top Row: Stars + Rating Score + Verified Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Stars n={rev.rating || rev.stars || 5} />
                        <span className="font-mono font-bold text-xs" style={{ color: isLight ? "#0F172A" : "#FFFFFF" }}>
                          {(rev.rating || rev.stars || 5).toFixed(1)}
                        </span>
                      </div>
                      <span 
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs"
                        style={{
                          backgroundColor: isLight ? "rgba(16, 185, 129, 0.08)" : "rgba(16, 185, 129, 0.15)",
                          borderColor: isLight ? "#A7F3D0" : "rgba(52, 211, 153, 0.3)",
                          color: isLight ? "#047857" : "#34D399"
                        }}
                      >
                        <ShieldCheck size={11} className="shrink-0" />
                        Verified Advisory
                      </span>
                    </div>

                    {/* Testimonial Quote */}
                    <div className="flex-1 flex flex-col justify-center min-h-[72px] my-1">
                      <p 
                        className="text-sm leading-relaxed font-medium transition-colors"
                        style={{ color: isLight ? "#1E293B" : "#E2E8F0" }}
                      >
                        "{rev.comment || rev.note}"
                      </p>
                    </div>
                  </div>

                  {/* Author Attribution Footer */}
                  <div 
                    className="flex items-center gap-3 pt-3.5 mt-4 border-t transition-colors"
                    style={{ borderColor: isLight ? "#F1F5F9" : "rgba(255, 255, 255, 0.1)" }}
                  >
                    <img 
                      src={rev.clientAvatar || rev.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'} 
                      className="w-10 h-10 rounded-full object-cover border-2 shadow-xs shrink-0" 
                      style={{ borderColor: isLight ? "#FCD34D" : "rgba(245, 158, 11, 0.5)" }}
                      alt={rev.clientName || rev.from} 
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: isLight ? "#0F172A" : "#FFFFFF" }}>
                        {rev.clientName || rev.from}
                      </p>
                      <p className="text-[11px] font-semibold truncate flex items-center gap-1 mt-0.5" style={{ color: isLight ? "#B45309" : "#FBBF24" }}>
                        <span>Advisory Client for</span>
                        <span className="font-bold underline decoration-amber-500/40 underline-offset-2">
                          {rev.expertName || 'Senior Expert'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </section>

      {/* Footer */}
      <Footer
        theme={theme}
        setPage={setPage}
        onOpenAuth={onOpenAuth}
        userRole={userRole}
      />
    </div>
  );
}

/* ---------------------------------------------------------------
   AUTHENTICATION MODAL / PAGE (Strict MongoDB Registration First Flow)
---------------------------------------------------------------- */
function normalizeRole(r?: string | null): "client" | "expert" | "admin" {
  if (!r) return "client";
  const clean = String(r).trim().toLowerCase();
  if (clean === "expert" || clean === "senior_expert" || clean === "senior expert" || clean === "professional") {
    return "expert";
  }
  if (clean === "admin") return "admin";
  return "client";
}

function AuthPage({ 
  onClose, 
  onSuccessLogin, 
  initialMode = "signup", 
  initialRole = "client",
  theme = "dark" 
}: { 
  onClose: () => void; 
  onSuccessLogin: (role: string, user: any) => void;
  initialMode?: "signup" | "login";
  initialRole?: string;
  theme?: "dark" | "light";
}) {
  const isLight = theme === "light";
  const [mode, setMode] = useState<"signup" | "login">(initialMode || "signup");
  const [role, setRole] = useState<string>(initialRole || "client");

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { domains } = useDomains();
  const availableFields = useMemo(() => domains.filter(d => d.is_active !== false).map(d => d.name), [domains]);
  const [field, setField] = useState(availableFields[0] || "Finance & Taxation");
  const [title, setTitle] = useState("");
  const [years, setYears] = useState(25);
  const [baseRate, setBaseRate] = useState(600);
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (availableFields.length > 0 && !availableFields.includes(field)) {
      setField(availableFields[0]);
    }
  }, [availableFields, field]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      alert("Please enter your email address and password.");
      return;
    }

    try {
      if (mode === "signup") {
        const cleanRole = normalizeRole(role);
        if (cleanRole === "expert") {
          if (baseRate < 0 || baseRate > 1000) {
            alert("⚠️ Base Hourly Rate must be between ₹0 and ₹1,000.");
            return;
          }
        }
        const safeBaseRate = Math.max(0, Math.min(1000, Number(baseRate) || 0));

        // 1. REGISTER FLOW IN MONGODB / BACKEND
        const res = await mongoDB.registerUser({
          role: cleanRole as any,
          email: email.trim().toLowerCase(),
          password,
          name: name || (cleanRole === "client" ? "Northwind Client" : "Sunita Rao"),
          phone: phone || "",
          company: company || (cleanRole === "client" ? "Northwind Retail Pvt Ltd" : ""),
          title: title || (cleanRole === "expert" ? "Senior Executive Advisor" : ""),
          field,
          years,
          baseRate: safeBaseRate,
          bio: bio || (cleanRole === "client" ? "Seeking corporate advisory." : "Decades of executive expertise.")
        });

        if (!res.success) {
          const errMsg = res.message || res.error || 'Unable to register';
          console.error("Registration error:", errMsg, res);
          alert(`❌ Registration Error: ${errMsg}`);
          return;
        }

        // Establish Supabase session in browser if available
        try {
          await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password
          });
        } catch (supaErr) {
          console.warn("Supabase session note after signup:", supaErr);
        }

        alert(`✅ ${res.message || 'Account registered successfully.'}`);
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.5 } });
        
        const assignedRole = normalizeRole(res.user?.role || cleanRole);
        if (assignedRole === "admin") {
          const token = res.token || (res.user as any)?.token;
          if (token) {
            try {
              localStorage.setItem("admin_token", token);
              sessionStorage.setItem("admin_token", token);
            } catch {}
          }
        }
        onSuccessLogin(assignedRole, res.user || { email: email.trim().toLowerCase(), role: assignedRole, name });
      } else {
        // 2. SIGN IN FLOW VIA SUPABASE AUTH (WITH BACKEND ADMIN FALLBACK)
        const cleanEmail = email.trim().toLowerCase();
        const ADMIN_EMAILS = [
          'kushwahaashwani12@gmail.com',
          'kushwaahaashwani12@gmail.com',
          'kushwaashwani12@gmail.com'
        ];
        const isAdminTarget = ADMIN_EMAILS.includes(cleanEmail);

        let data: any = null;
        let error: any = null;
        let userProfile: any = null;

        // First attempt Supabase Auth
        try {
          const supaRes = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password
          });
          data = supaRes.data;
          error = supaRes.error;
        } catch (err: any) {
          error = err;
        }

        // If Supabase Auth fails, attempt backend / MongoDB authentication (crucial for Admin credentials)
        if (error) {
          try {
            const authRes = await mongoDB.authenticateUser(cleanEmail, password);
            if (authRes && authRes.success) {
              error = null;
              userProfile = authRes.user;
            }
          } catch (mErr) {
            console.warn("MongoDB fallback auth error:", mErr);
          }
        }

        if (error) {
          const errMsg = error.message || 'Invalid login credentials';
          console.error("Sign-In failed:", error);
          alert(`⚠️ Sign-In Failed: ${errMsg}`);
          return;
        }

        // Fetch user profile from MongoDB / local storage using Supabase user ID or email
        if (!userProfile) {
          try {
            const dbRes = await fetch('/api/db');
            if (dbRes.ok) {
              const dbData = await dbRes.json();
              userProfile = (dbData.users || []).find((u: any) =>
                String(u.email || '').toLowerCase() === cleanEmail || (data?.user?.id && u.id === data.user.id)
              );
              if (!userProfile && Array.isArray(dbData.experts)) {
                const foundExp = dbData.experts.find((e: any) =>
                  String(e.email || '').toLowerCase() === cleanEmail || (data?.user?.id && e.id === data.user.id)
                );
                if (foundExp) {
                  userProfile = { ...foundExp, role: 'expert' };
                }
              }
            }
          } catch (dbErr) {
            console.warn("Local DB fetch error:", dbErr);
          }
        }

        if (!userProfile) {
          try {
            const { data: supaUser } = await supabase
              .from('users')
              // Never download password_hash to the browser — only the profile fields we use.
              .select('id, email, full_name, role, phone, bio, avatar_url, is_verified')
              .eq('email', cleanEmail)
              .maybeSingle();
            if (supaUser) userProfile = supaUser;
          } catch (supaErr) {
            console.warn("Supabase users table query error:", supaErr);
          }
        }

        // (Removed: a lookup in the 'expert_profiles' table. That table does not exist in the
        //  database, so the request failed with 404 on every login and never found anything.)

        if (!userProfile) {
          try {
            // Slim lookup (no base64 documents), cached 15 s — see supabaseExpertiseService.
            const supaExp: any = await getExpertSlimByKey(cleanEmail);
            if (supaExp) userProfile = { ...supaExp, role: 'expert' };
          } catch {}
        }

        // Determine saved role from user profile or Supabase user_metadata first (Point 5)
        const savedUserRole = userProfile?.role || data?.user?.user_metadata?.role || (data?.user?.app_metadata as any)?.role;
        const normalizedSavedRole = savedUserRole ? normalizeRole(savedUserRole) : null;
        const fallbackRole = normalizeRole(role || "client");
        const isUserAdmin = isAdminTarget || normalizedSavedRole === "admin" || data?.user?.user_metadata?.role === "admin";

        const assignedRole = isUserAdmin
          ? "admin"
          : (normalizedSavedRole || fallbackRole);

        // Create profile object if it doesn't exist
        if (!userProfile) {
          userProfile = {
            id: data?.user?.id || `usr-${Date.now()}`,
            email: cleanEmail,
            name: data?.user?.user_metadata?.full_name || data?.user?.user_metadata?.name || (isUserAdmin ? "Ashwani Kushwaha" : assignedRole === "client" ? "Northwind Client" : "Sunita Rao"),
            full_name: data?.user?.user_metadata?.full_name || data?.user?.user_metadata?.name || (isUserAdmin ? "Ashwani Kushwaha" : assignedRole === "client" ? "Northwind Client" : "Sunita Rao"),
            role: assignedRole,
            phone: data?.user?.user_metadata?.phone || "",
            company: data?.user?.user_metadata?.company || (assignedRole === "client" ? "Northwind Retail Pvt Ltd" : ""),
            title: data?.user?.user_metadata?.title || (assignedRole === "expert" ? "Senior Executive Advisor" : ""),
            field: data?.user?.user_metadata?.field || (assignedRole === "expert" ? field : "Finance & Taxation"),
            bio: data?.user?.user_metadata?.bio || (assignedRole === "client" ? "Seeking corporate advisory." : "Decades of executive expertise.")
          };

          try {
            await supabase.from('users').insert({
              id: data?.user?.id,
              email: cleanEmail,
              full_name: userProfile.name,
              role: userProfile.role,
              phone: userProfile.phone || null
            });
          } catch {}
        }

        alert(`✅ Welcome Back! Signed in successfully.`);
        confetti({ particleCount: 50, spread: 50, origin: { y: 0.5 } });

        if (assignedRole === "admin") {
          const token = userProfile?.token || (data?.session as any)?.access_token || (data?.user as any)?.token || "admin-session-token";
          if (token) {
            try {
              localStorage.setItem("admin_token", token);
              sessionStorage.setItem("admin_token", token);
              localStorage.setItem("admin_user_role", "admin");
              localStorage.setItem("current_user_role", "admin");
              localStorage.setItem("current_admin_page", "owner");
            } catch {}
          }
        }
        if (assignedRole === "expert" || userProfile?.role === "expert") {
          try {
            // Slim lookup (no base64 documents), cached 15 s — see supabaseExpertiseService.
            const supaExp: any = await getExpertSlimByKey(cleanEmail);
            if (supaExp) {
              const isVerified = Boolean(supaExp.verified === true);
              const status = isVerified ? 'approved' : (supaExp.verificationStatus || supaExp.documents?.verificationStatus || 'pending');
              userProfile = {
                ...userProfile,
                ...supaExp,
                role: 'expert',
                verified: isVerified,
                is_verified: isVerified,
                verificationStatus: status
              };
            }
          } catch {}
        }
        onSuccessLogin(assignedRole, { ...userProfile, role: assignedRole });
      }
    } catch (err: any) {
      console.error("Auth submit error:", err);
      alert(`❌ Authentication Error: ${err?.message || 'An unexpected error occurred. Please try again.'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div className={`w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative max-h-[92vh] overflow-y-auto border ${isLight ? "border-slate-200" : "border-white/15"}`} style={{ background: isLight ? "#FFFFFF" : "#0B111A", ...body }}>
        
        <div className={`relative h-28 p-6 flex flex-col justify-between overflow-hidden border-b ${isLight ? "border-slate-200" : "border-white/10"}`} style={{ background: isLight ? "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)" : "linear-gradient(180deg, #111A27 0%, #0B111A 100%)" }}>
          <div className="absolute inset-0 opacity-40">
            <ParticleField count={60} colorA={isLight ? "#D97706" : "#F59E0B"} colorB={isLight ? "#0284C7" : "#06B6D4"} />
          </div>
          <div className="relative z-10 flex justify-between items-center">
            <Logo theme={theme} />
            <button onClick={onClose} className={`p-1.5 rounded-full transition-all cursor-pointer ${isLight ? "bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200" : "bg-white/10 text-slate-300 hover:text-white hover:bg-white/20"}`}><X size={16} /></button>
          </div>
          <p className="relative z-10 text-xs font-semibold flex items-center gap-1.5" style={{ color: isLight ? "#B45309" : "#FCD34D" }}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${isLight ? "bg-amber-500" : "bg-amber-400"}`}></span>
            {mode === "signup" ? "Step 1: Register Account into Supabase Database" : "Step 2: Sign In with Verified Credentials"}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Navigation Tabs enforcing Registration First */}
          <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10">
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 text-xs py-2.5 rounded-lg transition-all font-bold cursor-pointer ${
                mode === "signup"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              1. Register New Account
            </button>
            <button
              onClick={() => setMode("login")}
              className={`flex-1 text-xs py-2.5 rounded-lg transition-all font-bold cursor-pointer ${
                mode === "login"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              2. Sign In
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Select Platform Role</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["client", "Client / Enterprise", Briefcase],
                ["expert", "Senior Expert", Award]
              ].map(([rKey, rLabel, Icon]: any) => {
                const active = role === rKey;
                return (
                  <button
                    key={rKey}
                    type="button"
                    onClick={() => setRole(rKey)}
                    className={`p-3 text-left rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                      active
                        ? "border-amber-500/80 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <Icon size={18} className={active ? "text-amber-400" : "text-slate-400"} />
                    <span className={`text-xs font-bold mt-2 ${active ? "text-amber-300" : "text-slate-300"}`}>{rLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={role === "client" ? "e.g. Vikramaditya Singh" : "e.g. Sunita Rao"}
                  className="w-full mt-1.5 px-3.5 py-2.5 text-xs rounded-xl outline-none border border-white/10 bg-[#111A27] text-white placeholder-slate-500 focus:border-amber-500/60 transition-colors"
                />
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full mt-1.5 px-3.5 py-2.5 text-xs rounded-xl outline-none border border-white/10 bg-[#111A27] text-white placeholder-slate-500 focus:border-amber-500/60 transition-colors font-mono"
                />
              </div>
            )}

            {mode === "signup" && role === "client" && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Company / Organization Name</label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Northwind Retail Pvt Ltd"
                  className="w-full mt-1.5 px-3.5 py-2.5 text-xs rounded-xl outline-none border border-white/10 bg-[#111A27] text-white placeholder-slate-500 focus:border-amber-500/60 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Email Address (Supabase Verified)</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full mt-1.5 px-3.5 py-2.5 text-xs rounded-xl outline-none border border-white/10 bg-[#111A27] text-white placeholder-slate-500 focus:border-amber-500/60 transition-colors font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Password</label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl outline-none border border-white/10 bg-[#111A27] text-white placeholder-slate-500 focus:border-amber-500/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === "signup" && role === "expert" && (
              <div className="space-y-3 pt-3 border-t border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider block text-amber-400">
                  Senior Professional Profile Details
                </span>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Executive Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Former Chief Financial Officer (Ex-CFO)"
                    className="w-full mt-1.5 px-3.5 py-2 text-xs rounded-xl outline-none border border-white/10 bg-[#111A27] text-white placeholder-slate-500 focus:border-amber-500/60"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Company / Organization</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. TATA Group, ICICI Bank"
                    className="w-full mt-1.5 px-3.5 py-2 text-xs rounded-xl outline-none border border-white/10 bg-[#111A27] text-white placeholder-slate-500 focus:border-amber-500/60"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Expertise Field</label>
                    <select
                      value={field}
                      onChange={(e) => setField(e.target.value)}
                      className="w-full mt-1.5 px-3 py-2 text-xs rounded-xl outline-none border border-white/10 bg-[#111A27] text-white cursor-pointer"
                    >
                      {availableFields.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Experience (Yrs)</label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={years}
                      onChange={(e) => setYears(Number(e.target.value) || 0)}
                      className="w-full mt-1.5 px-3 py-2 text-xs rounded-xl outline-none border border-white/10 bg-[#111A27] text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Base Rate (₹/hr)</label>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={baseRate}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setBaseRate(0);
                          return;
                        }
                        const num = Number(raw);
                        if (num > 1000) setBaseRate(1000);
                        else if (num < 0) setBaseRate(0);
                        else setBaseRate(num);
                      }}
                      className="w-full mt-1.5 px-3 py-2 text-xs rounded-xl outline-none border border-white/10 bg-[#111A27] text-amber-400 font-bold font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            <Button3D full type="submit" variant="brass" className="mt-4">
              <Save size={14} /> {mode === "signup" ? `Register Account` : `Sign In`}
            </Button3D>
          </form>

        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   CLIENT PAGE
---------------------------------------------------------------- */
function ClientPage({ 
  setPage, 
  clientProfile, 
  onUpdateClientProfile,
  experts,
  pendingVerifications = [],
  userRole,
  onRequireAuth,
  theme = "dark",
  onToggleTheme,
  onLogout,
  initialExpertForProjectReview,
  onProjectReviewExpertConsumed
}: { 
  setPage: (p: string) => void; 
  clientProfile: any;
  onUpdateClientProfile: (p: any) => void;
  experts: ExpertDoc[];
  pendingVerifications?: any[];
  userRole: string | null;
  onRequireAuth: () => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  onLogout?: () => void;
  initialExpertForProjectReview?: any;
  onProjectReviewExpertConsumed?: () => void;
}) {
  const { domains, selectedDomain: activeCategory, setSelectedDomain: setActiveCategory, getDomainName, refreshDomains } = useDomains();
  const expertiseFields = useMemo(() => domains.filter(d => d.is_active !== false).map(d => d.name), [domains]);
  const [searchQuery, setSearchQuery] = useState("");
  const [rateLimit, setRateLimit] = useState(1500);
  const storageKey = `client_upcoming_${(clientProfile?.email || "guest").toLowerCase()}`;
  const walletStorageKey = `client_wallet_${(clientProfile?.email || "guest").toLowerCase()}`;

  const [walletBalance, setWalletBalance] = useState<number>(() => {
    const saved = localStorage.getItem(walletStorageKey);
    if (saved !== null) {
      const num = Number(saved);
      if (!isNaN(num)) return num;
    }
    return 0;
  });

  const clientEmailClean = (clientProfile?.email || '').toLowerCase().trim();
  const clientIdClean = String(clientProfile?.id || '').toLowerCase().trim();

  const [upcoming, setUpcoming] = useState<any[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      const cleaned = sanitizeBookings(parsed).filter(b => b && b.id && !b.deletedByClient && !isClientRoleDeleted(b.id, clientProfile?.email));
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(storageKey, JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return [];
    }
  });

  useEffect(() => {
    // Centralized decision handler for Client Portal: updates state, active storageKey, and all client keys
    const applyBookingDecision = (detail: any) => {
      if (!detail) return;
      const targetId = String(detail.bookingId || detail.id || '');
      if (!targetId) return;
      const newStatus = detail.status || detail.decision || 'accepted';
      const expertName = detail.expertName || detail.expert_name || detail.expert;
      const meetUrl = detail.meetUrl || detail.meet_link || detail.meeting_link || '';
      const codeMatch = meetUrl ? meetUrl.match(/meet\.google\.com\/([a-z0-9-]+)/i) : null;
      const meetCode = codeMatch ? codeMatch[1] : (detail.meetCode || (meetUrl ? meetUrl.split("/").pop() : ''));
      const isDone = newStatus.toLowerCase().includes('complete') || detail.completed === true;
      const isLiveNow = !isDone && (newStatus.toLowerCase().includes('live') || detail.isLive === true);

      // Soft-delete guard: if hidden in Client Portal, do NOT resurrect
      if (isClientRoleDeleted(targetId, clientEmailClean)) {
        console.log('[CLIENT PORTAL] Booking is hidden/deleted by client, skipping update:', targetId);
        return;
      }

      console.log('⚡ [CLIENT PORTAL] Applying real-time booking update:', { targetId, newStatus, expertName, meetUrl, meetCode, isLive: isLiveNow, completed: isDone });

      setUpcoming(prev => {
        const idx = prev.findIndex(b => b && String(b.id) === targetId);
        let next: any[];
        if (idx >= 0) {
          next = [...prev];
          next[idx] = {
            ...next[idx],
            ...detail,
            status: newStatus,
            expert: expertName || next[idx].expert,
            meetUrl: meetUrl || next[idx].meetUrl || '',
            meet_link: meetUrl || next[idx].meet_link || '',
            meetCode: meetCode || next[idx].meetCode || '',
            isLive: isLiveNow,
            completed: isDone
          };
        } else {
          next = [{
            id: targetId,
            topic: detail.topic || 'Consultation',
            status: newStatus,
            expert: expertName || 'Expert',
            when: detail.when || 'Scheduled Time',
            clientEmail: detail.clientEmail || '',
            meetUrl: meetUrl,
            meet_link: meetUrl,
            meetCode: meetCode,
            isLive: isLiveNow,
            completed: isDone
          }, ...prev];
        }

        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
          mongoDB.syncKv(storageKey, next);
        } catch {}
        return next;
      });

      // Update ALL client_upcoming_* keys in localStorage to prevent any stale cache overwrite
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("client_upcoming_")) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                let changed = false;
                const updated = list.map((b: any) => {
                  if (b && String(b.id) === targetId) {
                    changed = true;
                    return {
                      ...b,
                      ...detail,
                      status: newStatus,
                      expert: expertName || b.expert,
                      meetUrl: meetUrl || b.meetUrl || '',
                      meet_link: meetUrl || b.meet_link || '',
                      meetCode: meetCode || b.meetCode || '',
                      isLive: isLiveNow,
                      completed: isDone
                    };
                  }
                  return b;
                });
                if (changed) {
                  localStorage.setItem(key, JSON.stringify(updated));
                  mongoDB.syncKv(key, updated);
                }
              }
            }
          }
        }
      } catch {}
    };

    // 1. Initial Authoritative Fetch from backend bookings table
    const loadSupabaseBookings = async () => {
      try {
        const localBookingIds: string[] = [];
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((b: any) => { if (b && b.id) localBookingIds.push(String(b.id)); });
            }
          }
        } catch {}

        const rawSbBookings = await fetchClientBookings(clientProfile?.id, clientProfile?.email, localBookingIds);
        const sbBookings = rawSbBookings.filter(b => !b.deletedByClient && !isClientRoleDeleted(b.id, clientEmailClean));

        if (sbBookings.length > 0) {
          setUpcoming(prev => {
            const sbMap = new Map<string, any>();
            sbBookings.forEach(b => sbMap.set(String(b.id), b));

            // Authoritative list from backend
            const merged = sbBookings.map(sbB => {
              const prevMatch = prev.find(p => p && String(p.id) === String(sbB.id));
              const realMeetUrl = sbB.meet_link || sbB.meeting_link || sbB.meetUrl || (prevMatch?.meetUrl || '');
              const codeMatch = realMeetUrl.match(/meet\.google\.com\/([a-z0-9-]+)/i);
              const realMeetCode = codeMatch ? codeMatch[1] : (realMeetUrl ? realMeetUrl.split("/").pop() : '');
              return {
                ...(prevMatch || {}),
                ...sbB,
                meetUrl: realMeetUrl,
                meet_link: realMeetUrl,
                meetCode: realMeetCode
              };
            });

            // Keep only recent optimistic bookings not yet synced
            prev.forEach(p => {
              if (p && p.id && !sbMap.has(String(p.id)) && !isClientRoleDeleted(p.id, clientEmailClean) && !p.deletedByClient) {
                const bClientEmail = (p.clientEmail || p.client_email || '').toLowerCase().trim();
                if (!bClientEmail || bClientEmail === clientEmailClean) {
                  const pCreated = p.created_at ? new Date(p.created_at).getTime() : 0;
                  if (Date.now() - pCreated < 120000) {
                    merged.push(p);
                  }
                }
              }
            });

            try {
              localStorage.setItem(storageKey, JSON.stringify(merged));
              mongoDB.syncKv(storageKey, merged);
            } catch {}
            return merged;
          });
        }
      } catch (err) {
        console.warn('[CLIENT PAGE] Supabase initial load note:', err);
      }
    };

    loadSupabaseBookings();

    // 2. Real-time Subscription to Supabase bookings table
    const unsubRealtime = subscribeToBookingsRealtime({
      channelName: 'bookings-realtime-channel',
      // Only this client's bookings (emails are stored lowercase). Without a filter every booking in
      // the whole table was pushed to every client's browser.
      filter: clientEmailClean ? `client_email=eq.${clientEmailClean}` : undefined,
      onInsert: (newBooking) => {
        if (newBooking.deletedByClient || isClientRoleDeleted(newBooking.id, clientEmailClean)) {
          return;
        }
        const bEmail = (newBooking.client_email || newBooking.clientEmail || '').toLowerCase().trim();
        const bId = String(newBooking.client_id || newBooking.clientId || '').toLowerCase().trim();
        if ((clientEmailClean && bEmail === clientEmailClean) || (clientIdClean && bId === clientIdClean)) {
          setUpcoming(prev => {
            if (prev.some(b => String(b.id) === String(newBooking.id))) return prev;
            const next = [newBooking, ...prev];
            localStorage.setItem(storageKey, JSON.stringify(next));
            return next;
          });
        }
      },
      onUpdate: (updatedBooking) => {
        console.log('[CLIENT REALTIME] Status updated on client session:', updatedBooking);
        if (updatedBooking.deletedByClient || isClientRoleDeleted(updatedBooking.id, clientEmailClean)) {
          setUpcoming(prev => {
            const next = prev.filter(b => String(b.id) !== String(updatedBooking.id));
            try {
              localStorage.setItem(storageKey, JSON.stringify(next));
              mongoDB.syncKv(storageKey, next);
            } catch {}
            return next;
          });
          return;
        }

        const meetLink = updatedBooking.meet_link || updatedBooking.meeting_link || updatedBooking.meetUrl || '';
        const codeMatch = meetLink.match(/meet\.google\.com\/([a-z0-9-]+)/i);
        const meetCode = codeMatch ? codeMatch[1] : (meetLink ? meetLink.split("/").pop() : '');

        applyBookingDecision({
          bookingId: updatedBooking.id,
          id: updatedBooking.id,
          status: updatedBooking.status,
          decision: updatedBooking.status,
          expertName: updatedBooking.expert_name || updatedBooking.expert,
          clientEmail: updatedBooking.client_email || updatedBooking.clientEmail,
          topic: updatedBooking.topic,
          meetUrl: meetLink,
          meet_link: meetLink,
          meetCode: meetCode,
          isLive: updatedBooking.status?.toLowerCase().includes('live') || updatedBooking.isLive,
          completed: updatedBooking.status?.toLowerCase().includes('complete') || updatedBooking.completed
        });
      },
      onDelete: (deletedId) => {
        setUpcoming(prev => {
          const next = prev.filter(b => String(b.id) !== String(deletedId));
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
            mongoDB.syncKv(storageKey, next);
          } catch {}
          return next;
        });
      }
    });

    // 3. Web API Native BroadcastChannel for instant cross-tab sync
    let bc: BroadcastChannel | null = null;
    let bcUpdates: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('mentora_booking_decisions');
        bc.onmessage = (event) => {
          console.log('[CLIENT BROADCASTCHANNEL] Decision received:', event.data);
          applyBookingDecision(event.data);
        };
        bcUpdates = new BroadcastChannel('mentora_booking_updates');
        bcUpdates.onmessage = (event) => {
          console.log('[CLIENT BROADCASTCHANNEL] Update received:', event.data);
          applyBookingDecision(event.data);
        };
      }
    } catch {}

    // 4. Cross-tab Storage Event Listener
    const handleStorageEvent = (e: StorageEvent) => {
      if ((e.key === 'mentora_last_booking_decision' || e.key === 'mentora_last_booking_update') && e.newValue) {
        try {
          const decision = JSON.parse(e.newValue);
          applyBookingDecision(decision);
        } catch {}
      } else if (e.key && e.key.startsWith('client_upcoming_')) {
        refreshUpcoming();
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // 5. Same-window custom event listener
    const handleCustomBookingDecision = (e: any) => {
      applyBookingDecision(e.detail);
    };
    window.addEventListener('booking_decision_updated', handleCustomBookingDecision);
    window.addEventListener('booking_updated', handleCustomBookingDecision);

    // 6. Polling & synchronization fallback (authoritative backend sync)
    const refreshUpcoming = async () => {
      // Fast local read for cached view
      const savedUpcoming = localStorage.getItem(storageKey);
      let localList: any[] = [];
      if (savedUpcoming) {
        try {
          const parsed = JSON.parse(savedUpcoming);
          localList = sanitizeBookings(parsed);
          if (localList.length !== parsed.length) {
            localStorage.setItem(storageKey, JSON.stringify(localList));
          }
        } catch {}
      }

      // Authoritative fetch for client's bookings from backend
      try {
        const localIds = localList.map(b => String(b.id)).filter(Boolean);
        const sbBookings = await fetchClientBookings(clientProfile?.id, clientProfile?.email, localIds);
        const validSbBookings = (sbBookings || []).filter(b => b && b.id && !b.deletedByClient && !isClientRoleDeleted(b.id, clientEmailClean));

        if (validSbBookings.length > 0) {
          setUpcoming(prev => {
            const sbMap = new Map<string, any>();
            validSbBookings.forEach(b => sbMap.set(String(b.id), b));

            const merged = validSbBookings.map(sbB => {
              const prevMatch = prev.find(p => p && String(p.id) === String(sbB.id));
              const realMeetUrl = sbB.meet_link || sbB.meeting_link || sbB.meetUrl || (prevMatch?.meetUrl || '');
              const codeMatch = realMeetUrl.match(/meet\.google\.com\/([a-z0-9-]+)/i);
              const realMeetCode = codeMatch ? codeMatch[1] : (realMeetUrl ? realMeetUrl.split("/").pop() : '');
              return {
                ...(prevMatch || {}),
                ...sbB,
                meetUrl: realMeetUrl,
                meet_link: realMeetUrl,
                meetCode: realMeetCode
              };
            });

            // Keep only recent optimistic bookings not yet synced
            prev.forEach(p => {
              if (p && p.id && !sbMap.has(String(p.id)) && !isClientRoleDeleted(p.id, clientEmailClean) && !p.deletedByClient) {
                const bClientEmail = (p.clientEmail || p.client_email || '').toLowerCase().trim();
                if (!bClientEmail || bClientEmail === clientEmailClean) {
                  const pCreated = p.created_at ? new Date(p.created_at).getTime() : 0;
                  if (Date.now() - pCreated < 120000) {
                    merged.push(p);
                  }
                }
              }
            });

            try {
              localStorage.setItem(storageKey, JSON.stringify(merged));
              mongoDB.syncKv(storageKey, merged);
            } catch {}
            return merged;
          });
        } else if (localList.length > 0) {
          const cleaned = localList.filter(b => b && b.id && !isClientRoleDeleted(b.id, clientEmailClean) && !b.deletedByClient && ((b.clientEmail || b.client_email || '').toLowerCase().trim() === clientEmailClean || !(b.clientEmail || b.client_email)));
          setUpcoming(cleaned);
        }
      } catch (sbErr) {
        if (localList.length > 0) {
          const cleaned = localList.filter(b => b && b.id && !isClientRoleDeleted(b.id, clientEmailClean) && !b.deletedByClient && ((b.clientEmail || b.client_email || '').toLowerCase().trim() === clientEmailClean || !(b.clientEmail || b.client_email)));
          setUpcoming(cleaned);
        }
      }

      // Authoritative Supabase & Backend Wallet Balance Fetch
      try {
        const savedWalletRaw = localStorage.getItem(walletStorageKey);
        const localBalNum = savedWalletRaw !== null ? Number(savedWalletRaw) : undefined;
        const walletRes = await fetchWalletBalance(clientProfile?.id, clientProfile?.email, localBalNum);
        if (typeof walletRes.balance === 'number') {
          setWalletBalance(walletRes.balance);
          try {
            localStorage.setItem(walletStorageKey, String(walletRes.balance));
          } catch {}
        }
      } catch {}

      refreshDomains().catch(() => {});
    };

    refreshUpcoming();
    // EGRESS FIX: was every 5 s even in hidden tabs. Booking changes already arrive instantly via
    // the realtime subscription + BroadcastChannel above, so this is only a safety-net refresh:
    // every 60 s while the tab is visible, and bursts of events are collapsed into one call.
    const debouncedRefreshUpcoming = debounce(refreshUpcoming, 400);
    window.addEventListener("focus", debouncedRefreshUpcoming);
    window.addEventListener("mongo_db_updated", debouncedRefreshUpcoming);
    window.addEventListener("mongo_kv_updated", debouncedRefreshUpcoming);
    const stopPolling = startVisibleInterval(refreshUpcoming, 60_000);

    return () => {
      unsubRealtime();
      if (bc) bc.close();
      if (bcUpdates) bcUpdates.close();
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("booking_decision_updated", handleCustomBookingDecision);
      window.removeEventListener("booking_updated", handleCustomBookingDecision);
      window.removeEventListener("focus", debouncedRefreshUpcoming);
      window.removeEventListener("mongo_db_updated", debouncedRefreshUpcoming);
      window.removeEventListener("mongo_kv_updated", debouncedRefreshUpcoming);
      debouncedRefreshUpcoming.cancel();
      stopPolling();
    };
  }, [clientProfile?.email, storageKey, walletStorageKey]);

  const [selectedExpertForBooking, setSelectedExpertForBooking] = useState<any | null>(null);
  const [selectedExpertForProfile, setSelectedExpertForProfile] = useState<any | null>(null);
  const [activeCallSession, setActiveCallSession] = useState<any | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [topupAmt, setTopupAmt] = useState(2000);
  const [selectedUpiApp, setSelectedUpiApp] = useState<"phonepe" | "gpay" | "paytm" | "amazonpay" | "bhim">("gpay");
  const [activeUpiGatewayModal, setActiveUpiGatewayModal] = useState<{ amount: number; app: any; upiId?: string } | null>(null);
  const [customUpiId, setCustomUpiId] = useState("");

  // Dedicated Project Review Workflow State (WORKFLOW B)
  const [selectedExpertForProjectReview, setSelectedExpertForProjectReview] = useState<any | null>(null);
  const [activeProjectReviewWorkspaceId, setActiveProjectReviewWorkspaceId] = useState<string | null>(null);
  const [myProjectReviews, setMyProjectReviews] = useState<ProjectReviewRecord[]>([]);
  const [clientActiveView, setClientActiveView] = useState<'directory' | 'project_reviews'>('directory');

  // Consume initialExpertForProjectReview from parent (e.g. redirected from global BookingModal)
  useEffect(() => {
    if (initialExpertForProjectReview) {
      setSelectedExpertForProjectReview(initialExpertForProjectReview);
      if (onProjectReviewExpertConsumed) onProjectReviewExpertConsumed();
    }
  }, [initialExpertForProjectReview]);

  const loadClientProjectReviews = async () => {
    if (!clientProfile?.email && !clientProfile?.id && !clientProfile?.name) return;
    try {
      const list = await mongoDB.getProjectReviews({
        clientId: clientProfile.id,
        clientEmail: clientProfile.email,
        clientName: clientProfile.name,
        role: 'client'
      });
      setMyProjectReviews(Array.isArray(list) ? list : (Array.isArray((list as any)?.projectReviews) ? (list as any).projectReviews : []));
    } catch {
      setMyProjectReviews([]);
    }
  };

  useEffect(() => {
    loadClientProjectReviews();
    const handlePRUpdate = () => loadClientProjectReviews();
    window.addEventListener('project_review_updated', handlePRUpdate);
    window.addEventListener('storage', handlePRUpdate);
    window.addEventListener('mongo_kv_updated', handlePRUpdate);
    // EGRESS FIX: was every 3 s. Updates also arrive through the events above.
    const stopPolling = startVisibleInterval(loadClientProjectReviews, 60_000);
    return () => {
      window.removeEventListener('project_review_updated', handlePRUpdate);
      window.removeEventListener('storage', handlePRUpdate);
      window.removeEventListener('mongo_kv_updated', handlePRUpdate);
      stopPolling();
    };
  }, [clientProfile?.email]);


  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewExpertName, setReviewExpertName] = useState("JK");
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const handleSubmittingClientReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) {
      alert("Please enter review comments before submitting.");
      return;
    }

    try {
      const raw = localStorage.getItem("app_platform_reviews");
      let current: any[] = [];
      if (raw) {
        try { current = JSON.parse(raw); } catch {}
      }

      const targetExp = experts.find((e: any) => 
        e.name?.toLowerCase() === reviewExpertName.toLowerCase() ||
        e.id === reviewExpertName ||
        e.email?.toLowerCase() === reviewExpertName.toLowerCase()
      );

      // Find completed sessions for this client & expert to link review
      const completedSessionsForExp = upcoming.filter((b: any) => 
        (b.status === "Completed" || b.completed === true) &&
        (
          !reviewExpertName || 
          b.expert?.toLowerCase() === reviewExpertName.toLowerCase() ||
          b.expertEmail?.toLowerCase() === targetExp?.email?.toLowerCase()
        )
      );

      const effectiveSessionId = reviewSessionId || completedSessionsForExp[0]?.id || `session-completed-${Date.now()}`;

      // Check if this completed session has already been reviewed
      const alreadyReviewed = current.some((r: any) => 
        (r.sessionId && r.sessionId === effectiveSessionId) ||
        (r.session_id && r.session_id === effectiveSessionId)
      );

      if (alreadyReviewed) {
        alert("A rating has already been submitted for this consultation session.");
        return;
      }

      const newRev = {
        id: `rev-${Date.now()}`,
        clientName: clientProfile?.name || "Corporate Client",
        clientAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        clientId: clientProfile?.id || clientProfile?.email || "client-1",
        clientEmail: clientProfile?.email || "",
        expertName: targetExp?.name || reviewExpertName,
        expertEmail: targetExp?.email || "",
        expertId: targetExp?.id || "",
        sessionId: effectiveSessionId,
        rating: reviewRating,
        comment: reviewComment.trim(),
        date: new Date().toISOString().split("T")[0],
        status: "approved",
        visibleToExpert: true,
        featuredOnLanding: true
      };

      // 1. Submit to server API
      try {
        await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expertId: targetExp?.id || "",
            expertEmail: targetExp?.email || "",
            expertName: targetExp?.name || reviewExpertName,
            clientId: clientProfile?.id || clientProfile?.email || "client-1",
            clientEmail: clientProfile?.email || "",
            clientName: clientProfile?.name || "Corporate Client",
            sessionId: effectiveSessionId,
            rating: reviewRating,
            comment: reviewComment.trim()
          })
        });
      } catch (apiErr) {
        console.warn("Server reviews API sync note:", apiErr);
      }

      // 2. Update local stores
      const updated = [newRev, ...current];
      localStorage.setItem("app_platform_reviews", JSON.stringify(updated));
      mongoDB.syncKv("app_platform_reviews", updated);

      // 3. Calculate new dynamic average rating
      const expReviews = updated.filter((r: any) => 
        (targetExp?.id && (r.expertId === targetExp.id || r.expert_id === targetExp.id)) ||
        (targetExp?.email && r.expertEmail?.toLowerCase() === targetExp.email.toLowerCase()) ||
        (r.expertName?.toLowerCase() === reviewExpertName.toLowerCase())
      );
      const validRatings = expReviews.map((r: any) => Number(r.rating)).filter((n: number) => !isNaN(n) && n >= 1 && n <= 5);
      const newAvgRating = validRatings.length > 0 
        ? Math.round((validRatings.reduce((a, b) => a + b, 0) / validRatings.length) * 10) / 10 
        : 0.0;
      const newReviewCount = validRatings.length;

      // 4. Update in-place on targetExp object if present
      if (targetExp) {
        targetExp.rating = newAvgRating;
        targetExp.sessions = Math.max(1, (targetExp.sessions || 0) + (reviewSessionId ? 0 : 1));
        targetExp.reviewCount = newReviewCount;
      }

      // 5. Update local expert profiles in storage
      try {
        const storedExpert = localStorage.getItem("current_logged_in_expert");
        if (storedExpert) {
          const parsed = JSON.parse(storedExpert);
          const matches = (targetExp?.id && parsed.id === targetExp.id) ||
                          (targetExp?.email && parsed.email?.toLowerCase().trim() === targetExp.email.toLowerCase().trim()) ||
                          (parsed.name?.toLowerCase().trim() === reviewExpertName.toLowerCase().trim());
          if (matches) {
            parsed.rating = newAvgRating;
            parsed.sessions = Math.max(1, (parsed.sessions || 0) + (reviewSessionId ? 0 : 1));
            parsed.reviewCount = newReviewCount;
            localStorage.setItem("current_logged_in_expert", JSON.stringify(parsed));
          }
        }
      } catch {}

      // 6. Dispatch cross-component real-time events
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app_platform_reviews_updated", { detail: updated }));
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: "app_platform_reviews" } }));
      }

      // Mark the completed session as reviewed in client portal upcoming list
      setUpcoming(prev => {
        const next = prev.map(b => {
          if ((effectiveSessionId && b.id === effectiveSessionId) || (!effectiveSessionId && b.expert?.toLowerCase() === reviewExpertName.toLowerCase())) {
            return { ...b, reviewed: true };
          }
          return b;
        });
        localStorage.setItem(storageKey, JSON.stringify(next));
        mongoDB.syncKv(storageKey, next);
        return next;
      });

      // Real-time notifications for review submission
      notificationService.add({
        target: "admin",
        type: "review",
        title: "New Client Review Received",
        message: `${clientProfile?.name || "Client"} submitted a ${reviewRating}★ review for "${reviewExpertName}". Dynamic rating updated to ${newAvgRating.toFixed(1)}★.`,
        actionLink: "owner"
      });
      notificationService.add({
        target: "client",
        recipientId: clientProfile?.email,
        type: "review",
        title: "Review Published Successfully",
        message: `Your ${reviewRating}★ review for "${reviewExpertName}" is verified and active!`,
        actionLink: "client"
      });

      setShowReviewModal(false);
      setReviewComment("");
      setReviewSessionId(null);
      confetti({ particleCount: 50, spread: 50, origin: { y: 0.5 } });
      alert(`⭐ Review Submitted Successfully!\nYour ${reviewRating}★ rating for "${reviewExpertName}" is recorded. Expert rating updated dynamically to ${newAvgRating.toFixed(1)} / 5.0!`);
    } catch (err) {
      console.error(err);
    }
  };

  const UPI_APPS = [
    { id: "gpay", name: "Google Pay", color: "#4285F4", bg: "#E8F0FE", logo: "GPay" },
    { id: "phonepe", name: "PhonePe", color: "#5F259F", bg: "#F3E8FF", logo: "PhonePe" },
    { id: "paytm", name: "Paytm", color: "#00B6F0", bg: "#E0F7FA", logo: "Paytm" },
    { id: "amazonpay", name: "Amazon Pay", color: "#FF9900", bg: "#FFF3E0", logo: "Amazon" },
    { id: "bhim", name: "BHIM UPI", color: "#F47721", bg: "#FBE9E7", logo: "BHIM" },
  ];

  const filteredExperts = experts.filter((e) => {
    // Visibility depends purely on the expert's verification status field in the database
    if (
      e.verified !== true || 
      e.verificationStatus === "pending" || 
      e.verificationStatus === "rejected" || 
      (e as any).rejected === true
    ) return false;
    const dName = getDomainName(e);
    if (activeCategory !== "All" && !dName?.toLowerCase().includes(activeCategory.toLowerCase()) && !activeCategory.toLowerCase().includes(dName?.toLowerCase() || "")) return false;
    if (searchQuery.trim() && !e.name.toLowerCase().includes(searchQuery.toLowerCase()) && !dName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (e.rate > rateLimit) return false;
    return true;
  });

  const handleBookingClick = (expert: ExpertDoc) => {
    if (!userRole) {
      alert("Registration Required: Please sign in or register your account first before booking an expert.");
      onRequireAuth();
    } else {
      setSelectedExpertForBooking(expert);
    }
  };

  const handleProjectReviewClick = (expert: ExpertDoc) => {
    if (!userRole) {
      alert("Registration Required: Please sign in or register your account first before requesting a Project Review.");
      onRequireAuth();
    } else {
      setSelectedExpertForProjectReview(expert);
    }
  };


  const handleBookingSuccess = async (newBooking: any, cost: number) => {
    const bookingWithClient = {
      ...newBooking,
      client: newBooking.client || clientProfile?.name || "Client ABC",
      clientEmail: newBooking.clientEmail || clientProfile?.email || "client@company.com"
    };

    const scheduledDate = bookingWithClient.date || (bookingWithClient.when ? bookingWithClient.when.split(',')[0].trim() : '');
    const scheduledTime = bookingWithClient.timeSlot || (bookingWithClient.when ? bookingWithClient.when.split(',')[1]?.trim() : '');

    // FIX 2: Await createConsultationBooking FIRST before updating state or deducting wallet!
    const res = await createConsultationBooking({
      id: bookingWithClient.id,
      clientId: clientProfile?.id || bookingWithClient.clientId || clientProfile?.email || 'client-1',
      clientName: bookingWithClient.client,
      clientEmail: bookingWithClient.clientEmail,
      expertId: selectedExpertForBooking?.id || bookingWithClient.expertId || '',
      expertName: selectedExpertForBooking?.name || bookingWithClient.expert || '',
      expertEmail: selectedExpertForBooking?.email || bookingWithClient.expertEmail || '',
      topic: bookingWithClient.topic || 'Consultation',
      scheduledDate,
      scheduledTime,
      when: bookingWithClient.when,
      durationMinutes: 60,
      packageType: bookingWithClient.type === "hourly" || bookingWithClient.type === "Hourly" ? "Hourly Consultation" : "Project Advisory",
      value: cost,
      price: cost,
      status: 'pending'
    });

    if (!res.success) {
      console.error('❌ [CLIENT BOOKING] Booking insert failed:', res.error);
      const userMessage = res.code === '23505'
        ? "This slot was just booked, please choose another time"
        : (res.error || "Failed to confirm booking.");
      alert(`⚠️ Booking Error: ${userMessage}`);
      return { success: false, error: userMessage, code: res.code };
    }

    // ONLY ON SUCCESS: update state, deduct wallet, save to localStorage
    const confirmedBooking = res.booking || bookingWithClient;

    setUpcoming(prev => {
      const next = [confirmedBooking, ...prev];
      localStorage.setItem(storageKey, JSON.stringify(next));
      mongoDB.syncKv(storageKey, next);
      return next;
    });
    setWalletBalance(prev => {
      const nextBal = Math.max(0, prev - cost);
      localStorage.setItem(walletStorageKey, String(nextBal));
      mongoDB.syncKv(walletStorageKey, String(nextBal));
      return nextBal;
    });

    deductWallet({
      userId: clientProfile?.id || bookingWithClient.clientId || clientProfile?.email,
      userEmail: bookingWithClient.clientEmail,
      amount: cost,
      description: `Consultation Booking: ${confirmedBooking.topic} with ${confirmedBooking.expert}`,
      relatedBookingId: confirmedBooking.id // same booking can never be charged twice
    }).then(async res => {
      if (res?.success) {
        setWalletBalance(res.newBalance);
      } else {
        // Don't hide a failed payment: tell the user and show the real balance from the server.
        alert(`⚠️ Your booking is confirmed, but the wallet payment could not be recorded: ${res?.error || "unknown error"}. Please contact support.`);
        const fresh = await fetchWalletBalance(clientProfile?.id, clientProfile?.email);
        setWalletBalance(fresh.balance);
      }
    }).catch(() => {});

    // Sync to Admin Meeting & Session OPS Desk immediately
    syncSessionToAdminOps({
      id: confirmedBooking.id,
      client: confirmedBooking.client,
      clientEmail: confirmedBooking.clientEmail,
      expert: confirmedBooking.expert,
      expertEmail: confirmedBooking.expertEmail,
      topic: confirmedBooking.topic,
      when: confirmedBooking.when,
      type: confirmedBooking.type === "hourly" || confirmedBooking.type === "Hourly" ? "Hourly Consultation" : "Project Advisory",
      rate: cost,
      payout: Math.round(cost * 0.85),
      status: "Pending Expert Acceptance",
      isLive: false,
      completed: false,
      meetUrl: "",
      meetCode: ""
    });

    // Real-time multi-party notifications
    notificationService.add({
      target: "expert",
      recipientId: selectedExpertForBooking?.email || bookingWithClient.expertEmail || bookingWithClient.expert,
      type: "booking",
      title: "New Advisory Session Booked!",
      message: `${bookingWithClient.client} booked "${bookingWithClient.topic}" for ${bookingWithClient.when}.`,
      actionLink: "expert"
    });
    notificationService.add({
      target: "client",
      recipientId: bookingWithClient.clientEmail,
      type: "booking",
      title: "Consultation Scheduled!",
      message: `Your session with ${bookingWithClient.expert} on ${bookingWithClient.when} is confirmed.`,
      actionLink: "client"
    });
    notificationService.add({
      target: "admin",
      type: "booking",
      title: "New Platform Booking",
      message: `${bookingWithClient.client} booked ${bookingWithClient.expert} (₹${cost}).`,
      actionLink: "owner"
    });

    // Centralized Notification Engine: Incoming Consultant Request
    notificationEngine.trigger("consultant_request_sent", {
      recipientId: selectedExpertForBooking?.email || selectedExpertForBooking?.name || bookingWithClient.expert,
      recipientName: selectedExpertForBooking?.name || bookingWithClient.expert,
      recipientType: "expert",
      clientName: bookingWithClient.client,
      expertName: selectedExpertForBooking?.name || bookingWithClient.expert,
      meetingDate: bookingWithClient.when?.split(" ")[0] || "Upcoming Date",
      meetingTime: bookingWithClient.when?.split(" ")[1] || "Scheduled Time",
      topic: bookingWithClient.topic || "Executive Advisory Consultation",
      amount: `₹${cost}`,
      bookingId: bookingWithClient.id,
      actionLink: "expert"
    });

    // Real-time sync into target Expert's session requests queue
    try {
      const expName = selectedExpertForBooking?.name || bookingWithClient.expert || "";
      const expEmail = selectedExpertForBooking?.email || bookingWithClient.expertEmail || "";
      const expId = selectedExpertForBooking?.id || bookingWithClient.expertId || "";

      const reqItem = {
        id: bookingWithClient.id,
        client: bookingWithClient.client,
        clientEmail: bookingWithClient.clientEmail,
        topic: bookingWithClient.topic,
        when: bookingWithClient.when,
        type: bookingWithClient.type || "Hourly",
        status: "Pending Expert Acceptance",
        rate: cost,
        meetUrl: ""
      };

      const keysToSync = [
        expEmail.toLowerCase().trim(),
        expName.toLowerCase().trim(),
        expId.toLowerCase().trim()
      ].filter(Boolean);

      keysToSync.forEach(k => {
        const reqKey = `expert_requests_${k}`;
        const existingRaw = localStorage.getItem(reqKey);
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        const updated = [reqItem, ...existing.filter((r: any) => r.id !== reqItem.id)];
        localStorage.setItem(reqKey, JSON.stringify(updated));
        mongoDB.syncKv(reqKey, updated);
      });
    } catch {}

    return { success: true, booking: confirmedBooking };
  };

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(topupAmt) || 0;
    if (amt <= 0) {
      alert("Please enter a valid deposit amount greater than ₹0.");
      return;
    }
    setShowWalletModal(false);
    const chosenApp = UPI_APPS.find(a => a.id === selectedUpiApp) || UPI_APPS[0];

    // Launch Fast-Track NPCI UPI Gateway Modal for instant payment
    setActiveUpiGatewayModal({
      amount: amt,
      app: chosenApp,
      upiId: customUpiId.trim() || undefined
    });
  };

  const handleUpiSuccess = (addedAmt: number) => {
    const amt = Number(addedAmt) || 0;
    if (amt <= 0) return;

    setWalletBalance(prev => {
      const nextBal = prev + amt;
      localStorage.setItem(walletStorageKey, String(nextBal));
      mongoDB.syncKv(walletStorageKey, String(nextBal));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mongo_kv_updated", {
          detail: { key: walletStorageKey, value: String(nextBal) }
        }));
      }
      return nextBal;
    });

    depositWallet({
      userId: clientProfile?.id || clientProfile?.email,
      userEmail: clientProfile?.email || 'client@company.com',
      amount: amt,
      description: `Wallet Funded via UPI (₹${amt})`
    }).then(async res => {
      if (res?.success) {
        setWalletBalance(res.newBalance);
      } else {
        // Undo the optimistic balance and tell the user the top-up was not saved.
        alert(`⚠️ Your top-up could not be saved: ${res?.error || "unknown error"}. Please try again or contact support.`);
        const fresh = await fetchWalletBalance(clientProfile?.id, clientProfile?.email);
        setWalletBalance(fresh.balance);
      }
    }).catch(() => {});

    notificationService.add({
      target: "client",
      recipientId: clientProfile?.email,
      type: "wallet",
      title: "Wallet Funded Successfully!",
      message: `₹${amt.toLocaleString("en-IN")} deposited dynamically into your client wallet.`,
      actionLink: "client"
    });
  };

  const handleRemoveBooking = (bookingId?: string, sessionItem?: any) => {
    const sessId = bookingId || sessionItem?.id;

    if (sessId) {
      recordRoleDeleted(sessId, 'client', clientProfile?.email);
      try {
        const delKey = `client_deleted_sessions_${clientEmailClean || 'default'}`;
        const raw = localStorage.getItem(delKey);
        const arr = raw ? JSON.parse(raw) : [];
        const nextArr = Array.from(new Set([...arr, sessId]));
        localStorage.setItem(delKey, JSON.stringify(nextArr));
        mongoDB.syncKv(delKey, nextArr);
      } catch {}
      deleteBooking(sessId, {
        userId: clientProfile?.id,
        userEmail: clientProfile?.email,
        userRole: 'client'
      }).catch(() => {});
    }

    setUpcoming(prev => {
      const next = prev.filter(b => {
        if (bookingId && b.id && b.id === bookingId) return false;
        if (sessionItem) {
          if (sessionItem.id && b.id && sessionItem.id === b.id) return false;
          if (sessionItem.topic && sessionItem.when && sessionItem.expert &&
              b.topic === sessionItem.topic && b.when === sessionItem.when && b.expert === sessionItem.expert) {
            return false;
          }
          if (b === sessionItem) return false;
        }
        if (bookingId && !b.id && sessionItem?.topic && b.topic === sessionItem.topic) return false;
        return true;
      });

      // 1. Sync updated state to client active storageKey and mongoDB
      localStorage.setItem(storageKey, JSON.stringify(next));
      mongoDB.syncKv(storageKey, next);

      // 2. Also clean from all client_upcoming_* keys in localStorage
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("client_upcoming_")) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const list = JSON.parse(raw);
                if (Array.isArray(list)) {
                  const filtered = list.filter((b: any) => {
                    if (bookingId && b.id && b.id === bookingId) return false;
                    if (sessionItem) {
                      if (sessionItem.id && b.id && sessionItem.id === b.id) return false;
                      if (sessionItem.topic && sessionItem.when && sessionItem.expert &&
                          b.topic === sessionItem.topic && b.when === sessionItem.when && b.expert === sessionItem.expert) {
                        return false;
                      }
                      if (b === sessionItem) return false;
                    }
                    return true;
                  });
                  if (filtered.length !== list.length) {
                    localStorage.setItem(key, JSON.stringify(filtered));
                    mongoDB.syncKv(key, filtered);
                  }
                }
              } catch {}
            }
          }
        }
      } catch {}

      // 3. Dispatch real-time event to refresh any listening components
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: storageKey, value: next } }));
      }

      return next;
    });
  };

  const isLight = theme === "light";
  const safeProjectReviews = Array.isArray(myProjectReviews) ? myProjectReviews : [];

  return (
    <div style={{ color: isLight ? "#0F172A" : "#F8FAFC", ...body, minHeight: "100vh", position: "relative" }} className="transition-colors duration-300">
      {/* Flow Wallpaper Background (Dedicated to Client Portal) */}
      <FlowWallpaper theme={theme} />

      {/* Main Client Portal Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Executive Cockpit Header */}
      <header className={`flex items-center gap-6 px-8 py-4 border-b relative z-30 backdrop-blur-xl ${isLight ? "bg-white/95 border-slate-200" : "bg-[#0B111A]/85 border-white/10"}`}>
        <button
          type="button"
          onClick={() => {
            setPage("landing");
          }}
          className="bg-transparent border-0 p-0 cursor-pointer hover:opacity-90 transition-opacity"
          title="Return to Mentora Home"
        >
          <Logo theme={theme} />
        </button>
        
        <div className={`flex-1 flex items-center gap-2 max-w-md px-3.5 py-2 rounded-xl border shadow-inner ${isLight ? "bg-slate-50 border-slate-200" : "bg-[#070C15] border-white/10"}`}>
          <Search size={15} className="text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by field or expert — finance, HR, legal..."
            className={`bg-transparent outline-none text-xs flex-1 placeholder-slate-500 font-medium ${isLight ? "text-slate-900" : "text-white"}`}
          />
        </div>



        <div className="hidden 2xl:block w-36 h-14 relative overflow-hidden">
          <GlobeGraphic />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {onToggleTheme && <ThemeToggle theme={theme} onToggle={onToggleTheme} />}
          <NotificationCenter role="client" recipientId={clientProfile?.email} darkTheme={!isLight} onNavigate={setPage} />
          <button
            onClick={() => setShowWalletModal(true)}
            className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl font-bold border transition-all cursor-pointer hover:brightness-110"
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              borderColor: "rgba(245, 158, 11, 0.4)",
              color: isLight ? "#B45309" : "#FCD34D",
              boxShadow: "0 0 15px rgba(245, 158, 11, 0.15)"
            }}
            title="Top up wallet balance"
          >
            <Wallet size={14} className="text-amber-500" /> ₹{walletBalance.toLocaleString("en-IN")}
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-600 font-bold">Deposit</span>
          </button>

          <button onClick={onLogout || (() => setPage("landing"))} className={`p-2 rounded-lg transition-colors cursor-pointer ${isLight ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100" : "text-slate-400 hover:text-white hover:bg-white/10"}`} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Profile Bar */}
      <div 
        className={`px-8 py-3.5 flex items-center justify-between border-b backdrop-blur-md transition-colors ${
          isLight ? "border-slate-200 shadow-sm" : "border-white/10"
        }`} 
        style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black bg-gradient-to-tr from-amber-500 to-amber-700 text-slate-950 shadow-md">
            {clientProfile?.initials || "CC"}
          </div>
          <div>
            <span className={`text-xs font-bold block ${isLight ? "text-slate-900" : "text-white"}`}>
              {clientProfile?.name || "Corporate Client"} <span className={`${isLight ? "text-slate-500" : "text-slate-400"} font-normal`}>({clientProfile?.company || "Enterprise"})</span>
            </span>
            <span className={`text-[11px] font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>
              {clientProfile?.email || "client@company.com"} · {clientProfile?.phone || ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setReviewExpertName(filteredExperts[0]?.name || "Sunita Rao");
              setShowReviewModal(true);
            }}
            className="text-xs px-3.5 py-1.5 rounded-xl font-bold border flex items-center gap-1.5 cursor-pointer transition-all hover:brightness-110 shadow-sm"
            style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", borderColor: "rgba(254, 240, 138, 0.4)", color: "#05080E" }}
            title="Submit consultation review to Admin Governance Desk"
          >
            <Star size={13} fill="#05080E" /> Rate & Review
          </button>
          <Button3D size="sm" variant="ghost" onClick={() => setShowEditProfileModal(true)}>
            <Edit3 size={13} /> Edit Profile
          </Button3D>
          <Button3D size="sm" variant="ghostDark" onClick={() => alert("Upgraded to Client Business Pass (₹999/month)!")}>
            Business Pass (₹999/mo)
          </Button3D>
        </div>
      </div>

      {/* Client View Switcher Tabs (WORKFLOW A vs WORKFLOW B) */}
      <div className={`px-8 pt-4 pb-0 flex items-center gap-6 border-b transition-colors ${isLight ? "border-slate-200" : "border-white/10"}`}>
        <button
          onClick={() => setClientActiveView('directory')}
          className={`pb-3 px-2 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            clientActiveView === 'directory'
              ? 'border-amber-500 text-amber-500'
              : (isLight ? 'border-transparent text-slate-500 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-white')
          }`}
        >
          <Users size={15} /> Advisory Directory (60-Min Consultations)
        </button>
        <button
          onClick={() => setClientActiveView('project_reviews')}
          className={`pb-3 px-2 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer relative ${
            clientActiveView === 'project_reviews'
              ? 'border-cyan-500 text-cyan-400'
              : (isLight ? 'border-transparent text-slate-500 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-white')
          }`}
        >
          <Briefcase size={15} /> My Dedicated Project Reviews
          {safeProjectReviews.length > 0 && (
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
              clientActiveView === 'project_reviews'
                ? 'bg-cyan-500 text-slate-950'
                : (isLight ? 'bg-slate-200 text-slate-700' : 'bg-white/10 text-slate-300')
            }`}>
              {safeProjectReviews.length}
            </span>
          )}
          {safeProjectReviews.some(r => r && (r.status === 'Accepted' || r.status === 'InReview' || r.status === 'PendingExpertAcceptance')) && (
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          )}
        </button>
      </div>

      {clientActiveView === 'directory' ? (
      <div className="grid md:grid-cols-[230px_1fr_320px] gap-8 px-8 py-8">
        {/* Filter Sidebar */}
        <aside className="space-y-6">
          <div>
            <p className={`text-xs mb-3 flex items-center gap-1.5 font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              <SlidersHorizontal size={13} className={isLight ? "text-amber-600" : "text-amber-400"} /> Domain Category
            </p>
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[min(340px,42vh)] pr-1.5 scrollbar-thin select-text">
              {["All", ...expertiseFields].map((c) => {
                const active = activeCategory === c;
                return (
                  <button
                    key={c}
                    onClick={(e) => {
                      setActiveCategory(c);
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }}
                    className={`text-left text-xs px-3.5 py-2 rounded-xl transition-all font-semibold cursor-pointer border shrink-0 ${
                      active
                        ? isLight
                          ? "text-amber-800 border-amber-500/60 bg-amber-50 shadow-sm"
                          : "text-amber-300 border-amber-500/50 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                        : isLight
                          ? "text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100"
                          : "text-slate-400 border-transparent hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div 
            className={`p-4 rounded-2xl border shadow-sm transition-colors ${
              isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0B111A]/80 shadow-md"
            }`}
            style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
          >
            <p className={`text-xs mb-3 font-bold uppercase tracking-wider ${isLight ? "text-slate-700" : "text-slate-400"}`}>Hourly Budget Cap</p>
            <input
              type="range"
              min={0}
              max={1500}
              step={50}
              value={rateLimit}
              onChange={(e) => setRateLimit(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs mt-2 font-mono">
              <span className={isLight ? "text-slate-400" : "text-slate-500"}>₹0</span>
              <span className={`font-bold ${isLight ? "text-amber-600" : "text-amber-400"}`}>Cap: ₹{rateLimit}</span>
              <span className={isLight ? "text-slate-400" : "text-slate-500"}>₹1,500</span>
            </div>
          </div>
        </aside>

        {/* Experts Directory */}
        <section>
          <div className="flex justify-between items-center mb-5">
            <p style={{ ...display }} className={`text-xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
              Verified Executive Advisors ({filteredExperts.length})
            </p>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
              isLight ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-emerald-950/80 text-emerald-300 border-emerald-500/30"
            }`}>
              <ShieldCheck size={14} className={isLight ? "text-emerald-600" : "text-emerald-400"} /> 100% History Checked
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {filteredExperts.map((e) => (
              <div
                key={e.id}
                className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between group ${
                  isLight 
                    ? "border-slate-200 shadow-sm hover:border-amber-500/50 hover:shadow-md" 
                    : "border-white/10 hover:border-amber-500/40 hover:shadow-[0_0_25px_rgba(245,158,11,0.12)]"
                }`}
                style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
              >
                <div>
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedExpertForProfile(e)}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border transition-colors ${
                      isLight ? "bg-slate-100 border-amber-500/30 text-amber-700" : "bg-slate-900 border-amber-500/40 text-amber-300 group-hover:border-amber-400"
                    }`}>
                      {e.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold truncate transition-colors ${
                        isLight ? "text-slate-900 group-hover:text-amber-600" : "text-white group-hover:text-amber-300"
                      }`}>{e.name}</p>
                      <p className={`text-xs truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>{getDomainName(e)}</p>
                    </div>
                    {e.verified !== false ? (
                      <span title="Verified Expert" className="ml-auto shrink-0 flex items-center">
                        <ShieldCheck size={16} className={isLight ? "text-emerald-600" : "text-emerald-400"} />
                      </span>
                    ) : (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ml-auto shrink-0 ${
                        isLight ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      }`}>New Expert</span>
                    )}
                  </div>

                  <div className={`flex items-center gap-2 mt-3 text-xs ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                    <Stars n={e.rating || 0} /> 
                    <span className={`font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                      {e.rating && Number(e.rating) > 0 ? Number(e.rating).toFixed(1) : "0.0"}
                    </span> 
                    <span className={isLight ? "text-slate-400" : "text-slate-500"}>
                      · {e.sessions || e.total_sessions || 0} consultations
                    </span>
                  </div>

                  <p className={`text-xs mt-2 italic line-clamp-2 ${isLight ? "text-slate-600" : "text-slate-300"}`}>"{e.bio}"</p>
                  <button onClick={() => setSelectedExpertForProfile(e)} className={`text-xs mt-2.5 font-bold flex items-center gap-1 cursor-pointer ${
                    isLight ? "text-amber-600 hover:text-amber-700" : "text-amber-400 hover:text-amber-300"
                  }`}>
                    <FileText size={12} /> View Complete Dossier →
                  </button>
                </div>

                <div className={`flex items-center justify-between mt-5 pt-3 border-t ${isLight ? "border-slate-100" : "border-white/10"}`}>
                  <div>
                    <span className={`text-[10px] uppercase font-mono block ${isLight ? "text-slate-400" : "text-slate-500"}`}>Hourly Rate</span>
                    <span className={`text-base font-bold font-mono ${isLight ? "text-amber-600" : "text-amber-400"}`}>₹{e.rate}/hr</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button3D size="sm" variant="ghost" onClick={() => setSelectedExpertForProfile(e)}>
                      Dossier
                    </Button3D>
                    <Button3D size="sm" variant="brass" onClick={() => handleBookingClick(e)}>
                      Book
                    </Button3D>
                    <button
                      type="button"
                      onClick={() => handleProjectReviewClick(e)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                        isLight
                          ? "bg-cyan-50 text-cyan-800 border-cyan-300 hover:bg-cyan-100"
                          : "bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                      }`}
                      title="Request Dedicated Project Review (Audit, Written Report & 2 Meetings)"
                    >
                      <Briefcase size={11} className={isLight ? "text-cyan-700" : "text-cyan-400"} /> Review
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Scheduled Consultations Sidebar */}
        <aside className="space-y-4">
          <p className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            <CalendarDays size={13} className={isLight ? "text-amber-600" : "text-amber-400"} /> Scheduled Sessions ({upcoming.length})
          </p>
          <div className="flex flex-col gap-3.5">
            {upcoming.length === 0 ? (
              <div 
                className={`p-6 rounded-2xl text-center border space-y-2 shadow-sm ${
                  isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0B111A]/80 shadow-md"
                }`}
                style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
              >
                <CalendarDays size={24} className={`mx-auto ${isLight ? "text-slate-400" : "text-slate-500"}`} />
                <p className={`text-xs font-bold ${isLight ? "text-slate-800" : "text-white"}`}>No Booked Consultations Yet</p>
                <p className={`text-[11px] leading-relaxed ${isLight ? "text-slate-500" : "text-slate-400"}`}>Select an expert from the directory and book your advisory consultation!</p>
              </div>
            ) : (
              upcoming.map((s, idx) => {
                const rawStatus = (s.status || '').toLowerCase().trim();
                const isPending = rawStatus === 'pending' || rawStatus.includes('pending') || rawStatus === 'pending expert acceptance';
                const isDeclined = !isPending && (rawStatus.includes("decline") || rawStatus.includes("reject"));
                const isCompleted = !isPending && !isDeclined && (s.status === "Completed" || s.completed || rawStatus.includes("complete"));
                const isLive = !isPending && !isDeclined && !isCompleted && (s.status === "live" || s.isLive || rawStatus.includes("live"));
                const isAccepted = !isPending && !isDeclined && !isCompleted && !isLive && (rawStatus.includes("accept") || rawStatus.includes("confirm") || (!!s.meetUrl && !isDeclined));
                return (
                  <div
                    key={s.id || `session-${idx}`}
                    className={`p-4 rounded-2xl space-y-3 shadow-md transition-all border ${
                      isDeclined
                        ? "bg-rose-950/20 border-rose-500/40 text-rose-200"
                        : isLight
                          ? "bg-white border-slate-200 text-slate-900"
                          : "bg-[#0B111A] border-white/15 text-white"
                    }`}
                    style={{ background: isDeclined ? undefined : isLight ? "#FFFFFF" : "#0B111A" }}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{s.topic}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleRemoveBooking(s.id, s);
                          }}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            isLight ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50" : "text-slate-500 hover:text-rose-400 hover:bg-rose-950/40"
                          }`}
                          title="Remove booking from list"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className={`text-xs mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>with <strong className={isLight ? "text-slate-800" : "text-slate-200"}>{s.expert}</strong></p>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className={`flex items-center gap-1 font-semibold font-mono ${isLight ? "text-amber-600" : "text-amber-400"}`}><Clock size={12} /> {s.when}</span>
                      <Pill tone={isDeclined ? "rust" : isCompleted ? "moss" : isLive ? "rust" : isAccepted ? "moss" : "brass"}>
                        {isDeclined ? "Rejected" : isCompleted ? "Completed" : isLive ? "LIVE NOW" : isAccepted ? "Accepted/Confirmed" : "Pending Expert Acceptance"}
                      </Pill>
                    </div>

                    {isDeclined ? (
                      <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px] space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                            <AlertCircle size={13} className="text-rose-400 shrink-0" />
                            <span>Request Rejected</span>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                            isLight ? "bg-white text-rose-800 border-rose-300" : "bg-rose-900/50 text-rose-300 border-rose-500/30"
                          }`}>
                            Rejected
                          </span>
                        </div>
                        <p className={`text-[11px] leading-relaxed ${isLight ? "text-rose-900/80" : "text-rose-200/90 font-medium"}`}>
                          Expert {s.expert || 'Expert'} has rejected your request.
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleRemoveBooking(s.id, s);
                          }}
                          className="w-full py-1.5 text-xs font-bold rounded-lg border border-rose-500 bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Trash2 size={13} /> Remove Request
                        </button>
                      </div>
                    ) : (s.status === "Completed" || s.completed || isCompleted) ? (
                      <div className={`p-3.5 rounded-xl border space-y-2.5 transition-colors ${
                        isLight ? "bg-emerald-50 border-emerald-200 text-emerald-950 shadow-sm" : "bg-emerald-950/40 border-emerald-500/30 text-emerald-200 shadow-inner"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className={`flex items-center gap-1.5 text-xs font-bold ${isLight ? "text-emerald-800" : "text-emerald-400"}`}>
                            <CheckCircle2 size={14} className={isLight ? "text-emerald-600" : "text-emerald-400"} />
                            <span>Session Completed ✅</span>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                            isLight ? "bg-white text-emerald-800 border-emerald-300" : "bg-emerald-900/60 text-emerald-300 border-emerald-500/40"
                          }`}>
                            Meet Ended
                          </span>
                        </div>

                        <p className={`text-[11px] leading-relaxed ${isLight ? "text-emerald-900/80" : "text-emerald-200/80"}`}>
                          The advisory consultation with {s.expert} has concluded. Please share your rating and experience!
                        </p>

                        {s.reviewed ? (
                          <div className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border ${
                            isLight ? "bg-white text-emerald-800 border-emerald-300" : "bg-emerald-900/50 text-emerald-300 border-emerald-500/40"
                          }`}>
                            <Check size={13} /> ⭐ Feedback Submitted for Audit
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setReviewExpertName(s.expert || "Sunita Rao");
                              setReviewSessionId(s.id);
                              setShowReviewModal(true);
                            }}
                            className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all hover:scale-[1.01]"
                          >
                            <Star size={13} fill="#0F172A" /> ⭐ Rate & Review {s.expert}
                          </button>
                        )}
                      </div>
                    ) : isLive ? (
                      <div className={`p-3.5 rounded-xl border space-y-3 transition-colors ${
                        isLight ? "bg-rose-50/90 border-rose-300 text-rose-950 shadow-sm" : "bg-rose-950/40 border-rose-500/40 text-rose-100 shadow-inner"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                            </span>
                            <span>🔴 Live Meeting In Progress</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold border bg-rose-500 text-white border-rose-600 animate-pulse">
                            LIVE NOW
                          </span>
                        </div>
                        <p className={`text-[11px] leading-relaxed ${isLight ? "text-rose-900 font-medium" : "text-rose-200 font-medium"}`}>
                          Your consultation with <strong>{s.expert}</strong> is active right now! Please join the Google Meet room.
                        </p>
                        {s.meetUrl && (
                          <div className={`p-2 rounded-lg border text-[10px] font-mono truncate select-all ${
                            isLight ? "bg-white border-rose-200 text-slate-800" : "bg-black/40 border-rose-500/30 text-rose-200"
                          }`}>
                            {s.meetUrl}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => window.open(s.meetUrl, "_blank", "noopener,noreferrer")}
                            className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all hover:scale-[1.01]"
                          >
                            <Video size={13} /> Join Meeting ↗
                          </button>
                          {s.meetUrl && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(s.meetUrl);
                                alert(`📋 Copied Google Meet link for ${s.expert}:\n${s.meetUrl}`);
                              }}
                              className={`py-2 px-2.5 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                                isLight ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300" : "bg-white/10 hover:bg-white/20 text-slate-200 border-white/10"
                              }`}
                              title="Copy Link"
                            >
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (!s.meetUrl) ? (
                      <div className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
                        isAccepted
                          ? isLight ? "bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-sm" : "bg-emerald-950/30 border-emerald-500/40 text-emerald-200 shadow-inner"
                          : isLight ? "bg-amber-50/80 border-amber-200 text-amber-950 shadow-sm" : "bg-amber-950/30 border-amber-500/30 text-amber-200 shadow-inner"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className={`flex items-center gap-1.5 text-xs font-bold ${
                            isAccepted
                              ? isLight ? "text-emerald-800" : "text-emerald-400"
                              : isLight ? "text-amber-800" : "text-amber-400"
                          }`}>
                            {isAccepted ? (
                              <CheckCircle2 size={13} className="text-emerald-400" />
                            ) : (
                              <Clock size={13} className="animate-pulse text-amber-500" />
                            )}
                            <span>{isAccepted ? "Request Accepted" : "Awaiting Expert Acceptance"}</span>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                            isAccepted
                              ? isLight ? "bg-white text-emerald-800 border-emerald-300" : "bg-emerald-900/50 text-emerald-300 border-emerald-500/30"
                              : isLight ? "bg-white text-amber-800 border-amber-300" : "bg-amber-900/50 text-amber-300 border-amber-500/30"
                          }`}>
                            {isAccepted ? "Accepted" : "Pending"}
                          </span>
                        </div>
                        <p className={`text-[11px] leading-relaxed ${
                          isAccepted
                            ? isLight ? "text-emerald-900/90 font-medium" : "text-emerald-200/90 font-medium"
                            : isLight ? "text-amber-900/80" : "text-amber-200/80"
                        }`}>
                          {isAccepted
                            ? `Expert ${s.expert || 'Expert'} has accepted your request.`
                            : `Your consultation request was sent to Expert ${s.expert || 'Expert'}. Awaiting expert confirmation.`}
                        </p>
                      </div>
                    ) : (
                      <div 
                        className={`p-3 rounded-xl border space-y-2.5 transition-colors ${
                          isLight ? "bg-slate-50 border-slate-200 text-slate-900 shadow-sm" : "bg-[#070C15] text-white border-white/10 shadow-inner"
                        }`}
                        style={{ background: isLight ? "#F8FAFC" : "#070C15" }}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`flex items-center gap-1.5 text-xs font-bold ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
                            <Video size={13} />
                            <span>Google Meet Ready</span>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            isLight ? "text-cyan-700 bg-cyan-50 border-cyan-200 font-bold" : "text-cyan-300 bg-cyan-950/60 border-cyan-500/30"
                          }`}>{s.meetCode || (s.meetUrl ? (s.meetUrl.match(/meet\.google\.com\/([a-z0-9-]+)/i)?.[1] || s.meetUrl.split("/").pop()) : "")}</span>
                        </div>

                        <div className={`p-2 rounded-lg border text-[10px] font-mono truncate select-all ${
                          isLight ? "bg-white border-slate-200 text-slate-700" : "bg-black/40 border-white/10 text-cyan-300"
                        }`}>
                          {s.meetUrl}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => window.open(s.meetUrl, "_blank", "noopener,noreferrer")}
                            className="py-1.5 px-2.5 rounded-lg text-xs font-bold bg-[#1a73e8] hover:bg-[#1557b0] text-white flex items-center justify-center gap-1 cursor-pointer transition-all shadow-md hover:scale-[1.01]"
                          >
                            <Video size={12} /> Join Meeting ↗
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(s.meetUrl);
                              alert(`📋 Copied Google Meet link for ${s.expert}:\n${s.meetUrl}\n\nReady to join or share with team!`);
                            }}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                              isLight ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm" : "bg-white/10 hover:bg-white/20 text-slate-200 border-white/10"
                            }`}
                          >
                            <Copy size={11} /> Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
      ) : (
        /* Dedicated Project Reviews View (WORKFLOW B) */
        <div className="px-8 py-8 space-y-6 max-w-7xl mx-auto">
          {/* Header Banner */}
          <div className={`p-6 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden ${
            isLight ? "bg-gradient-to-r from-amber-50 via-white to-cyan-50 border-slate-200 text-slate-900 shadow-sm" : "bg-gradient-to-r from-[#0d1522] via-[#09101a] to-[#07131e] border-white/10 text-white"
          }`}>
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3 border bg-cyan-500/10 border-cyan-500/30 text-cyan-400">
                <Sparkles size={14} /> Workflow B — Dedicated Executive Advisory
              </div>
              <h2 style={{ ...display }} className="text-2xl font-black tracking-tight">
                My Dedicated Project Reviews
              </h2>
              <p className={`text-xs mt-1.5 leading-relaxed ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Comprehensive end-to-end code & architecture reviews, strategic audits, and project evaluations. Includes multi-round materials inspection, up to 2 scheduled video consultations, real-time private messaging, dynamic escrow protection, and written executive findings.
              </p>
            </div>

            <div className="relative z-10 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setClientActiveView('directory')}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Plus size={14} /> Request New Review
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0B111A] border-white/10"}`}>
              <div className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>Total Reviews</div>
              <div className={`text-2xl font-black font-mono mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>{myProjectReviews.length}</div>
            </div>
            <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0B111A] border-white/10"}`}>
              <div className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>Active Workspaces</div>
              <div className="text-2xl font-black font-mono mt-1 text-cyan-400">
                {myProjectReviews.filter(r => r.status === 'Accepted' || r.status === 'InReview' || r.status === 'ProjectSubmitted' || r.status === 'MeetingScheduled' || r.status === 'MeetingRequested').length}
              </div>
            </div>
            <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0B111A] border-white/10"}`}>
              <div className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>Awaiting Action</div>
              <div className="text-2xl font-black font-mono mt-1 text-amber-400">
                {myProjectReviews.filter(r => r.status === 'PendingExpertAcceptance').length}
              </div>
            </div>
            <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0B111A] border-white/10"}`}>
              <div className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>Completed Reviews</div>
              <div className="text-2xl font-black font-mono mt-1 text-emerald-400">
                {myProjectReviews.filter(r => r.status === 'ReviewCompleted' || r.status === 'Completed').length}
              </div>
            </div>
          </div>

          {/* Reviews List */}
          {myProjectReviews.length === 0 ? (
            <div className={`p-12 rounded-3xl border text-center space-y-4 ${
              isLight ? "bg-white border-slate-200" : "bg-[#0B111A] border-white/10"
            }`}>
              <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Briefcase size={28} />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${isLight ? "text-slate-900" : "text-white"}`}>No Dedicated Project Reviews Yet</h3>
                <p className={`text-xs max-w-md mx-auto mt-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  Need comprehensive feedback on your codebase, architecture, or executive strategy? Select an advisor from Mentora and choose <strong>Review</strong> to get started.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClientActiveView('directory')}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
              >
                Browse Advisors Directory →
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {myProjectReviews.map((pr) => {
                const getStatusPill = (status: ProjectReviewStatus) => {
                  switch (status) {
                    case 'PendingExpertAcceptance':
                      return { label: 'Pending Expert Decision', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
                    case 'Declined':
                      return { label: 'Declined by Expert', color: 'bg-red-500/20 text-red-400 border-red-500/40' };
                    case 'Accepted':
                      return { label: 'Accepted — In Workspace', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
                    case 'ProjectSubmitted':
                      return { label: 'Materials Submitted', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40' };
                    case 'InReview':
                      return { label: 'Active In Review', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
                    case 'MeetingRequested':
                    case 'MeetingScheduled':
                      return { label: 'Consultation Scheduled', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
                    case 'ReviewCompleted':
                    case 'Completed':
                      return { label: 'Review Completed', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
                    case 'Cancelled':
                      return { label: 'Cancelled', color: 'bg-slate-500/20 text-slate-400 border-slate-500/40' };
                    default:
                      return { label: String(status), color: 'bg-white/10 text-slate-300 border-white/20' };
                  }
                };
                const pill = getStatusPill(pr.status);

                return (
                  <div
                    key={pr.projectReviewId}
                    className={`p-6 rounded-2xl border transition-all duration-300 ${
                      isLight
                        ? "bg-white border-slate-200 hover:border-cyan-500/50 hover:shadow-lg"
                        : "bg-[#0B111A] border-white/10 hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)]"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-400 text-sm shrink-0">
                          {pr.expertName?.slice(0, 2).toUpperCase() || "EX"}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-slate-500">{pr.projectReviewId}</span>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${pill.color}`}>
                              {pill.label}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isLight ? "bg-slate-100 border-slate-200 text-slate-600" : "bg-white/5 border-white/10 text-slate-400"}`}>
                              {pr.packageName || "Dedicated Project Review"}
                            </span>
                          </div>
                          <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? "text-slate-900" : "text-white"}`}>
                            {pr.expectedScope || pr.reviewType || "Project Review"}
                            <span className={`text-xs font-normal ${isLight ? "text-slate-500" : "text-slate-400"}`}>with {pr.expertName}</span>
                          </h3>
                          <p className={`text-xs mt-1 line-clamp-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                            {pr.submission?.description || pr.requestNotes || "Initial submission pending review."}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 lg:justify-end">
                        <div className="text-right">
                          <div className={`text-[10px] uppercase font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>Escrow Value</div>
                          <div className={`text-base font-bold font-mono ${isLight ? "text-amber-700" : "text-amber-400"}`}>₹{pr.price.toLocaleString('en-IN')}</div>
                          <div className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                            {pr.paymentStatus === 'PaymentSuccessful' ? '✅ Escrow Funded' : '⏳ Awaiting Deposit'}
                          </div>
                        </div>

                        <div className={`text-right border-l pl-4 ${isLight ? "border-slate-200" : "border-white/10"}`}>
                          <div className={`text-[10px] uppercase font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>Consultations</div>
                          <div className="text-base font-bold font-mono text-cyan-400">
                            {pr.completedMeetingCount} / 2 used
                          </div>
                          <div className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                            {pr.submission?.files?.length || 0} docs · {pr.chat?.length ?? pr.chatCount ?? 0} msgs
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {pr.status === 'PendingExpertAcceptance' && (
                            <button
                              type="button"
                              onClick={() => setActiveProjectReviewWorkspaceId(pr.projectReviewId)}
                              className="px-4 py-2 rounded-xl text-xs font-bold border border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-all cursor-pointer"
                            >
                              View Request Details
                            </button>
                          )}
                          {pr.status === 'Declined' && (
                            <button
                              type="button"
                              onClick={() => setActiveProjectReviewWorkspaceId(pr.projectReviewId)}
                              className="px-4 py-2 rounded-xl text-xs font-bold border border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all cursor-pointer"
                            >
                              View Decline Reason
                            </button>
                          )}
                          {pr.status !== 'PendingExpertAcceptance' && pr.status !== 'Declined' && (
                            <button
                              type="button"
                              onClick={() => setActiveProjectReviewWorkspaceId(pr.projectReviewId)}
                              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 cursor-pointer"
                            >
                              Open Dedicated Workspace <ArrowUpRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      </div>

      {showEditProfileModal && (
        <EditClientProfileModal
          profile={clientProfile}
          onClose={() => setShowEditProfileModal(false)}
          onSave={onUpdateClientProfile}
          theme={theme}
        />
      )}

      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div 
            className={`w-full max-w-md p-6 rounded-2xl space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto border transition-all ${
              isLight ? "bg-white border-slate-200 text-slate-900 shadow-2xl" : "bg-[#0B111A] border-white/15 text-white"
            }`} 
            style={{ ...body }}
          >
            <div className={`flex justify-between items-center pb-3 border-b ${isLight ? "border-slate-100" : "border-white/10"}`}>
              <div>
                <span style={{ ...display }} className={`text-xl font-extrabold block ${isLight ? "text-slate-900" : "text-white"}`}>Top Up Client Smart Wallet</span>
                <span className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>Select Instant UPI or Cards to fund escrow balance</span>
              </div>
              <button 
                onClick={() => setShowWalletModal(false)} 
                className={`p-1.5 rounded-full cursor-pointer transition-colors ${
                  isLight ? "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200" : "bg-white/10 text-slate-300 hover:text-white"
                }`}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleTopup} className="space-y-4">
              {/* Dynamic Real-time Balance Overview Card */}
              <div className={`p-3.5 rounded-xl border space-y-2 ${
                isLight ? "bg-amber-50/70 border-amber-200/80 shadow-sm" : "bg-[#111A27] border-amber-500/30 shadow-inner"
              }`}>
                <div className="flex justify-between items-center text-xs">
                  <span className={`flex items-center gap-1.5 font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    <Wallet size={13} className={isLight ? "text-amber-600" : "text-amber-400"} /> Current Escrow Balance:
                  </span>
                  <span className={`font-bold font-mono text-sm ${isLight ? "text-amber-700" : "text-amber-400"}`}>
                    ₹{walletBalance.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className={`flex justify-between items-center text-xs pt-1.5 border-t ${isLight ? "border-amber-200/60" : "border-white/10"}`}>
                  <span className={`font-semibold ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                    Projected Balance After Deposit:
                  </span>
                  <span className={`font-bold font-mono text-sm ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
                    ₹{(walletBalance + (Number(topupAmt) || 0)).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Deposit Amount Input */}
              <div>
                <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  1. Enter Deposit Amount (₹)
                </label>
                <div className="relative">
                  <span className={`absolute left-3.5 top-2.5 text-base font-bold ${isLight ? "text-amber-600" : "text-amber-400"}`}>₹</span>
                  <input
                    type="number"
                    min={100}
                    max={100000}
                    value={topupAmt}
                    onChange={(e) => setTopupAmt(Number(e.target.value))}
                    className={`w-full pl-8 pr-3 py-2.5 font-mono font-bold text-lg rounded-xl outline-none border shadow-inner transition-colors ${
                      isLight 
                        ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                        : "bg-[#111A27] border-white/10 text-white focus:border-amber-500/60"
                    }`}
                  />
                </div>
                {/* Amount Quick Presets */}
                <div className="flex gap-2 mt-2">
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopupAmt(amt)}
                      className={`text-xs px-3 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                        topupAmt === amt
                          ? (isLight ? "bg-amber-100 text-amber-900 border-amber-300 shadow-sm" : "bg-amber-500/20 text-amber-300 border-amber-500/50")
                          : (isLight ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-900" : "bg-white/[0.03] text-slate-400 border-white/10 hover:text-white")
                      }`}
                    >
                      +₹{amt.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Indian UPI Apps Selection Grid */}
              <div>
                <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  2. Select UPI Payment App
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {UPI_APPS.map((app) => {
                    const isSelected = selectedUpiApp === app.id;
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => setSelectedUpiApp(app.id as any)}
                        className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? (isLight ? "border-amber-500 bg-amber-50/90 shadow-sm ring-1 ring-amber-500/30" : "border-amber-500/80 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]")
                            : (isLight ? "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]")
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 shadow-sm"
                          style={{ background: app.color, color: "#fff" }}
                        >
                          {app.logo.slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold truncate ${isLight ? "text-slate-900" : "text-white"}`}>{app.name}</p>
                          <p className={`text-[10px] truncate font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>Instant UPI</p>
                        </div>
                        {isSelected && (
                          <div className={`w-2 h-2 rounded-full shrink-0 ${isLight ? "bg-amber-600" : "bg-amber-400 shadow-[0_0_6px_#F59E0B]"}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom UPI VPA ID Input */}
              <div>
                <label className={`text-[11px] font-semibold block ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Or Custom UPI VPA / ID (Optional)
                </label>
                <input
                  type="text"
                  value={customUpiId}
                  onChange={(e) => setCustomUpiId(e.target.value)}
                  placeholder="e.g. mobile@ybl / username@upi"
                  className={`w-full mt-1.5 px-3.5 py-2 text-xs rounded-xl outline-none border font-mono transition-colors ${
                    isLight 
                      ? "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-amber-500" 
                      : "bg-[#111A27] border-white/10 text-white placeholder-slate-500"
                  }`}
                />
              </div>

              {/* NPCI Verified Security Badge */}
              <div className={`flex items-center justify-between p-3 rounded-xl border text-[11px] ${
                isLight ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              }`}>
                <span className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck size={14} className={isLight ? "text-emerald-700 shrink-0" : "text-emerald-400 shrink-0"} /> NPCI Verified 256-bit Encrypted UPI Gateway
                </span>
              </div>

              {/* Submit Payment Button */}
              <Button3D full type="submit" variant="brass" className="py-3 font-bold text-sm">
                <Wallet size={15} /> Pay ₹{topupAmt.toLocaleString("en-IN")} via {UPI_APPS.find(a => a.id === selectedUpiApp)?.name || "UPI"}
              </Button3D>
            </form>
          </div>
        </div>
      )}

      <ExpertProfileModal
        expert={selectedExpertForProfile}
        onClose={() => setSelectedExpertForProfile(null)}
        onBook={(e) => handleBookingClick(e)}
        theme={theme}
      />

      {selectedExpertForBooking && (
        <BookingModal
          expert={selectedExpertForBooking}
          onClose={() => setSelectedExpertForBooking(null)}
          onBookSuccess={handleBookingSuccess}
          walletBalance={walletBalance}
          theme={theme}
          clientProfile={clientProfile}
          onSwitchToProjectReview={(expert: any) => {
            setSelectedExpertForBooking(null);
            setSelectedExpertForProjectReview(expert);
          }}
        />
      )}

      {activeUpiGatewayModal && (
        <UPIPaymentGatewayModal
          amount={activeUpiGatewayModal.amount}
          app={activeUpiGatewayModal.app}
          upiId={activeUpiGatewayModal.upiId}
          onClose={() => setActiveUpiGatewayModal(null)}
          onSuccess={() => handleUpiSuccess(activeUpiGatewayModal.amount)}
        />
      )}

      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div 
            className={`w-full max-w-md p-6 rounded-2xl space-y-4 shadow-2xl relative border transition-all ${
              isLight ? "bg-white border-slate-200 text-slate-900 shadow-2xl" : "bg-[#0B111A] border-white/15 text-white"
            }`} 
            style={{ ...body }}
          >
            <div className={`flex justify-between items-center pb-3 border-b ${isLight ? "border-slate-100" : "border-white/10"}`}>
              <div>
                <span style={{ ...display }} className={`text-xl font-bold block ${isLight ? "text-slate-900" : "text-white"}`}>Rate & Review Consultation</span>
                <span className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>Submit feedback to Admin Audit Desk for moderation</span>
              </div>
              <button 
                onClick={() => setShowReviewModal(false)} 
                className={`p-1.5 rounded-full cursor-pointer transition-colors ${
                  isLight ? "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200" : "bg-white/10 text-slate-300 hover:text-white"
                }`}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmittingClientReview} className="space-y-4">
              <div>
                <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>1. Select Expert / Senior Pro</label>
                <select
                  value={reviewExpertName}
                  onChange={(e) => setReviewExpertName(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl outline-none border font-bold cursor-pointer transition-colors ${
                    isLight 
                      ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500" 
                      : "bg-[#111A27] border-white/10 text-white"
                  }`}
                >
                  {experts && experts.length > 0 ? (
                    experts.map((exp: any) => (
                      <option key={exp.id || exp.name} value={exp.name}>
                        {exp.name} ({exp.field || "Expert Advisor"})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Sunita Rao">Sunita Rao (Former CFO & Finance Pro)</option>
                      <option value="JK">JK (Senior Logistics & Advisory Expert)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>2. Rating (1 to 5 Stars)</label>
                <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-[#111A27] border-white/10"
                }`}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className="p-1 cursor-pointer transition-transform hover:scale-110"
                    >
                      <Star size={20} fill={star <= reviewRating ? "#F59E0B" : "none"} stroke="#F59E0B" strokeWidth={1.5} className="drop-shadow-[0_0_4px_rgba(245,158,11,0.4)]" />
                    </button>
                  ))}
                  <span className={`text-xs font-bold ml-2 font-mono ${isLight ? "text-amber-700" : "text-amber-400"}`}>{reviewRating} Stars</span>
                </div>
              </div>

              <div>
                <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>3. Session Review Feedback</label>
                <textarea
                  required
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Describe your session experience, key takeaways, and recommendations..."
                  className={`w-full p-3 text-xs rounded-xl outline-none border shadow-inner transition-colors ${
                    isLight 
                      ? "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-amber-500" 
                      : "bg-[#111A27] border-white/10 text-white placeholder-slate-500 focus:border-amber-500/60"
                  }`}
                />
              </div>

              <div className={`p-3 rounded-xl border text-[11px] flex items-center gap-2 ${
                isLight ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-amber-950/40 border-amber-500/30 text-amber-300"
              }`}>
                <Check size={14} className={isLight ? "text-amber-700 shrink-0" : "text-amber-400 shrink-0"} />
                <span>Submitted reviews are audited by Admin before appearing on Expert Profile or Landing Page.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button3D 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowReviewModal(false)}
                  className={isLight ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100" : ""}
                >
                  Cancel
                </Button3D>
                <Button3D type="submit" variant="brass" size="sm">Submit Review to Admin Desk</Button3D>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Project Review Modals (WORKFLOW B) */}
      {selectedExpertForProjectReview && (
        <ProjectReviewRequestModal
          expert={selectedExpertForProjectReview}
          clientProfile={clientProfile}
          isOpen={!!selectedExpertForProjectReview}
          onClose={() => setSelectedExpertForProjectReview(null)}
          onRequestSuccess={(_newRecord: ProjectReviewRecord) => {
            setSelectedExpertForProjectReview(null);
            loadClientProjectReviews();
            setClientActiveView('project_reviews');
          }}
          theme={theme}
          walletBalance={walletBalance}
          onWalletUpdate={(newBal) => {
            setWalletBalance(newBal);
            try {
              localStorage.setItem(walletStorageKey, String(newBal));
              mongoDB.syncKv(walletStorageKey, String(newBal));
            } catch {}
          }}
        />
      )}

      {activeProjectReviewWorkspaceId && (
        <ProjectReviewWorkspace
          projectReviewId={activeProjectReviewWorkspaceId}
          userRole="client"
          currentUserId={clientProfile?.id || clientProfile?.email || "client-1"}
          currentUserName={clientProfile?.name || "Client"}
          currentUserEmail={clientProfile?.email || "client@company.com"}
          onClose={() => {
            setActiveProjectReviewWorkspaceId(null);
            loadClientProjectReviews();
          }}
          onRefreshList={() => {
            loadClientProjectReviews();
          }}
          theme={theme}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   EXPERT PAGE
---------------------------------------------------------------- */
function ExpertPage({ 
  setPage, 
  expertProfile, 
  onUpdateExpertProfile,
  experts,
  theme = "dark",
  onToggleTheme,
  onLogout
}: { 
  setPage: (p: string) => void; 
  expertProfile: any;
  onUpdateExpertProfile: (p: any) => void;
  experts?: ExpertDoc[];
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  onLogout?: () => void;
}) {
  const expertEmailKey = (expertProfile?.email || "guest_expert").toLowerCase();
  const earningsKey = `expert_earnings_${expertEmailKey}`;
  const walletKey = `expert_wallet_${expertEmailKey}`;
  const trendKey = `expert_trend_${expertEmailKey}`;
  const requestsKey = `expert_requests_${expertEmailKey}`;
  const reviewsKey = `expert_reviews_${expertEmailKey}`;

  const resolvedExpertId = expertProfile?.id || (
    experts?.find(e => 
      (expertProfile?.email && e.email?.toLowerCase() === expertProfile.email.toLowerCase()) || 
      (expertProfile?.name && e.name?.toLowerCase() === expertProfile.name.toLowerCase())
    )?.id
  );

  const [activeExpertTab, setActiveExpertTab] = useState<"sessions" | "availability" | "project_reviews">("sessions");

  // Dedicated Project Review Workflow State (WORKFLOW B)

  // Dynamic Authoritative Project Review Pricing State
  const [currentProjectReviewPrice, setCurrentProjectReviewPrice] = useState<number>(() => {
    if (typeof expertProfile?.projectRate === "number") return expertProfile.projectRate;
    return 1000;
  });
  const [priceInputVal, setPriceInputVal] = useState<string>(() => String(typeof expertProfile?.projectRate === "number" ? expertProfile.projectRate : 1000));
  const [isEditingPRPrice, setIsEditingPRPrice] = useState(false);
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [priceFeedbackMsg, setPriceFeedbackMsg] = useState<string | null>(null);

  const loadExpertPRPrice = async () => {
    if (!resolvedExpertId) return;
    const res = await mongoDB.getProjectReviewPricing(resolvedExpertId, false, 'expert');
    if (res.success && typeof res.projectRate === "number") {
      setCurrentProjectReviewPrice(res.projectRate);
      setPriceInputVal(String(res.projectRate));
    }
  };

  useEffect(() => {
    loadExpertPRPrice();
    const handleSync = () => loadExpertPRPrice();
    window.addEventListener('project_review_updated', handleSync);
    window.addEventListener('mongo_db_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('project_review_updated', handleSync);
      window.removeEventListener('mongo_db_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [resolvedExpertId]);

  const handleSavePRPrice = async () => {
    const num = Number(priceInputVal);
    if (priceInputVal === "" || isNaN(num) || num < 0 || num > 2000) {
      setPriceFeedbackMsg("❌ Project Review price must be between ₹0 and ₹2,000.");
      return;
    }
    setIsSavingPrice(true);
    setPriceFeedbackMsg(null);
    const oldPrice = currentProjectReviewPrice;
    const res = await mongoDB.updateProjectReviewPrice(
      resolvedExpertId || expertProfile?.id,
      num,
      'expert',
      resolvedExpertId || expertProfile?.id,
      expertProfile?.email
    );
    setIsSavingPrice(false);
    if (res.success) {
      setCurrentProjectReviewPrice(res.projectRate ?? num);
      setIsEditingPRPrice(false);
      setPriceFeedbackMsg("✅ Price updated and synchronized across all portals!");
      setTimeout(() => setPriceFeedbackMsg(null), 4000);

      // Log profile diff and broadcast in real-time to Admin Document Audit & KYC desk
      try {
        const expId = resolvedExpertId || expertProfile?.id;
        await fetch('/api/expert/profile-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expertId: expId,
            fieldName: 'Project Review Price',
            oldValue: `₹${oldPrice}`,
            newValue: `₹${num}`,
            changedBy: 'expert'
          })
        });

        const ch = supabase.channel('admin-kyc-desk');
        await ch.send({
          type: 'broadcast',
          event: 'expert_profile_updated',
          payload: {
            expertId: expId,
            fieldName: 'project_rate',
            oldValue: oldPrice,
            newValue: num,
            expertName: expertProfile?.name
          }
        });
      } catch (err) {
        console.warn('Realtime price change broadcast note:', err);
      }
    } else {
      setPriceFeedbackMsg(`❌ ${res.error || "Failed to update price"}`);
    }
  };

  const [expertProjectReviews, setExpertProjectReviews] = useState<ProjectReviewRecord[]>([]);
  const [activeExpertPRWorkspaceId, setActiveExpertPRWorkspaceId] = useState<string | null>(null);
  const [declineReasonModalId, setDeclineReasonModalId] = useState<string | null>(null);
  const [declineReasonText, setDeclineReasonText] = useState("");
  const [isProcessingPRAction, setIsProcessingPRAction] = useState(false);

  const loadExpertProjectReviews = async () => {
    if (!expertProfile?.email && !resolvedExpertId && !expertProfile?.name) return;
    try {
      const list = await mongoDB.getProjectReviews({
        expertId: resolvedExpertId,
        expertEmail: expertProfile?.email,
        expertName: expertProfile?.name,
        role: 'expert'
      });
      setExpertProjectReviews(Array.isArray(list) ? list : (Array.isArray((list as any)?.projectReviews) ? (list as any).projectReviews : []));
    } catch {
      setExpertProjectReviews([]);
    }
  };

  useEffect(() => {
    loadExpertProjectReviews();
    const handlePRUpdate = () => loadExpertProjectReviews();
    window.addEventListener('project_review_updated', handlePRUpdate);
    window.addEventListener('storage', handlePRUpdate);
    const interval = startVisibleInterval(loadExpertProjectReviews, 60_000); // EGRESS FIX: was every 3 s, now 60 s and only while the tab is visible
    return () => {
      window.removeEventListener('project_review_updated', handlePRUpdate);
      window.removeEventListener('storage', handlePRUpdate);
      interval();
    };
  }, [expertProfile?.email, expertProfile?.name, resolvedExpertId]);

  const handleAcceptProjectReview = async (reviewId: string) => {
    setIsProcessingPRAction(true);
    try {
      const res = await mongoDB.respondProjectReview(reviewId, 'accept', { id: resolvedExpertId, role: 'expert' });
      if (res.success && res.projectReview) {
        const updated = res.projectReview;
        notificationService.add({
          target: "client",
          recipientId: updated.clientEmail,
          type: "session",
          title: "Project Review Request Accepted!",
          message: `${expertProfile?.name || "Your Expert"} has accepted your project review request! Open workspace to fund escrow and begin.`,
          actionLink: "client"
        });
        notificationService.add({
          target: "admin",
          type: "session",
          title: "Project Review Accepted by Expert",
          message: `${expertProfile?.name || "Expert"} accepted review request ${reviewId}.`,
          actionLink: "owner"
        });
        loadExpertProjectReviews();
        setActiveExpertPRWorkspaceId(reviewId);
      } else {
        alert("Failed to accept review request: " + (res.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Failed to accept review request: " + (err.message || String(err)));
    } finally {
      setIsProcessingPRAction(false);
    }
  };

  const handleDeclineProjectReview = async (reviewId: string, reason?: string) => {
    setIsProcessingPRAction(true);
    try {
      const res = await mongoDB.respondProjectReview(reviewId, 'decline', {
        id: resolvedExpertId,
        role: 'expert',
        reason: reason || declineReasonText || 'Schedule conflict'
      });
      if (res.success && res.projectReview) {
        const updated = res.projectReview;
        notificationService.add({
          target: "client",
          recipientId: updated.clientEmail,
          type: "session",
          title: "Project Review Request Declined",
          message: `${expertProfile?.name || "Your Expert"} was unable to accept your review request: "${reason || declineReasonText || 'Schedule conflict'}"`,
          actionLink: "client"
        });
        notificationService.add({
          target: "admin",
          type: "session",
          title: "Project Review Declined by Expert",
          message: `${expertProfile?.name || "Expert"} declined review request ${reviewId}.`,
          actionLink: "owner"
        });
        setDeclineReasonModalId(null);
        setDeclineReasonText("");
        loadExpertProjectReviews();
        alert("Project Review request declined.");
      } else {
        alert("Failed to decline review request: " + (res.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Failed to decline review request: " + (err.message || String(err)));
    } finally {
      setIsProcessingPRAction(false);
    }
  };

  const [earnings, setEarnings] = useState<number>(() => {
    const saved = localStorage.getItem(earningsKey);
    return saved !== null ? Number(saved) : 0;
  });

  const [walletBalance, setWalletBalance] = useState<number>(() => {
    const saved = localStorage.getItem(walletKey);
    return (saved !== null && saved !== "6850") ? Number(saved) : 0;
  });

  const [trendData, setTrendData] = useState<any[]>(() => {
    const saved = localStorage.getItem(trendKey);
    if (saved) return JSON.parse(saved);
    return [
      { week: "W1", amount: 0 },
      { week: "W2", amount: 0 },
      { week: "W3", amount: 0 },
      { week: "W4", amount: 0 }
    ];
  });

  const acceptedKey = `expert_accepted_sessions_${expertEmailKey}`;

  const getExpertAcceptedSessions = () => {
    const sessionsMap = new Map<string, any>();

    // Load blacklist of expert deleted sessions so deleted items never resurrect in Expert Portal
    const deletedIds = new Set<string>();
    try {
      const savedExp = localStorage.getItem(`expert_deleted_sessions_${expertEmailKey}`);
      if (savedExp) {
        const parsed = JSON.parse(savedExp);
        if (Array.isArray(parsed)) parsed.forEach((id: string) => deletedIds.add(id));
      }
    } catch {}

    const savedDirect = localStorage.getItem(acceptedKey);
    if (savedDirect) {
      try {
        const parsed = JSON.parse(savedDirect);
        if (Array.isArray(parsed)) {
          parsed.forEach(s => {
            if (s && s.id && !deletedIds.has(s.id) && !s.deletedByExpert && !isExpertRoleDeleted(s.id, expertEmailKey)) {
              sessionsMap.set(s.id, s);
            }
          });
        }
      } catch {}
    }

    const nameKey = (expertProfile?.name || "").toLowerCase().trim();
    const emailKey = (expertProfile?.email || "").toLowerCase().trim();

    [nameKey, emailKey].filter(Boolean).forEach(k => {
      const raw = localStorage.getItem(`expert_accepted_sessions_${k}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach(s => {
              if (s && s.id && !deletedIds.has(s.id) && !s.deletedByExpert && !isExpertRoleDeleted(s.id, expertEmailKey)) {
                sessionsMap.set(s.id, s);
              }
            });
          }
        } catch {}
      }
    });

    const result = Array.from(sessionsMap.values()).filter(s => s && s.id && !deletedIds.has(s.id) && !s.deletedByExpert && !isExpertRoleDeleted(s.id, expertEmailKey));
    if (result.length > 0) {
      localStorage.setItem(acceptedKey, JSON.stringify(result));
      return result;
    }

    return [];
  };

  const getExpertSessionRequests = () => {
    const reqsMap = new Map<string, any>();
    const acceptedList = getExpertAcceptedSessions();
    const acceptedIds = new Set<string>(acceptedList.map((s: any) => s.id).filter(Boolean));

    const nameKey = (expertProfile?.name || "").toLowerCase().trim();
    const emailKey = (expertProfile?.email || "").toLowerCase().trim();
    const idKey = (expertProfile?.id || "").toLowerCase().trim();
    const declinedKey = `expert_declined_${nameKey || emailKey || idKey || "default"}`;

    let declinedIds = new Set<string>();
    try {
      const rawDeclined = localStorage.getItem(declinedKey);
      if (rawDeclined) {
        const arr = JSON.parse(rawDeclined);
        if (Array.isArray(arr)) declinedIds = new Set(arr);
      }
      const rawExpDeleted = localStorage.getItem(`expert_deleted_sessions_${expertEmailKey}`);
      if (rawExpDeleted) {
        const arr = JSON.parse(rawExpDeleted);
        if (Array.isArray(arr)) arr.forEach((id: string) => declinedIds.add(id));
      }
    } catch {}

    // 1. Direct key
    const savedDirect = localStorage.getItem(requestsKey);
    if (savedDirect) {
      try {
        const parsed = JSON.parse(savedDirect);
        if (Array.isArray(parsed)) {
          parsed.forEach(r => {
            if (r && r.id && !acceptedIds.has(r.id) && !declinedIds.has(r.id)) {
              reqsMap.set(r.id, r);
            }
          });
        }
      } catch {}
    }

    // 2. Name / Email / Id keys
    [nameKey, emailKey, idKey].filter(Boolean).forEach(k => {
      const raw = localStorage.getItem(`expert_requests_${k}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach(r => {
              if (r && r.id && !acceptedIds.has(r.id) && !declinedIds.has(r.id)) {
                reqsMap.set(r.id, r);
              }
            });
          }
        } catch {}
      }
    });

    // 3. Scan all client_upcoming_* keys for bookings matching this expert (e.g. JK)
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("client_upcoming_")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const bookings = JSON.parse(raw);
            if (Array.isArray(bookings)) {
              bookings.forEach((b: any) => {
                const expNameInBooking = b.expert || b.expertName || "";
                const matchesName = expNameInBooking && expertProfile?.name && expNameInBooking.toLowerCase().trim() === expertProfile.name.toLowerCase().trim();
                const matchesEmail = b.expertEmail && expertProfile?.email && b.expertEmail.toLowerCase().trim() === expertProfile.email.toLowerCase().trim();
                const matchesId = b.expertId && expertProfile?.id && b.expertId.toLowerCase().trim() === expertProfile.id.toLowerCase().trim();

                const statusStr = (b.status || "").toLowerCase();
                const isAlreadyConfirmedOrDeclined = 
                  statusStr.includes("decline") || 
                  statusStr.includes("confirm") || 
                  statusStr.includes("accept") || 
                  statusStr.includes("complete");

                if ((matchesName || matchesEmail || matchesId) && !isAlreadyConfirmedOrDeclined && !b.deletedByExpert && !isExpertRoleDeleted(b.id, expertEmailKey)) {
                  if (b.id && !acceptedIds.has(b.id) && !declinedIds.has(b.id)) {
                    if (!reqsMap.has(b.id)) {
                      reqsMap.set(b.id, {
                        id: b.id,
                        client: b.client || b.clientName || "Corporate Client",
                        clientEmail: b.clientEmail || "",
                        topic: b.topic || "Advisory Consultation",
                        when: b.when || b.date || "Scheduled Time",
                        type: b.type || b.serviceType || "Hourly"
                      });
                    }
                  }
                }
              });
            }
          }
        }
      }
    } catch {}

    const result = Array.from(reqsMap.values()).filter(r => r && r.id && !acceptedIds.has(r.id) && !declinedIds.has(r.id) && !r.deletedByExpert && !isExpertRoleDeleted(r.id, expertEmailKey));

    localStorage.setItem(requestsKey, JSON.stringify(result));
    return result;
  };

  const [requests, setRequests] = useState<any[]>(getExpertSessionRequests);

  const getApprovedPlatformReviews = () => {
    const reviewsMap = new Map<string, any>();

    const expName = (expertProfile?.name || '').toLowerCase().trim();
    const expEmail = (expertProfile?.email || '').toLowerCase().trim();
    const expInitials = (expertProfile?.initials || '').toLowerCase().trim();
    const expId = (expertProfile?.id || '').toLowerCase().trim();
    const expClean = expName.replace(/[^a-z0-9]/g, '');

    const isReviewMatch = (r: any) => {
      if (!r) return false;
      // Must be explicitly approved by Admin Governance Desk to appear on Expert Portal
      if (r.visibleToExpert !== true) return false;
      if (r.id === "rev-2") return false;

      const rExpName = (r.expertName || '').toLowerCase().trim();
      const rExpEmail = (r.expertEmail || '').toLowerCase().trim();
      const rExpId = (r.expertId || '').toLowerCase().trim();
      const rClean = rExpName.replace(/[^a-z0-9]/g, '');

      // 1. Email match
      if (expEmail && rExpEmail && expEmail === rExpEmail) return true;

      // 2. ID match
      if (expId && rExpId && expId === rExpId) return true;

      // 3. Name match (exact or substring)
      if (expName && rExpName && (expName === rExpName || expName.includes(rExpName) || rExpName.includes(expName))) return true;

      // 4. Normalized clean name match (ignoring spaces & punctuation)
      if (expClean && rClean && (expClean === rClean || expClean.includes(rClean) || rClean.includes(expClean))) return true;

      // 5. Initials match (e.g. target "JK" matches initials "JK")
      if (expInitials && (rExpName === expInitials || rClean === expInitials.replace(/[^a-z0-9]/g, ''))) return true;
      if (rClean && rClean.length <= 4 && expClean.startsWith(rClean)) return true;

      // 6. Special JK match (reviews targeting JK should match any profile with JK in name, initials, email, or fallback profile)
      if (rClean === "jk" && (expClean.includes("jk") || expInitials.includes("jk") || expEmail.includes("jk") || expName.includes("jk") || !expName || expName === "senior expert" || expName === "expert")) {
        return true;
      }

      // 7. Word parts match
      if (expName) {
        const parts = expName.split(/\s+/).filter(Boolean);
        for (const p of parts) {
          if (p.length >= 2 && (rExpName === p || rClean === p)) return true;
        }
      }

      return false;
    };

    // 1. Scan app_platform_reviews in localStorage
    let platformReviewsList: any[] | null = null;
    try {
      const raw = localStorage.getItem('app_platform_reviews');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          platformReviewsList = parsed;
          parsed.forEach((r: any) => {
            if (r && isReviewMatch(r)) {
              const reviewId = r.id || `${r.clientName || r.from}_${r.date}_${r.comment || r.note}`;
              reviewsMap.set(reviewId, {
                id: reviewId,
                from: r.clientName || r.from || "Corporate Client",
                note: r.comment || r.note || "",
                stars: r.rating || r.stars || 5,
                date: r.date || ""
              });
            }
          });
        }
      }
    } catch {}

    // 2. Also check dedicated expert reviews storage keys, but strictly respect platform deletions
    const checkKeys = [
      reviewsKey,
      `expert_reviews_${expertEmailKey}`,
      expEmail ? `expert_reviews_${expEmail}` : null,
      expClean ? `expert_reviews_${expClean}` : null,
      expInitials ? `expert_reviews_${expInitials}` : null,
      (expClean.includes("jk") || expInitials.includes("jk") || expEmail.includes("jk") || !expName || expName === "senior expert") ? "expert_reviews_jk" : null,
      (expClean.includes("jk") || expInitials.includes("jk") || expEmail.includes("jk") || !expName || expName === "senior expert") ? "expert_reviews_jk@registry.com" : null,
    ].filter(Boolean) as string[];

    checkKeys.forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            let needsPrune = false;
            const kept: any[] = [];

            parsed.forEach((r: any) => {
              if (!r || r.id === "rev-2") return;
              const reviewId = r.id || `${r.from || r.clientName}_${r.date}_${r.note || r.comment}`;

              // If master platformReviewsList exists, verify this review was not deleted and is visibleToExpert
              if (platformReviewsList !== null) {
                const masterReview = platformReviewsList.find(p => 
                  (p.id && p.id === r.id) || 
                  (reviewId && reviewId === (p.id || `${p.clientName}_${p.date}_${p.comment}`))
                );
                if (!masterReview || masterReview.visibleToExpert !== true) {
                  // Review was deleted or revoked by Admin! Prune it from dedicated storage
                  needsPrune = true;
                  return;
                }
              }

              if (r.visibleToExpert !== false) {
                if (!reviewsMap.has(reviewId)) {
                  reviewsMap.set(reviewId, {
                    id: reviewId,
                    from: r.from || r.clientName || "Corporate Client",
                    note: r.note || r.comment || "",
                    stars: r.stars || r.rating || 5,
                    date: r.date || ""
                  });
                }
                kept.push(r);
              }
            });

            if (needsPrune) {
              localStorage.setItem(k, JSON.stringify(kept));
              mongoDB.syncKv(k, kept);
            }
          }
        }
      } catch {}
    });

    return Array.from(reviewsMap.values());
  };

  const [reviews, setReviews] = useState<any[]>(getApprovedPlatformReviews);

  useEffect(() => {
    // Clear any stale legacy hardcoded reviews stored under old keys
    try {
      const saved = localStorage.getItem(reviewsKey);
      if (saved && saved.includes("thirty years of real shop-floor")) {
        localStorage.removeItem(reviewsKey);
      }
    } catch {}

    const savedEarn = localStorage.getItem(earningsKey);
    setEarnings(savedEarn !== null ? Number(savedEarn) : 0);

    const savedWall = localStorage.getItem(walletKey);
    setWalletBalance((savedWall !== null && savedWall !== "6850") ? Number(savedWall) : 0);

    const savedTrend = localStorage.getItem(trendKey);
    if (savedTrend) {
      setTrendData(JSON.parse(savedTrend));
    } else {
      setTrendData([
        { week: "W1", amount: 0 },
        { week: "W2", amount: 0 },
        { week: "W3", amount: 0 },
        { week: "W4", amount: 0 }
      ]);
    }

    const currentReqs = getExpertSessionRequests();
    setRequests(currentReqs);

    setReviews(getApprovedPlatformReviews());

    // Real-time listener: when client submits or Admin approves/toggles reviews or documents, update Expert Portal immediately
    const handleExpertUpdates = async () => {
      setReviews(getApprovedPlatformReviews());
      const localReqs = getExpertSessionRequests();
      setRequests(prev => {
        const map = new Map<string, any>();
        // Preserve all existing requests (including Supabase requests)
        prev.forEach(r => { if (r && r.id) map.set(r.id, r); });
        localReqs.forEach(r => { if (r && r.id && !map.has(r.id)) map.set(r.id, r); });
        return Array.from(map.values());
      });
      setAcceptedSessions(getExpertAcceptedSessions());

      // Synchronize expert requests and accepted sessions from MongoDB KV server backend
      try {
        const nameKey = (expertProfile?.name || "").toLowerCase().trim();
        const emailKey = (expertProfile?.email || "").toLowerCase().trim();
        const idKey = (expertProfile?.id || "").toLowerCase().trim();
        const keysToCheck = [emailKey, nameKey, idKey].filter(Boolean);

        for (const k of keysToCheck) {
          const srvReqs = await mongoDB.getKv(`expert_requests_${k}`);
          if (Array.isArray(srvReqs)) {
            localStorage.setItem(`expert_requests_${k}`, JSON.stringify(srvReqs));
          }
          const srvAccepted = await mongoDB.getKv(`expert_accepted_sessions_${k}`);
          if (Array.isArray(srvAccepted)) {
            localStorage.setItem(`expert_accepted_sessions_${k}`, JSON.stringify(srvAccepted));
          }
        }
        const refreshedLocal = getExpertSessionRequests();
        setRequests(prev => {
          const map = new Map<string, any>();
          prev.forEach(r => { if (r && r.id) map.set(r.id, r); });
          refreshedLocal.forEach(r => { if (r && r.id && !map.has(r.id)) map.set(r.id, r); });
          return Array.from(map.values());
        });
        setAcceptedSessions(getExpertAcceptedSessions());
      } catch {}
    };

    handleExpertUpdates();
    window.addEventListener("storage", handleExpertUpdates);
    window.addEventListener("focus", handleExpertUpdates);
    window.addEventListener("app_platform_reviews_updated", handleExpertUpdates);
    window.addEventListener("mongo_db_updated", handleExpertUpdates);
    window.addEventListener("mongo_kv_updated", handleExpertUpdates);
    window.addEventListener("expert_documents_updated", handleExpertUpdates);
    const expertSyncInterval = startVisibleInterval(handleExpertUpdates, 60_000); // EGRESS FIX: skip ticks while the tab is hidden

    return () => {
      window.removeEventListener("storage", handleExpertUpdates);
      window.removeEventListener("focus", handleExpertUpdates);
      window.removeEventListener("app_platform_reviews_updated", handleExpertUpdates);
      window.removeEventListener("mongo_db_updated", handleExpertUpdates);
      window.removeEventListener("mongo_kv_updated", handleExpertUpdates);
      window.removeEventListener("expert_documents_updated", handleExpertUpdates);
      expertSyncInterval();
    };
  }, [expertProfile?.id, expertProfile?.name, expertProfile?.email, earningsKey, walletKey, trendKey, requestsKey, reviewsKey]);

  // Authoritative Supabase Real-time Sync for Expert Requests & Confirmed Sessions
  useEffect(() => {
    const expEmail = (expertProfile?.email || '').toLowerCase().trim();
    const expId = String(resolvedExpertId || expertProfile?.id || expertProfile?.user_id || '').toLowerCase().trim();
    const expName = String(expertProfile?.name || '').toLowerCase().trim();

    if (!expEmail && !expId && !expName) return;

    // 1. Initial Authoritative Fetch from Supabase bookings table
    const loadSupabaseExpertBookings = async () => {
      try {
        const rawBookings = await fetchExpertBookings(expId, expEmail, 'all', expertProfile?.user_id);
        const sbBookings = rawBookings.filter(b => !b.deletedByExpert && !isExpertRoleDeleted(b.id, expEmail));
        const pending = sbBookings.filter(b => b.status?.toLowerCase().includes('pending') || b.status === 'pending');
        const confirmed = sbBookings.filter(b => !b.status?.toLowerCase().includes('pending') && b.status !== 'pending' && !b.status?.toLowerCase().includes('reject'));

        if (pending.length > 0) {
          setRequests(prev => {
            const map = new Map<string, any>();
            pending.forEach(b => map.set(b.id, b));
            prev.forEach(p => {
              if (p && p.id && !map.has(p.id) && !p.deletedByExpert && !isExpertRoleDeleted(p.id, expEmail) && (p.status?.toLowerCase().includes('pending') || p.status === 'pending')) {
                map.set(p.id, p);
              }
            });
            const merged = Array.from(map.values());
            try { localStorage.setItem(requestsKey, JSON.stringify(merged)); } catch {}
            return merged;
          });
        }

        if (confirmed.length > 0) {
          setAcceptedSessions(prev => {
            const map = new Map<string, any>();
            confirmed.forEach(b => {
              const isDone = b.status?.toLowerCase().includes('complete') || b.completed === true;
              const isLiveNow = !isDone && (b.status?.toLowerCase().includes('live') || b.isLive === true);
              map.set(b.id, {
                ...b,
                meetUrl: b.meet_link || b.meeting_link || b.meetUrl || '',
                isLive: isLiveNow,
                completed: isDone
              });
            });
            prev.forEach(p => {
              if (p && p.id && !map.has(p.id) && !p.deletedByExpert && !isExpertRoleDeleted(p.id, expEmail)) {
                map.set(p.id, p);
              }
            });
            const merged = Array.from(map.values());
            try { localStorage.setItem(acceptedKey, JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      } catch (err) {
        console.warn('[EXPERT PORTAL] Supabase bookings load note:', err);
      }
    };

    loadSupabaseExpertBookings();

    const handleExpertLiveUpdate = (updatedBooking: any) => {
      if (!updatedBooking || !updatedBooking.id) return;
      if (updatedBooking.deletedByExpert || isExpertRoleDeleted(updatedBooking.id, expEmail)) {
        setRequests(prev => {
          const next = prev.filter(r => r.id !== updatedBooking.id);
          try { localStorage.setItem(requestsKey, JSON.stringify(next)); } catch {}
          return next;
        });
        setAcceptedSessions(prev => {
          const next = prev.filter(s => s.id !== updatedBooking.id);
          try { localStorage.setItem(acceptedKey, JSON.stringify(next)); } catch {}
          return next;
        });
        return;
      }

      const bExpId = String(updatedBooking.expert_id || '').toLowerCase().trim();
      const bExpEmail = String(updatedBooking.expert_email || '').toLowerCase().trim();
      const bExpName = String(updatedBooking.expert_name || '').toLowerCase().trim();

      const isForMe = (expId && bExpId === expId) ||
                      (expEmail && bExpEmail === expEmail) ||
                      (expName && bExpName === expName) ||
                      (expertProfile?.user_id && bExpId === String(expertProfile.user_id).toLowerCase());

      if (!isForMe) return;

      const isStillPending = updatedBooking.status?.toLowerCase().includes('pending') || updatedBooking.status === 'pending';
      const isDone = updatedBooking.status?.toLowerCase().includes('complete') || updatedBooking.completed === true;
      const isLiveNow = !isDone && (updatedBooking.status?.toLowerCase().includes('live') || updatedBooking.isLive === true);
      const meetUrl = updatedBooking.meet_link || updatedBooking.meeting_link || updatedBooking.meetUrl || '';

      console.log('⚡ [EXPERT REALTIME] Processing booking update for expert:', { id: updatedBooking.id, status: updatedBooking.status, meetUrl, isLive: isLiveNow, completed: isDone });

      setRequests(prev => {
        let next: any[];
        if (!isStillPending) {
          next = prev.filter(r => r.id !== updatedBooking.id);
        } else {
          next = prev.map(r => r.id === updatedBooking.id ? updatedBooking : r);
        }
        try { localStorage.setItem(requestsKey, JSON.stringify(next)); } catch {}
        return next;
      });

      if (!isStillPending && !updatedBooking.status?.toLowerCase().includes('reject')) {
        setAcceptedSessions(prev => {
          const mapped = {
            ...updatedBooking,
            meetUrl: meetUrl,
            isLive: isLiveNow,
            completed: isDone
          };
          const idx = prev.findIndex(s => s.id === updatedBooking.id);
          let next: any[];
          if (idx >= 0) {
            next = [...prev];
            next[idx] = { ...next[idx], ...mapped };
          } else {
            next = [mapped, ...prev];
          }
          try { localStorage.setItem(acceptedKey, JSON.stringify(next)); } catch {}
          return next;
        });
      }
    };

    // 2. Real-time Subscription to Supabase bookings table
    const unsubRealtime = subscribeToBookingsRealtime({
      channelName: 'bookings-realtime-channel',
      // Only this expert's bookings (emails are stored lowercase). Without a filter every booking in
      // the whole table was pushed to every expert's browser.
      filter: expEmail ? `expert_email=eq.${expEmail}` : undefined,
      onInsert: (newBooking) => {
        if (newBooking.deletedByExpert || isExpertRoleDeleted(newBooking.id, expEmail)) {
          return;
        }

        const bExpId = String(newBooking.expert_id || '').toLowerCase().trim();
        const bExpEmail = String(newBooking.expert_email || '').toLowerCase().trim();
        const bExpName = String(newBooking.expert_name || '').toLowerCase().trim();

        const isForMe = (expId && bExpId === expId) ||
                        (expEmail && bExpEmail === expEmail) ||
                        (expName && bExpName === expName) ||
                        (expertProfile?.user_id && bExpId === String(expertProfile.user_id).toLowerCase());

        const isPending = newBooking.status?.toLowerCase().includes('pending') || newBooking.status === 'pending';

        if (isForMe && isPending) {
          console.log('⚡ [EXPERT REALTIME] New incoming client booking request received:', newBooking);
          setRequests(prev => {
            if (prev.some(r => r.id === newBooking.id)) return prev;
            const next = [newBooking, ...prev];
            try { localStorage.setItem(requestsKey, JSON.stringify(next)); } catch {}
            return next;
          });
        }
      },
      onUpdate: (updatedBooking) => {
        handleExpertLiveUpdate(updatedBooking);
      },
      onDelete: (deletedId) => {
        console.log('⚡ [EXPERT REALTIME] Booking request deleted:', deletedId);
        setRequests(prev => {
          const next = prev.filter(r => r.id !== deletedId);
          try { localStorage.setItem(requestsKey, JSON.stringify(next)); } catch {}
          return next;
        });
        setAcceptedSessions(prev => {
          const next = prev.filter(s => s.id !== deletedId);
          try { localStorage.setItem(acceptedKey, JSON.stringify(next)); } catch {}
          return next;
        });
      }
    });

    // 3. BroadcastChannel & Custom window events for instantaneous cross-portal sync
    let bcUpdates: BroadcastChannel | null = null;
    let bcDecisions: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bcUpdates = new BroadcastChannel('mentora_booking_updates');
        bcUpdates.onmessage = (event) => {
          if (event.data) handleExpertLiveUpdate(normalizeBooking(event.data));
        };
        bcDecisions = new BroadcastChannel('mentora_booking_decisions');
        bcDecisions.onmessage = (event) => {
          if (event.data) handleExpertLiveUpdate(normalizeBooking(event.data));
        };
      }
    } catch {}

    const handleWindowBookingUpdate = (e: any) => {
      if (e.detail) handleExpertLiveUpdate(normalizeBooking(e.detail));
    };
    window.addEventListener("booking_updated", handleWindowBookingUpdate);
    window.addEventListener("booking_decision_updated", handleWindowBookingUpdate);
    window.addEventListener("app_platform_sessions_updated", loadSupabaseExpertBookings);
    window.addEventListener("focus", loadSupabaseExpertBookings);
    const periodicExpertSync = startVisibleInterval(loadSupabaseExpertBookings, 60_000); // EGRESS FIX: was every 10 s; live changes already arrive via the realtime subscription above

    return () => {
      unsubRealtime();
      bcUpdates?.close();
      bcDecisions?.close();
      window.removeEventListener("booking_updated", handleWindowBookingUpdate);
      window.removeEventListener("booking_decision_updated", handleWindowBookingUpdate);
      window.removeEventListener("app_platform_sessions_updated", loadSupabaseExpertBookings);
      window.removeEventListener("focus", loadSupabaseExpertBookings);
      periodicExpertSync();
    };
  }, [resolvedExpertId, expertProfile?.id, expertProfile?.user_id, expertProfile?.email, expertProfile?.name]);

  const [acceptedSessions, setAcceptedSessions] = useState<any[]>(getExpertAcceptedSessions);
  const [activeCallSession, setActiveCallSession] = useState<any | null>(null);
  const [meetSetupRequest, setMeetSetupRequest] = useState<any | null>(null);
  const [enteredMeetUrl, setEnteredMeetUrl] = useState<string>("");
  const [boostActive, setBoostActive] = useState(false);
  const [selectedExpertForProfile, setSelectedExpertForProfile] = useState<any | null>(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  // Supabase Documents State (Eliminates localStorage quota issues)
  const [supabaseDocs, setSupabaseDocs] = useState<Record<ExpertDocType, SupabaseExpertDoc | null>>({
    work_experience_cert: null,
    offer_relieving_letter: null,
    executive_cv: null
  });
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<{
    work_experience_cert?: File;
    offer_relieving_letter?: File;
    executive_cv?: File;
  }>({});
  const [isSavingDocs, setIsSavingDocs] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docToast, setDocToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [resolvedExpertUuid, setResolvedExpertUuid] = useState<string>("");
  const [viewerDoc, setViewerDoc] = useState<DocumentViewerItem | null>(null);

  const showDocToast = (message: string, type: 'success' | 'error' = 'success') => {
    setDocToast({ message, type });
    setTimeout(() => {
      setDocToast(prev => prev?.message === message ? null : prev);
    }, 4500);
  };

  // Resolve expert profile UUID and clean up legacy localStorage entries
  useEffect(() => {
    cleanupLegacyExpertDocsLocalStorage();
    let isMounted = true;

    async function resolveUuid() {
      const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      // Check current Supabase Auth user
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id && isUuid(user.id)) {
          if (isMounted) setResolvedExpertUuid(user.id);
          return;
        }
      } catch {}

      const candidate = expertProfile?.user_id || expertProfile?.id;
      if (candidate && isUuid(candidate)) {
        if (isMounted) setResolvedExpertUuid(candidate);
        return;
      }

      // Check email in users / profiles table
      const cleanEmail = (expertProfile?.email || '').toLowerCase().trim();
      if (cleanEmail) {
        try {
          const { data: u } = await supabase
            .from('users')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle();
          if (u?.id && isUuid(u.id)) {
            if (isMounted) setResolvedExpertUuid(u.id);
            return;
          }
        } catch {}

        try {
          const { data: p } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle();
          if (p?.id && isUuid(p.id)) {
            if (isMounted) setResolvedExpertUuid(p.id);
            return;
          }
        } catch {}
      }

      if (candidate && isMounted) {
        setResolvedExpertUuid(String(candidate));
      }
    }

    resolveUuid();
    return () => { isMounted = false; };
  }, [expertProfile?.id, expertProfile?.user_id, expertProfile?.email]);

  const loadDocumentsFromDb = async (uuidToUse: string) => {
    if (!uuidToUse) return;
    setIsLoadingDocs(true);
    try {
      const res = await fetchExpertDocuments(uuidToUse);
      if (res.success) {
        setSupabaseDocs(res.documents);
      } else {
        console.warn('[DOCUMENTS] Fetch warning:', res.error);
      }
    } catch (err: any) {
      console.error('[DOCUMENTS] Load error:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (resolvedExpertUuid) {
      loadDocumentsFromDb(resolvedExpertUuid);
    }
  }, [resolvedExpertUuid]);

  // Realtime subscription for expert documents table
  useEffect(() => {
    if (!resolvedExpertUuid) return;
    const channel = supabase.channel(`expert-docs-realtime-${resolvedExpertUuid}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'expert_documents',
        filter: `expert_id=eq.${resolvedExpertUuid}`
      }, () => {
        console.log('[REALTIME] Document change received for expert:', resolvedExpertUuid);
        loadDocumentsFromDb(resolvedExpertUuid);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedExpertUuid]);

  const [meetLinkInputs, setMeetLinkInputs] = useState<{ [sessionId: string]: string }>({});
  const [editingMeetSessionId, setEditingMeetSessionId] = useState<string | null>(null);
  const [meetLinkErrors, setMeetLinkErrors] = useState<{ [sessionId: string]: string }>({});
  const [meetLinkSuccess, setMeetLinkSuccess] = useState<{ [sessionId: string]: string }>({});
  const [isSendingMeetLink, setIsSendingMeetLink] = useState<{ [sessionId: string]: boolean }>({});

  // Supabase Realtime synchronization with Admin Document Audit & KYC desk
  useEffect(() => {
    const ch = supabase.channel('admin-kyc-desk', {
      config: { broadcast: { self: false } }
    });

    ch.on('broadcast', { event: 'expert_status_changed' }, (payload: any) => {
      const p = payload.payload;
      if (!p) return;
      const myId = String(expertProfile?.id || '').toLowerCase();
      const myEmail = String(expertProfile?.email || '').toLowerCase();
      const targetId = String(p.expertId || '').toLowerCase();
      const targetEmail = String(p.email || '').toLowerCase();

      if ((targetId && (targetId === myId || targetId === resolvedExpertUuid)) || (targetEmail && targetEmail === myEmail)) {
        console.log('[EXPERT PORTAL] Real-time status event received:', p);
        const isApproved = p.status === 'approved' || p.status === 'Verified' || p.isApproved === true;
        const isRejected = p.status === 'changes_requested' || p.status === 'rejected' || p.status === 'Rejected' || p.isRejected === true;

        const updatedProfile = {
          ...expertProfile,
          verified: isApproved,
          verificationStatus: isApproved ? 'approved' : (isRejected ? 'rejected' : 'pending'),
          status: isApproved ? 'Verified' : (isRejected ? 'Rejected' : (p.status || 'Pending Review')),
          rejected: isRejected,
          rejectionReason: p.rejectionReason || null
        };

        if (onUpdateExpertProfile) {
          onUpdateExpertProfile(updatedProfile);
        }

        try {
          const activeKey = localStorage.getItem("admin_logged_in_expert") ? "admin_logged_in_expert" : "current_logged_in_expert";
          localStorage.setItem(activeKey, JSON.stringify(updatedProfile));
        } catch {}

        if (resolvedExpertUuid) {
          loadDocumentsFromDb(resolvedExpertUuid);
        }
      }
    });

    ch.on('broadcast', { event: 'expert_deleted' }, (payload: any) => {
      const p = payload.payload;
      if (!p) return;
      const myId = String(expertProfile?.id || '').toLowerCase();
      const targetId = String(p.expertId || '').toLowerCase();

      if (targetId && (targetId === myId || targetId === resolvedExpertUuid)) {
        console.log('[EXPERT PORTAL] Expert deleted event received, resetting profile');
        try {
          localStorage.removeItem("current_logged_in_expert");
          localStorage.removeItem("admin_logged_in_expert");
        } catch {}
        if (onLogout) onLogout();
      }
    });

    ch.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'experts'
      },
      (payload: any) => {
        const newRecord = payload.new;
        if (!newRecord) return;
        const myId = String(expertProfile?.id || '').toLowerCase();
        const myEmail = String(expertProfile?.email || '').toLowerCase();
        if (newRecord.id === myId || (newRecord.email && newRecord.email.toLowerCase() === myEmail)) {
          const isApproved = newRecord.verified === true || newRecord.status === 'approved' || newRecord.verification_status === 'approved';
          const isRejected = newRecord.status === 'rejected' || newRecord.verification_status === 'rejected' || newRecord.rejected === true;

          const updatedProfile = {
            ...expertProfile,
            verified: isApproved,
            verificationStatus: isApproved ? 'approved' : (isRejected ? 'rejected' : 'pending'),
            status: isApproved ? 'Verified' : (isRejected ? 'Rejected' : (newRecord.status || 'Pending Review')),
            rejected: isRejected,
            rejectionReason: newRecord.rejection_reason || null
          };

          if (onUpdateExpertProfile) {
            onUpdateExpertProfile(updatedProfile);
          }

          try {
            const activeKey = localStorage.getItem("admin_logged_in_expert") ? "admin_logged_in_expert" : "current_logged_in_expert";
            localStorage.setItem(activeKey, JSON.stringify(updatedProfile));
          } catch {}
        }
      }
    );

    ch.subscribe((status) => {
      console.log('[EXPERT PORTAL] Realtime channel status:', status);
    });

    return () => {
      supabase.removeChannel(ch);
    };
  }, [expertProfile?.id, expertProfile?.email]);

  // Placeholder handler for Accept Booking (as specified in requirements)
  const handleAcceptBooking = async (bookingId: string) => {
    try {
      const targetReq = requests.find(r => r.id === bookingId);
      const callerInfo = {
        userId: expertProfile?.id || expertProfile?.user_id || '',
        userEmail: expertProfile?.email || '',
        userRole: 'expert'
      };
      await updateBookingStatus(bookingId, 'accepted', {}, callerInfo);
      if (targetReq) {
        handleAcceptRequest(targetReq);
      } else {
        setRequests(prev => prev.filter(r => r.id !== bookingId));
      }

      // Event emit & notification trigger AFTER existing action has already succeeded
      broadcastBookingDecision({
        bookingId,
        decision: 'accepted',
        expertName: expertProfile?.name || targetReq?.expert || 'Senior Expert',
        clientEmail: targetReq?.clientEmail || targetReq?.client_email || '',
        topic: targetReq?.topic || ''
      });
    } catch (err) {
      console.error('[EXPERT PORTAL] handleAcceptBooking error:', err);
    }
  };

  // Placeholder handler for Reject Booking (as specified in requirements)
  const handleRejectBooking = async (bookingId: string) => {
    try {
      const targetReq = requests.find(r => r.id === bookingId);
      const callerInfo = {
        userId: expertProfile?.id || expertProfile?.user_id || '',
        userEmail: expertProfile?.email || '',
        userRole: 'expert'
      };
      await updateBookingStatus(bookingId, 'rejected', {}, callerInfo);
      if (targetReq) {
        handleDeclineRequest(targetReq);
      } else {
        setRequests(prev => prev.filter(r => r.id !== bookingId));
      }

      // Event emit & notification trigger AFTER existing action has already succeeded
      broadcastBookingDecision({
        bookingId,
        decision: 'rejected',
        expertName: expertProfile?.name || targetReq?.expert || 'Senior Expert',
        clientEmail: targetReq?.clientEmail || targetReq?.client_email || '',
        topic: targetReq?.topic || ''
      });
    } catch (err) {
      console.error('[EXPERT PORTAL] handleRejectBooking error:', err);
    }
  };

  const handleAcceptRequest = (req: any) => {
    if (!req) return;
    const callerInfo = {
      userId: expertProfile?.id || expertProfile?.user_id || '',
      userEmail: expertProfile?.email || '',
      userRole: 'expert'
    };
    updateBookingStatus(req.id, 'accepted', {}, callerInfo).catch(() => {});
    const basePay = expertProfile?.baseRate || 600;
    const payout = req.type === "Project" ? basePay * 3 : basePay;

    // 1. Remove from active requests state and requestsKey
    const updatedRequests = requests.filter(r => r.id !== req.id);
    setRequests(updatedRequests);
    localStorage.setItem(requestsKey, JSON.stringify(updatedRequests));
    mongoDB.syncKv(requestsKey, updatedRequests);

    const nameKey = (expertProfile?.name || "").toLowerCase().trim();
    const emailKey = (expertProfile?.email || "").toLowerCase().trim();
    const idKey = (expertProfile?.id || "").toLowerCase().trim();

    [nameKey, emailKey, idKey].filter(Boolean).forEach(k => {
      const reqKey = `expert_requests_${k}`;
      const raw = localStorage.getItem(reqKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((r: any) => r.id !== req.id);
            localStorage.setItem(reqKey, JSON.stringify(filtered));
            mongoDB.syncKv(reqKey, filtered);
          }
        } catch {}
      }
    });

    // 2. Add to acceptedSessions with status "Accepted — Awaiting Google Meet Link" and meetUrl: ""
    const acceptedItem = {
      id: req.id,
      client: req.client || "Client ABC",
      clientEmail: req.clientEmail || "",
      topic: req.topic || "Advisory Session",
      when: req.when || "Scheduled Time",
      type: req.type || "Hourly",
      payout: payout,
      status: "Accepted — Awaiting Google Meet Link",
      completed: false,
      expert: expertProfile?.name || "Senior Expert",
      expertEmail: expertProfile?.email || "",
      meetUrl: ""
    };

    const updatedAccepted = [acceptedItem, ...acceptedSessions.filter(s => s.id !== req.id)];
    setAcceptedSessions(updatedAccepted);
    localStorage.setItem(acceptedKey, JSON.stringify(updatedAccepted));
    mongoDB.syncKv(acceptedKey, updatedAccepted);

    if (nameKey) {
      localStorage.setItem(`expert_accepted_sessions_${nameKey}`, JSON.stringify(updatedAccepted));
      mongoDB.syncKv(`expert_accepted_sessions_${nameKey}`, updatedAccepted);
    }
    if (emailKey) {
      localStorage.setItem(`expert_accepted_sessions_${emailKey}`, JSON.stringify(updatedAccepted));
      mongoDB.syncKv(`expert_accepted_sessions_${emailKey}`, updatedAccepted);
    }

    // 3. Cross-sync to client's upcoming sessions
    try {
      const targetClientEmail = (req.clientEmail || "").toLowerCase().trim();
      if (targetClientEmail) {
        const clientKey = `client_upcoming_${targetClientEmail}`;
        mongoDB.getKv(clientKey).then((serverData: any) => {
          const list = Array.isArray(serverData) ? serverData : [];
          let srvChanged = false;
          const updated = list.map((b: any) => {
            if (b.id === req.id || (b.topic === req.topic && (b.expert === expertProfile?.name || b.expertEmail === expertProfile?.email))) {
              srvChanged = true;
              return {
                ...b,
                status: "accepted",
                meetUrl: "",
                completed: false
              };
            }
            return b;
          });
          if (srvChanged) {
            localStorage.setItem(clientKey, JSON.stringify(updated));
            mongoDB.syncKv(clientKey, updated);
          }
        });
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("client_upcoming_")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const bookings = JSON.parse(raw);
            if (Array.isArray(bookings)) {
              let changed = false;
              const updated = bookings.map((b: any) => {
                if (b.id === req.id || (b.topic === req.topic && (b.expert === expertProfile?.name || b.expertEmail === expertProfile?.email))) {
                  changed = true;
                  return {
                    ...b,
                    status: "accepted",
                    meetUrl: "",
                    completed: false
                  };
                }
                return b;
              });
              if (changed) {
                localStorage.setItem(key, JSON.stringify(updated));
                mongoDB.syncKv(key, updated);
              }
            }
          }
        }
      }
    } catch {}

    // 4. Sync accepted status to Admin Meeting & Session OPS Desk
    syncSessionToAdminOps({
      id: req.id,
      client: req.client || "Client ABC",
      clientEmail: req.clientEmail || "",
      expert: expertProfile?.name || "Senior Expert",
      expertEmail: expertProfile?.email || "",
      topic: req.topic || "Advisory Session",
      when: req.when || "Scheduled Time",
      type: req.type || "Hourly Consultation",
      rate: req.rate || (payout ? Math.round(payout * 1.25) : 750),
      payout: payout,
      status: "accepted",
      isLive: false,
      completed: false,
      meetUrl: "",
      meetCode: ""
    });

    // 5. Send notification to Client ABC
    notificationService.add({
      target: "client",
      recipientId: req.clientEmail,
      type: "session",
      title: "Consultation Request Accepted! 🎉",
      message: `Your consultation request has been accepted by Expert ${expertProfile?.name || "Expert"}. Your session is now ready to be scheduled.`,
      actionLink: "client"
    });
    notificationService.add({
      target: "expert",
      recipientId: expertProfile?.email || expertProfile?.name,
      type: "session",
      title: "Session Accepted",
      message: `You accepted "${req.topic}" with ${req.client}. Move down to "Confirm & Schedule Session" to provide the Google Meet link.`,
      actionLink: "expert"
    });

    // Centralized Notification Engine: Request Accepted Multi-Channel Trigger
    notificationEngine.trigger("request_accepted", {
      recipientId: req.clientEmail || req.client,
      recipientName: req.client,
      recipientType: "client",
      clientName: req.client,
      expertName: expertProfile?.name || "Senior Expert",
      meetingDate: req.when?.split(" ")[0] || "Scheduled Date",
      meetingTime: req.when?.split(" ")[1] || "Scheduled Time",
      topic: req.topic,
      bookingId: req.id,
      actionLink: "client"
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: "client_upcoming" } }));
      window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: acceptedKey } }));
      window.dispatchEvent(new Event("storage"));
    }

    confetti({ particleCount: 50, spread: 50, origin: { y: 0.5 } });
    alert(`✅ Consultation Request Accepted!\n\nSession with ${req.client} has been accepted and moved to "Confirm & Schedule Session".\nPlease generate and paste your Google Meet link there.`);
  };

  const handleSendMeetLink = async (session: any, inputUrl?: string) => {
    if (!session) return;
    const sessId = session.id;
    const rawUrl = (inputUrl !== undefined ? inputUrl : (meetLinkInputs[sessId] || "")).trim();

    if (!rawUrl) {
      setMeetLinkErrors(prev => ({ ...prev, [sessId]: "Please enter or paste a valid Google Meet link before sending." }));
      return;
    }

    let cleanUrl = rawUrl;
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const isGoogleMeet = /^https:\/\/meet\.google\.com\/[a-zA-Z0-9_\-]+(\?.*)?$/i.test(cleanUrl);
    if (!isGoogleMeet) {
      setMeetLinkErrors(prev => ({
        ...prev,
        [sessId]: "Please enter a valid Google Meet link (e.g. https://meet.google.com/xxx-yyyy-zzz)"
      }));
      return;
    }

    setIsSendingMeetLink(prev => ({ ...prev, [sessId]: true }));

    // Single source of truth: write exact character-for-character meet link to Supabase / DB
    const expId = expertProfile?.id || expertProfile?.user_id || "";
    const expEmail = expertProfile?.email || "";
    const sentAt = new Date().toISOString();

    const updateRes = await updateBookingStatus(
      sessId,
      session.isLive || session.status === "live" ? "live" : "accepted",
      {
        meet_link: cleanUrl,
        meeting_link: cleanUrl,
        meet_url: cleanUrl,
        meeting_link_sent_at: sentAt,
        updated_at: sentAt
      },
      {
        userId: expId,
        userEmail: expEmail,
        userRole: "expert"
      }
    );

    setIsSendingMeetLink(prev => ({ ...prev, [sessId]: false }));

    if (!updateRes || !updateRes.success) {
      const errMsg = (updateRes && updateRes.error) || "Failed to update Google Meet link in Supabase. Please try again.";
      setMeetLinkErrors(prev => ({ ...prev, [sessId]: errMsg }));
      alert(`❌ Error sending meeting link:\n${errMsg}`);
      return;
    }

    setMeetLinkErrors(prev => {
      const next = { ...prev };
      delete next[sessId];
      return next;
    });
    setMeetLinkSuccess(prev => ({ ...prev, [sessId]: "Link sent to client and admin" }));

    const codeMatch = cleanUrl.match(/meet\.google\.com\/([a-z0-9-]+)/i);
    const meetCode = codeMatch ? codeMatch[1] : cleanUrl.split("/").pop() || "meet-session";

    const basePay = expertProfile?.baseRate || 600;
    const payout = session.payout || (session.type === "Project" ? basePay * 3 : basePay);

    // 1. Update session in acceptedSessions
    const updatedAccepted = acceptedSessions.map((s: any) => {
      if (s.id === sessId) {
        return {
          ...s,
          meetUrl: cleanUrl,
          meet_link: cleanUrl,
          meeting_link: cleanUrl,
          meeting_link_sent_at: sentAt,
          meetCode: meetCode,
          status: "Confirmed — Meet Link Ready",
          payout: payout
        };
      }
      return s;
    });
    setAcceptedSessions(updatedAccepted);

    const nameKey = (expertProfile?.name || "").toLowerCase().trim();
    const emailKey = (expertProfile?.email || "").toLowerCase().trim();
    const idKey = (expertProfile?.id || "").toLowerCase().trim();

    localStorage.setItem(acceptedKey, JSON.stringify(updatedAccepted));
    mongoDB.syncKv(acceptedKey, updatedAccepted);

    if (nameKey) {
      localStorage.setItem(`expert_accepted_sessions_${nameKey}`, JSON.stringify(updatedAccepted));
      mongoDB.syncKv(`expert_accepted_sessions_${nameKey}`, updatedAccepted);
    }
    if (emailKey) {
      localStorage.setItem(`expert_accepted_sessions_${emailKey}`, JSON.stringify(updatedAccepted));
      mongoDB.syncKv(`expert_accepted_sessions_${emailKey}`, updatedAccepted);
    }

    // 2. Cross-sync to client's upcoming sessions
    try {
      const targetClientEmail = (session.clientEmail || "").toLowerCase().trim();
      if (targetClientEmail) {
        const clientKey = `client_upcoming_${targetClientEmail}`;
        mongoDB.getKv(clientKey).then((serverData: any) => {
          const list = Array.isArray(serverData) ? serverData : [];
          let srvChanged = false;
          const updated = list.map((b: any) => {
            if (b.id === sessId || (b.topic === session.topic && (b.expert === expertProfile?.name || b.expertEmail === expertProfile?.email))) {
              srvChanged = true;
              return {
                ...b,
                status: "Confirmed — Meet Link Ready",
                meetUrl: cleanUrl,
                meet_link: cleanUrl,
                meeting_link: cleanUrl,
                meeting_link_sent_at: sentAt,
                meetCode: meetCode,
                completed: false
              };
            }
            return b;
          });
          if (srvChanged) {
            localStorage.setItem(clientKey, JSON.stringify(updated));
            mongoDB.syncKv(clientKey, updated);
          }
        });
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("client_upcoming_")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const bookings = JSON.parse(raw);
            if (Array.isArray(bookings)) {
              let changed = false;
              const updated = bookings.map((b: any) => {
                if (b.id === sessId || (b.topic === session.topic && (b.expert === expertProfile?.name || b.expertEmail === expertProfile?.email))) {
                  changed = true;
                  return {
                    ...b,
                    status: "Confirmed — Meet Link Ready",
                    meetUrl: cleanUrl,
                    meet_link: cleanUrl,
                    meeting_link: cleanUrl,
                    meeting_link_sent_at: sentAt,
                    meetCode: meetCode,
                    completed: false
                  };
                }
                return b;
              });
              if (changed) {
                localStorage.setItem(key, JSON.stringify(updated));
                mongoDB.syncKv(key, updated);
              }
            }
          }
        }
      }
    } catch {}

    // 3. Update earnings & wallet balance once link is sent (if not already counted)
    if (!session.meetUrl) {
      const newEarnings = earnings + payout;
      const newWallet = walletBalance + payout;
      setEarnings(newEarnings);
      setWalletBalance(newWallet);
      localStorage.setItem(earningsKey, String(newEarnings));
      localStorage.setItem(walletKey, String(newWallet));

      const updatedTrend = trendData.map((t, idx) => 
        idx === 3 ? { ...t, amount: t.amount + payout } : t
      );
      setTrendData(updatedTrend);
      localStorage.setItem(trendKey, JSON.stringify(updatedTrend));
    }

    // 4. Sync exact Google Meet link to Admin Meeting & Session OPS Desk
    syncSessionToAdminOps({
      id: sessId,
      client: session.client || "Client ABC",
      clientEmail: session.clientEmail || "",
      expert: expertProfile?.name || session.expert || "Senior Expert",
      expertEmail: expertProfile?.email || session.expertEmail || "",
      topic: session.topic,
      when: session.when,
      type: session.type || "Hourly Consultation",
      payout: payout,
      status: "Confirmed — Meet Link Ready",
      isLive: false,
      completed: false,
      meetUrl: cleanUrl,
      meet_link: cleanUrl,
      meeting_link: cleanUrl,
      meeting_link_sent_at: sentAt,
      meetCode: meetCode
    });

    // 5. Broadcast across realtime channel and window events
    try {
      broadcastBookingUpdate({
        id: sessId,
        meetUrl: cleanUrl,
        meet_link: cleanUrl,
        meeting_link: cleanUrl,
        meeting_link_sent_at: sentAt,
        status: session.isLive || session.status === "live" ? "live" : "accepted",
        expert_name: expertProfile?.name || session.expert || "Senior Expert",
        expert_email: expertProfile?.email || session.expertEmail || "",
        client_name: session.client || "Client ABC",
        client_email: session.clientEmail || "",
        topic: session.topic
      });
    } catch {}

    // 6. Dispatch real-time notifications
    notificationService.add({
      target: "client",
      recipientId: session.clientEmail,
      type: "session",
      title: "Google Meet Link Received! 🎥",
      message: `Expert ${expertProfile?.name || "Expert"} has sent the Google Meet link for "${session.topic}". You can now join the session.`,
      actionLink: "client"
    });
    notificationService.add({
      target: "expert",
      recipientId: expertProfile?.email || expertProfile?.name,
      type: "session",
      title: "Meet Link Sent & Session Confirmed",
      message: `Google Meet link sent to ${session.client} for "${session.topic}". Payout of ₹${payout.toLocaleString("en-IN")} credited.`,
      actionLink: "expert"
    });

    // Centralized Notification Engine: Google Meet Link Dispatched Multi-Channel Trigger
    notificationEngine.trigger("meet_link_sent", {
      recipientId: session.clientEmail || session.client,
      recipientName: session.client,
      recipientType: "client",
      clientName: session.client,
      expertName: expertProfile?.name || session.expert || "Senior Expert",
      meetingDate: session.when?.split(" ")[0] || "Scheduled Date",
      meetingTime: session.when?.split(" ")[1] || "Scheduled Time",
      meetingLink: cleanUrl,
      topic: session.topic,
      bookingId: sessId,
      actionLink: "client"
    });

    setEditingMeetSessionId(null);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: "client_upcoming" } }));
      window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: acceptedKey } }));
      window.dispatchEvent(new Event("storage"));
    }

    confetti({ particleCount: 60, spread: 50, origin: { y: 0.5 } });
    alert(`🎉 Google Meet Link Sent to Client!\n\nSession with ${session.client} is confirmed.\nGoogle Meet Link: ${cleanUrl}\n\nBoth you and the client can now join directly via Google Meet.`);
  };

  const handleMarkSessionCompleted = (s: any) => {
    if (!confirm(`Mark session "${s.topic}" with ${s.client} as completed? This will prompt the client to submit their Rating and Review.`)) {
      return;
    }

    // Single source of truth: write completed status to Supabase / DB and broadcast to Client & Admin
    const expId = expertProfile?.id || expertProfile?.user_id || "";
    const expEmail = expertProfile?.email || "";
    updateBookingStatus(
      s.id,
      "completed",
      {
        completed: true,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        userId: expId,
        userEmail: expEmail,
        userRole: "expert"
      }
    ).catch(err => {
      console.error("[EXPERT] Failed to mark booking completed in DB:", err);
    });

    const updatedAccepted = acceptedSessions.map(item => {
      if (item.id === s.id) {
        return { ...item, status: "Completed", completed: true, completedAt: new Date().toISOString() };
      }
      return item;
    });
    setAcceptedSessions(updatedAccepted);

    const nameKey = (expertProfile?.name || "").toLowerCase().trim();
    const emailKey = (expertProfile?.email || "").toLowerCase().trim();
    if (nameKey) {
      localStorage.setItem(`expert_accepted_sessions_${nameKey}`, JSON.stringify(updatedAccepted));
      mongoDB.syncKv(`expert_accepted_sessions_${nameKey}`, updatedAccepted);
    }
    if (emailKey) {
      localStorage.setItem(`expert_accepted_sessions_${emailKey}`, JSON.stringify(updatedAccepted));
      mongoDB.syncKv(`expert_accepted_sessions_${emailKey}`, updatedAccepted);
    }

    // Cross-sync into client upcoming sessions
    try {
      const targetClientEmail = (s.clientEmail || "").toLowerCase().trim();
      if (targetClientEmail) {
        const clientKey = `client_upcoming_${targetClientEmail}`;
        mongoDB.getKv(clientKey).then((serverData: any) => {
          const list = Array.isArray(serverData) ? serverData : [];
          let srvChanged = false;
          const updated = list.map((b: any) => {
            if (b.id === s.id || (b.topic === s.topic && (b.expert === expertProfile?.name || b.expertEmail === expertProfile?.email))) {
              srvChanged = true;
              return { ...b, status: "Completed", completed: true, completedAt: new Date().toISOString() };
            }
            return b;
          });
          if (srvChanged) {
            localStorage.setItem(clientKey, JSON.stringify(updated));
            mongoDB.syncKv(clientKey, updated);
          }
        });
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("client_upcoming_")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const bookings = JSON.parse(raw);
            if (Array.isArray(bookings)) {
              let changed = false;
              const updated = bookings.map((b: any) => {
                if (b.id === s.id || (b.topic === s.topic && (b.expert === expertProfile?.name || b.expertEmail === expertProfile?.email))) {
                  changed = true;
                  return { ...b, status: "Completed", completed: true, completedAt: new Date().toISOString() };
                }
                return b;
              });
              if (changed) {
                localStorage.setItem(key, JSON.stringify(updated));
                mongoDB.syncKv(key, updated);
              }
            }
          }
        }
      }
    } catch {}

    // Sync completed status to Admin Meeting & Session OPS Desk
    syncSessionToAdminOps({
      id: s.id,
      client: s.client,
      clientEmail: s.clientEmail,
      expert: expertProfile?.name || s.expert,
      expertEmail: expertProfile?.email || s.expertEmail,
      topic: s.topic,
      when: s.when,
      status: "Completed",
      completed: true,
      completedAt: new Date().toISOString()
    });

    notificationService.add({
      target: "client",
      recipientId: s.clientEmail,
      type: "review",
      title: "Session Completed! Please Rate & Review ⭐",
      message: `Your consultation "${s.topic}" with ${expertProfile?.name || "Expert"} is completed. Please rate your experience!`,
      actionLink: "client"
    });
    notificationService.add({
      target: "expert",
      recipientId: expertProfile?.email || expertProfile?.name,
      type: "session",
      title: "Session Marked Completed ✅",
      message: `Consultation with ${s.client} marked complete. Client invited to rate & review.`,
      actionLink: "expert"
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: "client_upcoming" } }));
    }

    confetti({ particleCount: 50, spread: 50, origin: { y: 0.5 } });
    alert(`✅ Session Marked Completed!\n\nThe client (${s.client}) has been notified to Rate and Review your consultation.`);
  };

  const handleDeleteAcceptedSession = (s: any) => {
    if (!s) return;
    const sessId = s.id;
    const sessTopic = s.topic || "Consultation";
    const sessClient = s.client || "Client";

    if (!confirm(`Are you sure you want to delete session "${sessTopic}" with ${sessClient}? This will remove it from your scheduled sessions.`)) {
      return;
    }

    const nameKey = (expertProfile?.name || "").toLowerCase().trim();
    const emailKey = (expertProfile?.email || "").toLowerCase().trim();
    const idKey = (expertProfile?.id || "").toLowerCase().trim();
    const deletedSessionKey = `expert_deleted_sessions_${expertEmailKey || nameKey || emailKey || "default"}`;

    // 1. Add to persistent expert deleted sessions blacklist
    if (sessId) {
      recordRoleDeleted(sessId, 'expert', expertProfile?.email);
      try {
        const rawDeleted = localStorage.getItem(deletedSessionKey);
        const existing = rawDeleted ? JSON.parse(rawDeleted) : [];
        const next = Array.from(new Set([...existing, sessId]));
        localStorage.setItem(deletedSessionKey, JSON.stringify(next));
        mongoDB.syncKv(deletedSessionKey, next);
      } catch {}

      // Call role-based soft-delete API (does NOT delete globally)
      deleteBooking(sessId, {
        userId: expertProfile?.id,
        userEmail: expertProfile?.email,
        userRole: 'expert'
      }).catch(() => {});
    }

    // 2. Remove from active acceptedSessions state
    const updatedAccepted = acceptedSessions.filter(item => item.id !== sessId);
    setAcceptedSessions(updatedAccepted);

    // 3. Save to primary acceptedKey
    localStorage.setItem(acceptedKey, JSON.stringify(updatedAccepted));
    mongoDB.syncKv(acceptedKey, updatedAccepted);

    // 4. Clean from expert_accepted_sessions_* keys for this expert only
    const checkAcceptedKeys = new Set<string>([
      acceptedKey,
      nameKey ? `expert_accepted_sessions_${nameKey}` : "",
      emailKey ? `expert_accepted_sessions_${emailKey}` : "",
      idKey ? `expert_accepted_sessions_${idKey}` : "",
      "expert_accepted_sessions_jk",
      "expert_accepted_sessions_jk@registry.com",
    ]);

    checkAcceptedKeys.forEach(k => {
      if (!k) return;
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((item: any) => item && item.id !== sessId);
            localStorage.setItem(k, JSON.stringify(filtered));
            mongoDB.syncKv(k, filtered);
          }
        }
      } catch {}
    });

    // 5. Dispatch events (ONLY expert-local events, DO NOT touch client or admin)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: acceptedKey } }));
      window.dispatchEvent(new Event("storage"));
    }

    notificationService.add({
      target: "expert",
      recipientId: expertProfile?.email || expertProfile?.name,
      type: "session",
      title: "Session Deleted 🗑️",
      message: `Consultation session "${sessTopic}" with ${sessClient} has been deleted.`,
      actionLink: "expert"
    });
  };

  const handleDeleteRequest = (r: any) => {
    if (!r) return;
    const reqId = r.id;
    const reqTopic = r.topic || "Consultation Request";
    const reqClient = r.client || r.client_name || "Client";

    if (!confirm(`Are you sure you want to delete request "${reqTopic}" from ${reqClient}? This will remove it from your incoming requests.`)) {
      return;
    }

    const nameKey = (expertProfile?.name || "").toLowerCase().trim();
    const emailKey = (expertProfile?.email || "").toLowerCase().trim();
    const deletedSessionKey = `expert_deleted_sessions_${expertEmailKey || nameKey || emailKey || "default"}`;

    if (reqId) {
      recordRoleDeleted(reqId, 'expert', expertProfile?.email);
      try {
        const rawDeleted = localStorage.getItem(deletedSessionKey);
        const existing = rawDeleted ? JSON.parse(rawDeleted) : [];
        const next = Array.from(new Set([...existing, reqId]));
        localStorage.setItem(deletedSessionKey, JSON.stringify(next));
        mongoDB.syncKv(deletedSessionKey, next);
      } catch {}

      deleteBooking(reqId, {
        userId: expertProfile?.id,
        userEmail: expertProfile?.email,
        userRole: 'expert'
      }).catch(() => {});
    }

    const updatedRequests = requests.filter(item => item.id !== reqId);
    setRequests(updatedRequests);
    try {
      localStorage.setItem(requestsKey, JSON.stringify(updatedRequests));
      mongoDB.syncKv(requestsKey, updatedRequests);
    } catch {}

    const checkRequestKeys = [
      requestsKey,
      nameKey ? `expert_requests_${nameKey}` : "",
      emailKey ? `expert_requests_${emailKey}` : ""
    ].filter(Boolean);

    checkRequestKeys.forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((item: any) => item && item.id !== reqId);
            localStorage.setItem(k, JSON.stringify(filtered));
            mongoDB.syncKv(k, filtered);
          }
        }
      } catch {}
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: requestsKey } }));
      window.dispatchEvent(new Event("storage"));
    }
  };

  const handleDeclineRequest = (reqItem: any) => {
    const reqId = typeof reqItem === "object" ? reqItem.id : reqItem;
    if (reqId) {
      updateBookingStatus(reqId, 'rejected').catch(() => {});
    }
    const reqTopic = typeof reqItem === "object" ? reqItem.topic : "";
    const reqClient = typeof reqItem === "object" ? reqItem.client : "";
    const reqClientEmail = typeof reqItem === "object" ? (reqItem.clientEmail || "") : "";

    const nameKey = (expertProfile?.name || "").toLowerCase().trim();
    const emailKey = (expertProfile?.email || "").toLowerCase().trim();
    const idKey = (expertProfile?.id || "").toLowerCase().trim();
    const declinedKey = `expert_declined_${nameKey || emailKey || idKey || "default"}`;

    // 1. Add to persistent declinedIds list
    if (reqId) {
      try {
        const rawDeclined = localStorage.getItem(declinedKey);
        const existing = rawDeclined ? JSON.parse(rawDeclined) : [];
        const next = Array.from(new Set([...existing, reqId]));
        localStorage.setItem(declinedKey, JSON.stringify(next));
        mongoDB.syncKv(declinedKey, next);
      } catch {}
    }

    // 2. Remove from active requests state and requestsKey
    const updatedRequests = requests.filter(r => {
      if (reqId && r.id && r.id === reqId) return false;
      if (reqTopic && r.topic === reqTopic && (r.client === reqClient || !reqClient)) return false;
      return true;
    });
    setRequests(updatedRequests);
    localStorage.setItem(requestsKey, JSON.stringify(updatedRequests));
    mongoDB.syncKv(requestsKey, updatedRequests);

    // 3. Clean from ALL expert_requests_* keys in localStorage and mongoDB
    [nameKey, emailKey, idKey, requestsKey.replace("expert_requests_", "")].filter(Boolean).forEach(k => {
      const rk = `expert_requests_${k}`;
      const raw = localStorage.getItem(rk);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((r: any) => {
              if (reqId && r.id && r.id === reqId) return false;
              if (reqTopic && r.topic === reqTopic) return false;
              return true;
            });
            localStorage.setItem(rk, JSON.stringify(filtered));
            mongoDB.syncKv(rk, filtered);
          }
        } catch {}
      }
    });

    // 4. Update matching client booking status to "Declined by Expert" across all client_upcoming_* keys
    try {
      const targetClientEmail = reqClientEmail ? reqClientEmail.toLowerCase().trim() : "";
      if (targetClientEmail) {
        const clientKey = `client_upcoming_${targetClientEmail}`;
        mongoDB.getKv(clientKey).then((serverData: any) => {
          const list = Array.isArray(serverData) ? serverData : [];
          let srvChanged = false;
          const updated = list.map((b: any) => {
            const matchesId = reqId && b.id && b.id === reqId;
            const matchesTopic = reqTopic && b.topic === reqTopic && (
              !b.expert || !expertProfile?.name ||
              b.expert.toLowerCase().trim() === expertProfile.name.toLowerCase().trim() ||
              (b.expertEmail && expertProfile?.email && b.expertEmail.toLowerCase().trim() === expertProfile.email.toLowerCase().trim())
            );
            if (matchesId || matchesTopic) {
              srvChanged = true;
              return {
                ...b,
                status: "rejected",
                declineReason: "The Expert is currently busy/unavailable and has declined your consultation request."
              };
            }
            return b;
          });
          if (srvChanged) {
            localStorage.setItem(clientKey, JSON.stringify(updated));
            mongoDB.syncKv(clientKey, updated);
          }
        });
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("client_upcoming_")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const bookings = JSON.parse(raw);
            if (Array.isArray(bookings)) {
              let changed = false;
              const updated = bookings.map((b: any) => {
                const matchesId = reqId && b.id && b.id === reqId;
                const matchesTopic = reqTopic && b.topic === reqTopic && (
                  !b.expert || !expertProfile?.name ||
                  b.expert.toLowerCase().trim() === expertProfile.name.toLowerCase().trim() ||
                  (b.expertEmail && expertProfile?.email && b.expertEmail.toLowerCase().trim() === expertProfile.email.toLowerCase().trim())
                );
                if (matchesId || matchesTopic) {
                  changed = true;
                  return { 
                    ...b, 
                    status: "rejected",
                    declineReason: "The Expert is currently busy/unavailable and has declined your consultation request."
                  };
                }
                return b;
              });
              if (changed) {
                localStorage.setItem(key, JSON.stringify(updated));
                mongoDB.syncKv(key, updated);
              }
            }
          }
        }
      }
    } catch {}

    // 5. Sync declined status to Admin Meeting & Session OPS Desk
    if (reqId) {
      syncSessionToAdminOps({
        id: reqId,
        client: reqClient || "Client ABC",
        clientEmail: reqClientEmail,
        expert: expertProfile?.name || "Senior Expert",
        expertEmail: expertProfile?.email,
        topic: reqTopic,
        status: "rejected",
        isLive: false,
        completed: false,
        meetUrl: "",
        meetCode: ""
      });
    }

    // 6. Dispatch real-time notification to client
    notificationService.add({
      target: "client",
      recipientId: reqClientEmail,
      type: "session",
      title: "Consultation Request Declined",
      message: "The Expert is currently busy/unavailable and has declined your consultation request.",
      actionLink: "client"
    });

    // Centralized Notification Engine: Request Declined Multi-Channel Trigger
    notificationEngine.trigger("request_declined", {
      recipientId: reqClientEmail || reqClient,
      recipientName: reqClient,
      recipientType: "client",
      clientName: reqClient,
      expertName: expertProfile?.name || "Senior Expert",
      topic: reqTopic,
      bookingId: reqId,
      actionLink: "client"
    });

    // 6. Broadcast real-time update
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: "client_upcoming" } }));
      window.dispatchEvent(new CustomEvent("storage"));
    }

    confetti({ particleCount: 30, spread: 40, origin: { y: 0.5 } });
    alert(`❌ Consultation Request Declined!\nThe request has been declined and removed from your queue.`);
  };

  const handleDecline = handleDeclineRequest;

  const handleWithdraw = () => {
    if (walletBalance <= 0) {
      alert("⚠️ No earnings available for withdrawal yet. Complete client consultation sessions to earn payouts!");
      return;
    }

    const withdrawAmt = walletBalance;
    setWalletBalance(0);
    localStorage.setItem(walletKey, "0");

    notificationService.add({
      target: "expert",
      recipientId: expertProfile?.email || expertProfile?.name,
      type: "wallet",
      title: "Bank Payout Dispatched",
      message: `₹${withdrawAmt.toLocaleString("en-IN")} has been dispatched to your registered bank account.`,
      actionLink: "expert"
    });

    confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 } });
    alert(`✅ Bank Payout Initiated!\n₹${withdrawAmt.toLocaleString("en-IN")} has been transferred to your registered bank account via NEFT/UPI.`);
  };

  const handleSelectDocFile = (docType: ExpertDocType, file: File | null) => {
    if (!file) {
      setSelectedUploadFiles(prev => {
        const copy = { ...prev };
        delete copy[docType];
        return copy;
      });
      return;
    }

    const val = validateDocumentFile(file);
    if (!val.valid) {
      showDocToast(val.error || "Invalid file", "error");
      return;
    }

    setSelectedUploadFiles(prev => ({
      ...prev,
      [docType]: file
    }));
  };

  const handleSaveAllDocs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedExpertUuid) {
      showDocToast("Could not resolve expert profile identifier. Please sign in again.", "error");
      return;
    }

    const filesToUpload = Object.entries(selectedUploadFiles).filter(([_, f]) => Boolean(f)) as [ExpertDocType, File][];

    if (filesToUpload.length === 0) {
      showDocToast("⚠️ Please choose at least one PDF credential document to submit.", "error");
      return;
    }

    setIsSavingDocs(true);
    let successCount = 0;
    const errors: string[] = [];
    const updatedDocsMap = { ...supabaseDocs };

    for (const [docType, file] of filesToUpload) {
      const existingDoc = supabaseDocs[docType];
      const res = await uploadSingleExpertDocument(
        resolvedExpertUuid,
        docType,
        file,
        existingDoc?.file_path
      );

      if (res.success && res.document) {
        successCount++;
        updatedDocsMap[docType] = res.document;
      } else {
        errors.push(res.error || `Failed to upload ${docType}`);
      }
    }

    setIsSavingDocs(false);

    if (errors.length > 0) {
      showDocToast(errors.join("; "), "error");
    }

    if (successCount > 0) {
      // Update state immediately without waiting for page refresh
      setSupabaseDocs(updatedDocsMap);
      setSelectedUploadFiles({});

      // Reset verification status upon new upload
      const isResubmit = expertProfile?.rejected === true || expertProfile?.verificationStatus === 'rejected' || expertProfile?.status === 'Rejected';
      const nextStatus = isResubmit ? 'Pending Review (Re-submitted)' : 'Pending Review';

      if (onUpdateExpertProfile && expertProfile) {
        onUpdateExpertProfile({
          ...expertProfile,
          status: nextStatus,
          verified: false,
          verificationStatus: "pending",
          rejected: false,
          rejectionReason: null
        });
      }

      try {
        const ch = supabase.channel('admin-kyc-desk');
        ch.send({
          type: 'broadcast',
          event: 'document_uploaded',
          payload: {
            expertId: resolvedExpertUuid,
            status: nextStatus,
            verificationStatus: 'pending_verification',
            isResubmission: isResubmit
          }
        });
      } catch {}

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
      showDocToast("✅ Documents successfully uploaded and synchronized with Supabase database!", "success");
    }
  };

  const handleViewDocument = async (doc: SupabaseExpertDoc) => {
    try {
      const signedUrl = await getDocumentSignedUrl(doc.file_path, 3600);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      console.error("View document error:", err);
      showDocToast(err?.message || "Failed to generate signed document preview URL", "error");
    }
  };

  const handleReplaceDocument = async (docType: ExpertDocType, file: File) => {
    if (!resolvedExpertUuid) {
      showDocToast("Could not resolve expert identifier.", "error");
      return;
    }

    const val = validateDocumentFile(file);
    if (!val.valid) {
      showDocToast(val.error || "Invalid file", "error");
      return;
    }

    setIsSavingDocs(true);
    const existingDoc = supabaseDocs[docType];
    const res = await uploadSingleExpertDocument(
      resolvedExpertUuid,
      docType,
      file,
      existingDoc?.file_path
    );
    setIsSavingDocs(false);

    if (res.success && res.document) {
      setSupabaseDocs(prev => ({
        ...prev,
        [docType]: res.document!
      }));

      // Status resets upon document replacement
      const isResubmit = expertProfile?.rejected === true || expertProfile?.verificationStatus === 'rejected' || expertProfile?.status === 'Rejected';
      const nextStatus = isResubmit ? 'Pending Review (Re-submitted)' : 'Pending Review';

      if (onUpdateExpertProfile && expertProfile) {
        onUpdateExpertProfile({
          ...expertProfile,
          status: nextStatus,
          verified: false,
          verificationStatus: "pending",
          rejected: false,
          rejectionReason: null
        });
      }

      try {
        const ch = supabase.channel('admin-kyc-desk');
        ch.send({
          type: 'broadcast',
          event: 'document_uploaded',
          payload: {
            expertId: resolvedExpertUuid,
            documentType: docType,
            document: res.document,
            status: nextStatus,
            verificationStatus: 'pending_verification',
            isResubmission: isResubmit
          }
        });
      } catch {}

      showDocToast(`✅ ${res.document.file_name} replaced and queued for Admin audit!`, "success");
    } else {
      showDocToast(res.error || "Failed to replace document", "error");
    }
  };

  const handleDeleteDocument = async (docType: ExpertDocType) => {
    const existingDoc = supabaseDocs[docType];
    if (!existingDoc || !resolvedExpertUuid) return;

    const confirmDelete = window.confirm(`Are you sure you want to delete ${existingDoc.file_name}?`);
    if (!confirmDelete) return;

    setIsSavingDocs(true);
    const res = await deleteExpertDocument(
      resolvedExpertUuid,
      docType,
      existingDoc.file_path
    );
    setIsSavingDocs(false);

    if (res.success) {
      setSupabaseDocs(prev => ({
        ...prev,
        [docType]: null
      }));
      showDocToast("Document deleted successfully.", "success");
    } else {
      showDocToast(res.error || "Failed to delete document", "error");
    }
  };

  const handleOpenDocPreview = async (docSlot?: any, defaultTitle = "Document Proof") => {
    if (!docSlot) return;
    const docId = docSlot.id || `doc-${expertProfile?.id || "exp"}-${docSlot.type}`;
    let fileData = docSlot.fileData;

    // 1. Try Supabase Storage signed URL if filePath exists
    const filePath = docSlot.filePath || docSlot.file_path;
    if (filePath && (!fileData || (!fileData.startsWith("data:") && !fileData.startsWith("blob:") && !fileData.includes("supabase.co")))) {
      try {
        const sRes = await fetch(`/api/documents/signed-url?filePath=${encodeURIComponent(filePath)}`);
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.signedUrl) {
            fileData = sData.signedUrl;
          }
        }
      } catch (e) {
        console.warn("Signed URL fetch failed:", e);
      }
    }

    // Direct static server check
    if (docSlot.fileName && (!fileData || !fileData.startsWith("data:"))) {
      try {
        const staticUrl = `/uploaded_docs/${encodeURIComponent(docSlot.fileName)}`;
        const chk = await fetch(staticUrl, { method: "HEAD" });
        if (chk.ok) {
          fileData = staticUrl;
        }
      } catch {}
    }

    if (!fileData) {
      fileData = (await getDocFile(docSlot.fileName || docId, {
        id: docId,
        type: docSlot.type,
        title: docSlot.title || defaultTitle,
        fileName: docSlot.fileName,
        expertId: expertProfile?.id,
        expertName: expertProfile?.name,
        expertEmail: expertProfile?.email,
        status: docSlot.status || "Verified in Database"
      })) || undefined;
    }
    setViewerDoc({
      id: docId,
      title: docSlot.title || defaultTitle,
      fileName: docSlot.fileName,
      fileSize: docSlot.fileSize || "1.8 MB",
      fileData,
      uploadedAt: docSlot.uploadedAt,
      status: docSlot.status || "Verified in Database",
      expertName: expertProfile?.name,
      expertEmail: expertProfile?.email,
      expertField: expertProfile?.field
    });
  };

  const isLight = theme === "light";

  return (
    <div 
      style={{ 
        color: isLight ? "#0F172A" : "#F8FAFC", 
        ...body, 
        minHeight: "100vh", 
        position: "relative" 
      }} 
      className="transition-colors duration-300 relative min-h-screen"
    >
      {/* Animated Video Background for Mentora Expert Portal */}
      <ExpertBackgroundVideo theme={theme} />

      {/* Main Expert Portal Content Layer */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Executive Command Desk Header */}
        <header className={`flex items-center gap-6 px-8 py-4 border-b relative z-30 backdrop-blur-xl ${isLight ? "bg-white/95 border-slate-200" : "bg-[#0B111A]/85 border-white/10"}`}>
        <button
          type="button"
          onClick={() => {
            setPage("landing");
          }}
          className="bg-transparent border-0 p-0 cursor-pointer hover:opacity-90 transition-opacity"
          title="Return to Mentora Home"
        >
          <Logo theme={theme} />
        </button>


        
        <div className="hidden 2xl:block w-36 h-14 relative overflow-hidden">
          <TrophyGraphic />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {onToggleTheme && <ThemeToggle theme={theme} onToggle={onToggleTheme} />}
          <NotificationCenter role="expert" recipientId={expertProfile?.email || expertProfile?.name} darkTheme={!isLight} onNavigate={setPage} />
          <span className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ background: "rgba(245, 158, 11, 0.12)", color: isLight ? "#B45309" : "#FCD34D", border: "1px solid rgba(245, 158, 11, 0.35)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            Senior Advisory Desk
          </span>
          <button onClick={onLogout || (() => setPage("landing"))} className={`p-2 rounded-lg transition-colors cursor-pointer ${isLight ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100" : "text-slate-400 hover:text-white hover:bg-white/10"}`} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="grid md:grid-cols-[300px_1fr] gap-8 px-8 py-8">
        {/* Left Aside: Profile & Document Verification Zone */}
        <aside className="space-y-6">
          <div 
            className={`p-5 rounded-2xl border shadow-xl space-y-4 transition-colors ${
              isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0B111A]"
            }`} 
            style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 bg-gradient-to-tr from-amber-500 to-amber-700 text-slate-950 shadow-md">
                {expertProfile?.initials || "EX"}
              </div>
              <div className="min-w-0 flex-1">
                <p style={{ ...display }} className={`text-lg font-bold truncate ${isLight ? "text-slate-900" : "text-white"}`}>{expertProfile?.name || "Senior Expert"}</p>
                <p className={`text-xs truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>{expertProfile?.field || "Advisory"}</p>
              </div>
            </div>

            <div className="pt-1">
              <Pill tone={expertProfile?.verified ? "moss" : (expertProfile?.rejected ? "rust" : "brass")}>
                <ShieldCheck size={12} /> {expertProfile?.verified ? "Verified History" : (expertProfile?.rejected ? "Audit Rejected" : "Pending Audit")}
              </Pill>
            </div>

            <div className={`pt-3.5 flex items-center justify-between text-xs border-t ${isLight ? "border-slate-100" : "border-white/10"}`}>
              <span className={`${isLight ? "text-slate-500" : "text-slate-400"} uppercase font-mono`}>Base Demand</span>
              <span className={`font-bold font-mono text-base ${isLight ? "text-amber-600" : "text-amber-400"}`}>₹{expertProfile?.baseRate || 600}/hr</span>
            </div>
            <div className={`pt-2 flex items-center justify-between text-xs`}>
              <span className={`${isLight ? "text-slate-500" : "text-slate-400"} uppercase font-mono`}>Project Review</span>
              <span className={`font-bold font-mono text-base ${isLight ? "text-cyan-600" : "text-cyan-400"}`}>₹{currentProjectReviewPrice.toLocaleString('en-IN')}</span>
            </div>

            <div className="pt-2 space-y-2">
              <Button3D 
                full 
                size="sm" 
                variant={activeExpertTab === "availability" ? "moss" : "brass"} 
                onClick={() => setActiveExpertTab("availability")}
              >
                <CalendarDays size={14} /> Availability Management
              </Button3D>
              <Button3D full size="sm" variant="brass" onClick={() => setShowEditProfileModal(true)}>
                <Edit3 size={14} /> Edit Profile & Rate
              </Button3D>
              <Button3D full size="sm" variant="ghost" onClick={() => setSelectedExpertForProfile(expertProfile)}>
                <FileText size={14} /> View Live Dossier
              </Button3D>
            </div>
          </div>

          <div 
            className={`p-5 rounded-2xl border shadow-xl space-y-3.5 transition-colors ${
              isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0B111A]"
            }`} 
            style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
          >
            <div className="flex items-center justify-between">
              <p className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? "text-slate-900" : "text-white"}`}>
                <FileCheck size={14} className={isLight ? "text-amber-600" : "text-amber-400"} /> Upload Credentials (PDF)
              </p>
              {(() => {
                const uploaded = Object.values(supabaseDocs).filter(Boolean);
                const allVerified = REQUIRED_DOC_TYPES.every(t => supabaseDocs[t]?.status === 'verified');
                if (uploaded.length > 0) {
                  return (
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                      allVerified
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    }`}>
                      {allVerified ? "Verified Badge" : "Database Synced"}
                    </span>
                  );
                }
                return null;
              })()}
            </div>

            <p className={`text-[11px] leading-relaxed ${isLight ? "text-slate-500" : "text-slate-400"}`}>
              Upload work experience certificate, offer letter & CV (PDF only, up to 10MB) for Admin audit to earn official Verified Badge.
            </p>

            <form onSubmit={handleSaveAllDocs} className="space-y-3 pt-1">
              {REQUIRED_DOC_TYPES.map((docType) => {
                const meta = DOC_TYPE_META[docType];
                const doc = supabaseDocs[docType];
                const selectedFile = selectedUploadFiles[docType];

                if (doc) {
                  // Document already uploaded in Supabase -> Show View / Replace / Delete
                  return (
                    <div key={docType} className={`p-3 border rounded-xl space-y-2 transition-all ${
                      isLight ? "border-slate-200 bg-slate-50" : "border-white/10 bg-[#111A27]"
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <span className={`font-semibold block text-[11px] truncate ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                            {meta.title}
                          </span>
                          <span className={`text-[10px] font-mono block truncate ${isLight ? "text-slate-600" : "text-slate-400"}`} title={doc.file_name}>
                            {doc.file_name}
                          </span>
                          <span className="text-[9px] text-amber-500 font-mono block">
                            {formatDocumentSize(doc.file_size)} · {new Date(doc.uploaded_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 uppercase tracking-wider ${
                          doc.status === 'verified'
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : doc.status === 'rejected'
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        }`}>
                          {doc.status === 'verified' ? (
                            <><Check size={10} /> Verified</>
                          ) : doc.status === 'rejected' ? (
                            <><AlertCircle size={10} /> Rejected</>
                          ) : (
                            <><Clock size={10} /> Pending</>
                          )}
                        </span>
                      </div>

                      {/* Admin Remark if Rejected */}
                      {doc.status === 'rejected' && doc.admin_remark && (
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-300 font-mono">
                          <span className="font-bold">Admin Remark:</span> {doc.admin_remark}
                        </div>
                      )}

                      {/* 3 Action Buttons: View, Replace, Delete */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200/40 dark:border-white/5">
                        <button
                          type="button"
                          onClick={() => handleViewDocument(doc)}
                          className="text-[11px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Open document in a new tab"
                        >
                          <ExternalLink size={12} /> View
                        </button>

                        <span className="text-slate-500 text-[10px]">·</span>

                        <label className="text-[11px] font-bold text-sky-500 hover:text-sky-400 flex items-center gap-1 cursor-pointer transition-colors">
                          <RefreshCw size={12} /> Replace
                          <input
                            type="file"
                            accept=".pdf,application/pdf"
                            className="hidden"
                            disabled={isSavingDocs}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleReplaceDocument(docType, file);
                              e.target.value = '';
                            }}
                          />
                        </label>

                        <span className="text-slate-500 text-[10px]">·</span>

                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(docType)}
                          disabled={isSavingDocs}
                          className="text-[11px] font-bold text-rose-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors ml-auto"
                          title="Delete this document"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  );
                }

                // Document not yet uploaded -> Render File Input with client validation
                return (
                  <div key={docType} className={`p-2.5 border rounded-xl space-y-1.5 ${
                    isLight ? "border-slate-200 bg-slate-50" : "border-white/10 bg-[#111A27]"
                  }`}>
                    <span className={`font-semibold block text-[11px] ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                      {meta.title}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {meta.subtitle} (PDF only, max 10MB)
                    </span>

                    {selectedFile ? (
                      <div className="flex items-center justify-between p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px]">
                        <span className="truncate text-amber-400 font-mono font-medium">
                          📄 {selectedFile.name} ({formatDocumentSize(selectedFile.size)})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSelectDocFile(docType, null)}
                          className="text-slate-400 hover:text-white ml-2 cursor-pointer"
                          title="Remove file"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        disabled={isSavingDocs}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          handleSelectDocFile(docType, file);
                        }}
                        className={`text-[10px] mt-1 block w-full file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-amber-500/10 file:text-amber-500 hover:file:bg-amber-500/20 cursor-pointer ${
                          isLight ? "text-slate-600" : "text-slate-400"
                        }`}
                      />
                    )}
                  </div>
                );
              })}

              {/* Save Documents to Database Button */}
              {Object.keys(selectedUploadFiles).length > 0 && (
                <Button3D
                  full
                  size="sm"
                  type="submit"
                  variant="brass"
                  disabled={isSavingDocs}
                >
                  <Upload size={13} className={isSavingDocs ? "animate-spin" : ""} /> {isSavingDocs ? "Saving to Database..." : "Save Documents to Database"}
                </Button3D>
              )}
            </form>
          </div>
        </aside>

        {/* Right Section: Telemetry & Sessions */}
        <section>
          {/* Dynamic Admin Audit Status Notification Banner */}
          {(() => {
            const isApproved = expertProfile?.verified === true && expertProfile?.verificationStatus === "approved" && !expertProfile?.rejected;
            const isRejected = expertProfile?.status === 'Rejected' || expertProfile?.verificationStatus === 'rejected' || expertProfile?.rejected === true;
            const isResubmitted = expertProfile?.status === 'Pending Review (Re-submitted)' || String(expertProfile?.status).includes('Re-submitted');

            if (isApproved) {
              return (
                <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-3.5 shadow-xl backdrop-blur-md ${
                  isLight ? "bg-emerald-50 text-emerald-900 border-emerald-300 shadow-sm" : "bg-emerald-950/50 text-emerald-200 border-emerald-500/40"
                }`}>
                  <ShieldCheck size={22} className={isLight ? "text-emerald-600 shrink-0" : "text-emerald-400 shrink-0"} />
                  <div>
                    <p className={`font-bold text-sm ${isLight ? "text-emerald-900" : "text-emerald-100"}`}>
                      Your documents have been audited and your account has been verified by Admin. Your profile is now live and you are ready to take work.
                    </p>
                  </div>
                </div>
              );
            }

            if (isRejected) {
              return (
                <div className="mb-6 p-4 rounded-2xl border flex items-start gap-3.5 shadow-xl backdrop-blur-md bg-rose-950/70 text-rose-200 border-rose-500/50 animate-fadeIn">
                  <AlertCircle size={22} className="text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm text-rose-200 flex items-center gap-2">
                      Submission Rejected
                    </p>
                    <p className="text-xs mt-1 leading-relaxed text-rose-300 font-medium">
                      {expertProfile?.rejectionReason || "Your submission has been rejected because the uploaded documents were not valid. Please upload valid documents and re-apply."}
                    </p>
                    <p className="text-[11px] text-rose-400/80 mt-1.5 font-mono">
                      You can replace or re-upload your credential documents on the left. Upon uploading, your submission will automatically change to &quot;Pending Review (Re-submitted)&quot; for admin verification.
                    </p>
                  </div>
                </div>
              );
            }

            if (isResubmitted) {
              return (
                <div className="mb-6 p-4 rounded-2xl border flex items-start gap-3.5 shadow-xl backdrop-blur-md bg-indigo-950/50 text-indigo-200 border-indigo-500/40 animate-fadeIn">
                  <RefreshCw size={22} className="text-indigo-400 shrink-0 mt-0.5 animate-spin" />
                  <div>
                    <p className="font-bold text-sm text-indigo-200 flex items-center gap-2">
                      Pending Review (Re-submitted)
                    </p>
                    <p className="text-xs mt-1 leading-relaxed text-indigo-300">
                      Your updated credentials have been re-submitted to the Admin KYC Verification Queue. The admin is auditing your latest documents.
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div className={`mb-6 p-4 rounded-2xl border flex items-start gap-3.5 shadow-xl backdrop-blur-md ${
                isLight ? "bg-amber-50 text-amber-950 border-amber-300 shadow-sm" : "bg-amber-950/40 text-amber-200 border-amber-500/40"
              }`}>
                <Clock size={22} className="text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <p className={`font-bold text-sm flex items-center gap-2 ${isLight ? "text-amber-900" : "text-amber-100"}`}>
                    Verification pending – admin audit
                  </p>
                  <p className={`text-xs mt-1 leading-relaxed ${isLight ? "text-amber-800 font-medium" : "text-amber-300/90"}`}>
                    Please upload all your documents in the Documents section so the admin can verify them.
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Top Navigation Tabs for Expert Desk */}
          <div className="flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-white/10 pb-3">
            <button
              onClick={() => setActiveExpertTab("sessions")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeExpertTab === "sessions"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : (isLight ? "bg-white/90 text-slate-900 border border-slate-300/80 shadow-xs backdrop-blur-md hover:bg-white hover:text-black font-extrabold" : "text-slate-400 hover:bg-white/10")
              }`}
            >
              <CalendarDays size={14} /> Advisory Sessions & Telemetry
            </button>
            <button
              onClick={() => setActiveExpertTab("availability")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeExpertTab === "availability"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : (isLight ? "bg-white/90 text-slate-900 border border-slate-300/80 shadow-xs backdrop-blur-md hover:bg-white hover:text-black font-extrabold" : "text-slate-400 hover:bg-white/10")
              }`}
            >
              <Clock size={14} /> Availability Management
            </button>
            <button
              onClick={() => setActiveExpertTab("project_reviews")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer relative ${
                activeExpertTab === "project_reviews"
                  ? "bg-cyan-500 text-slate-950 shadow-md"
                  : (isLight ? "bg-white/90 text-slate-900 border border-slate-300/80 shadow-xs backdrop-blur-md hover:bg-white hover:text-black font-extrabold" : "text-slate-400 hover:bg-white/10")
              }`}
            >
              <Briefcase size={14} /> Dedicated Project Reviews
              {expertProjectReviews.filter(r => r.status === 'PendingExpertAcceptance').length > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse ml-1">
                  {expertProjectReviews.filter(r => r.status === 'PendingExpertAcceptance').length}
                </span>
              )}
            </button>
          </div>

          {activeExpertTab === "availability" ? (
            <div id="expert-availability-manager-container" className="space-y-6">
              <ExpertAvailabilityManager
                expertId={resolvedExpertId}
                expertName={expertProfile?.name}
                isAdmin={false}
                theme={theme}
              />
            </div>
          ) : activeExpertTab === "project_reviews" ? (
            <div className="space-y-6">
              {/* Expert Project Reviews Desk (WORKFLOW B) */}
              <div className={`p-6 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden ${
                isLight ? "bg-gradient-to-r from-amber-50 via-white to-cyan-50 border-slate-200 text-slate-900 shadow-sm" : "bg-gradient-to-r from-[#0d1522] via-[#09101a] to-[#07131e] border-white/10 text-white"
              }`}>
                <div className="relative z-10 max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3 border bg-cyan-500/10 border-cyan-500/30 text-cyan-400">
                    <Sparkles size={14} /> Workflow B — Dedicated Executive Advisory
                  </div>
                  <h2 style={{ ...display }} className="text-2xl font-black tracking-tight">
                    Dedicated Project Reviews Desk
                  </h2>
                  <p className={`text-xs mt-1.5 leading-relaxed ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    Comprehensive multi-day engagements. Review incoming client project audits, inspect submitted code & documents, consult via Google Meet (up to 2 sessions), and submit written advisory findings to unlock escrow payouts.
                  </p>
                </div>
              </div>

              {/* Project Review Authoritative Pricing Synchronization Card */}
              <div className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isLight ? "bg-white border-slate-200 shadow-sm" : "bg-[#0B111A] border-white/10"
              }`}>
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
                    <IndianRupee size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xs tracking-wider uppercase text-slate-400">PROJECT REVIEW PRICE</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Synchronized
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-xs text-slate-400">Your Current Price:</span>
                      <strong className="font-mono text-amber-400 text-xl font-black">₹{currentProjectReviewPrice.toLocaleString('en-IN')}</strong>
                    </div>
                    <p className={`text-xs mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                      This is the amount charged for your Project Review service.
                    </p>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                      Maximum allowed price: ₹2,000
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 self-start md:self-center">
                  {!isEditingPRPrice ? (
                    <button
                      onClick={() => {
                        setPriceInputVal(String(currentProjectReviewPrice));
                        setIsEditingPRPrice(true);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow flex items-center gap-1.5"
                    >
                      <Save size={13} />
                      <span>Edit Price</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          min={0}
                          max={2000}
                          value={priceInputVal}
                          onChange={(e) => setPriceInputVal(e.target.value)}
                          placeholder="0 - 2000"
                          className={`w-32 pl-7 pr-3 py-1.5 text-xs rounded-xl outline-none font-bold font-mono border transition-all ${
                            isLight
                              ? "bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-amber-500"
                              : "bg-[#111A27] border-white/15 text-white focus:border-amber-400"
                          }`}
                        />
                      </div>
                      <button
                        onClick={handleSavePRPrice}
                        disabled={isSavingPrice}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Save size={13} />
                        <span>{isSavingPrice ? "Saving..." : "Save Price"}</span>
                      </button>
                      <button
                        onClick={() => setIsEditingPRPrice(false)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {priceFeedbackMsg && (
                    <span className={`text-[11px] font-bold block sm:inline ${priceFeedbackMsg.startsWith('✅') ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {priceFeedbackMsg}
                    </span>
                  )}
                </div>
              </div>


              {/* Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0B111A] border-white/10"}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>Pending Requests</div>
                  <div className="text-2xl font-black font-mono mt-1 text-amber-400">
                    {expertProjectReviews.filter(r => r.status === 'PendingExpertAcceptance').length}
                  </div>
                </div>
                <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0B111A] border-white/10"}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>Active Workspaces</div>
                  <div className="text-2xl font-black font-mono mt-1 text-cyan-400">
                    {expertProjectReviews.filter(r => r.status === 'Accepted' || r.status === 'InReview' || r.status === 'ProjectSubmitted' || r.status === 'MeetingScheduled' || r.status === 'MeetingRequested').length}
                  </div>
                </div>
                <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0B111A] border-white/10"}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>Completed Reviews</div>
                  <div className="text-2xl font-black font-mono mt-1 text-emerald-400">
                    {expertProjectReviews.filter(r => r.status === 'ReviewCompleted' || r.status === 'Completed').length}
                  </div>
                </div>
                <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0B111A] border-white/10"}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>PR Payouts Earned</div>
                  <div className="text-2xl font-black font-mono mt-1 text-emerald-400">
                    ₹{expertProjectReviews
                      .filter(r => r.status === 'ReviewCompleted' || r.status === 'Completed')
                      .reduce((sum, r) => sum + (r.expertEarning || 0), 0)
                      .toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Project Review Requests Section (Requirement 2) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isLight ? "text-amber-800" : "text-amber-400"}`}>
                    <AlertCircle size={14} className="text-amber-500 animate-pulse" /> Project Review Requests ({expertProjectReviews.filter(r => r.status === 'PendingExpertAcceptance').length})
                  </h3>
                  <button
                    type="button"
                    onClick={loadExpertProjectReviews}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isLight ? "border-slate-300 hover:bg-slate-100 text-slate-700" : "border-white/10 hover:bg-white/5 text-slate-300"
                    }`}
                  >
                    <RefreshCw size={12} /> Refresh Requests
                  </button>
                </div>

                {expertProjectReviews.filter(r => r.status === 'PendingExpertAcceptance').length === 0 ? (
                  <div className={`p-8 rounded-2xl border text-center ${
                    isLight ? "bg-white border-slate-200 text-slate-500" : "bg-[#0B111A] border-white/10 text-slate-400"
                  }`}>
                    <Clock size={22} className="mx-auto mb-2 text-amber-500/60" />
                    <p className="text-xs font-bold">No Pending Project Review Requests</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">When a client requests a Dedicated Project Review with you, it will appear here for your decision.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {expertProjectReviews.filter(r => r.status === 'PendingExpertAcceptance').map((pr) => (
                      <div
                        key={pr.projectReviewId}
                        className={`p-6 rounded-2xl border transition-all ${
                          isLight
                            ? "bg-amber-50/60 border-amber-300 shadow-md"
                            : "bg-[#0B111A] border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-1.5 max-w-xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs text-amber-500 font-bold">{pr.projectReviewId}</span>
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                                Pending Expert Acceptance
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${isLight ? "bg-white border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-slate-300"}`}>
                                {pr.packageName || "Dedicated Project Review"}
                              </span>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                                <Clock size={11} className="text-amber-400" />
                                {new Date(pr.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            </div>
                            <h4 className={`text-base font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                              {pr.expectedScope || pr.reviewType || "Project Review Request"}
                            </h4>
                            <p className={`text-xs ${isLight ? "text-slate-600" : "text-slate-300"}`}>
                              Requested by <strong>{pr.clientName}</strong> ({pr.clientEmail})
                            </p>
                            <p className={`text-xs italic line-clamp-2 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                              "{pr.submission?.description || pr.requestNotes || "Initial submission provided."}"
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-6 lg:justify-end">
                            <div className="text-right">
                              <div className={`text-[10px] uppercase font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>Your Net Payout</div>
                              <div className="text-xl font-black font-mono text-emerald-400">
                                ₹{(pr.expertEarning || Math.round(pr.price * 0.85)).toLocaleString('en-IN')}
                              </div>
                              <div className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                Client Escrow: ₹{pr.price.toLocaleString('en-IN')} {pr.paymentStatus === 'PaymentSuccessful' ? '(Funded)' : ''}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={isProcessingPRAction}
                                onClick={() => handleAcceptProjectReview(pr.projectReviewId)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                              >
                                <Check size={14} /> Accept Review
                              </button>
                              <button
                                type="button"
                                disabled={isProcessingPRAction}
                                onClick={() => {
                                  setDeclineReasonModalId(pr.projectReviewId);
                                  setDeclineReasonText("");
                                }}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                              >
                                Decline
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveExpertPRWorkspaceId(pr.projectReviewId)}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-white/20 text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                              >
                                Details
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active & Completed Reviews */}
              <div className="space-y-3">
                <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                  <Briefcase size={14} className="text-cyan-400" /> Active & Completed Workspaces ({expertProjectReviews.filter(r => r.status !== 'PendingExpertAcceptance').length})
                </h3>

                {expertProjectReviews.filter(r => r.status !== 'PendingExpertAcceptance').length === 0 ? (
                  <div className={`p-8 rounded-2xl border text-center ${isLight ? "bg-white border-slate-200 text-slate-500" : "bg-[#0B111A] border-white/10 text-slate-400"}`}>
                    <p className="text-xs">No active or completed Dedicated Project Reviews found.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {expertProjectReviews.filter(r => r.status !== 'PendingExpertAcceptance').map((pr) => {
                      const isComplete = pr.status === 'ReviewCompleted' || pr.status === 'Completed';
                      const isDeclined = pr.status === 'Declined';
                      return (
                        <div
                          key={pr.projectReviewId}
                          className={`p-5 rounded-2xl border transition-all ${
                            isLight
                              ? "bg-white border-slate-200 hover:border-cyan-500/40"
                              : "bg-[#0B111A] border-white/10 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)]"
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-500">{pr.projectReviewId}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isComplete
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : isDeclined
                                      ? "bg-red-500/20 text-red-400 border-red-500/40"
                                      : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                }`}>
                                  {isComplete ? "Completed" : isDeclined ? "Declined" : "Active In Progress"}
                                </span>
                                <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                  Client: {pr.clientName}
                                </span>
                              </div>
                              <h4 className={`text-base font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                                {pr.expectedScope || pr.reviewType || "Dedicated Project Review"}
                              </h4>
                              <p className={`text-xs line-clamp-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                                {pr.submission?.description || pr.requestNotes || "Initial materials in workspace."}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-6 lg:justify-end">
                              <div className="text-right">
                                <div className={`text-[10px] uppercase font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>Your Payout</div>
                                <div className="text-base font-bold font-mono text-emerald-400">
                                  ₹{(pr.expertEarning || Math.round(pr.price * 0.85)).toLocaleString('en-IN')}
                                </div>
                                <div className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                  {pr.expertEarningStatus === 'EarningReleased' ? '✅ Released to Wallet' : '⏳ Escrow Pending'}
                                </div>
                              </div>

                              <div className={`text-right border-l pl-4 ${isLight ? "border-slate-200" : "border-white/10"}`}>
                                <div className={`text-[10px] uppercase font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>Consultations</div>
                                <div className="text-base font-bold font-mono text-cyan-400">
                                  {pr.completedMeetingCount} / 2 used
                                </div>
                                <div className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                  {pr.submission?.files?.length || 0} docs · {pr.chat?.length ?? pr.chatCount ?? 0} msgs
                                </div>
                              </div>

                              <div className="shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setActiveExpertPRWorkspaceId(pr.projectReviewId)}
                                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                                >
                                  Open Workspace <ArrowUpRight size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
          {/* Telemetry KPI Cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <div 
              className={`p-5 rounded-2xl border shadow-xl transition-colors ${
                isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0B111A]"
              }`} 
              style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
            >
              <p className={`text-xs flex items-center gap-1.5 font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                <IndianRupee size={12} className={isLight ? "text-amber-600" : "text-amber-400"} /> Month Earnings
              </p>
              <p style={{ ...display }} className={`text-3xl mt-1.5 font-extrabold font-mono ${isLight ? "text-slate-900" : "text-white"}`}>
                ₹{earnings.toLocaleString("en-IN")}
              </p>
              <span className={`text-[11px] mt-1 block font-medium ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
                100% Payout Disbursed
              </span>
            </div>

            <div 
              className={`p-5 rounded-2xl border shadow-xl transition-colors ${
                isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0B111A]"
              }`} 
              style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
            >
              <p className={`text-xs flex items-center gap-1.5 font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                <Wallet size={12} className={isLight ? "text-cyan-600" : "text-cyan-400"} /> Wallet Balance
              </p>
              <p style={{ ...display }} className={`text-3xl mt-1.5 font-extrabold font-mono ${isLight ? "text-amber-600" : "text-amber-400"}`}>
                ₹{walletBalance.toLocaleString("en-IN")}
              </p>
              <button onClick={handleWithdraw} className={`text-xs font-bold mt-1.5 block cursor-pointer ${isLight ? "text-cyan-700 hover:underline" : "text-cyan-400 hover:underline"}`}>
                Withdraw to Bank ↗
              </button>
            </div>

            <div 
              className={`p-5 rounded-2xl border shadow-xl flex flex-col justify-between transition-colors ${
                isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0B111A]"
              }`} 
              style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
            >
              <p className={`text-xs flex items-center gap-1.5 font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                <TrendingUp size={12} className={isLight ? "text-emerald-600" : "text-emerald-400"} /> 4-Week Trend
              </p>
              <div style={{ height: 46 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <Bar dataKey="amount" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Interactive Slot Availability Management UI directly on Main Dashboard */}
          <div className="mb-8 p-6 rounded-3xl border border-amber-500/30 shadow-2xl space-y-6" style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500 font-mono block">
                  Calendar & Consultation Slots
                </span>
                <h3 className={`text-xl font-black flex items-center gap-2 mt-0.5 ${isLight ? "text-slate-900" : "text-white"}`}>
                  <Clock size={20} className="text-amber-500" />
                  Slot Availability Management
                </h3>
                <p className={`text-xs mt-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  Configure explicit consultation dates, time slots, and quick presets for client advisory bookings.
                </p>
              </div>
              <button
                onClick={() => setActiveExpertTab("availability")}
                className="text-xs px-4 py-2 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 flex items-center gap-2 cursor-pointer shadow hover:brightness-110 shrink-0"
              >
                <CalendarDays size={13} /> Full Schedule View →
              </button>
            </div>

            <ExpertAvailabilityManager
              expertId={resolvedExpertId}
              expertName={expertProfile?.name}
              isAdmin={false}
              theme={theme}
            />
          </div>

          {/* Section 1: Incoming Client Consultant Request */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <p style={{ ...display }} className={`text-xl font-bold flex items-center gap-2 ${isLight ? "text-slate-900" : "text-white"}`}>
                <CalendarDays size={20} className={isLight ? "text-amber-600" : "text-amber-400"} />
                Incoming Client Consultant Request ({requests.length})
              </p>
              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                isLight ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-amber-950/80 text-amber-300 border-amber-500/30"
              }`}>
                Pending Requests
              </span>
            </div>

            {requests.length === 0 ? (
              <div 
                className={`p-6 rounded-2xl text-center border space-y-2 shadow-sm ${
                  isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0B111A]/80 shadow-md"
                }`}
                style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
              >
                <CalendarDays size={24} className={`mx-auto ${isLight ? "text-slate-400" : "text-slate-500"}`} />
                <p className={`text-xs font-bold ${isLight ? "text-slate-800" : "text-white"}`}>No Pending Client Requests</p>
                <p className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>Client consultation requests will appear here once submitted by clients on the platform!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {requests.map((r) => {
                  const reqDate = r.date || r.scheduled_date || (r.when ? r.when.split(',')[0].trim() : '');
                  const reqTime = r.time || r.scheduled_time || (r.when ? r.when.split(',')[1]?.trim() : '');
                  const reqDuration = r.duration_minutes || r.duration || 60;
                  const reqClient = r.client || r.client_name || "Client";
                  const reqClientEmail = r.clientEmail || r.client_email || "";

                  return (
                    <div 
                      key={r.id} 
                      className={`p-4.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border shadow-xl transition-all ${
                        isLight ? "border-slate-200 bg-white hover:border-amber-400/60" : "border-white/10 bg-[#0B111A] hover:border-amber-500/30"
                      }`} 
                      style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{r.topic}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono border font-bold flex items-center gap-1 ${
                            isLight ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-amber-950/60 text-amber-300 border-amber-500/30"
                          }`}>
                            Pending
                          </span>
                        </div>
                        <div className={`text-xs space-y-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                          <p>
                            Client: <strong className={isLight ? "text-slate-800" : "text-slate-200"}>{reqClient}</strong>
                            {reqClientEmail ? <span className="font-mono text-[11px] ml-1 opacity-80">({reqClientEmail})</span> : null}
                          </p>
                          <p className="flex items-center gap-2 flex-wrap">
                            {reqDate && <span>📅 {reqDate}</span>}
                            {reqTime && <span>⏰ {reqTime}</span>}
                            <span>⏳ {reqDuration} mins</span>
                            <span>• {r.type || r.package_type || "Hourly Consultation"}</span>
                            <span>• ₹{r.rate || r.value || r.price || (expertProfile?.baseRate || 600)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button3D
                          size="sm"
                          variant="moss"
                          onClick={() => handleAcceptBooking(r.id)}
                        >
                          <Check size={13} /> Accept
                        </Button3D>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleRejectBooking(r.id);
                          }}
                          className={`text-xs px-3.5 py-1.5 rounded-xl border font-semibold cursor-pointer transition-colors ${
                            isLight ? "border-rose-300 text-rose-700 hover:bg-rose-50" : "border-rose-500/40 text-rose-300 hover:bg-rose-950/30"
                          }`}
                        >
                          <X size={13} className="inline mr-1" /> Reject
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDeleteRequest(r);
                          }}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            isLight
                              ? "bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border-slate-200 hover:border-rose-300 shadow-sm"
                              : "bg-white/5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border-white/10 hover:border-rose-500/40"
                          }`}
                          title="Delete Request"
                          aria-label="Delete Request"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Confirm & Schedule Session */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <p style={{ ...display }} className={`text-xl font-bold flex items-center gap-2 ${isLight ? "text-slate-900" : "text-white"}`}>
                <CalendarDays size={20} className={isLight ? "text-emerald-600" : "text-emerald-400"} />
                Confirm & Schedule Session ({acceptedSessions.length})
              </p>
              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                isLight ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-emerald-950/80 text-emerald-300 border-emerald-500/30"
              }`}>
                Active Schedule
              </span>
            </div>

            {acceptedSessions.length === 0 ? (
              <div 
                className={`p-6 rounded-2xl text-center border space-y-2 shadow-sm ${
                  isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0B111A]/80 shadow-md"
                }`}
                style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
              >
                <Clock size={24} className={`mx-auto ${isLight ? "text-slate-400" : "text-slate-500"}`} />
                <p className={`text-xs font-bold ${isLight ? "text-slate-800" : "text-white"}`}>No Confirmed Sessions Scheduled Yet</p>
                <p className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>When you accept client consultant requests above, sessions appear here for scheduling and providing Google Meet links!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {acceptedSessions.map((s) => {
                  const isCompleted = s.completed || s.status === "Completed";
                  const hasMeetUrl = Boolean(s.meetUrl && s.meetUrl.trim() !== "");
                  const isEditingThis = editingMeetSessionId === s.id;
                  const showMeetSetup = !hasMeetUrl || isEditingThis;

                  return (
                    <div 
                      key={s.id} 
                      className={`p-5 rounded-2xl border shadow-xl space-y-3.5 transition-colors ${
                        isLight ? "border-emerald-300 bg-white" : "border-emerald-500/30 bg-[#0B111A]"
                      }`}
                      style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{s.topic}</p>
                            <Pill tone={isCompleted ? "moss" : (s.isLive || s.status?.toLowerCase().includes("live")) ? "rust" : hasMeetUrl ? "moss" : "brass"}>
                              {isCompleted ? "Completed" : (s.isLive || s.status?.toLowerCase().includes("live")) ? "🔴 LIVE NOW" : hasMeetUrl ? "Confirmed" : "Accepted — Ready to Schedule"}
                            </Pill>
                          </div>
                          <p className={`text-xs mt-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                            Client: <strong className={isLight ? "text-slate-800" : "text-slate-200"}>{s.client}</strong> · {s.when} · {s.type} Package
                          </p>
                        </div>
                        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                          <div className="text-right shrink-0">
                            <span className={`text-xs block ${isLight ? "text-slate-400" : "text-slate-400"}`}>Earned Payout</span>
                            <span className={`text-base font-bold font-mono ${isLight ? "text-amber-600" : "text-amber-400"}`}>₹{s.payout || expertProfile.baseRate || 600}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteAcceptedSession(s)}
                            className={`p-2 rounded-xl border transition-all cursor-pointer ${
                              isLight
                                ? "bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border-slate-200 hover:border-rose-300 shadow-sm"
                                : "bg-white/5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border-white/10 hover:border-rose-500/40"
                            }`}
                            title="Delete Session"
                            aria-label="Delete Session"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className={`pt-3 border-t space-y-3 ${isLight ? "border-slate-100" : "border-white/10"}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className={`text-xs font-semibold flex items-center gap-1 ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
                            <Check size={14} className={isLight ? "text-emerald-600" : "text-emerald-400"} /> Allotted Slot: {s.when}
                          </span>
                          <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded border font-bold flex items-center gap-1 ${
                            isCompleted
                              ? (isLight ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-emerald-950/80 text-emerald-300 border-emerald-500/50")
                              : (s.isLive || s.status?.toLowerCase().includes("live"))
                                ? (isLight ? "bg-rose-100 text-rose-900 border-rose-300 animate-pulse" : "bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse")
                                : hasMeetUrl
                                  ? (isLight ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-emerald-950/60 text-emerald-300 border-emerald-500/30")
                                  : (isLight ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-amber-950/60 text-amber-300 border-amber-500/30")
                          }`}>
                            {isCompleted ? (
                              <>
                                <CheckCircle2 size={11} className="text-emerald-500" /> Session Completed
                              </>
                            ) : (s.isLive || s.status?.toLowerCase().includes("live")) ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block animate-ping mr-0.5" /> 🔴 Live Meeting In Progress
                              </>
                            ) : hasMeetUrl ? (
                              <>
                                <Video size={11} className={isLight ? "text-emerald-600" : "text-emerald-400"} /> Link Sent
                              </>
                            ) : (
                              <>
                                <Clock size={11} className="text-amber-500" /> Awaiting Google Meet Link
                              </>
                            )}
                          </span>
                        </div>

                        {/* Google Meet Workflow Box */}
                        {showMeetSetup ? (
                          <div className={`p-4 rounded-xl border space-y-3.5 ${
                            isLight ? "bg-amber-50/70 border-amber-200 text-slate-900" : "bg-[#111A27] border-amber-500/30 text-white"
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold flex items-center gap-1.5 text-amber-500">
                                <Video size={14} /> Prepare Google Meet Link for {s.client}
                              </span>
                              {isEditingThis && (
                                <button
                                  type="button"
                                  onClick={() => setEditingMeetSessionId(null)}
                                  className={`text-[11px] px-2 py-0.5 rounded border font-medium cursor-pointer ${
                                    isLight ? "bg-white text-slate-600 border-slate-200" : "bg-white/10 text-slate-300 border-white/10"
                                  }`}
                                >
                                  Cancel Edit
                                </button>
                              )}
                            </div>

                            {/* Step 1: Open Google Meet */}
                            <div className="space-y-1.5">
                              <label className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                                1. Go to Google Meet:
                              </label>
                              <button
                                type="button"
                                onClick={() => window.open("https://meet.google.com/new", "_blank")}
                                className="py-2 px-3.5 rounded-xl text-xs font-bold bg-[#1a73e8] hover:bg-[#1557b0] text-white flex items-center gap-2 cursor-pointer shadow-md transition-all hover:scale-[1.01]"
                              >
                                <ExternalLink size={13} /> Open meet.google.com/new in New Tab ↗
                              </button>
                              <p className={`text-[11px] leading-relaxed ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                                Generate a Google Meet link there, then return and paste it into the field below.
                              </p>
                            </div>

                            {/* Step 2 & 3: Paste Link & Send */}
                            <div className="space-y-1.5">
                              <label className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                                2. Paste Generated Google Meet Link:
                              </label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="url"
                                  value={meetLinkInputs[s.id] ?? (s.meetUrl || "")}
                                  onChange={(e) => {
                                    setMeetLinkInputs(prev => ({ ...prev, [s.id]: e.target.value }));
                                    if (meetLinkErrors[s.id]) {
                                      setMeetLinkErrors(prev => {
                                        const next = { ...prev };
                                        delete next[s.id];
                                        return next;
                                      });
                                    }
                                  }}
                                  placeholder="https://meet.google.com/xxx-yyyy-zzz"
                                  className={`flex-1 px-3.5 py-2 text-xs font-mono rounded-xl outline-none border transition-colors ${
                                    meetLinkErrors[s.id]
                                      ? "border-rose-500 bg-rose-50/10 focus:border-rose-500"
                                      : isLight 
                                        ? "bg-white border-slate-300 text-slate-900 focus:border-amber-500" 
                                        : "bg-[#070C15] border-white/15 text-white focus:border-amber-500/60"
                                  }`}
                                />
                                <button
                                  type="button"
                                  disabled={Boolean(isSendingMeetLink[s.id])}
                                  onClick={() => handleSendMeetLink(s, meetLinkInputs[s.id])}
                                  className={`py-2 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all hover:scale-[1.01] shrink-0 ${
                                    isSendingMeetLink[s.id] ? "bg-emerald-700 opacity-75 cursor-wait" : "bg-emerald-600 hover:bg-emerald-700"
                                  }`}
                                >
                                  <Send size={13} /> {isSendingMeetLink[s.id] ? "Sending..." : "Send Meeting Link"}
                                </button>
                              </div>
                              {meetLinkSuccess[s.id] && (
                                <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
                                  <CheckCircle2 size={12} className="shrink-0" /> {meetLinkSuccess[s.id]}
                                </p>
                              )}
                              {meetLinkErrors[s.id] && (
                                <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                                  <AlertCircle size={12} className="shrink-0" /> {meetLinkErrors[s.id]}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div 
                            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isLight ? "bg-slate-50 border-slate-200 text-slate-900 shadow-sm" : "bg-[#070C15] text-white border-white/10 shadow-inner"
                            }`}
                            style={{ background: isLight ? "#F8FAFC" : "#070C15" }}
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className={`text-xs font-bold flex items-center gap-1.5 ${isLight ? "text-slate-800" : "text-white"}`}>
                                  <Video size={13} className={isLight ? "text-emerald-600" : "text-emerald-400"} /> Google Meet Link:
                                </span>
                                <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 size={11} className="text-emerald-400" /> Link sent to client and admin
                                </span>
                              </div>
                              <span className={`text-xs font-mono select-all ${isLight ? "text-cyan-700" : "text-cyan-300"}`}>{s.meetUrl}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => window.open(s.meetUrl, "_blank", "noopener,noreferrer")}
                                className="px-3.5 py-1.5 text-xs rounded-lg font-bold bg-[#1a73e8] hover:bg-[#1557b0] text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
                              >
                                <Video size={12} /> Join Meeting ↗
                              </button>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(s.meetUrl);
                                  alert(`📋 Copied Google Meet link for ${s.client}:\n${s.meetUrl}`);
                                }}
                                className={`px-2.5 py-1.5 text-xs rounded-lg font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                                  isLight ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm" : "bg-white/10 hover:bg-white/20 text-slate-200 border-white/10"
                                }`}
                                title="Copy Google Meet Link"
                              >
                                <Copy size={12} /> Copy
                              </button>
                              <button
                                onClick={() => {
                                  setEditingMeetSessionId(s.id);
                                  setMeetLinkInputs(prev => ({ ...prev, [s.id]: s.meetUrl || "" }));
                                }}
                                className={`px-2.5 py-1.5 text-xs rounded-lg font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                                  isLight ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm" : "bg-white/10 hover:bg-white/20 text-slate-200 border-white/10"
                                }`}
                                title="Edit Link"
                              >
                                <Edit3 size={12} /> Edit Link
                              </button>
                              <button
                                onClick={() => handleDeleteAcceptedSession(s)}
                                className={`px-2.5 py-1.5 text-xs rounded-lg font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                                  isLight 
                                    ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 shadow-sm" 
                                    : "bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-500/30"
                                }`}
                                title="Delete Session"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Completed Status / Action to mark completed */}
                        {isCompleted ? (
                          <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                            isLight ? "bg-emerald-50 text-emerald-900 border-emerald-200" : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
                          }`}>
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 size={14} className="text-emerald-500" /> Meeting Marked Completed ✅
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] opacity-80">Client invited to Rate & Review</span>
                              <button
                                onClick={() => handleDeleteAcceptedSession(s)}
                                className={`px-2 py-1 text-[11px] rounded-md font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                                  isLight ? "bg-white hover:bg-rose-50 text-rose-700 border-rose-200 shadow-sm" : "bg-black/40 hover:bg-rose-950/60 text-rose-300 border-rose-500/40"
                                }`}
                                title="Delete Session Record"
                              >
                                <Trash2 size={11} /> Delete
                              </button>
                            </div>
                          </div>
                        ) : hasMeetUrl ? (
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              onClick={() => handleDeleteAcceptedSession(s)}
                              className={`py-1.5 px-3 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-all ${
                                isLight ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200" : "bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-500/30"
                              }`}
                              title="Delete Session"
                            >
                              <Trash2 size={12} /> Delete Session
                            </button>
                            <button
                              onClick={() => handleMarkSessionCompleted(s)}
                              className="py-1.5 px-3.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer shadow-md transition-all hover:scale-[1.01]"
                            >
                              <CheckCircle2 size={13} /> Mark Session as Completed ✅
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Reviews */}
          <p style={{ ...display }} className={`text-xl font-bold mb-4 ${isLight ? "text-slate-900" : "text-white"}`}>
            Recent Client Reviews ({reviews.length})
          </p>
          <div className="flex flex-col gap-3.5">
            {reviews.length === 0 ? (
              <div 
                className={`p-6 rounded-2xl text-center border space-y-2 shadow-sm ${
                  isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0B111A]/80 shadow-md"
                }`}
                style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
              >
                <Star size={24} className={`mx-auto ${isLight ? "text-slate-400" : "text-slate-500"}`} />
                <p className={`text-xs font-bold ${isLight ? "text-slate-800" : "text-white"}`}>No Client Reviews Yet</p>
                <p className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>Client reviews will appear here after you complete consultations!</p>
              </div>
            ) : (
              reviews.map((r: any, i: number) => (
                <div 
                  key={i} 
                  className={`p-4.5 rounded-2xl border shadow-xl space-y-2 transition-colors ${
                    isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0B111A]"
                  }`} 
                  style={{ background: isLight ? "#FFFFFF" : "#0B111A" }}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{r.from}</p>
                    <Stars n={r.stars || 5} />
                  </div>
                  <p className={`text-xs leading-relaxed italic ${isLight ? "text-slate-600" : "text-slate-300"}`}>"{r.note}"</p>
                </div>
              ))
            )}
          </div>
            </>
          )}
        </section>
      </div>
      </div>

      {showEditProfileModal && (
        <EditExpertProfileModal
          profile={expertProfile}
          onClose={() => setShowEditProfileModal(false)}
          onSave={onUpdateExpertProfile}
          theme={theme}
        />
      )}

      <ExpertProfileModal
        expert={selectedExpertForProfile}
        onClose={() => setSelectedExpertForProfile(null)}
        onBook={() => alert("Self-booking not permitted. Active in Expert Portal view.")}
        theme={theme}
      />



      {viewerDoc && (
        <DocumentViewerModal
          document={viewerDoc}
          onClose={() => setViewerDoc(null)}
          theme={theme}
        />
      )}

      {/* Decline Reason Modal */}
      {declineReasonModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md p-6 rounded-2xl border space-y-4 shadow-2xl ${
            isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0B111A] border-white/10 text-white"
          }`}>
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h3 className="font-bold text-sm text-red-400">Decline Project Review Request</h3>
              <button
                type="button"
                onClick={() => setDeclineReasonModalId(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Please let the client know why you're unable to take on this project review (e.g., bandwidth constraints, domain mismatch).
            </p>
            <textarea
              rows={3}
              value={declineReasonText}
              onChange={(e) => setDeclineReasonText(e.target.value)}
              placeholder="e.g. Currently at maximum capacity this week. Please feel free to request next month."
              className={`w-full p-3 rounded-xl text-xs border outline-none ${
                isLight
                  ? "bg-slate-50 border-slate-200 text-slate-900"
                  : "bg-white/5 border-white/10 text-white focus:border-red-400"
              }`}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeclineReasonModalId(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingPRAction}
                onClick={() => handleDeclineProjectReview(declineReasonModalId, declineReasonText)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-all shadow-md cursor-pointer"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Project Review Workspace Modal (WORKFLOW B) */}
      {activeExpertPRWorkspaceId && (
        <ProjectReviewWorkspace
          projectReviewId={activeExpertPRWorkspaceId}
          userRole="expert"
          currentUserId={resolvedExpertId}
          currentUserName={expertProfile?.name || "Executive Expert"}
          currentUserEmail={expertProfile?.email || "expert@company.com"}
          onClose={() => {
            setActiveExpertPRWorkspaceId(null);
            loadExpertProjectReviews();
          }}
          onRefreshList={() => {
            loadExpertProjectReviews();
          }}
          theme={theme}
        />
      )}

      {/* Floating Document Action Toast Notification */}
      {docToast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md transition-all ${
          docToast.type === 'error'
            ? 'bg-rose-950/90 border-rose-500/40 text-rose-200 shadow-rose-950/50'
            : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50'
        }`}>
          {docToast.type === 'error' ? (
            <AlertCircle size={18} className="text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{docToast.message}</span>
          <button
            onClick={() => setDocToast(null)}
            className="ml-2 text-slate-400 hover:text-white cursor-pointer"
            title="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   OWNER PAGE
---------------------------------------------------------------- */
function OwnerPage({ 
  setPage, 
  experts, 
  pendingVerifications,
  onUpdateExpertMarkup,
  onOpenMongoModal,
  onToggleFeatured,
  onUpdateHeroSpotlight,
  onUpdatePhotoUrl,
  onApproveVerification,
  onDeleteExpert,
  onToggleVerification,
  onDemoteToAuditQueue,
  onResetPendingQueue,
  onLogout
}: { 
  setPage: (p: string) => void; 
  experts: ExpertDoc[]; 
  pendingVerifications: any[];
  onUpdateExpertMarkup: (expId: string, base: number, markup: number) => void;
  onOpenMongoModal: () => void;
  onToggleFeatured?: (expId: string, featured: boolean) => void;
  onUpdateHeroSpotlight?: (expId: string, heroSpotlight: boolean, heroPosition?: "top" | "bottom") => void;
  onUpdatePhotoUrl?: (expId: string, imgUrl: string) => void;
  onApproveVerification?: (item: any) => Promise<void>;
  onDeleteExpert?: (expId: string) => Promise<void>;
  onToggleVerification?: (expId: string, verified: boolean) => Promise<void>;
  onDemoteToAuditQueue?: (expId: string) => Promise<void>;
  onResetPendingQueue?: () => Promise<void>;
  onLogout?: () => void;
}) {
  const verifications = pendingVerifications;
  const [selectedAuditItem, setSelectedAuditItem] = useState<any | null>(null);

  const [platformReviews, setPlatformReviews] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("app_platform_reviews");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out legacy hardcoded rev-2 for JK
          const cleaned = parsed.filter((r: any) => r && r.id !== "rev-2" && !(r.expertName === "JK" && r.clientName === "Northwind Retail Pvt Ltd"));
          localStorage.setItem("app_platform_reviews", JSON.stringify(cleaned));
          return cleaned;
        }
      }
    } catch {}
    const defaultRevs = [
      {
        id: "rev-1",
        clientName: "Priya Sharma",
        clientAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        expertName: "Sunita Rao",
        rating: 5,
        comment: "Sunita explained our corporate GST exposure clearly without any fluff or expensive law firm rates. We booked her again the exact same week for our valuation audit.",
        date: "2026-09-01",
        status: "approved",
        visibleToExpert: true,
        featuredOnLanding: true,
      }
    ];
    localStorage.setItem("app_platform_reviews", JSON.stringify(defaultRevs));
    return defaultRevs;
  });

  const syncPlatformReviews = (updated: any[]) => {
    setPlatformReviews(updated);
    localStorage.setItem("app_platform_reviews", JSON.stringify(updated));
    mongoDB.syncKv("app_platform_reviews", updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app_platform_reviews_updated", { detail: updated }));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: "app_platform_reviews" } }));
      window.dispatchEvent(new CustomEvent("mongo_db_updated"));
    }
  };

  const toggleVisibleToExpert = (id: string) => {
    let toggledReview: any = null;
    const updated = platformReviews.map((r) => {
      if (r.id === id) {
        const nextState = !r.visibleToExpert;
        toggledReview = { ...r, visibleToExpert: nextState, status: nextState ? "approved" : r.status };
        if (nextState) {
          notificationService.add({
            target: "expert",
            recipientId: r.expertName,
            type: "review",
            title: "Client Review Approved & Published!",
            message: `${r.clientName} left you a ${r.rating}★ review: "${r.comment.slice(0, 65)}..."`,
            actionLink: "expert"
          });
        }
        return toggledReview;
      }
      return r;
    });
    syncPlatformReviews(updated);

    if (toggledReview) {
      const expNameLower = (toggledReview.expertName || "").toLowerCase().trim();
      const expClean = expNameLower.replace(/[^a-z0-9]/g, "_");
      const expEmailLower = (toggledReview.expertEmail || "").toLowerCase().trim();

      const targetKeys = new Set<string>();
      if (expClean) targetKeys.add(`expert_reviews_${expClean}`);
      if (expEmailLower) targetKeys.add(`expert_reviews_${expEmailLower}`);
      if (expClean === "jk" || expNameLower.includes("jk")) {
        targetKeys.add("expert_reviews_jk");
        targetKeys.add("expert_reviews_jk@registry.com");
      }

      targetKeys.forEach(key => {
        try {
          const raw = localStorage.getItem(key);
          let list: any[] = [];
          if (raw) {
            try { list = JSON.parse(raw); } catch {}
          }
          if (!Array.isArray(list)) list = [];

          if (toggledReview.visibleToExpert) {
            const existingIdx = list.findIndex((item: any) => item.id === toggledReview.id);
            const reviewItem = {
              id: toggledReview.id,
              from: toggledReview.clientName,
              note: toggledReview.comment,
              stars: toggledReview.rating,
              date: toggledReview.date,
              visibleToExpert: true
            };
            if (existingIdx >= 0) {
              list[existingIdx] = reviewItem;
            } else {
              list.unshift(reviewItem);
            }
          } else {
            list = list.filter((item: any) => item.id !== toggledReview.id);
          }

          localStorage.setItem(key, JSON.stringify(list));
          mongoDB.syncKv(key, list);
        } catch {}
      });
    }
  };

  const toggleFeaturedOnLanding = (id: string) => {
    const updated = platformReviews.map((r) => {
      if (r.id === id) {
        const nextState = !r.featuredOnLanding;
        if (nextState) {
          notificationService.add({
            target: "all",
            type: "announcement",
            title: "Featured Story Spotlighted on Homepage!",
            message: `New client review for ${r.expertName} from ${r.clientName} has been spotlighted on the Mentora homepage.`,
            actionLink: "landing"
          });
        }
        return { ...r, featuredOnLanding: nextState };
      }
      return r;
    });
    syncPlatformReviews(updated);
  };

  const deletePlatformReview = (id: string) => {
    if (confirm("Are you sure you want to reject/delete this review?")) {
      const updated = platformReviews.filter((r) => r.id !== id);

      // Purge this deleted review from all expert-specific review keys
      try {
        const keysToClean: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("expert_reviews_")) {
            keysToClean.push(k);
          }
        }
        keysToClean.forEach(k => {
          try {
            const raw = localStorage.getItem(k);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const cleaned = list.filter((item: any) => item && item.id !== id);
                if (cleaned.length !== list.length) {
                  localStorage.setItem(k, JSON.stringify(cleaned));
                  mongoDB.syncKv(k, cleaned);
                }
              }
            }
          } catch {}
        });
      } catch {}

      syncPlatformReviews(updated);
    }
  };

  // Admin Broadcast Announcement Console State
  const [broadcastAudience, setBroadcastAudience] = useState<"all" | "client" | "expert">("all");
  const [broadcastType, setBroadcastType] = useState<"announcement" | "booking" | "verification" | "review">("announcement");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      alert("Please provide both Title and Message for the broadcast notification.");
      return;
    }

    notificationService.add({
      target: broadcastAudience,
      type: broadcastType,
      title: broadcastTitle.trim(),
      message: broadcastMessage.trim(),
      actionLink: broadcastAudience === "client" ? "client" : broadcastAudience === "expert" ? "expert" : "landing"
    });

    setBroadcastTitle("");
    setBroadcastMessage("");
    confetti({ particleCount: 60, spread: 60, origin: { y: 0.5 } });
    alert(`📢 Notification Broadcast Dispatched!\nAudience: ${broadcastAudience.toUpperCase()}\nTitle: "${broadcastTitle}"\nDelivered in real-time across all portals.`);
  };

  const [markupState, setMarkupState] = useState<Record<string, { base: number; markup: number }>>(
    experts.reduce((acc, e) => {
      acc[e.id] = { base: e.baseRate || e.rate - 150, markup: e.adminMarkup || 150 };
      return acc;
    }, {} as Record<string, { base: number; markup: number }>)
  );

  const kpis = [
    ["Professionals", "3,240", Users],
    ["Clients", "8,910", Briefcase],
    ["GMV this month", "₹9.7L", IndianRupee],
    ["Platform Profit Cut", "₹1.31L", TrendingUp],
  ];

  const handleApprove = async (id: string) => {
    const item = verifications.find(v => v.id === id);
    if (item && onApproveVerification) {
      await onApproveVerification(item);
    }
  };

  const handleMarkupChange = (id: string, fieldName: "base" | "markup", val: number) => {
    setMarkupState(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [fieldName]: val
      }
    }));
  };

  const handleSaveMarkup = (id: string) => {
    const item = markupState[id];
    if (!item) return;
    onUpdateExpertMarkup(id, item.base, item.markup);
    confetti({ particleCount: 40, spread: 40, origin: { y: 0.5 } });
    alert(`Saved Pricing Rule to MongoDB! Client Price updated to ₹${item.base + item.markup}/hr (Base ₹${item.base} + Admin Profit ₹${item.markup}).`);
  };

  return (
    <div style={{ background: T.ink2, ...body, minHeight: 600 }}>
      <header className="relative flex items-center gap-6 px-8 py-4 border-b overflow-hidden" style={{ borderColor: T.lineInk }}>
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <ParticleField count={45} />
        </div>
        
        <button
          type="button"
          onClick={() => {
            setPage("owner");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="relative z-10 bg-transparent border-0 p-0 cursor-pointer"
          title="Admin Desk Home"
        >
          <Logo ink />
        </button>
        
        <div className="hidden lg:block w-40 h-14 relative z-10">
          <VaultGraphic />
        </div>

        <button
          onClick={onOpenMongoModal}
          className="relative z-10 text-xs px-3 py-1.5 rounded font-mono flex items-center gap-1.5 cursor-pointer bg-emerald-950 text-emerald-300 border border-emerald-700 hover:bg-emerald-900 transition-colors"
        >
          <Database size={13} /> MongoDB Atlas Status & URI Setup
        </button>

        <div className="relative z-10 ml-auto flex items-center gap-3">
          <button onClick={onLogout || (() => setPage("landing"))} className="p-2 text-slate-400 hover:text-white cursor-pointer" title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="px-8 py-8 space-y-10">
        <div className="grid sm:grid-cols-4 gap-4">
          {kpis.map(([label, val, Icon]: any) => (
            <div key={label} className="p-5 rounded-sm shadow-md" style={{ background: T.ink, border: `1px solid ${T.lineInk}` }}>
              <Icon size={15} color={T.brassLight} />
              <p style={{ ...display, color: T.cream }} className="text-2xl mt-3">{val}</p>
              <p className="text-xs mt-1" style={{ color: "#8A93A0" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Real-Time Platform Broadcast Notification Console */}
        <div className="p-6 rounded-sm shadow-md space-y-4" style={{ background: T.ink, border: `1px solid ${T.lineInk}` }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 pb-3 border-b" style={{ borderColor: T.lineInk }}>
            <div>
              <p style={{ ...display, color: T.cream }} className="text-xl flex items-center gap-2">
                <Bell size={18} color={T.brassLight} /> Admin Platform-Wide Broadcast & Notification Console
              </p>
              <p className="text-xs mt-1" style={{ color: "#8A93A0" }}>
                Send instant push notifications and alerts to all platform users, clients, or senior experts in real-time.
              </p>
            </div>
            <Pill tone="moss">Live Real-Time Dispatch</Pill>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Target Audience:</label>
                <select
                  value={broadcastAudience}
                  onChange={(e) => setBroadcastAudience(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded outline-none border cursor-pointer font-bold"
                  style={{ background: T.ink2, borderColor: T.lineInk, color: T.cream }}
                >
                  <option value="all">📢 Everyone (Platform-Wide Broadcast)</option>
                  <option value="client">💼 All Clients (Corporates & Startups)</option>
                  <option value="expert">🎖️ All Senior Professionals (Experts)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Notification Category:</label>
                <select
                  value={broadcastType}
                  onChange={(e) => setBroadcastType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded outline-none border cursor-pointer font-bold"
                  style={{ background: T.ink2, borderColor: T.lineInk, color: T.cream }}
                >
                  <option value="announcement">✨ Important Platform Announcement</option>
                  <option value="booking">📅 Advisory Booking & Session Update</option>
                  <option value="verification">🛡️ Governance, KYC & Verification Audit</option>
                  <option value="wallet">💳 Billing, Payouts & Wallet Notice</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Broadcast Title:</label>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="e.g. New Executive Advisory Slots Open for Q3 Planning"
                className="w-full px-3 py-2 text-xs rounded outline-none border font-medium"
                style={{ background: T.ink2, borderColor: T.lineInk, color: T.cream }}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Notification Message:</label>
              <textarea
                rows={2}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="e.g. Elite retired CFOs & IAS officers have published morning consulting windows. Check available time slots now."
                className="w-full px-3 py-2 text-xs rounded outline-none border font-medium resize-none"
                style={{ background: T.ink2, borderColor: T.lineInk, color: T.cream }}
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 text-xs rounded font-bold transition-all cursor-pointer flex items-center gap-2 shadow-lg"
                style={{ background: T.brass, color: T.ink2 }}
              >
                <Send size={13} /> Send Real-Time Notification Broadcast
              </button>
            </div>
          </form>
        </div>

        {/* Client Review Audit & Governance Desk (Admin Controls) */}
        <div className="p-6 rounded-sm shadow-md space-y-4" style={{ background: T.ink, border: `1px solid ${T.lineInk}` }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 pb-3 border-b" style={{ borderColor: T.lineInk }}>
            <div>
              <p style={{ ...display, color: T.cream }} className="text-xl flex items-center gap-2">
                <MessageSquare size={18} color={T.brassLight} /> Client Consultation Review Moderation & Governance Desk
              </p>
              <p className="text-xs mt-1" style={{ color: "#8A93A0" }}>
                Admin Controls: Decide which client reviews are published on the Expert Profile and featured on the Main Landing Page.
              </p>
            </div>
            <Pill tone="brass">Admin Governance System</Pill>
          </div>

          <div className="space-y-3">
            {platformReviews.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No client reviews submitted yet.</p>
            ) : (
              platformReviews.map((rev: any) => (
                <div key={rev.id} className="p-4 rounded border bg-slate-900/90 space-y-3" style={{ borderColor: T.lineInk }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <img src={rev.clientAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"} className="w-9 h-9 rounded-full object-cover border" style={{ borderColor: T.brassLight }} alt={rev.clientName} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white">{rev.clientName}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-amber-300">For Expert: {rev.expertName}</span>
                        </div>
                        <div className="flex items-center gap-1 text-amber-400 text-xs mt-0.5">
                          <Stars n={rev.rating || 5} />
                          <span className="text-slate-400 text-[10px] ml-2">{rev.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border ${rev.visibleToExpert ? "bg-emerald-950 text-emerald-300 border-emerald-700" : "bg-slate-800 text-slate-400 border-slate-700"}`}>
                        {rev.visibleToExpert ? "✓ Visible on Expert Profile" : "❌ Hidden from Expert"}
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border ${rev.featuredOnLanding ? "bg-amber-950 text-amber-300 border-amber-700" : "bg-slate-800 text-slate-400 border-slate-700"}`}>
                        {rev.featuredOnLanding ? "★ Featured on Landing Page" : "Normal"}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-950/80 p-2.5 rounded border leading-relaxed italic" style={{ borderColor: T.lineInk }}>
                    "{rev.comment}"
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: T.lineInk }}>
                    <span className="text-[11px] text-slate-400">Admin Control Actions:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleVisibleToExpert(rev.id)}
                        className={`px-2.5 py-1 text-xs rounded font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          rev.visibleToExpert 
                            ? "bg-emerald-700 text-white hover:bg-emerald-600" 
                            : "bg-slate-800 text-emerald-300 border border-emerald-600 hover:bg-slate-700"
                        }`}
                      >
                        {rev.visibleToExpert ? <EyeOff size={12} /> : <Eye size={12} />}
                        {rev.visibleToExpert ? "Hide from Expert" : "Approve for Expert"}
                      </button>

                      <button
                        onClick={() => toggleFeaturedOnLanding(rev.id)}
                        className={`px-2.5 py-1 text-xs rounded font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          rev.featuredOnLanding 
                            ? "bg-amber-700 text-white hover:bg-amber-600" 
                            : "bg-slate-800 text-amber-300 border border-amber-600 hover:bg-slate-700"
                        }`}
                      >
                        <Sparkles size={12} />
                        {rev.featuredOnLanding ? "Remove from Landing" : "Feature on Landing Page"}
                      </button>

                      <button
                        onClick={() => deletePlatformReview(rev.id)}
                        className="px-2 py-1 text-[10px] rounded font-bold bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 transition-all cursor-pointer flex items-center gap-1"
                        title="Delete Review"
                      >
                        <Trash2 size={11} /> Delete Review
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Hero Banner 3D Spotlight Floating Cards Control Desk */}
        <div className="p-6 rounded-sm shadow-md space-y-4" style={{ background: T.ink, border: `1px solid ${T.lineInk}` }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 pb-3 border-b" style={{ borderColor: T.lineInk }}>
            <div>
              <p style={{ ...display, color: T.cream }} className="text-xl flex items-center gap-2">
                <Sparkles size={18} color={T.brassLight} /> Landing Page Hero 3D Spotlight Cards Manager (Admin Control)
              </p>
              <p className="text-xs mt-1" style={{ color: "#8A93A0" }}>
                Select which expert profiles appear on the floating 3D Hero Banner (Card 1 Top-Right & Card 2 Bottom-Left)
              </p>
            </div>
            <Pill tone="moss">Admin Hero Spotlight Control</Pill>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Card 1 Top-Right */}
            <div className="p-4 rounded border bg-slate-900/80 space-y-3" style={{ borderColor: T.lineInk }}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={13} /> Hero Card 1 (Top-Right Floating Card)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-200 border border-amber-800">Position: Top</span>
              </div>

              {(() => {
                const currentTop = experts.find(e => e.heroSpotlight && e.heroPosition === "top") || experts.find(e => e.id === "exp-6");
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-2 bg-slate-950 rounded border" style={{ borderColor: T.lineInk }}>
                      <img src={getExpertPhoto(currentTop)} onError={handleImgError} className="w-12 h-12 rounded-full object-cover border" style={{ borderColor: T.brassLight }} alt={currentTop?.name} />
                      <div>
                        <p className="text-sm font-bold text-white">{currentTop?.name}</p>
                        <p className="text-xs text-slate-400">{currentTop?.field} · ₹{currentTop?.rate}/hr</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Select Expert for Card 1:</label>
                      <select
                        value={currentTop?.id || "exp-6"}
                        onChange={(ev) => {
                          if (onUpdateHeroSpotlight) onUpdateHeroSpotlight(ev.target.value, true, "top");
                          confetti({ particleCount: 30, spread: 40, origin: { y: 0.5 } });
                          alert(`Admin Control: Assigned expert to Hero Banner Card 1 (Top-Right)!`);
                        }}
                        className="w-full px-3 py-2 text-xs rounded outline-none border cursor-pointer font-bold"
                        style={{ background: T.ink2, borderColor: T.lineInk, color: T.cream }}
                      >
                        {experts.map(e => (
                          <option key={e.id} value={e.id}>{e.name} ({e.field} · ₹{e.rate}/hr)</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Card 2 Bottom-Left */}
            <div className="p-4 rounded border bg-slate-900/80 space-y-3" style={{ borderColor: T.lineInk }}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={13} /> Hero Card 2 (Bottom-Left Floating Card)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-200 border border-emerald-800">Position: Bottom</span>
              </div>

              {(() => {
                const currentBottom = experts.find(e => e.heroSpotlight && e.heroPosition === "bottom") || experts.find(e => e.id === "exp-5");
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-2 bg-slate-950 rounded border" style={{ borderColor: T.lineInk }}>
                      <img src={getExpertPhoto(currentBottom)} onError={handleImgError} className="w-12 h-12 rounded-full object-cover border" style={{ borderColor: T.mossLight }} alt={currentBottom?.name} />
                      <div>
                        <p className="text-sm font-bold text-white">{currentBottom?.name}</p>
                        <p className="text-xs text-slate-400">{currentBottom?.field} · ₹{currentBottom?.rate}/hr</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Select Expert for Card 2:</label>
                      <select
                        value={currentBottom?.id || "exp-5"}
                        onChange={(ev) => {
                          if (onUpdateHeroSpotlight) onUpdateHeroSpotlight(ev.target.value, true, "bottom");
                          confetti({ particleCount: 30, spread: 40, origin: { y: 0.5 } });
                          alert(`Admin Control: Assigned expert to Hero Banner Card 2 (Bottom-Left)!`);
                        }}
                        className="w-full px-3 py-2 text-xs rounded outline-none border cursor-pointer font-bold"
                        style={{ background: T.ink2, borderColor: T.lineInk, color: T.cream }}
                      >
                        {experts.map(e => (
                          <option key={e.id} value={e.id}>{e.name} ({e.field} · ₹{e.rate}/hr)</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Executive Expert Registry Directory & Deletion Governance Desk */}
        <div className="p-6 rounded-sm shadow-md space-y-4" style={{ background: T.ink, border: `1px solid ${T.lineInk}` }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 pb-3 border-b" style={{ borderColor: T.lineInk }}>
            <div>
              <p style={{ ...display, color: T.cream }} className="text-xl flex items-center gap-2">
                <ShieldCheck size={18} color={T.brassLight} /> Executive Expert Mentora Directory & Deletion Governance Desk (Admin Rights)
              </p>
              <p className="text-xs mt-1" style={{ color: "#8A93A0" }}>
                Admin Rights: Delete/Remove Expert permanently, Grant/Revoke Verification Status, Edit Photo URL & Rate Rules
              </p>
            </div>
            <Pill tone="brass">Admin Governance Rights</Pill>
          </div>

          <div className="overflow-x-auto max-h-[380px] overflow-y-auto pr-1">
            <table className="w-full text-left text-xs" style={{ color: T.cream }}>
              <thead className="sticky top-0 z-10 shadow-sm" style={{ background: T.ink }}>
                <tr className="border-b text-[11px] uppercase tracking-wider" style={{ borderColor: T.lineInk, color: T.brassLight }}>
                  <th className="py-2.5 px-3">Expert Name & Photo URL</th>
                  <th className="py-2.5 px-3">Verification Badge</th>
                  <th className="py-2.5 px-3">Landing Page Visibility</th>
                  <th className="py-2.5 px-3">Base Pay (₹/hr)</th>
                  <th className="py-2.5 px-3">Admin Profit (+₹)</th>
                  <th className="py-2.5 px-3">Client Price (₹/hr)</th>
                  <th className="py-2.5 px-3 text-right">Admin Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: T.lineInk }}>
                {experts.map((e) => {
                  const m = markupState[e.id] || { base: e.baseRate || 600, markup: e.adminMarkup || 150 };
                  const clientPrice = m.base + m.markup;
                  const isFeatured = e.featuredOnLanding !== false;

                  return (
                    <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={getExpertPhoto(e)}
                            onError={handleImgError}
                            alt={e.name}
                            className="w-10 h-10 rounded-full object-cover border shrink-0"
                            style={{ borderColor: T.brassLight }}
                          />
                          <div className="space-y-1">
                            <span className="font-semibold block text-xs">{e.name}</span>
                            <input
                              type="text"
                              defaultValue={getExpertPhoto(e)}
                              onBlur={(ev) => {
                                if (ev.target.value && onUpdatePhotoUrl) {
                                  onUpdatePhotoUrl(e.id, ev.target.value);
                                  alert(`Updated photo URL for ${e.name}! Saved to MongoDB.`);
                                }
                              }}
                              placeholder="Paste photo URL..."
                              className="w-36 px-2 py-0.5 text-[10px] rounded outline-none font-mono"
                              style={{ background: T.ink2, border: `1px solid ${T.lineInk}`, color: T.brassLight }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Admin Toggle for Verification Rights */}
                      <td className="py-3 px-3">
                        <button
                          onClick={() => {
                            if (onToggleVerification) onToggleVerification(e.id, !e.verified);
                          }}
                          className={`px-2.5 py-1 text-xs rounded font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            e.verified
                              ? "bg-emerald-950/90 text-emerald-300 border border-emerald-600 hover:bg-emerald-900"
                              : "bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800"
                          }`}
                          title={e.verified ? "Click to Revoke Verification" : "Click to Grant Verified Badge"}
                        >
                          <ShieldCheck size={13} color={e.verified ? T.mossLight : "#8A93A0"} />
                          {e.verified ? "Verified Expert" : "Unverified (Click to Grant)"}
                        </button>
                      </td>

                      {/* Admin Toggle for Landing Page Visibility */}
                      <td className="py-3 px-3">
                        <button
                          onClick={() => {
                            if (onToggleFeatured) onToggleFeatured(e.id, !isFeatured);
                          }}
                          className={`px-2 py-1 text-[11px] rounded font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            isFeatured
                              ? "bg-amber-950/90 text-amber-300 border border-amber-600 hover:bg-amber-900"
                              : "bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800"
                          }`}
                        >
                          {isFeatured ? (
                            <>
                              <Sparkles size={12} color={T.brassLight} /> Featured
                            </>
                          ) : (
                            <>
                              <Eye size={12} /> Hidden
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-3">
                        <input
                          type="number"
                          value={m.base}
                          onChange={(ev) => handleMarkupChange(e.id, "base", Number(ev.target.value))}
                          className="w-16 px-2 py-1 text-xs rounded outline-none font-bold"
                          style={{ background: T.ink2, border: `1px solid ${T.lineInk}`, color: T.cream }}
                        />
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          value={m.markup}
                          onChange={(ev) => handleMarkupChange(e.id, "markup", Number(ev.target.value))}
                          className="w-16 px-2 py-1 text-xs rounded outline-none font-bold"
                          style={{ background: T.ink2, border: `1px solid ${T.lineInk}`, color: T.brassLight }}
                        />
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-xs" style={{ color: T.cream }}>
                        ₹{clientPrice}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          <Button3D size="sm" variant="brass" onClick={() => handleSaveMarkup(e.id)}>
                            <Save size={12} /> Save
                          </Button3D>

                          {/* Admin Remove Expert & Move into Audit Queue Button */}
                          <button
                            onClick={() => {
                              if (window.confirm(`Remove expert "${e.name}" from Client Portal and send back to Document Audit Queue?`)) {
                                if (onDemoteToAuditQueue) {
                                  onDemoteToAuditQueue(e.id);
                                } else if (onDeleteExpert) {
                                  onDeleteExpert(e.id);
                                }
                              }
                            }}
                            className="px-2 py-1.5 text-[11px] rounded font-bold bg-amber-950 text-amber-300 border border-amber-800 hover:bg-amber-900 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                            title={`Remove ${e.name} from Client Portal & move into Document Audit Queue`}
                          >
                            <UserX size={12} /> Remove to Audit Queue
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 rounded-sm shadow-md" style={{ background: T.ink, border: `1px solid ${T.lineInk}` }}>
            <p style={{ ...display, color: T.cream }} className="text-lg mb-4">Revenue Stream Breakdown (per PDF Spec)</p>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={REVENUE_STREAMS} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fill: "#8A93A0", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: T.ink2, border: `1px solid ${T.lineInk}`, fontSize: 12 }} labelStyle={{ color: T.cream }} />
                  <Bar dataKey="value" fill={T.brass} radius={[0, 3, 3, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-6 rounded-sm shadow-md" style={{ background: T.ink, border: `1px solid ${T.lineInk}` }}>
            <p style={{ ...display, color: T.cream }} className="text-lg mb-4">Mentora Growth Index</p>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={GROWTH}>
                  <CartesianGrid stroke={T.lineInk} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#8A93A0", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: T.ink2, border: `1px solid ${T.lineInk}`, fontSize: 12 }} labelStyle={{ color: T.cream }} />
                  <Line type="monotone" dataKey="professionals" stroke={T.brassLight} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="clients" stroke={T.mossLight} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 rounded-sm shadow-md" style={{ background: T.ink, border: `1px solid ${T.lineInk}` }}>
            <div className="flex justify-between items-center mb-4">
              <p style={{ ...display, color: T.cream }} className="text-lg">Document Audit & Verification Queue ({verifications.length})</p>
              <div className="flex items-center gap-2">
                {onResetPendingQueue && (
                  <button
                    onClick={async () => {
                      await onResetPendingQueue();
                    }}
                    className="text-[11px] px-2.5 py-1 rounded font-semibold bg-slate-800 text-amber-300 border border-slate-700 hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Add sample pending applicants into queue"
                  >
                    <Plus size={12} /> Add Sample Applicants
                  </button>
                )}
                <span className="text-[11px] text-slate-400">PDF Proof Audit Desk</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-2">
              {verifications.map((p) => (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-t" style={{ borderColor: T.lineInk }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: T.cream }}>{p.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#8A93A0" }}>{p.field} · {p.years} yrs exp at {p.company}</p>
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-amber-300">📄 Work Cert PDF</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-emerald-300">📄 Offer Letter PDF</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button3D size="sm" variant="ghostDark" onClick={() => setSelectedAuditItem(p)}>
                      <Eye size={12} /> Inspect PDFs
                    </Button3D>
                    <Button3D size="sm" variant="moss" onClick={() => handleApprove(p.id)}>
                      <Check size={12} /> Approve
                    </Button3D>
                    <button
                      onClick={() => {
                        if (window.confirm(`Reject and remove applicant ${p.name} from verification queue?`)) {
                          if (onDeleteExpert) onDeleteExpert(p.id);
                        }
                      }}
                      className="px-2 py-1 text-[10px] rounded font-bold bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 transition-all cursor-pointer flex items-center gap-1"
                      title="Reject & Remove Applicant"
                    >
                      <UserX size={11} /> Reject / Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-sm shadow-md" style={{ background: T.ink, border: `1px solid ${T.lineInk}` }}>
            <p style={{ ...display, color: T.cream }} className="text-lg mb-4">Recent Escrow Transactions & Admin Cut</p>
            <div className="flex flex-col gap-3">
              {TRANSACTIONS.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2" style={{ borderTop: `1px solid ${T.lineInk}` }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: T.cream }}>{t.desc}</p>
                    <p className="text-xs mt-0.5 font-mono" style={{ color: "#8A93A0" }}>{t.id} · {t.date} · Expert Pay: ₹{t.expertPay}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: T.cream }}>₹{t.amount}</p>
                    <p className="text-xs mt-0.5 font-semibold" style={{ color: T.brassLight }}>+₹{t.cut} platform profit</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {selectedAuditItem && (
        <AdminDocInspectionModal
          item={selectedAuditItem}
          onClose={() => setSelectedAuditItem(null)}
          onApprove={handleApprove}
        />
      )}
    </div>
  );
}

const DEFAULT_CLIENT_FALLBACK = {
  name: "Corporate Client",
  company: "Enterprise Partner",
  email: "client@company.com",
  phone: "+91 98765 43210",
  field: "Corporate Advisory",
  bio: "Registered enterprise advisory client account.",
  initials: "CC"
};

const DEFAULT_EXPERT_FALLBACK = {
  id: "exp-1",
  name: "Sunita Rao",
  title: "Former Chief Financial Officer (Ex-CFO)",
  field: "Finance & Taxation",
  years: 34,
  rate: 750,
  rating: 0,
  sessions: 0,
  email: "sunita.rao@registry.com",
  phone: "+91 98765 43210",
  verified: true,
  verificationStatus: "approved",
  initials: "SR",
  bio: "Over three decades of senior financial leadership across Tata Capital and listed corporate entities."
};

function hasValidExpertSession(): boolean {
  try {
    const savedRole = localStorage.getItem("current_user_role");
    const expertData = localStorage.getItem("current_logged_in_expert");
    const adminExpert = localStorage.getItem("admin_logged_in_expert");
    if (expertData || adminExpert) {
      try {
        const parsed = JSON.parse(expertData || adminExpert || '{}');
        if (parsed && (parsed.email || parsed.name || parsed.id)) {
          return true;
        }
      } catch {}
    }
    return Boolean(savedRole && normalizeRole(savedRole) === "expert");
  } catch {
    return false;
  }
}

function parseRouteFromLocation(): { page: string; isAdmin: boolean; blogSlug?: string } {
  try {
    const rawPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const pathname = rawPath === '/index.html' ? '/' : rawPath;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.toLowerCase();
    const queryPage = params.get('page')?.toLowerCase();
    const portal = params.get('portal')?.toLowerCase();

    // 1. Admin desk routes & Protection
    const isAdminTarget = (
      pathname === '/admin' ||
      pathname === '/owner' ||
      pathname.startsWith('/admin/') ||
      portal === 'admin' ||
      queryPage === 'admin' ||
      queryPage === 'owner' ||
      hash === '#admin' ||
      hash === '#owner'
    );

    if (isAdminTarget) {
      // Check for authenticated Admin session
      const adminToken = localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token") || localStorage.getItem("admin_session_token");
      const adminRole = localStorage.getItem("admin_user_role");
      if (adminToken && (adminRole === "admin" || !adminRole)) {
        return { page: "owner", isAdmin: true };
      }

      // Unauthorized access without Admin session -> Redirect to login page
      return { page: "login", isAdmin: false };
    }

    // 2. Explicit public routes
    if (pathname === '/about' || queryPage === 'about' || hash === '#about') {
      return { page: 'about', isAdmin: false };
    }
    if (pathname === '/blogs' || pathname.startsWith('/blogs/') || queryPage === 'blogs' || hash === '#blogs') {
      let blogSlug: string | undefined = undefined;
      if (pathname.startsWith('/blogs/')) {
        blogSlug = pathname.replace('/blogs/', '').replace(/\/+$/, '');
      }
      return { page: 'blogs', isAdmin: false, blogSlug };
    }
    if (pathname === '/client' || queryPage === 'client' || hash === '#client') {
      return { page: 'client', isAdmin: false };
    }
    if (
      pathname === '/expert' ||
      pathname === '/expert-portal' ||
      pathname === '/expertportal' ||
      pathname === '/portal/expert' ||
      queryPage === 'expert' ||
      queryPage === 'expert-portal' ||
      queryPage === 'expertportal' ||
      portal === 'expert' ||
      hash === '#expert' ||
      hash === '#expert-portal'
    ) {
      if (hasValidExpertSession()) {
        return { page: 'expert', isAdmin: false };
      }
      return { page: 'login', isAdmin: false };
    }
    if (pathname === '/login' || pathname === '/auth' || queryPage === 'login' || hash === '#login') {
      return { page: 'login', isAdmin: false };
    }

    return { page: 'landing', isAdmin: false };
  } catch {
    return { page: 'landing', isAdmin: false };
  }
}

/* ---------------------------------------------------------------
   Main App Architecture
---------------------------------------------------------------- */
export default function App() {
  const [isAdminPortal, setIsAdminPortal] = useState<boolean>(() => {
    return parseRouteFromLocation().isAdmin;
  });

  // Persist userRole & active page across browser refreshes (Isolated session per portal)
  const [userRole, setUserRole] = useState<string | null>(() => {
    try {
      const route = parseRouteFromLocation();
      if (route.isAdmin) {
        const savedRole = localStorage.getItem("admin_user_role");
        const normSaved = normalizeRole(savedRole);
        if (savedRole && ["client", "expert", "admin"].includes(normSaved)) {
          return normSaved;
        }
        return "admin";
      } else {
        const savedRole = localStorage.getItem("current_user_role");
        const normSaved = normalizeRole(savedRole);
        if (savedRole && ["client", "expert"].includes(normSaved)) {
          return normSaved;
        }
        if (route.page === "client") return "client";
        if (route.page === "expert") return "expert";
        return null;
      }
    } catch {}
    return null;
  });

  const [page, setPage] = useState<string>(() => {
    return parseRouteFromLocation().page;
  });

  const [blogSlug, setBlogSlug] = useState<string | undefined>(() => {
    return parseRouteFromLocation().blogSlug;
  });

  const prevPageRef = useRef<string>("landing");
  useEffect(() => {
    if (page !== "login") {
      prevPageRef.current = page;
    }
  }, [page]);

  const navigateTo = (newPage: string, replace = false, extraSlug?: string) => {
    try {
      const adminToken = localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token") || localStorage.getItem("admin_session_token");
      const adminRole = localStorage.getItem("admin_user_role");

      // Authorization guard for Admin Portal (owner)
      if (newPage === "owner") {
        const isAdminSession = Boolean(adminToken && (adminRole === "admin" || userRole === "admin" || !adminRole));
        if (!isAdminSession) {
          newPage = "login";
        }
      }

      // Authorization guard for Expert Portal (expert)
      if (newPage === "expert" || newPage === "expert-portal" || newPage === "expertportal") {
        if (!hasValidExpertSession()) {
          newPage = "login";
        } else {
          newPage = "expert";
        }
      }

      setPage(newPage);
      setBlogSlug(extraSlug);

      const isAdminRoute = newPage === "owner";
      setIsAdminPortal(isAdminRoute);

      if (isAdminRoute) {
        localStorage.setItem("current_admin_page", "owner");
        localStorage.removeItem("current_user_role");
        setUserRole("admin");
        try { localStorage.setItem("admin_user_role", "admin"); } catch {}
      } else {
        localStorage.setItem("current_page", newPage);
        const savedRole = localStorage.getItem("current_user_role");
        const normSavedRole = normalizeRole(savedRole);
        if (savedRole && (normSavedRole === "client" || normSavedRole === "expert")) {
          setUserRole(normSavedRole);
        } else if (newPage === "client") {
          setUserRole("client");
        }
      }

      let targetPath = "/";
      if (newPage === "client") targetPath = "/client";
      else if (newPage === "expert") targetPath = "/expert";
      else if (newPage === "owner") targetPath = "/?portal=admin";
      else if (newPage === "login") targetPath = "/login";
      else if (newPage === "about") targetPath = "/about";
      else if (newPage === "blogs") targetPath = extraSlug ? `/blogs/${extraSlug}` : "/blogs";
      else if (newPage === "landing") targetPath = "/";

      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== targetPath) {
        if (replace) {
          window.history.replaceState({ page: newPage, slug: extraSlug }, "", targetPath);
        } else {
          window.history.pushState({ page: newPage, slug: extraSlug }, "", targetPath);
        }
      }
    } catch {}
  };

  // Light / Dark Theme State (Persisted in localStorage)
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      const saved = localStorage.getItem("app_theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return "dark";
  });

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("app_theme", next);
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("theme-light");
      document.documentElement.classList.remove("dark");
      document.body.style.backgroundColor = "#F8FAFC";
      document.body.style.color = "#0F172A";
    } else {
      document.documentElement.classList.remove("theme-light");
      document.documentElement.classList.add("dark");
      document.body.style.backgroundColor = "#05080E";
      document.body.style.color = "#F8FAFC";
    }
  }, [theme]);

  // Keep userRole and page synchronized with localStorage
  useEffect(() => {
    try {
      const roleKey = isAdminPortal ? "admin_user_role" : "current_user_role";
      if (userRole) {
        localStorage.setItem(roleKey, userRole);
      } else {
        localStorage.removeItem(roleKey);
      }
    } catch {}
  }, [userRole, isAdminPortal]);

  useEffect(() => {
    try {
      const pageKey = isAdminPortal ? "current_admin_page" : "current_page";
      localStorage.setItem(pageKey, page);
    } catch {}
  }, [page, isAdminPortal]);

  // Authoritative Backend Admin Session Verification
  useEffect(() => {
    if (page === "owner" || isAdminPortal) {
      const token = localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token") || localStorage.getItem("admin_session_token");
      if (!token) {
        setIsAdminPortal(false);
        setUserRole(null);
        navigateTo("login", true);
        return;
      }

      mongoDB.verifyAdminSession(token).then((res) => {
        const isAuth = res?.authenticated ?? res?.success ?? false;
        if (!isAuth) {
          try {
            localStorage.removeItem("admin_token");
            sessionStorage.removeItem("admin_token");
            localStorage.removeItem("admin_session_token");
            localStorage.removeItem("admin_user_role");
          } catch {}
          setIsAdminPortal(false);
          setUserRole(null);
          navigateTo("login", true);
        } else {
          setUserRole("admin");
          setIsAdminPortal(true);
        }
      }).catch(() => {
        // If network error during active session, retain admin if token exists
      });
    }
  }, [page, isAdminPortal]);

  // Protected Route Guard for Expert Portal
  useEffect(() => {
    if (page === "expert") {
      try {
        localStorage.setItem("current_user_role", "expert");
        setUserRole("expert");
      } catch {}
    }
  }, [page]);

  // MongoDB experts & pending verifications state
  const [experts, setExperts] = useState<ExpertDoc[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<any[]>([]);

  useEffect(() => {
    // EGRESS FIX: this effect used to run every 1.5 s on EVERY page and download the whole
    // experts table (incl. base64 files) three times per tick — ~1.7 GB per hour per open tab.
    // Now: one load on mount, a refresh every 60 s only while the tab is visible, and
    // event-driven refreshes collapsed by a debounce. Reads are cached (src/lib/requestCache.ts)
    // and the admin-only KYC queue is only fetched on admin pages.
    const needsPendingQueue = page === "owner" || isAdminPortal;
    const refreshData = async () => {
      try {
        const [freshExperts, freshPendings] = await Promise.all([
          mongoDB.getExperts(),
          needsPendingQueue ? mongoDB.getPendingVerifications() : Promise.resolve(null)
        ]);
        setExperts(Array.isArray(freshExperts) ? freshExperts : []);
        if (freshPendings !== null) {
          setPendingVerifications(Array.isArray(freshPendings) ? freshPendings : []);
        }

        setExpertProfile((prev: any) => {
          if (!prev) return prev;
          const queryKey = (prev.email || prev.id || prev.name || "").toLowerCase().trim();
          if (!queryKey) return prev;

          // Asynchronously query live single-source-of-truth audit status from database
          mongoDB.getAuditStatus(queryKey).then((statusRes) => {
            setExpertProfile((curr: any) => {
              if (!curr) return curr;
              const currEmail = curr.email?.toLowerCase().trim();
              const currId = curr.id?.toLowerCase().trim();
              const currName = curr.name?.toLowerCase().trim();
              const isMatch = (
                (currEmail && (queryKey === currEmail || statusRes.expert?.email?.toLowerCase().trim() === currEmail || statusRes.applicant?.email?.toLowerCase().trim() === currEmail)) ||
                (currId && (queryKey === currId || statusRes.expert?.id?.toLowerCase().trim() === currId || statusRes.applicant?.id?.toLowerCase().trim() === currId)) ||
                (currName && (queryKey === currName || statusRes.expert?.name?.toLowerCase().trim() === currName || statusRes.applicant?.name?.toLowerCase().trim() === currName))
              );
              if (!isMatch) return curr;
              if (!statusRes || statusRes.verified === undefined) return curr;

              if (
                curr.verified === statusRes.verified &&
                curr.verificationStatus === statusRes.verificationStatus &&
                curr.rejected === statusRes.rejected &&
                (!statusRes.expert || statusRes.expert.rate === curr.rate)
              ) {
                return curr;
              }

              const updated = {
                ...curr,
                ...(statusRes.expert || {}),
                email: curr.email || statusRes.expert?.email || statusRes.applicant?.email,
                verified: statusRes.verified,
                is_verified: statusRes.verified,
                verificationStatus: statusRes.verificationStatus,
                rejected: statusRes.rejected
              };
              const activeKey = isAdminPortal ? "admin_logged_in_expert" : "current_logged_in_expert";
              try { localStorage.setItem(activeKey, JSON.stringify(updated)); } catch {}
              return updated;
            });
          });

          return prev;
        });
      } catch {}
    };

    refreshData();
    // Many events can fire at once (focus + storage + mongo_db_updated); run ONE refresh 400 ms
    // after the last of them instead of one per event.
    const debouncedRefresh = debounce(refreshData, 400);
    const unsub = mongoDB.subscribe(() => debouncedRefresh());
    const stopPolling = startVisibleInterval(refreshData, 60_000);
    window.addEventListener("focus", debouncedRefresh);
    window.addEventListener("mongo_db_updated", debouncedRefresh);

    return () => {
      unsub();
      stopPolling();
      debouncedRefresh.cancel();
      window.removeEventListener("focus", debouncedRefresh);
      window.removeEventListener("mongo_db_updated", debouncedRefresh);
    };
  }, [page, isAdminPortal]);

  // Sanitize any stale hardcoded reviews so newly registered experts start with 0 reviews
  useEffect(() => {
    try {
      const rawRevs = localStorage.getItem("app_platform_reviews");
      if (rawRevs) {
        const parsed = JSON.parse(rawRevs);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((r: any) => 
            r && r.id !== "rev-2" && !(r.expertName === "JK" && r.comment?.includes("thirty years of real shop-floor"))
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem("app_platform_reviews", JSON.stringify(cleaned));
            window.dispatchEvent(new CustomEvent("app_platform_reviews_updated", { detail: cleaned }));
          }
        }
      }
      ["jk", "jk@registry.com"].forEach((k) => {
        const staleKey = `expert_reviews_${k}`;
        const stale = localStorage.getItem(staleKey);
        if (stale && stale.includes("thirty years of real shop-floor")) {
          localStorage.removeItem(staleKey);
        }
      });
    } catch {}
  }, []);

  // Listen for browser popstate / back / forward navigation and sync route
  useEffect(() => {
    const handleRouteSync = () => {
      try {
        const route = parseRouteFromLocation();
        setIsAdminPortal(route.isAdmin);
        setPage(route.page);
        setBlogSlug(route.blogSlug);

        if (route.isAdmin) {
          const adminRole = localStorage.getItem("admin_user_role") || "admin";
          setUserRole(adminRole);
        } else {
          const publicRole = localStorage.getItem("current_user_role");
          const normRole = normalizeRole(publicRole);
          if (publicRole && ["client", "expert"].includes(normRole)) {
            setUserRole(normRole);
          } else if (route.page === "client") {
            setUserRole("client");
          }
        }

        const clientKey = route.isAdmin ? "admin_logged_in_client" : "current_logged_in_client";
        const savedClient = localStorage.getItem(clientKey);
        if (savedClient) {
          try {
            const parsed = JSON.parse(savedClient);
            if (parsed && (parsed.email || parsed.name)) {
              setClientProfile(parsed);
            }
          } catch {}
        }
      } catch {}
    };

    window.addEventListener("popstate", handleRouteSync);
    return () => {
      window.removeEventListener("popstate", handleRouteSync);
    };
  }, []);

  // Dynamic User Profiles State (Separated for Admin and Public Portals)
  const [clientProfile, setClientProfile] = useState<any>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const isAdminUrl = params.get("portal") === "admin" || window.location.hash === "#admin";
      const clientKey = isAdminUrl ? "admin_logged_in_client" : "current_logged_in_client";
      const saved = localStorage.getItem(clientKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.email || parsed.name)) return parsed;
      }
    } catch {}
    return DEFAULT_CLIENT_FALLBACK;
  });

  useEffect(() => {
    try {
      const clientKey = isAdminPortal ? "admin_logged_in_client" : "current_logged_in_client";
      if (clientProfile && userRole === "client") {
        localStorage.setItem(clientKey, JSON.stringify(clientProfile));
      }
    } catch {}
  }, [clientProfile, userRole, isAdminPortal]);

  const [expertProfile, setExpertProfile] = useState<any>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const isAdminUrl = params.get("portal") === "admin" || window.location.hash === "#admin";
      const expertKey = isAdminUrl ? "admin_logged_in_expert" : "current_logged_in_expert";
      const saved = localStorage.getItem(expertKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.name || parsed.id)) return parsed;
      }
    } catch {}
    return DEFAULT_EXPERT_FALLBACK;
  });

  useEffect(() => {
    try {
      const expertKey = isAdminPortal ? "admin_logged_in_expert" : "current_logged_in_expert";
      if (expertProfile && userRole === "expert") {
        localStorage.setItem(expertKey, JSON.stringify(expertProfile));
      }
    } catch {}
  }, [expertProfile, userRole, isAdminPortal]);

  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<"signup" | "login">("signup");
  const [authInitialRole, setAuthInitialRole] = useState<string>("client");
  const [showMongoModal, setShowMongoModal] = useState(false);
  const [selectedExpertForProfile, setSelectedExpertForProfile] = useState<ExpertDoc | null>(null);
  const [selectedExpertForBooking, setSelectedExpertForBooking] = useState<ExpertDoc | null>(null);
  // Global state to trigger ProjectReviewRequestModal inside ClientPage from landing/App level
  const [pendingProjectReviewExpert, setPendingProjectReviewExpert] = useState<any | null>(null);

  const handleOpenAuth = (mode: "signup" | "login" = "signup", role: string = "client") => {
    setAuthInitialMode(mode);
    setAuthInitialRole(role);
    setShowAuthModal(true);
  };

  const handleLogout = () => {
    setUserRole(null);

    try {
      if (isAdminPortal || userRole === "admin") {
        mongoDB.adminLogout();
        localStorage.removeItem("admin_token");
        sessionStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user_role");
        localStorage.removeItem("admin_logged_in_client");
        localStorage.removeItem("admin_logged_in_expert");
        localStorage.removeItem("current_admin_authenticated");
        localStorage.removeItem("current_admin_page");
        setIsAdminPortal(false);
        navigateTo("login");
      } else {
        localStorage.removeItem("current_user_role");
        localStorage.removeItem("current_logged_in_client");
        localStorage.removeItem("current_logged_in_expert");
        localStorage.setItem("current_page", "landing");
        navigateTo("landing");
      }
    } catch {}
  };

  const handleSuccessLogin = async (role: string, userData: any) => {
    const normalizedRole = normalizeRole(role);
    setUserRole(normalizedRole);
    setShowAuthModal(false);

    if (normalizedRole === "client") {
      setIsAdminPortal(false);
      try {
        localStorage.removeItem("admin_token");
        sessionStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user_role");
        localStorage.setItem("current_user_role", "client");
      } catch {}

      const emailKey = (userData?.email || "guest").toLowerCase();
      const storageKey = `client_upcoming_${emailKey}`;
      const walletStorageKey = `client_wallet_${emailKey}`;

      const existing = localStorage.getItem(storageKey);
      if (existing) {
        try {
          const cleaned = sanitizeBookings(JSON.parse(existing));
          localStorage.setItem(storageKey, JSON.stringify(cleaned));
        } catch {
          localStorage.setItem(storageKey, JSON.stringify([]));
        }
      } else {
        localStorage.setItem(storageKey, JSON.stringify([]));
      }
      const clientData = {
        id: userData?.id || userData?.user_id || `usr-${emailKey}`,
        name: userData?.name || "Corporate Client",
        company: userData?.company || "Enterprise Partner",
        email: userData?.email || "client@company.com",
        phone: userData?.phone || "+91 98765 43210",
        field: userData?.field || "Corporate Advisory",
        bio: userData?.bio || "Registered client account.",
        initials: userData?.name ? userData.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "CC"
      };
      setClientProfile(clientData);

      const savedWallet = localStorage.getItem(walletStorageKey);
      const initialLocalBal = savedWallet !== null ? Number(savedWallet) : undefined;
      fetchWalletBalance(clientData.id, emailKey, initialLocalBal).then(res => {
        try {
          localStorage.setItem(walletStorageKey, String(res.balance));
        } catch {}
      }).catch(() => {});

      try {
        const srvBookings = await Promise.race([
          fetchClientBookings(clientData.id, emailKey),
          new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 1500))
        ]);
        if (Array.isArray(srvBookings) && srvBookings.length > 0) {
          localStorage.setItem(storageKey, JSON.stringify(srvBookings));
        }
      } catch {}

      notificationService.syncWithBackend('client', emailKey).catch(() => {});

      try {
        localStorage.setItem("current_logged_in_client", JSON.stringify(clientData));
        localStorage.setItem("current_page", "client");
      } catch {}
      navigateTo("client");
    } else if (normalizedRole === "expert") {
      setIsAdminPortal(false);
      try {
        localStorage.removeItem("admin_token");
        sessionStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user_role");
        localStorage.setItem("current_user_role", "expert");
      } catch {}

      const userEmail = (userData?.email || "").toLowerCase().trim();
      const userName = (userData?.name || userData?.full_name || "").toLowerCase().trim();
      const match = (experts || []).find(e => 
        (userEmail && e.email?.toLowerCase().trim() === userEmail) ||
        (userName && e.name?.toLowerCase().trim() === userName)
      );
      const isVerified = match 
        ? Boolean(match.verified === true && match.verificationStatus !== "pending" && !(match as any).rejected) 
        : Boolean(userData?.verified === true && userData?.verificationStatus === "approved" && !userData?.rejected);
      const status = isVerified ? "approved" : (match?.verificationStatus || userData?.verificationStatus || "pending");
      const isRejected = match ? Boolean((match as any).rejected === true || status === "rejected") : Boolean(userData?.rejected === true || status === "rejected");

      const merged = { 
        ...(expertProfile || {}), 
        ...(match || {}),
        ...userData, 
        role: "expert",
        name: userData?.name || userData?.full_name || match?.name || expertProfile?.name || "Senior Expert",
        email: userData?.email || match?.email || expertProfile?.email || "",
        phone: userData?.phone || match?.phone || expertProfile?.phone || "",
        title: userData?.title || match?.title || expertProfile?.title || "Senior Executive Advisor",
        company: userData?.company || match?.company || expertProfile?.company || "",
        field: userData?.field || match?.field || expertProfile?.field || "Finance & Taxation",
        verified: isVerified,
        verificationStatus: status,
        rejected: isRejected,
        rating: match?.rating !== undefined ? Number(match.rating) : (userData?.rating !== undefined ? Number(userData.rating) : 0),
        sessions: match?.sessions !== undefined ? Number(match.sessions) : (match?.total_sessions !== undefined ? Number(match.total_sessions) : (userData?.sessions !== undefined ? Number(userData.sessions) : 0)),
        initials: (userData?.name || userData?.full_name || match?.name || expertProfile?.name || "EX").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) 
      };

      setExpertProfile(merged);
      try {
        localStorage.setItem("current_logged_in_expert", JSON.stringify(merged));
        localStorage.setItem("current_page", "expert");
      } catch {}

      // Pre-load expert bookings so Expert portal displays fresh accepted sessions immediately on login
      const expEmail = userEmail;
      const expId = String(merged.id || '').toLowerCase().trim();
      const acceptedKey = `expert_accepted_sessions_${expEmail}`;
      try {
        const srvExpertBookings = await Promise.race([
          fetchExpertBookings(expId, expEmail, 'all', merged.user_id),
          new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 1500))
        ]);
        if (Array.isArray(srvExpertBookings) && srvExpertBookings.length > 0) {
          const confirmed = srvExpertBookings.filter(b => !b.status?.toLowerCase().includes('pending') && b.status !== 'pending' && !b.status?.toLowerCase().includes('reject'));
          if (confirmed.length > 0) {
            localStorage.setItem(acceptedKey, JSON.stringify(confirmed));
          }
          const pending = srvExpertBookings.filter(b => b.status?.toLowerCase().includes('pending') || b.status === 'pending');
          if (pending.length > 0) {
            localStorage.setItem(`expert_requests_${expEmail}`, JSON.stringify(pending));
          }
        }
      } catch {}

      // Immediately navigate to the Expert Portal page (same mechanism as Client flow)
      navigateTo("expert");

      // Non-blocking background sync so expert verification and fresh directory data stay up to date
      (async () => {
        try {
          const freshExperts = await mongoDB.getExperts();
          if (Array.isArray(freshExperts) && freshExperts.length > 0) {
            setExperts(freshExperts);
            const freshMatch = freshExperts.find(e => 
              (userEmail && e.email?.toLowerCase().trim() === userEmail) ||
              (userName && e.name?.toLowerCase().trim() === userName)
            );
            if (freshMatch) {
              setExpertProfile((prev: any) => ({ ...prev, ...freshMatch }));
            }
          }
        } catch (syncErr) {
          console.error("Expert directory sync note:", syncErr);
        }
      })();
    } else if (normalizedRole === "admin") {
      setIsAdminPortal(true);
      setUserRole("admin");
      const token = userData?.token || localStorage.getItem("admin_token") || localStorage.getItem("admin_session_token") || "admin-session-token";
      try {
        localStorage.setItem("admin_user_role", "admin");
        localStorage.setItem("current_admin_page", "owner");
        localStorage.removeItem("current_user_role");
        localStorage.setItem("admin_token", token);
        sessionStorage.setItem("admin_token", token);
        localStorage.setItem("admin_session_token", token);

        // Pre-fetch platform sessions so admin portal displays immediately
        const srvAdminBookings = await Promise.race([
          fetchAllBookingsForAdmin(),
          new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 1500))
        ]);
        if (Array.isArray(srvAdminBookings) && srvAdminBookings.length > 0) {
          localStorage.setItem("app_platform_sessions", JSON.stringify(srvAdminBookings));
        }
      } catch {}
      navigateTo("owner");
    }
  };

  // After an admin save, reload the (slim) expert list from the database, skipping the cache,
  // so the screen always shows what was really saved. These handlers used to call
  // setExperts(updated) with a { success, expert } object instead of a list — the old 1.5 s
  // poll hid that bug by overwriting it a moment later. Failed saves are now reported.
  const reloadExpertsAfterSave = async (saveResult: any): Promise<any[]> => {
    if (saveResult && saveResult.success === false) {
      console.error("[admin] save failed:", saveResult.error);
      alert(`❌ Could not save the change: ${saveResult.error || "unknown error"}. Please try again.`);
    }
    const fresh = await mongoDB.getExperts({ force: true });
    setExperts(Array.isArray(fresh) ? fresh : []);
    return Array.isArray(fresh) ? fresh : [];
  };

  const handleUpdateExpertMarkup = async (expId: string, base: number, markup: number) => {
    const updated = await mongoDB.saveExpertMarkup(expId, base, markup);
    await reloadExpertsAfterSave(updated);
  };

  const handleToggleFeatured = async (expId: string, featured: boolean) => {
    const updated = await mongoDB.toggleFeaturedOnLanding(expId, featured);
    await reloadExpertsAfterSave(updated);
  };

  const handleUpdateHeroSpotlight = async (expId: string, heroSpotlight: boolean, heroPosition?: "top" | "bottom") => {
    const updated = await mongoDB.updateHeroSpotlightCard(expId, heroSpotlight, heroPosition);
    await reloadExpertsAfterSave(updated);
  };

  const handleUpdatePhotoUrl = async (expId: string, imgUrl: string) => {
    const updated = await mongoDB.updateExpertProfile(expId, { img: imgUrl });
    await reloadExpertsAfterSave(updated);
  };

  const handleApproveVerification = async (item: any) => {
    const res = await mongoDB.approvePendingVerification(item);
    if (Array.isArray(res?.experts)) setExperts(res.experts);
    if (Array.isArray(res?.pendingVerifications)) setPendingVerifications(res.pendingVerifications);

    const itemEmail = item?.email?.toLowerCase().trim();
    const itemName = item?.name?.toLowerCase().trim();
    const itemId = item?.id;

    setExpertProfile((prev: any) => {
      const prevEmail = prev?.email?.toLowerCase().trim();
      const prevName = prev?.name?.toLowerCase().trim();
      const prevId = prev?.id;

      const isMatch = (
        (prevEmail && itemEmail && prevEmail === itemEmail) ||
        (prevId && itemId && prevId === itemId) ||
        (prevName && itemName && prevName === itemName)
      );

      if (prev && isMatch) {
        const updated = { 
          ...prev, 
          email: prev.email || item.email,
          verified: true, 
          verificationStatus: "approved", 
          rejected: false 
        };
        const activeKey = isAdminPortal ? "admin_logged_in_expert" : "current_logged_in_expert";
        try { localStorage.setItem(activeKey, JSON.stringify(updated)); } catch {}
        return updated;
      }
      return prev;
    });

    try {
      const pubRaw = localStorage.getItem("current_logged_in_expert");
      if (pubRaw) {
        const parsed = JSON.parse(pubRaw);
        const parsedEmail = parsed?.email?.toLowerCase().trim();
        const isMatch = (
          (parsedEmail && itemEmail && parsedEmail === itemEmail) ||
          (parsed.id && itemId && parsed.id === itemId) ||
          (parsed.name && itemName && parsed.name?.toLowerCase().trim() === itemName)
        );
        if (isMatch) {
          localStorage.setItem("current_logged_in_expert", JSON.stringify({ 
            ...parsed, 
            email: parsed.email || item.email,
            verified: true, 
            verificationStatus: "approved", 
            rejected: false 
          }));
        }
      }
    } catch {}

    // Broadcast cross-tab instant synchronization
    localStorage.setItem("mongo_last_admin_action", Date.now().toString());
    window.dispatchEvent(new CustomEvent("mongo_db_updated"));

    notificationService.add({
      target: "expert",
      recipientId: item.email || item.name,
      type: "verification",
      title: "Credentials Approved & Profile Verified!",
      message: `Congratulations ${item.name}! Your professional credentials & certificates have been verified. Your profile is now live!`,
      actionLink: "expert"
    });

    confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 } });
    alert(`✅ Admin Approval Complete!\nExpert "${item.name}" approved. PDF documents verified. Added to MongoDB & live on Client Page.`);
  };

  const handleResetPendingQueue = async () => {
    const fresh = await mongoDB.resetPendingQueue();
    setPendingVerifications(fresh);
    localStorage.setItem("mongo_last_admin_action", Date.now().toString());
    window.dispatchEvent(new CustomEvent("mongo_db_updated"));
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.5 } });
    alert("✅ Loaded fresh sample applicants into Document Audit & Verification Queue!");
  };

  const handleDemoteToAuditQueue = async (expId: string) => {
    const res = await mongoDB.demoteExpertToAuditQueue(expId);
    if (Array.isArray(res?.experts)) setExperts(res.experts);
    if (Array.isArray(res?.pendingVerifications)) setPendingVerifications(res.pendingVerifications);

    const targetExp = Array.isArray(res?.experts) ? res.experts.find(e => e.id === expId || e.name.toLowerCase().trim() === expId.toLowerCase().trim()) : null;
    const targetEmail = targetExp?.email?.toLowerCase().trim();
    const targetName = targetExp?.name?.toLowerCase().trim();

    setExpertProfile((prev: any) => {
      const prevEmail = prev?.email?.toLowerCase().trim();
      const prevName = prev?.name?.toLowerCase().trim();
      const prevId = prev?.id;

      const isMatch = (
        prevId === expId ||
        (targetEmail && prevEmail && targetEmail === prevEmail) ||
        (targetName && prevName && targetName === prevName) ||
        prevName === expId.toLowerCase().trim()
      );

      if (prev && isMatch) {
        const updated = { ...prev, verified: false, verificationStatus: "pending", rejected: false };
        const activeKey = isAdminPortal ? "admin_logged_in_expert" : "current_logged_in_expert";
        try { localStorage.setItem(activeKey, JSON.stringify(updated)); } catch {}
        return updated;
      }
      return prev;
    });

    try {
      const pubRaw = localStorage.getItem("current_logged_in_expert");
      if (pubRaw) {
        const parsed = JSON.parse(pubRaw);
        const parsedEmail = parsed?.email?.toLowerCase().trim();
        const isMatch = (
          parsed.id === expId ||
          (targetEmail && parsedEmail && targetEmail === parsedEmail) ||
          (targetName && parsed.name && targetName === parsed.name.toLowerCase().trim()) ||
          parsed.name?.toLowerCase().trim() === expId.toLowerCase().trim()
        );
        if (isMatch) {
          localStorage.setItem("current_logged_in_expert", JSON.stringify({
            ...parsed,
            verified: false,
            verificationStatus: "pending",
            rejected: false
          }));
        }
      }
    } catch {}

    localStorage.setItem("mongo_last_admin_action", Date.now().toString());
    window.dispatchEvent(new CustomEvent("mongo_db_updated"));
    confetti({ particleCount: 30, spread: 40, origin: { y: 0.5 } });
    alert(`⚡ Admin Action:\nExpert moved back into Document Audit & Verification Queue!`);
  };

  const handleDeleteExpert = async (expId: string) => {
    const targetInPending = pendingVerifications.find(p => p.id === expId || p.name.toLowerCase().trim() === expId.toLowerCase().trim());
    const targetEmail = targetInPending?.email?.toLowerCase().trim();
    const targetName = targetInPending?.name?.toLowerCase().trim();

    const res = await mongoDB.rejectPendingVerification(expId);
    if (Array.isArray(res?.experts)) setExperts(res.experts);
    if (Array.isArray(res?.pendingVerifications)) setPendingVerifications(res.pendingVerifications);

    setExpertProfile((prev: any) => {
      const prevEmail = prev?.email?.toLowerCase().trim();
      const prevName = prev?.name?.toLowerCase().trim();
      const prevId = prev?.id;

      const isMatch = (
        prevId === expId ||
        (targetEmail && prevEmail && targetEmail === prevEmail) ||
        (targetName && prevName && targetName === prevName) ||
        prevName === expId.toLowerCase().trim()
      );

      if (prev && isMatch) {
        const updated = { ...prev, verified: false, verificationStatus: "rejected", rejected: true };
        const activeKey = isAdminPortal ? "admin_logged_in_expert" : "current_logged_in_expert";
        try { localStorage.setItem(activeKey, JSON.stringify(updated)); } catch {}
        return updated;
      }
      return prev;
    });

    try {
      const pubRaw = localStorage.getItem("current_logged_in_expert");
      if (pubRaw) {
        const parsed = JSON.parse(pubRaw);
        const parsedEmail = parsed?.email?.toLowerCase().trim();
        const isMatch = (
          parsed.id === expId ||
          (targetEmail && parsedEmail && targetEmail === parsedEmail) ||
          (targetName && parsed.name && targetName === parsed.name.toLowerCase().trim()) ||
          parsed.name?.toLowerCase().trim() === expId.toLowerCase().trim()
        );
        if (isMatch) {
          localStorage.setItem("current_logged_in_expert", JSON.stringify({
            ...parsed,
            verified: false,
            verificationStatus: "rejected",
            rejected: true
          }));
        }
      }
    } catch {}

    localStorage.setItem("mongo_last_admin_action", Date.now().toString());
    window.dispatchEvent(new CustomEvent("mongo_db_updated"));
    confetti({ particleCount: 30, spread: 40, origin: { y: 0.5 } });
    alert(`❌ Admin Governance: Expert audit rejected / removed from Client listings.`);
  };

  const handleToggleVerification = async (expId: string, verified: boolean) => {
    const updated = await reloadExpertsAfterSave(await mongoDB.toggleExpertVerification(expId, verified));


    const targetExp = updated.find(e => e.id === expId || e.name.toLowerCase().trim() === expId.toLowerCase().trim());
    const targetEmail = targetExp?.email?.toLowerCase().trim();
    const targetName = targetExp?.name?.toLowerCase().trim();

    setExpertProfile((prev: any) => {
      const prevEmail = prev?.email?.toLowerCase().trim();
      const prevName = prev?.name?.toLowerCase().trim();
      const prevId = prev?.id;

      const isMatch = (
        prevId === expId ||
        (targetEmail && prevEmail && targetEmail === prevEmail) ||
        (targetName && prevName && targetName === prevName) ||
        prevName === expId.toLowerCase().trim()
      );

      if (prev && isMatch) {
        const updatedProf = { 
          ...prev, 
          verified, 
          verificationStatus: verified ? "approved" : "rejected", 
          rejected: !verified 
        };
        const activeKey = isAdminPortal ? "admin_logged_in_expert" : "current_logged_in_expert";
        try { localStorage.setItem(activeKey, JSON.stringify(updatedProf)); } catch {}
        return updatedProf;
      }
      return prev;
    });

    try {
      const pubRaw = localStorage.getItem("current_logged_in_expert");
      if (pubRaw) {
        const parsed = JSON.parse(pubRaw);
        const parsedEmail = parsed?.email?.toLowerCase().trim();
        const isMatch = (
          parsed.id === expId ||
          (targetEmail && parsedEmail && targetEmail === parsedEmail) ||
          (targetName && parsed.name && targetName === parsed.name.toLowerCase().trim()) ||
          parsed.name?.toLowerCase().trim() === expId.toLowerCase().trim()
        );
        if (isMatch) {
          localStorage.setItem("current_logged_in_expert", JSON.stringify({
            ...parsed,
            verified,
            verificationStatus: verified ? "approved" : "rejected",
            rejected: !verified
          }));
        }
      }
    } catch {}

    localStorage.setItem("mongo_last_admin_action", Date.now().toString());
    window.dispatchEvent(new CustomEvent("mongo_db_updated"));
  };

  const handleUpdateExpertProfile = async (updatedProfile: any) => {
    const isApproved = updatedProfile.verified === true && updatedProfile.verificationStatus === "approved" && !updatedProfile.rejected;
    const isRejected = updatedProfile.rejected === true || updatedProfile.verificationStatus === "rejected";
    const status = isApproved ? "approved" : (isRejected ? "rejected" : "pending");
    const finalProfile = { 
      ...updatedProfile, 
      verified: isApproved, 
      verificationStatus: status, 
      rejected: isRejected 
    };

    // Profile change audit log and realtime broadcast to Admin KYC desk
    try {
      const expId = finalProfile.id;
      const fieldsToCheck = [
        { key: 'baseRate', label: 'Base Rate', prefix: '₹' },
        { key: 'projectRate', label: 'Project Review Price', prefix: '₹' },
        { key: 'title', label: 'Professional Title' },
        { key: 'field', label: 'Domain Field' },
        { key: 'years', label: 'Experience Years' },
        { key: 'phone', label: 'Phone Number' },
        { key: 'bio', label: 'Executive Bio' },
      ];

      for (const f of fieldsToCheck) {
        const oldV = expertProfile ? expertProfile[f.key] : undefined;
        const newV = finalProfile[f.key];
        if (oldV !== undefined && newV !== undefined && String(oldV) !== String(newV)) {
          const oldStr = f.prefix ? `${f.prefix}${oldV}` : String(oldV);
          const newStr = f.prefix ? `${f.prefix}${newV}` : String(newV);
          fetch('/api/expert/profile-change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expertId: expId,
              fieldName: f.label,
              oldValue: oldStr,
              newValue: newStr,
              changedBy: 'expert'
            })
          }).catch(() => {});

          const ch = supabase.channel('admin-kyc-desk');
          ch.send({
            type: 'broadcast',
            event: 'expert_profile_updated',
            payload: {
              expertId: expId,
              fieldName: f.key,
              oldValue: oldV,
              newValue: newV,
              expertName: finalProfile.name
            }
          }).catch(() => {});
        }
      }
    } catch (diffErr) {
      console.warn('Profile diff broadcast error:', diffErr);
    }

    setExpertProfile(finalProfile);
    const expertKey = isAdminPortal ? "admin_logged_in_expert" : "current_logged_in_expert";
    try {
      localStorage.setItem(expertKey, JSON.stringify(finalProfile));
    } catch {}

    const res = await mongoDB.submitExpertVerification(finalProfile);
    if (Array.isArray(res?.experts)) setExperts(res.experts);
    if (Array.isArray(res?.pendingVerifications)) setPendingVerifications(res.pendingVerifications);
    if (typeof finalProfile.projectRate === 'number') {
      const safeProjectRate = Math.max(0, Math.min(2000, finalProfile.projectRate));
      await mongoDB.updateProjectReviewPrice(finalProfile.id, safeProjectRate, 'expert', finalProfile.id, finalProfile.email);
    }

    confetti({ particleCount: 50, spread: 50, origin: { y: 0.5 } });
    alert(`✅ Profile & Rates Saved Permanently to Database!\nAll profile details for "${finalProfile.name}" have been updated.`);
  };

  return (
    <div className={theme === "light" ? "theme-light min-h-screen" : "theme-dark min-h-screen"}>
      <ProtoBar
        page={page}
        setPage={navigateTo}
        userRole={userRole}
        recipientId={userRole === "client" ? clientProfile?.email : (expertProfile?.email || expertProfile?.name)}
        onOpenMongoModal={() => setShowMongoModal(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isAdminPortal={isAdminPortal}
        onLogout={handleLogout}
      />

      {page === "landing" && (
        <Landing
          setPage={navigateTo}
          onOpenAuth={handleOpenAuth}
          experts={experts}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          userRole={userRole}
          onLogout={handleLogout}
          onViewDossier={(exp) => setSelectedExpertForProfile(exp)}
        />
      )}

      {page === "about" && (
        <MentoraAboutPage
          setPage={navigateTo}
          onOpenAuth={handleOpenAuth}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          userRole={userRole}
          onLogout={handleLogout}
        />
      )}

      {page === "blogs" && (
        <MentoraBlogsPage
          setPage={(p, s) => navigateTo(p, false, s)}
          initialSlug={blogSlug}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          userRole={userRole}
          onLogout={handleLogout}
          onOpenAuth={handleOpenAuth}
        />
      )}

      {page === "login" && (
        <AuthPage
          onClose={() => navigateTo((prevPageRef.current && prevPageRef.current !== "expert" && prevPageRef.current !== "owner") ? prevPageRef.current : "landing")}
          onSuccessLogin={handleSuccessLogin}
          initialMode="login"
          initialRole={userRole || "client"}
          theme={theme}
        />
      )}

      {page === "client" && (
        <ClientPage
          setPage={navigateTo}
          clientProfile={clientProfile || DEFAULT_CLIENT_FALLBACK}
          onUpdateClientProfile={(updated) => setClientProfile(updated)}
          experts={experts}
          pendingVerifications={pendingVerifications}
          userRole={userRole || "client"}
          onRequireAuth={() => handleOpenAuth("signup", "client")}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onLogout={handleLogout}
          initialExpertForProjectReview={pendingProjectReviewExpert}
          onProjectReviewExpertConsumed={() => setPendingProjectReviewExpert(null)}
        />
      )}

      {page === "expert" && (
        <ExpertPage
          setPage={navigateTo}
          expertProfile={expertProfile || DEFAULT_EXPERT_FALLBACK}
          onUpdateExpertProfile={handleUpdateExpertProfile}
          experts={experts}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onLogout={handleLogout}
        />
      )}

      {page === "owner" && (userRole === "admin" || (typeof window !== "undefined" && localStorage.getItem("admin_user_role") === "admin")) && (
        <AdminGovernancePortal
          setPage={navigateTo}
          experts={experts || []}
          pendingVerifications={pendingVerifications || []}
          onUpdateExpertMarkup={handleUpdateExpertMarkup}
          onOpenMongoModal={() => setShowMongoModal(true)}
          onToggleFeatured={handleToggleFeatured}
          onUpdateHeroSpotlight={handleUpdateHeroSpotlight}
          onUpdatePhotoUrl={handleUpdatePhotoUrl}
          onApproveVerification={handleApproveVerification}
          onDeleteExpert={handleDeleteExpert}
          onToggleVerification={handleToggleVerification}
          onDemoteToAuditQueue={handleDemoteToAuditQueue}
          onResetPendingQueue={handleResetPendingQueue}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onLogout={handleLogout}
        />
      )}

      {page === "owner" && userRole !== "admin" && (typeof window !== "undefined" && localStorage.getItem("admin_user_role") !== "admin") && (
        <AuthPage
          onClose={() => navigateTo(userRole === "client" ? "client" : userRole === "expert" ? "expert" : "landing")}
          onSuccessLogin={handleSuccessLogin}
          initialMode="login"
          initialRole={userRole || "client"}
          theme={theme}
        />
      )}

      {/* Floating ChatGPT-Style Intelligent Assistant Chatbot (Only for Public / Client Portals) */}
      {page !== "owner" && (
        <AIChatbotWidget
          userRole={userRole}
          onBookExpert={(exp) => {
            navigateTo("client");
            setSelectedExpertForBooking(exp);
          }}
          onViewDossier={(exp) => setSelectedExpertForProfile(exp)}
          onRequireAuth={() => handleOpenAuth("signup", "client")}
          theme={theme}
        />
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthPage
          onClose={() => setShowAuthModal(false)}
          onSuccessLogin={handleSuccessLogin}
          initialMode={authInitialMode}
          initialRole={authInitialRole}
          theme={theme}
        />
      )}

      {/* MongoDB Setup & Status Modal */}
      {showMongoModal && (
        <MongoDBSetupModal onClose={() => setShowMongoModal(false)} />
      )}

      {/* Full Profile Dossier Modal */}
      {selectedExpertForProfile && (
        <ExpertProfileModal
          expert={selectedExpertForProfile}
          onClose={() => setSelectedExpertForProfile(null)}
          onBook={(exp) => {
            setSelectedExpertForProfile(null);
            if (!userRole) {
              handleOpenAuth("signup", "client");
            } else {
              setSelectedExpertForBooking(exp);
            }
          }}
          theme={theme}
        />
      )}

      {/* Booking Modal */}
      {selectedExpertForBooking && (
        <BookingModal
          expert={selectedExpertForBooking}
          onClose={() => setSelectedExpertForBooking(null)}
          theme={theme}
          clientProfile={clientProfile}
          onBookSuccess={async (newBooking: any, cost: number) => {
            const bookingWithClient = {
              ...newBooking,
              client: newBooking.client || clientProfile?.name || "Client ABC",
              clientEmail: newBooking.clientEmail || clientProfile?.email || "client@company.com"
            };

            const scheduledDate = bookingWithClient.date || (bookingWithClient.when ? bookingWithClient.when.split(',')[0].trim() : '');
            const scheduledTime = bookingWithClient.timeSlot || (bookingWithClient.when ? bookingWithClient.when.split(',')[1]?.trim() : '');

            // FIX 2: Await createConsultationBooking FIRST before updating state or deducting wallet!
            const res = await createConsultationBooking({
              id: bookingWithClient.id,
              clientId: clientProfile?.id || bookingWithClient.clientId || clientProfile?.email || 'client-1',
              clientName: bookingWithClient.client,
              clientEmail: bookingWithClient.clientEmail,
              expertId: selectedExpertForBooking?.id || bookingWithClient.expertId || '',
              expertName: selectedExpertForBooking?.name || bookingWithClient.expert || '',
              expertEmail: selectedExpertForBooking?.email || bookingWithClient.expertEmail || '',
              topic: bookingWithClient.topic || 'Consultation',
              scheduledDate,
              scheduledTime,
              when: bookingWithClient.when,
              durationMinutes: 60,
              packageType: bookingWithClient.type === "hourly" || bookingWithClient.type === "Hourly" ? "Hourly Consultation" : "Project Advisory",
              value: cost,
              price: cost,
              status: 'pending'
            });

            if (!res.success) {
              console.error('[ROOT BOOKING] Failed to persist to Supabase:', res.error);
              const userMessage = res.code === '23505'
                ? "This slot was just booked, please choose another time"
                : (res.error || "Failed to confirm booking.");
              alert(`⚠️ Booking Error: ${userMessage}`);
              return { success: false, error: userMessage, code: res.code };
            }

            const confirmedBooking = res.booking || bookingWithClient;
            const emailKey = (clientProfile?.email || "guest").toLowerCase();
            const storageKey = `client_upcoming_${emailKey}`;
            const walletStorageKey = `client_wallet_${emailKey}`;

            const savedBookings = localStorage.getItem(storageKey);
            const prevBookings = savedBookings ? JSON.parse(savedBookings) : [];
            const nextBookings = [confirmedBooking, ...prevBookings];
            localStorage.setItem(storageKey, JSON.stringify(nextBookings));

            const savedWallet = localStorage.getItem(walletStorageKey);
            const prevBal = savedWallet !== null ? Number(savedWallet) : 0;
            const nextBal = Math.max(0, (isNaN(prevBal) ? 0 : prevBal) - cost);
            localStorage.setItem(walletStorageKey, String(nextBal));
            mongoDB.syncKv(walletStorageKey, String(nextBal));

            // Sync to Admin Meeting & Session OPS Desk
            syncSessionToAdminOps({
              id: confirmedBooking.id,
              client: confirmedBooking.client,
              clientEmail: confirmedBooking.clientEmail,
              expert: confirmedBooking.expert,
              expertEmail: confirmedBooking.expertEmail,
              topic: confirmedBooking.topic,
              when: confirmedBooking.when,
              type: confirmedBooking.type === "hourly" || confirmedBooking.type === "Hourly" ? "Hourly Consultation" : "Project Advisory",
              rate: cost,
              payout: Math.round(cost * 0.85),
              status: "Pending Expert Acceptance",
              isLive: false,
              completed: false,
              meetUrl: "",
              meetCode: ""
            });

            // Sync into expert requests queue
            try {
              const expName = selectedExpertForBooking?.name || bookingWithClient.expert || "";
              const expEmail = selectedExpertForBooking?.email || bookingWithClient.expertEmail || "";
              const expId = selectedExpertForBooking?.id || bookingWithClient.expertId || "";

              const reqItem = {
                id: bookingWithClient.id,
                client: bookingWithClient.client,
                clientEmail: bookingWithClient.clientEmail,
                topic: bookingWithClient.topic,
                when: bookingWithClient.when,
                type: bookingWithClient.type || "Hourly",
                status: "Pending Expert Acceptance",
                rate: cost,
                meetUrl: ""
              };

              const keysToSync = [
                expEmail.toLowerCase().trim(),
                expName.toLowerCase().trim(),
                expId.toLowerCase().trim()
              ].filter(Boolean);

              keysToSync.forEach(k => {
                const reqKey = `expert_requests_${k}`;
                const existingRaw = localStorage.getItem(reqKey);
                const existing = existingRaw ? JSON.parse(existingRaw) : [];
                const updated = [reqItem, ...existing.filter((r: any) => r.id !== reqItem.id)];
                localStorage.setItem(reqKey, JSON.stringify(updated));
              });
            } catch {}

            // Real-time multi-party notifications
            notificationService.add({
              target: "expert",
              recipientId: selectedExpertForBooking?.email || bookingWithClient.expertEmail || bookingWithClient.expert,
              type: "booking",
              title: "New Advisory Session Booked!",
              message: `${bookingWithClient.client} booked "${bookingWithClient.topic}" for ${bookingWithClient.when}.`,
              actionLink: "expert"
            });
            notificationService.add({
              target: "client",
              recipientId: bookingWithClient.clientEmail,
              type: "booking",
              title: "Consultation Scheduled!",
              message: `Your session with ${bookingWithClient.expert} on ${bookingWithClient.when} is confirmed.`,
              actionLink: "client"
            });
            notificationService.add({
              target: "admin",
              type: "booking",
              title: "New Platform Booking",
              message: `${bookingWithClient.client} booked ${bookingWithClient.expert} (₹${cost}).`,
              actionLink: "owner"
            });

            setSelectedExpertForBooking(null);
            navigateTo("client");
            return { success: true, booking: confirmedBooking };
          }}
          walletBalance={(() => {
            const emailKey = (clientProfile?.email || "guest").toLowerCase();
            const savedWallet = localStorage.getItem(`client_wallet_${emailKey}`);
            const num = savedWallet !== null ? Number(savedWallet) : 0;
            return !isNaN(num) ? num : 0;
          })()}
          onSwitchToProjectReview={(expert: any) => {
            setSelectedExpertForBooking(null);
            setPendingProjectReviewExpert(expert);
            navigateTo("client");
          }}
        />
      )}
    </div>
  );
}
