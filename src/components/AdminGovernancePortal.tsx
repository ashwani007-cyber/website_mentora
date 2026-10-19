import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Briefcase,
  Users,
  IndianRupee,
  TrendingUp,
  Bell,
  MessageSquare,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
  Save,
  UserX,
  Plus,
  Check,
  ExternalLink,
  Database,
  LogOut,
  RefreshCw,
  FileText,
  CheckCircle2,
  Search,
  Layers,
  FileCheck,
  X,
  ChevronRight,
  PieChart as PieChartIcon,
  Clock,
  Sun,
  Moon,
  Video,
  CalendarDays,
  Copy,
  Play,
  AlertCircle,
  BookOpen
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import confetti from 'canvas-confetti';
import { ExpertDoc, mongoDB, getDocFile } from '../mongoDBService';
import { DocumentViewerModal, DocumentViewerItem } from './DocumentViewerModal';
import { notificationService } from '../services/notificationService';
import { expertiseService } from '../services/expertiseService';
import { NotificationCenter } from './NotificationCenter';
import { NotificationManagementDesk } from './NotificationManagementDesk';
import { ExpertAvailabilityManager } from './ExpertAvailabilityManager';
import { AdminProjectReviewDesk } from './AdminProjectReviewDesk';
import { ProjectReviewWorkspace } from './ProjectReviewWorkspace';
import { AdminBlogsDesk } from './AdminBlogsDesk';




const REVENUE_STREAMS = [
  { name: "Advisory Comm. (15%)", value: 45 },
  { name: "Pro Subscriptions", value: 25 },
  { name: "Enterprise Retainers", value: 20 },
  { name: "Verified Credentialing", value: 10 },
];

const GROWTH = [
  { month: "Jan", professionals: 120, clients: 450 },
  { month: "Feb", professionals: 380, clients: 1200 },
  { month: "Mar", professionals: 890, clients: 2900 },
  { month: "Apr", professionals: 1650, clients: 4800 },
  { month: "May", professionals: 2400, clients: 6900 },
  { month: "Jun", professionals: 3240, clients: 8910 },
];

const TRANSACTIONS = [
  { id: "TX-9011", date: "2026-09-08", expertPay: 1800, amount: 2250, cut: 450, desc: "Corporate GST Audit — Northwind Retail" },
  { id: "TX-9010", date: "2026-09-08", expertPay: 2100, amount: 2700, cut: 600, desc: "SEBI Compliance Advisory — FinCorp India" },
  { id: "TX-9009", date: "2026-09-07", expertPay: 1500, amount: 1950, cut: 450, desc: "Supply Chain & Customs Clearance — Apex Logistix" },
  { id: "TX-9008", date: "2026-09-07", expertPay: 2400, amount: 3000, cut: 600, desc: "Board Level Arbitration — Nexus Energy" },
];

function getExpertPhoto(exp: any): string {
  if (!exp) return "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80";
  return exp.imageUrl || exp.avatar || exp.photoUrl || exp.img || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80";
}

function handleImgError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  e.currentTarget.src = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80";
}

interface AdminGovernancePortalProps {
  setPage: (p: string) => void;
  experts?: ExpertDoc[];
  pendingVerifications?: any[];
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
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  onLogout?: () => void;
}

export const AdminGovernancePortal: React.FC<AdminGovernancePortalProps> = ({
  setPage,
  experts: propExperts = [],
  pendingVerifications = [],
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
  theme,
  onToggleTheme,
  onLogout,
}) => {
  const experts = Array.isArray(propExperts) ? propExperts : [];
  // Navigation Desks State
  const [activeDesk, setActiveDesk] = useState<"kpi" | "kyc" | "pricing" | "spotlight" | "reviews" | "sessions" | "broadcast" | "diagnostics" | "expertise" | "availability" | "project_reviews" | "blogs">("kpi");
  const [adminInspectingReviewId, setAdminInspectingReviewId] = useState<string | null>(null);
  const [selectedAuditItem, setSelectedAuditItem] = useState<any | null>(null);

  const [adminPreviewDoc, setAdminPreviewDoc] = useState<DocumentViewerItem | null>(null);
  const [expertSearch, setExpertSearch] = useState("");
  const [adminSelectedExpertId, setAdminSelectedExpertId] = useState<string>(() => experts[0]?.id || "exp-1");
  const [adminExpertSearch, setAdminExpertSearch] = useState<string>("");
  const [adminAvailabilityTabFilter, setAdminAvailabilityTabFilter] = useState<"all" | "has_slots" | "no_slots">("all");

  // Expertise Fields Taxonomy State
  const [expertiseFields, setExpertiseFields] = useState<string[]>(() => expertiseService.getAll());
  const [newFieldName, setNewFieldName] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");

  useEffect(() => {
    return expertiseService.subscribe((updated) => {
      setExpertiseFields(updated);
    });
  }, []);

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) return;
    const res = expertiseService.add(newFieldName.trim());
    if (!res.success) {
      alert(res.message);
      return;
    }
    setNewFieldName("");
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
  };

  const handleDeleteField = (fieldName: string) => {
    const assignedExperts = experts.filter(e => e.field && e.field.toLowerCase() === fieldName.toLowerCase());
    let promptMsg = `Are you sure you want to delete the expertise field "${fieldName}"?`;
    if (assignedExperts.length > 0) {
      promptMsg += `\n\n⚠️ Caution: ${assignedExperts.length} expert(s) are currently tagged in this field (${assignedExperts.map(e => e.name).slice(0, 3).join(", ")}${assignedExperts.length > 3 ? "..." : ""}).`;
    }
    if (window.confirm(promptMsg)) {
      const res = expertiseService.delete(fieldName);
      if (!res.success) {
        alert(res.message);
      }
    }
  };

  const handleResetFields = () => {
    if (window.confirm("Restore standard canonical expertise fields? This will revert any custom additions and deletions.")) {
      expertiseService.reset();
      confetti({ particleCount: 30, spread: 40 });
      alert("✅ Restored default expertise domain fields.");
    }
  };

  // Internal theme fallback
  const [internalTheme, setInternalTheme] = useState<"dark" | "light">(() => {
    try {
      const saved = localStorage.getItem("app_theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return "dark";
  });

  const activeTheme = theme || internalTheme;
  const isLight = activeTheme === "light";

  const handleToggleThemeLocal = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      const next = activeTheme === "dark" ? "light" : "dark";
      setInternalTheme(next);
      try {
        localStorage.setItem("app_theme", next);
      } catch {}
      if (next === "light") {
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
    }
  };

  // Dynamic Theme Tokens
  const T = {
    ink: isLight ? "#F1F5F9" : "#0E1520",
    ink2: isLight ? "#F8FAFC" : "#070B10",
    ink3: isLight ? "#E2E8F0" : "#131C28",
    cream: isLight ? "#0F172A" : "#F4EFEA",
    parchment: isLight ? "#F8FAFC" : "#EFE8DF",
    brass: isLight ? "#B45309" : "#C9A063",
    brassLight: isLight ? "#92400E" : "#DFBE87",
    moss: "#4F5D3F",
    mossLight: isLight ? "#2E7D32" : "#7A8C66",
    rust: "#9E4736",
    line: isLight ? "rgba(15,23,42,0.08)" : "rgba(14,21,32,0.12)",
    lineInk: isLight ? "#E2E8F0" : "rgba(244,239,234,0.12)",
    goldGradient: isLight 
      ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" 
      : "linear-gradient(135deg, #C9A063 0%, #9B783E 100%)",
    cardBg: isLight ? "#FFFFFF" : "rgba(14, 21, 32, 0.85)",
    cardBorder: isLight ? "#E2E8F0" : "rgba(244, 239, 234, 0.12)"
  };

  // Platform Reviews Moderation State
  const [platformReviews, setPlatformReviews] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("app_platform_reviews");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter((r: any) => r && r.id !== "rev-2" && !(r.expertName === "JK" && r.clientName === "Northwind Retail Pvt Ltd"));
          return cleaned;
        }
      }
    } catch {}
    return [
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
  });

  useEffect(() => {
    const handleSync = (e?: any) => {
      if (e?.detail) {
        if (Array.isArray(e.detail)) {
          setPlatformReviews(e.detail);
          return;
        }
        if (e.detail?.key === "app_platform_reviews" && Array.isArray(e.detail.value)) {
          setPlatformReviews(e.detail.value);
          return;
        }
        if (e.detail?.kv?.app_platform_reviews && Array.isArray(e.detail.kv.app_platform_reviews)) {
          setPlatformReviews(e.detail.kv.app_platform_reviews);
          return;
        }
      }
      try {
        const saved = localStorage.getItem("app_platform_reviews");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setPlatformReviews(parsed);
          }
        }
      } catch {}
    };
    window.addEventListener("app_platform_reviews_updated", handleSync);
    window.addEventListener("storage", handleSync);
    window.addEventListener("mongo_kv_updated", handleSync);
    window.addEventListener("mongo_db_updated", handleSync);
    const syncPoll = setInterval(handleSync, 2000);
    return () => {
      window.removeEventListener("app_platform_reviews_updated", handleSync);
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("mongo_kv_updated", handleSync);
      window.removeEventListener("mongo_db_updated", handleSync);
      clearInterval(syncPoll);
    };
  }, []);

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

    // Synchronize directly with the target expert's dedicated review keys
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

      // Also check experts list prop
      const matchedExp = experts?.find((e: any) => 
        e.name?.toLowerCase() === expNameLower || 
        (e.initials && e.initials.toLowerCase() === expNameLower) ||
        (e.name && e.name.toLowerCase().includes(expNameLower))
      );
      if (matchedExp) {
        if (matchedExp.email) targetKeys.add(`expert_reviews_${matchedExp.email.toLowerCase().trim()}`);
        if (matchedExp.id) targetKeys.add(`expert_reviews_${matchedExp.id.toLowerCase().trim()}`);
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

  // ==============================================================
  // SESSION OPERATIONS & MEETING GOVERNANCE STATE & LOGIC
  // ==============================================================
  const [sessionTab, setSessionTab] = useState<"all" | "live" | "scheduled" | "completed">("all");
  const [sessionSearch, setSessionSearch] = useState("");
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [newSessClient, setNewSessClient] = useState("");
  const [newSessExpert, setNewSessExpert] = useState("JK");
  const [newSessTopic, setNewSessTopic] = useState("");
  const [newSessWhen, setNewSessWhen] = useState("2026-09-12, 04:00 PM");
  const [newSessType, setNewSessType] = useState<"Hourly" | "Project">("Hourly");
  const [newSessRate, setNewSessRate] = useState(600);
  const [newSessIsLive, setNewSessIsLive] = useState(false);

  const [platformSessions, setPlatformSessions] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("app_platform_sessions");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [
      {
        id: "sess-live-1",
        client: "Raj (Nexus Tech Innovations)",
        clientEmail: "raj@nexustech.in",
        expert: "JK (Senior Logistics & Advisory Expert)",
        expertEmail: "jk@registry.com",
        topic: "Warehouse Logistics & Freight Fleet Bottleneck Audit",
        when: "Today (Live)",
        type: "Hourly Consultation",
        rate: 1500,
        payout: 1200,
        status: "Live — Call In Progress",
        isLive: true,
        completed: false,
        meetUrl: "https://meet.google.com/qwe-rtyu-iop",
        meetCode: "qwe-rtyu-iop",
        startedAt: "Active for 24 mins",
        reviewed: false,
        payoutTransferred: false
      },
      {
        id: "sess-live-2",
        client: "Priya Sharma (FinCorp Partners)",
        clientEmail: "priya@fincorp.com",
        expert: "Sunita Rao (Former CFO)",
        expertEmail: "sunita.rao@registry.com",
        topic: "Corporate Tax Exposure & ESOP Valuation Structuring",
        when: "Today (Live)",
        type: "Hourly Consultation",
        rate: 750,
        payout: 600,
        status: "Live — Meeting Connected",
        isLive: true,
        completed: false,
        meetUrl: "https://meet.google.com/abc-defg-hij",
        meetCode: "abc-defg-hij",
        startedAt: "Active for 12 mins",
        reviewed: false,
        payoutTransferred: false
      },
      {
        id: "sess-sched-1",
        client: "Vikramaditya Singh (Northwind Retail)",
        clientEmail: "vikram@northwindretail.com",
        expert: "JK (Senior Logistics & Advisory Expert)",
        expertEmail: "jk@registry.com",
        topic: "Multi-Hub Distribution Route Scheduling & Vendor Terms",
        when: "2026-09-13, 04:00 PM",
        type: "Hourly Consultation",
        rate: 600,
        payout: 500,
        status: "Confirmed — Meet Link Sent",
        isLive: false,
        completed: false,
        meetUrl: "https://meet.google.com/jkl-zxcv-bnm",
        meetCode: "jkl-zxcv-bnm",
        reviewed: false,
        payoutTransferred: false
      },
      {
        id: "sess-sched-2",
        client: "Aditi Rao (Zeta Media)",
        clientEmail: "aditi@zetamedia.in",
        expert: "Meera Chatterjee (Senior Brand Director)",
        expertEmail: "meera.c@registry.com",
        topic: "D2C Brand Retention & Growth Launch Strategy",
        when: "2026-09-14, 11:00 AM",
        type: "Project Advisory",
        rate: 2100,
        payout: 1750,
        status: "Confirmed — Meet Link Scheduled",
        isLive: false,
        completed: false,
        meetUrl: "https://meet.google.com/mno-pqrs-tuv",
        meetCode: "mno-pqrs-tuv",
        reviewed: false,
        payoutTransferred: false
      },
      {
        id: "sess-sched-3",
        client: "Siddharth Verma (EdTech Labs)",
        clientEmail: "siddharth@edtechlabs.org",
        expert: "Anjali Menon (Mathematics Pedagogy Specialist)",
        expertEmail: "anjali.menon@registry.com",
        topic: "K-12 Pedagogy Standard & Olympiad Math Design",
        when: "2026-09-15, 02:30 PM",
        type: "Hourly Consultation",
        rate: 400,
        payout: 300,
        status: "Pending Expert Meet Link",
        isLive: false,
        completed: false,
        meetUrl: "",
        meetCode: "",
        reviewed: false,
        payoutTransferred: false
      },
      {
        id: "sess-comp-1",
        client: "Raj",
        clientEmail: "raj@nexustech.in",
        expert: "JK",
        expertEmail: "jk@registry.com",
        topic: "Freight Fleet Cost Rationalization",
        when: "2026-09-11, 02:00 PM",
        completedAt: "2026-09-11 03:00 PM",
        type: "Hourly Consultation",
        rate: 1500,
        payout: 1200,
        status: "Completed",
        isLive: false,
        completed: true,
        meetUrl: "https://meet.google.com/qwe-rtyu-iop",
        reviewed: true,
        payoutTransferred: true
      },
      {
        id: "sess-comp-2",
        client: "Vikramaditya Singh",
        clientEmail: "vikram@northwindretail.com",
        expert: "JK",
        expertEmail: "jk@registry.com",
        topic: "GST Audits & Compliance Reconciliation",
        when: "2026-09-07, 03:00 PM",
        completedAt: "2026-09-07 04:00 PM",
        type: "Hourly Consultation",
        rate: 600,
        payout: 500,
        status: "Completed",
        isLive: false,
        completed: true,
        meetUrl: "https://meet.google.com/jkl-zxcv-bnm",
        reviewed: true,
        payoutTransferred: true
      },
      {
        id: "sess-comp-3",
        client: "Priya Sharma",
        clientEmail: "priya@fincorp.com",
        expert: "Sunita Rao",
        expertEmail: "sunita.rao@registry.com",
        topic: "Corporate GST Structuring & Valuation Readiness",
        when: "2026-09-01, 10:00 AM",
        completedAt: "2026-09-01 11:15 AM",
        type: "Hourly Consultation",
        rate: 750,
        payout: 600,
        status: "Completed",
        isLive: false,
        completed: true,
        meetUrl: "https://meet.google.com/abc-defg-hij",
        reviewed: true,
        payoutTransferred: true
      },
      {
        id: "sess-comp-4",
        client: "Kavita Nair (Aura Wellness)",
        clientEmail: "kavita@aurawellness.in",
        expert: "Krishnan Iyer",
        expertEmail: "krishnan.iyer@registry.com",
        topic: "Executive POSH Policy & Leadership Restructuring",
        when: "2026-09-09, 05:00 PM",
        completedAt: "2026-09-09 06:00 PM",
        type: "Hourly Consultation",
        rate: 650,
        payout: 500,
        status: "Completed",
        isLive: false,
        completed: true,
        meetUrl: "https://meet.google.com/xyz-uvwx-rst",
        reviewed: false,
        payoutTransferred: true
      },
      {
        id: "sess-comp-5",
        client: "Harsh Vardhan (Zenith Logistics)",
        clientEmail: "harsh@zenithlogistics.in",
        expert: "Vikram Deshpande",
        expertEmail: "vikram.d@registry.com",
        topic: "Plant Shop-Floor Lean Six Sigma Overhaul",
        when: "2026-09-10, 11:30 AM",
        completedAt: "2026-09-10 01:00 PM",
        type: "Project Advisory",
        rate: 2250,
        payout: 1800,
        status: "Completed",
        isLive: false,
        completed: true,
        meetUrl: "https://meet.google.com/uvw-xyz1-234",
        reviewed: false,
        payoutTransferred: false
      }
    ];
  });

  const syncPlatformSessions = (updated: any[]) => {
    setPlatformSessions(updated);
    localStorage.setItem("app_platform_sessions", JSON.stringify(updated));
    mongoDB.syncKv("app_platform_sessions", updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app_platform_sessions_updated", { detail: updated }));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: "app_platform_sessions" } }));
      window.dispatchEvent(new CustomEvent("mongo_db_updated"));
    }
  };

  // Dynamically scan and merge any bookings from client_upcoming_* and expert_accepted_sessions_*
  useEffect(() => {
    const scanAllActiveSessions = () => {
      try {
        const deletedIds = new Set<string>();
        const savedGlobal = localStorage.getItem("app_deleted_sessions");
        if (savedGlobal) {
          try {
            const parsed = JSON.parse(savedGlobal);
            if (Array.isArray(parsed)) parsed.forEach((id: string) => deletedIds.add(id));
          } catch {}
        }

        setPlatformSessions(prevSessions => {
          const map = new Map<string, any>();
          prevSessions.forEach(s => { 
            if (s && s.id && !deletedIds.has(s.id)) map.set(s.id, s); 
          });

          // Scan client_upcoming_* keys
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("client_upcoming_")) {
              const raw = localStorage.getItem(key);
              if (raw) {
                try {
                  const arr = JSON.parse(raw);
                  if (Array.isArray(arr)) {
                    arr.forEach((b: any) => {
                      if (b && b.id && !deletedIds.has(b.id)) {
                        if (b.status?.toLowerCase().includes("decline")) {
                          if (map.has(b.id)) {
                            map.set(b.id, {
                              ...map.get(b.id),
                              status: "Declined by Expert",
                              completed: false,
                              isLive: false
                            });
                          }
                          return;
                        }

                        const isDone = b.completed === true || b.status?.toLowerCase().includes("complete");
                        const isLiveSession = !isDone && (b.status?.toLowerCase().includes("live") || b.status?.toLowerCase().includes("meet link sent") || (b.meetUrl && (b.when?.toLowerCase().includes("today") || b.when?.toLowerCase().includes("now"))));
                        const clientName = b.client || b.clientName || "Client ABC";
                        const clientEmail = b.clientEmail || "";
                        const expertName = b.expert || b.expertName || "Senior Expert";
                        const expertEmail = b.expertEmail || "";

                        if (map.has(b.id)) {
                          const exist = map.get(b.id);
                          map.set(b.id, {
                            ...exist,
                            ...b,
                            client: clientName !== "Corporate Client" ? clientName : (exist.client || clientName),
                            clientEmail: clientEmail || exist.clientEmail,
                            expert: expertName !== "Senior Advisor" ? expertName : (exist.expert || expertName),
                            expertEmail: expertEmail || exist.expertEmail,
                            completed: isDone || exist.completed,
                            reviewed: b.reviewed === true || exist.reviewed,
                            meetUrl: b.meetUrl && b.meetUrl.trim() !== "" ? b.meetUrl : (exist.meetUrl || ""),
                            meetCode: b.meetCode || exist.meetCode || "",
                            isLive: isLiveSession || exist.isLive
                          });
                        } else {
                          map.set(b.id, {
                            id: b.id,
                            client: clientName,
                            clientEmail: clientEmail,
                            expert: expertName,
                            expertEmail: expertEmail,
                            topic: b.topic || "Executive Advisory Consultation",
                            when: b.when || b.date || "Scheduled Time",
                            type: b.type || b.serviceType || "Hourly Consultation",
                            rate: b.rate || b.price || 600,
                            payout: b.payout || (b.rate ? Math.round(b.rate * 0.85) : 500),
                            status: b.status || (isDone ? "Completed" : "Confirmed"),
                            isLive: isLiveSession,
                            completed: isDone,
                            completedAt: b.completedAt || (isDone ? new Date().toISOString() : ""),
                            meetUrl: b.meetUrl || "",
                            meetCode: b.meetCode || "",
                            reviewed: b.reviewed === true,
                            payoutTransferred: isDone
                          });
                        }
                      }
                    });
                  }
                } catch {}
              }
            }
          }

          // Scan expert_accepted_sessions_* keys
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("expert_accepted_sessions_")) {
              const raw = localStorage.getItem(key);
              if (raw) {
                try {
                  const arr = JSON.parse(raw);
                  if (Array.isArray(arr)) {
                    arr.forEach((s: any) => {
                      if (s && s.id && !deletedIds.has(s.id)) {
                        const isDone = s.completed === true || s.status?.toLowerCase().includes("complete");
                        const isLiveSession = !isDone && (s.status?.toLowerCase().includes("live") || (s.meetUrl && (s.when?.toLowerCase().includes("today") || s.when?.toLowerCase().includes("now"))));
                        
                        if (map.has(s.id)) {
                          const exist = map.get(s.id);
                          map.set(s.id, {
                            ...exist,
                            ...s,
                            client: s.client && s.client !== "Corporate Client" ? s.client : (exist.client || s.client || "Client ABC"),
                            clientEmail: s.clientEmail || exist.clientEmail || "",
                            expert: s.expert && s.expert !== "Senior Advisor" ? s.expert : (exist.expert || s.expert || "Senior Expert"),
                            expertEmail: s.expertEmail || exist.expertEmail || "",
                            completed: isDone || exist.completed,
                            meetUrl: s.meetUrl && s.meetUrl.trim() !== "" ? s.meetUrl : (exist.meetUrl || ""),
                            meetCode: s.meetCode || exist.meetCode || ""
                          });
                        } else {
                          map.set(s.id, {
                            id: s.id,
                            client: s.client || "Client ABC",
                            clientEmail: s.clientEmail || "",
                            expert: s.expert || "Senior Expert",
                            expertEmail: s.expertEmail || "",
                            topic: s.topic || "Executive Advisory Consultation",
                            when: s.when || "Scheduled Time",
                            type: s.type || "Hourly Consultation",
                            rate: s.rate || (s.payout ? Math.round(s.payout * 1.25) : 750),
                            payout: s.payout || 600,
                            status: s.status || (isDone ? "Completed" : "Confirmed — Meet Link Ready"),
                            isLive: isLiveSession,
                            completed: isDone,
                            completedAt: s.completedAt || "",
                            meetUrl: s.meetUrl || "",
                            meetCode: s.meetCode || "",
                            reviewed: s.reviewed === true,
                            payoutTransferred: isDone
                          });
                        }
                      }
                    });
                  }
                } catch {}
              }
            }
          }

          // Scan expert_requests_* keys for incoming/pending requests
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("expert_requests_")) {
              const raw = localStorage.getItem(key);
              if (raw) {
                try {
                  const arr = JSON.parse(raw);
                  if (Array.isArray(arr)) {
                    arr.forEach((r: any) => {
                      if (r && r.id && !deletedIds.has(r.id)) {
                        if (!map.has(r.id)) {
                          map.set(r.id, {
                            id: r.id,
                            client: r.client || "Client ABC",
                            clientEmail: r.clientEmail || "",
                            expert: r.expert || "Senior Expert",
                            expertEmail: r.expertEmail || "",
                            topic: r.topic || "Executive Advisory Consultation",
                            when: r.when || "Scheduled Time",
                            type: r.type || "Hourly Consultation",
                            rate: r.rate || 600,
                            payout: Math.round((r.rate || 600) * 0.85),
                            status: r.status || "Pending Expert Acceptance",
                            isLive: false,
                            completed: false,
                            completedAt: "",
                            meetUrl: "",
                            meetCode: "",
                            reviewed: false,
                            payoutTransferred: false
                          });
                        }
                      }
                    });
                  }
                } catch {}
              }
            }
          }

          const merged = Array.from(map.values()).filter(s => s && s.id && !deletedIds.has(s.id));
          localStorage.setItem("app_platform_sessions", JSON.stringify(merged));
          return merged;
        });
      } catch {}
    };

    scanAllActiveSessions();
    window.addEventListener("storage", scanAllActiveSessions);
    window.addEventListener("mongo_kv_updated", scanAllActiveSessions);
    window.addEventListener("mongo_db_updated", scanAllActiveSessions);
    window.addEventListener("app_platform_sessions_updated", scanAllActiveSessions);
    const scanTimer = setInterval(scanAllActiveSessions, 2500);

    return () => {
      window.removeEventListener("storage", scanAllActiveSessions);
      window.removeEventListener("mongo_kv_updated", scanAllActiveSessions);
      window.removeEventListener("mongo_db_updated", scanAllActiveSessions);
      window.removeEventListener("app_platform_sessions_updated", scanAllActiveSessions);
      clearInterval(scanTimer);
    };
  }, []);

  // Helper: Cross-reference reviews submitted by clients for completed sessions
  const getSessionReviewStatus = (s: any) => {
    const sClient = (s.client || "").toLowerCase().trim();
    const sExpert = (s.expert || "").toLowerCase().trim();

    const matchedReview = platformReviews.find((r: any) => {
      if (!r) return false;
      const rClient = (r.clientName || "").toLowerCase().trim();
      const rExpert = (r.expertName || "").toLowerCase().trim();

      const clientMatch = rClient === sClient || sClient.includes(rClient) || rClient.includes(sClient);
      const expertMatch = rExpert === sExpert || sExpert.includes(rExpert) || rExpert.includes(sExpert) || (sExpert.includes("jk") && rExpert === "jk");
      return clientMatch && expertMatch;
    });

    if (matchedReview) {
      return {
        hasReview: true,
        rating: matchedReview.rating || 5,
        comment: matchedReview.comment || "Consultation completed successfully.",
        date: matchedReview.date || s.when,
        status: matchedReview.visibleToExpert ? "Approved & Live" : "Pending Moderation"
      };
    }

    if (s.reviewed) {
      return {
        hasReview: true,
        rating: 5,
        comment: "Client submitted favorable session rating.",
        date: s.when,
        status: "Submitted"
      };
    }

    return {
      hasReview: false,
      rating: null,
      comment: null,
      date: null,
      status: "Not Submitted (Pending Review)"
    };
  };

  // Action: Admin marks session as completed
  const handleMarkSessionCompleted = (sessId: string) => {
    const target = platformSessions.find(s => s.id === sessId);
    if (!target) return;
    if (!confirm(`Mark consultation "${target.topic}" between ${target.client} and ${target.expert} as Completed?\n\nThis will trigger the Client to submit Rating & Review, and release escrow payout.`)) {
      return;
    }

    const updated = platformSessions.map(s => {
      if (s.id === sessId) {
        return {
          ...s,
          completed: true,
          isLive: false,
          status: "Completed",
          completedAt: new Date().toISOString(),
          payoutTransferred: true
        };
      }
      return s;
    });
    syncPlatformSessions(updated);

    // Sync to all client_upcoming_* keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("client_upcoming_")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              let modified = false;
              const next = arr.map((b: any) => {
                if (b.id === sessId) {
                  modified = true;
                  return { ...b, completed: true, status: "Completed — Ready for Review", completedAt: new Date().toISOString() };
                }
                return b;
              });
              if (modified) {
                localStorage.setItem(key, JSON.stringify(next));
                mongoDB.syncKv(key, next);
              }
            }
          } catch {}
        }
      }
    }

    // Sync to all expert_accepted_sessions_* keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("expert_accepted_sessions_")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              let modified = false;
              const next = arr.map((s: any) => {
                if (s.id === sessId) {
                  modified = true;
                  return { ...s, completed: true, status: "Completed", completedAt: new Date().toISOString() };
                }
                return s;
              });
              if (modified) {
                localStorage.setItem(key, JSON.stringify(next));
                mongoDB.syncKv(key, next);
              }
            }
          } catch {}
        }
      }
    }

    // Notifications
    notificationService.add({
      target: "expert",
      recipientId: target.expertEmail || target.expert,
      type: "session",
      title: "Consultation Marked Completed by Admin ✅",
      message: `Session "${target.topic}" with ${target.client} marked Completed. Payout of ₹${target.payout || 600} disbursed to your wallet.`,
      actionLink: "expert"
    });
    notificationService.add({
      target: "client",
      recipientId: target.clientEmail || target.client,
      type: "session",
      title: "Consultation Concluded — Rate Your Expert ⭐",
      message: `Your session with ${target.expert} is complete. Please share your rating & review feedback!`,
      actionLink: "client"
    });

    confetti({ particleCount: 50, spread: 50, origin: { y: 0.5 } });
    alert(`✅ Consultation Marked Completed!\nClient invited to rate expert, and payout disbursed.`);
  };

  // Action: Admin deletes session
  const handleDeleteSession = (sessId: string) => {
    const target = platformSessions.find(s => s.id === sessId);
    if (!confirm(`Are you sure you want to delete session "${target?.topic || sessId}"? This will remove it from all active records.`)) {
      return;
    }

    try {
      const savedGlobal = localStorage.getItem("app_deleted_sessions");
      const existingGlobal = savedGlobal ? JSON.parse(savedGlobal) : [];
      const nextGlobal = Array.from(new Set([...existingGlobal, sessId]));
      localStorage.setItem("app_deleted_sessions", JSON.stringify(nextGlobal));
      mongoDB.syncKv("app_deleted_sessions", nextGlobal);
    } catch {}

    const updated = platformSessions.filter(s => s.id !== sessId);
    syncPlatformSessions(updated);

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("client_upcoming_") || key.startsWith("expert_accepted_sessions_"))) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const arr = JSON.parse(raw);
              if (Array.isArray(arr)) {
                const filtered = arr.filter((item: any) => item && item.id !== sessId);
                if (filtered.length !== arr.length) {
                  localStorage.setItem(key, JSON.stringify(filtered));
                  mongoDB.syncKv(key, filtered);
                }
              }
            } catch {}
          }
        }
      }
    } catch {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: "client_upcoming" } }));
      window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key: "app_platform_sessions" } }));
      window.dispatchEvent(new CustomEvent("app_platform_sessions_updated"));
      window.dispatchEvent(new Event("storage"));
    }
  };

  // Action: Admin disburses payout from escrow to expert wallet
  const handleDisbursePayout = (sessId: string) => {
    const target = platformSessions.find(s => s.id === sessId);
    if (!target) return;
    const amt = target.payout || 600;
    if (!confirm(`Release and disburse payout of ₹${amt.toLocaleString("en-IN")} to ${target.expert}'s wallet now?`)) {
      return;
    }

    const updated = platformSessions.map(s => {
      if (s.id === sessId) {
        return { ...s, payoutTransferred: true };
      }
      return s;
    });
    syncPlatformSessions(updated);

    // Credit expert wallet in localStorage & mongoDB
    const expEmailKey = (target.expertEmail || target.expert || "").toLowerCase().trim();
    const walletKey = `expert_wallet_${expEmailKey}`;
    const curWall = Number(localStorage.getItem(walletKey) || "0");
    const nextWall = curWall + amt;
    localStorage.setItem(walletKey, String(nextWall));
    mongoDB.syncKv(walletKey, String(nextWall));

    // Also credit JK fallback if target is JK
    if (expEmailKey.includes("jk") || target.expert?.toLowerCase().includes("jk")) {
      ["expert_wallet_jk", "expert_wallet_jk@registry.com"].forEach(wk => {
        const val = Number(localStorage.getItem(wk) || "0") + amt;
        localStorage.setItem(wk, String(val));
        mongoDB.syncKv(wk, String(val));
      });
    }

    notificationService.add({
      target: "expert",
      recipientId: target.expertEmail || target.expert,
      type: "wallet",
      title: "Escrow Payout Released by Admin 💳",
      message: `₹${amt.toLocaleString("en-IN")} from completed session "${target.topic}" has been credited to your wallet balance.`,
      actionLink: "expert"
    });

    confetti({ particleCount: 60, spread: 60, origin: { y: 0.5 } });
    alert(`✅ Payout Disbursed Successfully!\n₹${amt.toLocaleString("en-IN")} credited to ${target.expert}'s registered account.`);
  };

  // Action: Admin starts live meeting
  const handleStartLiveMeeting = (sessId: string) => {
    const target = platformSessions.find(s => s.id === sessId);
    if (!target) return;

    const meetUrl = target.meetUrl;
    if (!meetUrl) {
      alert(`⚠️ Cannot launch live meeting for "${target.topic}".\n\nThe Expert has not provided a Google Meet link yet for this session.`);
      return;
    }

    const updated = platformSessions.map(s => {
      if (s.id === sessId) {
        return {
          ...s,
          isLive: true,
          status: "Live — Call Connected",
          meetUrl: meetUrl,
          startedAt: "Active now (Admin Launched)"
        };
      }
      return s;
    });
    syncPlatformSessions(updated);

    alert(`🔴 Session Moved to LIVE Now!\n\nClient: ${target.client}\nExpert: ${target.expert}\nGoogle Meet: ${meetUrl}\n\nBoth participants and Admin can join the active Google Meet consultation.`);
  };

  // Action: Admin creates manual session
  const handleCreateNewSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessClient.trim() || !newSessTopic.trim()) {
      alert("Please enter Client Name and Consultation Topic.");
      return;
    }

    const rnd = () => Math.random().toString(36).substring(2, 5);
    const meetCode = `${rnd()}-${rnd()}-${rnd()}`;
    const meetUrl = `https://meet.google.com/${meetCode}`;

    const newSess = {
      id: `sess-${Date.now()}`,
      client: newSessClient.trim(),
      clientEmail: `${newSessClient.toLowerCase().replace(/[^a-z0-9]/g, "")}@client.com`,
      expert: newSessExpert,
      expertEmail: `${newSessExpert.toLowerCase().replace(/[^a-z0-9]/g, "")}@registry.com`,
      topic: newSessTopic.trim(),
      when: newSessIsLive ? "Today (Live)" : newSessWhen,
      type: newSessType === "Hourly" ? "Hourly Consultation" : "Project Advisory",
      rate: newSessRate,
      payout: Math.round(newSessRate * 0.85),
      status: newSessIsLive ? "Live — Call Connected" : "Confirmed — Meet Link Sent",
      isLive: newSessIsLive,
      completed: false,
      meetUrl: meetUrl,
      meetCode: meetCode,
      startedAt: newSessIsLive ? "Active now" : "",
      reviewed: false,
      payoutTransferred: false
    };

    const updated = [newSess, ...platformSessions];
    syncPlatformSessions(updated);

    setShowNewSessionModal(false);
    setNewSessClient("");
    setNewSessTopic("");
    confetti({ particleCount: 50, spread: 50 });
    alert(`🎉 New Consultation Session Registered into Operations Ledger!\n\nClient: ${newSess.client}\nExpert: ${newSess.expert}\nStatus: ${newSess.status}\nGoogle Meet: ${meetUrl}`);
  };



  // Expert Markup Pricing State
  const [markupState, setMarkupState] = useState<Record<string, { base: number; markup: number }>>(() =>
    (experts || []).reduce((acc, e) => {
      if (!e) return acc;
      acc[e.id] = { base: e.baseRate || (e.rate ? e.rate - 150 : 100), markup: e.adminMarkup || 150 };
      return acc;
    }, {} as Record<string, { base: number; markup: number }>)
  );

  useEffect(() => {
    setMarkupState((prev) => {
      const next = { ...prev };
      (experts || []).forEach((e) => {
        if (e && !next[e.id]) {
          next[e.id] = { base: e.baseRate || (e.rate ? e.rate - 150 : 100), markup: e.adminMarkup || 150 };
        }
      });
      return next;
    });
  }, [experts]);

  const handleMarkupChange = (id: string, fieldName: "base" | "markup", val: number) => {
    setMarkupState((prev) => ({
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
    alert(`✅ Saved Pricing Rule to MongoDB! Client Price updated to ₹${item.base + item.markup}/hr (Base ₹${item.base} + Admin Profit ₹${item.markup}).`);
  };

  const handleApprove = async (id: string) => {
    const item = pendingVerifications.find((v) => v.id === id);
    if (item && onApproveVerification) {
      await onApproveVerification(item);
      confetti({ particleCount: 50, spread: 50, origin: { y: 0.5 } });
    }
  };

  const filteredExperts = experts.filter((e) => {
    if (!expertSearch.trim()) return true;
    const q = expertSearch.toLowerCase();
    return e.name.toLowerCase().includes(q) || (e.field && e.field.toLowerCase().includes(q)) || (e.company && e.company.toLowerCase().includes(q));
  });

  const pendingReviewsCount = (Array.isArray(platformReviews) ? platformReviews : []).filter((r) => !r?.visibleToExpert).length;

  const liveSessionsList = platformSessions.filter(s => !s.completed && (s.isLive || s.status?.toLowerCase().includes("live")));
  const scheduledSessionsList = platformSessions.filter(s => !s.completed && !s.isLive && !s.status?.toLowerCase().includes("live"));
  const completedSessionsList = platformSessions.filter(s => s.completed || s.status?.toLowerCase().includes("completed"));

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-amber-500 selection:text-black ${isLight ? "text-slate-900" : "text-slate-100"}`} style={{ background: T.ink2 }}>
      {/* ==============================================================
          EXECUTIVE TOP COMMAND HEADER
      ============================================================== */}
      <header
        className="w-full sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between border-b backdrop-blur-md"
        style={{ background: isLight ? "#FFFFFF" : "rgba(7, 11, 16, 0.95)", borderColor: T.lineInk }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPage("landing")}
              className="bg-transparent border-0 p-0 cursor-pointer hover:opacity-90 transition-opacity"
              title="Return to Mentora Home"
            >
              <img
                src={isLight ? "/mentora-logo-horizontal-light.png" : "/mentora-logo-horizontal-dark.png"}
                alt="Mentora — Empowering Future Leaders"
                className="h-9 w-auto object-contain drop-shadow-sm brightness-[1.02] contrast-[1.05]"
              />
            </button>
            <div className="hidden sm:block border-l pl-3" style={{ borderColor: T.lineInk }}>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border"
                  style={{
                    background: isLight ? "#FEF3C7" : "rgba(201,160,99,0.15)",
                    color: isLight ? "#92400E" : T.brassLight,
                    borderColor: isLight ? "#FDE68A" : "rgba(201,160,99,0.4)"
                  }}
                >
                  Governance HQ
                </span>
              </div>
              <p className={`text-[10px] font-mono mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                Executive Command Center · Standalone Portal
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-4 border-l" style={{ borderColor: T.lineInk }}>
            <button
              onClick={onOpenMongoModal}
              className={`text-[11px] px-3 py-1.5 rounded-md font-mono flex items-center gap-1.5 cursor-pointer transition-all shadow-sm ${
                isLight 
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200" 
                  : "bg-emerald-950/80 text-emerald-300 border border-emerald-600/70 hover:bg-emerald-900"
              }`}
              title="Inspect MongoDB connection details"
            >
              <Database size={13} className="animate-pulse" />
              <span>MongoDB Atlas: Connected</span>
            </button>
            <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>System: 100% Operational</span>
            </div>
          </div>
        </div>

        {/* Executive Right Controls */}
        <div className="flex items-center gap-3">
          {/* Quick Bridge Buttons to All Portals */}
          <div className="hidden xl:flex items-center gap-1.5">
            <button
              onClick={() => setPage("landing")}
              className="text-xs px-2.5 py-1 rounded font-medium flex items-center gap-1 cursor-pointer transition-all border hover:border-amber-400"
              style={{
                background: isLight ? "#F1F5F9" : "rgba(255,255,255,0.04)",
                borderColor: isLight ? "#CBD5E1" : "rgba(201,160,99,0.35)",
                color: isLight ? "#92400E" : T.brassLight
              }}
              title="Public Home"
            >
              <ExternalLink size={12} /> Home
            </button>
            <button
              onClick={() => setPage("client")}
              className="text-xs px-2.5 py-1 rounded font-medium flex items-center gap-1 cursor-pointer transition-all border hover:border-amber-400"
              style={{
                background: isLight ? "#F1F5F9" : "rgba(255,255,255,0.04)",
                borderColor: isLight ? "#CBD5E1" : "rgba(201,160,99,0.35)",
                color: isLight ? "#92400E" : T.brassLight
              }}
              title="Client Advisory Portal"
            >
              Client
            </button>
            <button
              onClick={() => setPage("expert")}
              className="text-xs px-2.5 py-1 rounded font-medium flex items-center gap-1 cursor-pointer transition-all border hover:border-amber-400"
              style={{
                background: isLight ? "#F1F5F9" : "rgba(255,255,255,0.04)",
                borderColor: isLight ? "#CBD5E1" : "rgba(201,160,99,0.35)",
                color: isLight ? "#92400E" : T.brassLight
              }}
              title="Expert Consultation Portal"
            >
              Expert
            </button>
            <button
              onClick={() => setPage("about")}
              className="text-xs px-2.5 py-1 rounded font-medium flex items-center gap-1 cursor-pointer transition-all border hover:border-amber-400"
              style={{
                background: isLight ? "#F1F5F9" : "rgba(255,255,255,0.04)",
                borderColor: isLight ? "#CBD5E1" : "rgba(201,160,99,0.35)",
                color: isLight ? "#92400E" : T.brassLight
              }}
              title="About Mentora"
            >
              About
            </button>
            <button
              onClick={() => setPage("blogs")}
              className="text-xs px-2.5 py-1 rounded font-medium flex items-center gap-1 cursor-pointer transition-all border hover:border-amber-400"
              style={{
                background: isLight ? "#F1F5F9" : "rgba(255,255,255,0.04)",
                borderColor: isLight ? "#CBD5E1" : "rgba(201,160,99,0.35)",
                color: isLight ? "#92400E" : T.brassLight
              }}
              title="Blogs & Articles"
            >
              Blogs
            </button>
          </div>

          {/* Theme Toggle Button (☀️ Light / 🌙 Dark) */}
          <button
            type="button"
            onClick={handleToggleThemeLocal}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-300 border select-none ${
              isLight 
                ? "bg-white text-slate-700 border-slate-300 hover:border-amber-500 shadow-sm" 
                : "bg-[#111A27] text-slate-200 border-white/15 hover:border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
            }`}
            title={isLight ? "Switch to Dark Mode 🌙" : "Switch to Light Mode ☀️"}
            aria-label="Toggle Theme Mode"
          >
            {isLight ? (
              <>
                <Sun size={13} className="text-amber-500 fill-amber-500/30" />
                <span className="text-[11px] font-medium">Light</span>
              </>
            ) : (
              <>
                <Moon size={13} className="text-cyan-400 fill-cyan-400/30" />
                <span className="text-[11px] font-medium">Dark</span>
              </>
            )}
          </button>

          {/* Admin Real-Time Notification Bell */}
          <div className="border-l border-r px-2" style={{ borderColor: T.lineInk }}>
            <NotificationCenter role="admin" recipientId="admin" darkTheme={!isLight} onNavigate={setPage} />
          </div>

          {/* Admin Profile & Sign Out */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col text-right">
              <span className={`text-xs font-bold leading-tight ${isLight ? "text-slate-900" : "text-white"}`}>Super Admin</span>
              <span className={`text-[10px] font-mono ${isLight ? "text-amber-800" : "text-amber-300/80"}`}>Chief Governance Officer</span>
            </div>
            <div
              className="w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shadow-inner"
              style={{
                background: isLight ? "#FEF3C7" : T.ink3,
                borderColor: isLight ? "#F59E0B" : T.brass,
                color: isLight ? "#92400E" : T.brassLight
              }}
            >
              GO
            </div>
            <button
              onClick={() => {
                if (window.confirm("Sign out of Admin Governance Portal?")) {
                  if (onLogout) {
                    onLogout();
                  } else {
                    setPage("landing");
                  }
                }
              }}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isLight ? "text-slate-500 hover:text-rose-700 hover:bg-rose-50" : "text-slate-400 hover:text-rose-300 hover:bg-rose-950/40"
              }`}
              title="Sign Out of Admin Portal"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ==============================================================
          MAIN WORKSPACE LAYOUT (SIDEBAR + DESK CANVAS)
      ============================================================== */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Navigation Sidebar */}
        <aside
          className="w-full md:w-64 shrink-0 border-r flex flex-col p-4 gap-1.5 overflow-y-auto"
          style={{ background: isLight ? "#FFFFFF" : "rgba(11, 17, 25, 0.98)", borderColor: T.lineInk }}
        >
          <div className={`pb-3 mb-2 border-b text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`} style={{ borderColor: T.lineInk }}>
            Executive Desks
          </div>

          <button
            onClick={() => setActiveDesk("kpi")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDesk === "kpi" 
                ? "text-slate-950 shadow-md font-bold" 
                : isLight ? "text-slate-700 hover:bg-slate-100 hover:text-slate-950" : "text-slate-300 hover:bg-slate-800/60"
            }`}
            style={{
              background: activeDesk === "kpi" ? T.goldGradient : "transparent"
            }}
          >
            <div className="flex items-center gap-2.5">
              <TrendingUp size={16} />
              <span>Overview & KPIs</span>
            </div>
            <ChevronRight size={14} className={activeDesk === "kpi" ? "opacity-100" : "opacity-40"} />
          </button>

          <button
            onClick={() => setActiveDesk("kyc")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDesk === "kyc" 
                ? "text-slate-950 shadow-md font-bold" 
                : isLight ? "text-slate-700 hover:bg-slate-100 hover:text-slate-950" : "text-slate-300 hover:bg-slate-800/60"
            }`}
            style={{
              background: activeDesk === "kyc" ? T.goldGradient : "transparent"
            }}
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={16} />
              <span>Document Audit & KYC</span>
            </div>
            {pendingVerifications.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500 text-slate-950">
                {pendingVerifications.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveDesk("pricing")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDesk === "pricing" 
                ? "text-slate-950 shadow-md font-bold" 
                : isLight ? "text-slate-700 hover:bg-slate-100 hover:text-slate-950" : "text-slate-300 hover:bg-slate-800/60"
            }`}
            style={{
              background: activeDesk === "pricing" ? T.goldGradient : "transparent"
            }}
          >
            <div className="flex items-center gap-2.5">
              <IndianRupee size={16} />
              <span>Expert Rates & Markups</span>
            </div>
            <span className={`text-[10px] font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>{experts.length}</span>
          </button>

          <button
            onClick={() => setActiveDesk("spotlight")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDesk === "spotlight" 
                ? "text-slate-950 shadow-md font-bold" 
                : isLight ? "text-slate-700 hover:bg-slate-100 hover:text-slate-950" : "text-slate-300 hover:bg-slate-800/60"
            }`}
            style={{
              background: activeDesk === "spotlight" ? T.goldGradient : "transparent"
            }}
          >
            <div className="flex items-center gap-2.5">
              <Sparkles size={16} />
              <span>Hero 3D Spotlight Cards</span>
            </div>
            <ChevronRight size={14} className={activeDesk === "spotlight" ? "opacity-100" : "opacity-40"} />
          </button>

          <button
            onClick={() => setActiveDesk("reviews")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDesk === "reviews" 
                ? "text-slate-950 shadow-md font-bold" 
                : isLight ? "text-slate-700 hover:bg-slate-100 hover:text-slate-950" : "text-slate-300 hover:bg-slate-800/60"
            }`}
            style={{
              background: activeDesk === "reviews" ? T.goldGradient : "transparent"
            }}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare size={16} />
              <span>Client Reviews Moderation</span>
            </div>
            {pendingReviewsCount > 0 ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500 text-slate-950">
                {pendingReviewsCount}
              </span>
            ) : (
              <span className={`text-[10px] font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>{platformReviews.length}</span>
            )}
          </button>

          <button
            onClick={() => setActiveDesk("sessions")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDesk === "sessions" 
                ? "text-slate-950 shadow-md font-bold" 
                : isLight ? "text-slate-700 hover:bg-slate-100 hover:text-slate-950" : "text-slate-300 hover:bg-slate-800/60"
            }`}
            style={{
              background: activeDesk === "sessions" ? T.goldGradient : "transparent"
            }}
          >
            <div className="flex items-center gap-2.5">
              <Video size={16} />
              <span>Meeting & Session Ops</span>
            </div>
            {liveSessionsList.length > 0 ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500 text-white animate-pulse">
                ● {liveSessionsList.length} Live
              </span>
            ) : (
              <span className={`text-[10px] font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                {platformSessions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveDesk("broadcast")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDesk === "broadcast" 
                ? "text-slate-950 shadow-md font-bold" 
                : isLight ? "text-slate-700 hover:bg-slate-100 hover:text-slate-950" : "text-slate-300 hover:bg-slate-800/60"
            }`}
            style={{
              background: activeDesk === "broadcast" ? T.goldGradient : "transparent"
            }}
          >
            <div className="flex items-center gap-2.5">
              <Bell size={16} />
              <span>Notification Management</span>
            </div>
            <ChevronRight size={14} className={activeDesk === "broadcast" ? "opacity-100" : "opacity-40"} />
          </button>

          <button
            onClick={() => setActiveDesk("diagnostics")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDesk === "diagnostics" 
                ? "text-slate-950 shadow-md font-bold" 
                : isLight ? "text-slate-700 hover:bg-slate-100 hover:text-slate-950" : "text-slate-300 hover:bg-slate-800/60"
            }`}
            style={{
              background: activeDesk === "diagnostics" ? T.goldGradient : "transparent"
            }}
          >
            <div className="flex items-center gap-2.5">
              <Database size={16} />
              <span>Database & Diagnostics</span>
            </div>
            <ChevronRight size={14} className={activeDesk === "diagnostics" ? "opacity-100" : "opacity-40"} />
          </button>

          <button
            onClick={() => setActiveDesk("expertise")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDesk === "expertise" 
                ? "text-slate-950 shadow-md font-bold" 
                : isLight ? "text-slate-700 hover:bg-slate-100 hover:text-slate-950" : "text-slate-300 hover:bg-slate-800/60"
            }`}
            style={{
              background: activeDesk === "expertise" ? T.goldGradient : "transparent"
            }}
          >
            <div className="flex items-center gap-2.5">
              <Layers size={16} />
              <span>Expertise Fields Manager</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500 text-slate-950 font-mono">
              {expertiseFields.length}
            </span>
          </button>

          <button
            onClick={() => setActiveDesk("availability")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDesk === "availability" 
                ? "text-slate-950 shadow-md font-bold" 
                : isLight ? "text-slate-700 hover:bg-slate-100 hover:text-slate-950" : "text-slate-300 hover:bg-slate-800/60"
            }`}
            style={{
              background: activeDesk === "availability" ? T.goldGradient : "transparent"
            }}
          >
            <div className="flex items-center gap-2.5">
              <CalendarDays size={16} />
              <span>Expert Availability</span>
            </div>
            <ChevronRight size={14} className={activeDesk === "availability" ? "opacity-100" : "opacity-40"} />
          </button>

          <button
            onClick={() => setActiveDesk("project_reviews")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDesk === "project_reviews" 
                ? "text-slate-950 shadow-md font-bold" 
                : isLight ? "text-slate-700 hover:bg-slate-100 hover:text-slate-950" : "text-slate-300 hover:bg-slate-800/60"
            }`}
            style={{
              background: activeDesk === "project_reviews" ? T.goldGradient : "transparent"
            }}
          >
            <div className="flex items-center gap-2.5">
              <FileCheck size={16} />
              <span>Project Review OPS</span>
            </div>
            <ChevronRight size={14} className={activeDesk === "project_reviews" ? "opacity-100" : "opacity-40"} />
          </button>

          <button
            onClick={() => setActiveDesk("blogs")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDesk === "blogs" 
                ? "text-slate-950 shadow-md font-bold" 
                : isLight ? "text-slate-700 hover:bg-slate-100 hover:text-slate-950" : "text-slate-300 hover:bg-slate-800/60"
            }`}
            style={{
              background: activeDesk === "blogs" ? T.goldGradient : "transparent"
            }}
          >
            <div className="flex items-center gap-2.5">
              <BookOpen size={16} />
              <span>Blogs & Articles</span>
            </div>
            <ChevronRight size={14} className={activeDesk === "blogs" ? "opacity-100" : "opacity-40"} />
          </button>

          {/* Quick Client Website Shortcut Card */}

          <div className="mt-auto pt-4 border-t" style={{ borderColor: T.lineInk }}>
            <div
              className="p-3.5 rounded-xl border space-y-2.5 shadow-lg"
              style={{
                background: isLight ? "#F8FAFC" : T.ink,
                borderColor: isLight ? "#CBD5E1" : "rgba(201,160,99,0.25)"
              }}
            >
              <div className={`flex items-center gap-2 ${isLight ? "text-amber-800" : "text-amber-300"}`}>
                <Sparkles size={14} />
                <span className="text-xs font-bold">Public Portal Sync</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                All changes made in this governance console synchronize to MongoDB and reflect immediately on the client site.
              </p>
              <button
                onClick={() => setPage("client")}
                className={`w-full text-xs py-1.5 px-2 rounded font-semibold text-center block transition-all cursor-pointer border ${
                  isLight 
                    ? "bg-white hover:bg-slate-100 text-amber-800 border-slate-300 shadow-sm" 
                    : "bg-slate-800 hover:bg-slate-700 text-amber-200 border-slate-700"
                }`}
              >
                Launch Client Search ↗
              </button>
            </div>
          </div>
        </aside>

        {/* Main Canvas / Active Desk View */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto space-y-8 max-w-7xl mx-auto w-full">
          {/* ==========================================================
              DESK 1: OVERVIEW & EXECUTIVE KPIS
          ========================================================== */}
          {activeDesk === "kpi" && (
            <div className="space-y-8 animate-fadeIn">
              <div>
                <span className="text-xs uppercase font-bold tracking-widest text-amber-500">Desk 01 • Executive Metrics</span>
                <h1 className={`text-2xl sm:text-3xl font-serif font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>
                  Platform Governance Overview
                </h1>
                <p className={`text-xs sm:text-sm mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Holistic view of gross transaction volumes, escrow margins, and real-time member registrations.
                </p>
              </div>

              {/* 4 Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl border shadow-xl space-y-2" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                  <div className={`flex justify-between items-center ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                    <span className="text-xs font-bold uppercase tracking-wider">Gross Merch. Value</span>
                    <TrendingUp size={16} className="text-amber-500" />
                  </div>
                  <p className={`text-3xl font-serif font-bold ${isLight ? "text-amber-800" : "text-amber-300"}`}>₹9,70,000</p>
                  <p className={`text-[11px] font-semibold flex items-center gap-1 ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
                    <span>↑ +24% growth vs previous month</span>
                  </p>
                </div>

                <div className="p-5 rounded-2xl border shadow-xl space-y-2" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                  <div className={`flex justify-between items-center ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                    <span className="text-xs font-bold uppercase tracking-wider">Platform Profit Cut</span>
                    <IndianRupee size={16} className={isLight ? "text-emerald-700" : "text-emerald-400"} />
                  </div>
                  <p className={`text-3xl font-serif font-bold ${isLight ? "text-emerald-700" : "text-emerald-300"}`}>₹1,31,000</p>
                  <p className={`text-[11px] font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>Secured in platform escrow account</p>
                </div>

                <div className="p-5 rounded-2xl border shadow-xl space-y-2" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                  <div className={`flex justify-between items-center ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                    <span className="text-xs font-bold uppercase tracking-wider">Verified Senior Pros</span>
                    <ShieldCheck size={16} className="text-amber-500" />
                  </div>
                  <p className={`text-3xl font-serif font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                    {experts.filter(e => e.verified).length} Pros
                  </p>
                  <p className={`text-[11px] font-medium ${isLight ? "text-amber-800" : "text-amber-300/80"}`}>
                    {pendingVerifications.length} applicants in KYC audit queue
                  </p>
                </div>

                <div className="p-5 rounded-2xl border shadow-xl space-y-2" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                  <div className={`flex justify-between items-center ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                    <span className="text-xs font-bold uppercase tracking-wider">Active Clients</span>
                    <Briefcase size={16} className={isLight ? "text-sky-600" : "text-sky-400"} />
                  </div>
                  <p className={`text-3xl font-serif font-bold ${isLight ? "text-slate-900" : "text-white"}`}>8,910</p>
                  <p className={`text-[11px] font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>Enterprise & SME advisory partners</p>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl border shadow-xl space-y-4" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4 text-amber-500" />
                      <h3 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Revenue Streams Breakdown</h3>
                    </div>
                    <span className={`text-[10px] font-mono font-bold ${isLight ? "text-amber-800" : "text-amber-300"}`}>Total ARR: ₹34.8L</span>
                  </div>
                  <div style={{ height: 210 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={REVENUE_STREAMS} layout="vertical" margin={{ left: 10 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={140} tick={{ fill: isLight ? "#475569" : "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: isLight ? "#FFFFFF" : "#0B1119",
                            border: isLight ? "1px solid #CBD5E1" : "1px solid rgba(201,160,99,0.3)",
                            borderRadius: 8,
                            fontSize: 12,
                            color: isLight ? "#0F172A" : "#F4EFEA"
                          }}
                          labelStyle={{ color: isLight ? "#0F172A" : "#F4EFEA" }}
                        />
                        <Bar dataKey="value" fill={isLight ? "#D97706" : "#C9A063"} radius={[0, 4, 4, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="p-6 rounded-2xl border shadow-xl space-y-4" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className={`w-4 h-4 ${isLight ? "text-emerald-700" : "text-emerald-400"}`} />
                      <h3 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Mentora Expansion & Growth Curve</h3>
                    </div>
                    <span className={`text-[10px] font-mono font-bold ${isLight ? "text-emerald-700" : "text-emerald-300"}`}>Trajectory</span>
                  </div>
                  <div style={{ height: 210 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={GROWTH}>
                        <CartesianGrid stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(244,239,234,0.06)"} vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: isLight ? "#475569" : "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{
                            background: isLight ? "#FFFFFF" : "#0B1119",
                            border: isLight ? "1px solid #CBD5E1" : "1px solid rgba(201,160,99,0.3)",
                            borderRadius: 8,
                            fontSize: 12,
                            color: isLight ? "#0F172A" : "#F4EFEA"
                          }}
                          labelStyle={{ color: isLight ? "#0F172A" : "#F4EFEA" }}
                        />
                        <Line type="monotone" dataKey="professionals" stroke={isLight ? "#B45309" : "#DFBE87"} strokeWidth={2.5} dot={false} name="Senior Pros" />
                        <Line type="monotone" dataKey="clients" stroke={isLight ? "#16A34A" : "#4ADE80"} strokeWidth={2.5} dot={false} name="Client Orgs" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Recent Escrow Ledger */}
              <div className="p-6 rounded-2xl border shadow-xl space-y-4" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: T.lineInk }}>
                  <div>
                    <h3 className={`text-base font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Escrow Settlements Ledger</h3>
                    <p className={`text-xs ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      Live transaction escrow payouts and platform margin deductions.
                    </p>
                  </div>
                  <span className={`text-xs font-mono px-2.5 py-1 rounded border ${
                    isLight 
                      ? "text-emerald-800 bg-emerald-50 border-emerald-300 font-semibold" 
                      : "text-emerald-400 bg-emerald-950/60 border-emerald-800"
                  }`}>
                    100% Escrow Protected
                  </span>
                </div>

                <div className="divide-y" style={{ borderColor: T.lineInk }}>
                  {TRANSACTIONS.map((t) => (
                    <div key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className={`text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{t.desc}</p>
                        <p className={`text-[11px] font-mono mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                          {t.id} · Date: {t.date} · Expert Payout: ₹{t.expertPay}
                        </p>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <p className={`text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Total ₹{t.amount}</p>
                        <p className={`text-[11px] font-bold mt-0.5 ${isLight ? "text-amber-800" : "text-amber-300"}`}>
                          +₹{t.cut} Platform Margin
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==========================================================
              DESK 2: DOCUMENT AUDIT & KYC QUEUE
          ========================================================== */}
          {activeDesk === "kyc" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs uppercase font-bold tracking-widest text-amber-500">Desk 02 • Document Governance</span>
                  <h1 className={`text-2xl sm:text-3xl font-serif font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>
                    Senior Professional KYC Verification Queue ({pendingVerifications.length})
                  </h1>
                  <p className={`text-xs sm:text-sm mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    Inspect uploaded work certificates, relieving letters, and CV documents before publishing profiles to client search.
                  </p>
                </div>

                {onResetPendingQueue && (
                  <button
                    onClick={async () => {
                      await onResetPendingQueue();
                      confetti({ particleCount: 40, spread: 50 });
                    }}
                    className={`self-start sm:self-auto text-xs px-3.5 py-2 rounded-lg font-semibold border transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                      isLight 
                        ? "bg-white hover:bg-slate-100 text-amber-800 border-slate-300" 
                        : "bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700"
                    }`}
                  >
                    <Plus size={14} /> Add Sample Applicants
                  </button>
                )}
              </div>

              {pendingVerifications.length === 0 ? (
                <div className="p-12 rounded-2xl border text-center space-y-3" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                  <CheckCircle2 className={`w-12 h-12 mx-auto ${isLight ? "text-emerald-600" : "text-emerald-400"}`} />
                  <h3 className={`text-lg font-bold ${isLight ? "text-slate-900" : "text-white"}`}>KYC Verification Queue is Clear</h3>
                  <p className={`text-xs max-w-md mx-auto ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    All senior professionals who registered and submitted documents have been audited and verified.
                  </p>
                  {onResetPendingQueue && (
                    <button
                      onClick={onResetPendingQueue}
                      className="mt-2 text-xs px-4 py-2 rounded-lg font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow"
                    >
                      Restore Verification Samples
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingVerifications.map((p) => (
                    <div
                      key={p.id}
                      className="p-5 rounded-2xl border shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-amber-500/50"
                      style={{ background: T.cardBg, borderColor: T.lineInk }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`text-base font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{p.name}</span>
                          {p.email && (
                            <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded border ${
                              isLight ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-white/5 text-amber-300/90 border-white/10"
                            }`}>
                              {p.email}
                            </span>
                          )}
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                            isLight 
                              ? "bg-amber-100 text-amber-900 border-amber-300" 
                              : "bg-amber-950/80 text-amber-300 border-amber-800/80"
                          }`}>
                            Awaiting Audit
                          </span>
                        </div>
                        <p className={`text-xs ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                          {p.field} · {p.years} years experience · Ex-{p.company || "Fortune 500"}
                        </p>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className={`text-[11px] px-2.5 py-1 rounded font-mono border flex items-center gap-1 ${
                            isLight ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-slate-900 border-slate-700 text-amber-300"
                          }`}>
                            <FileText size={12} /> Work Cert PDF
                          </span>
                          <span className={`text-[11px] px-2.5 py-1 rounded font-mono border flex items-center gap-1 ${
                            isLight ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-slate-900 border-slate-700 text-emerald-300"
                          }`}>
                            <FileCheck size={12} /> Relieving Letter PDF
                          </span>
                          <span className={`text-[11px] px-2.5 py-1 rounded font-mono border flex items-center gap-1 ${
                            isLight ? "bg-sky-50 border-sky-300 text-sky-800" : "bg-slate-900 border-slate-700 text-sky-300"
                          }`}>
                            <FileText size={12} /> Executive CV Dossier
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 shrink-0">
                        <button
                          onClick={() => setSelectedAuditItem(p)}
                          className={`px-3.5 py-2 text-xs rounded-lg font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                            isLight 
                              ? "bg-white text-slate-800 hover:bg-slate-100 border-slate-300 shadow-sm" 
                              : "bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700"
                          }`}
                          title="View Documents"
                        >
                          <Eye size={13} /> View Documents
                        </button>
                        <button
                          onClick={() => handleApprove(p.id)}
                          className="px-4 py-2 text-xs rounded-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
                        >
                          <Check size={14} /> Approve & Publish
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Reject and remove applicant "${p.name}" from verification queue?`)) {
                              if (onDeleteExpert) onDeleteExpert(p.id);
                            }
                          }}
                          className={`px-3 py-2 text-xs rounded-lg font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                            isLight 
                              ? "bg-rose-50 text-rose-800 hover:bg-rose-100 border-rose-300" 
                              : "bg-rose-950/80 text-rose-300 hover:bg-rose-900 border-rose-800"
                          }`}
                          title="Reject & Delete Applicant"
                        >
                          <UserX size={13} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==========================================================
              DESK 3: EXPERT DIRECTORY, RATES & MARKUPS
          ========================================================== */}
          {activeDesk === "pricing" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs uppercase font-bold tracking-widest text-amber-500">Desk 03 • Commercial Rules</span>
                  <h1 className={`text-2xl sm:text-3xl font-serif font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>
                    Expert Directory & Platform Profit Markups ({experts.length})
                  </h1>
                  <p className={`text-xs sm:text-sm mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    Adjust base pay and platform margins. The client hourly rate is dynamically computed and saved to MongoDB.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search size={14} className={`absolute left-3 top-3 ${isLight ? "text-slate-400" : "text-slate-500"}`} />
                  <input
                    type="text"
                    value={expertSearch}
                    onChange={(e) => setExpertSearch(e.target.value)}
                    placeholder="Search by name or field..."
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-lg border outline-none font-medium transition-colors ${
                      isLight 
                        ? "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 shadow-sm" 
                        : "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-amber-400"
                    }`}
                  />
                </div>
              </div>

              <div className="p-6 rounded-2xl border shadow-xl overflow-hidden" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                <div className="overflow-x-auto">
                  <table className={`w-full text-left text-xs ${isLight ? "text-slate-700" : "text-slate-200"}`}>
                    <thead>
                      <tr className={`border-b text-[11px] uppercase tracking-wider pb-3 ${isLight ? "text-slate-700 bg-slate-50" : "text-amber-300/90"}`} style={{ borderColor: T.lineInk }}>
                        <th className="py-3 px-3">Expert & Photo URL</th>
                        <th className="py-3 px-3">Verification Badge</th>
                        <th className="py-3 px-3">Landing Featured</th>
                        <th className="py-3 px-3">Base Pay (₹/hr)</th>
                        <th className="py-3 px-3">Admin Markup (+₹)</th>
                        <th className="py-3 px-3">Client Rate (₹/hr)</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: T.lineInk }}>
                      {filteredExperts.map((e) => {
                        const m = markupState[e.id] || { base: e.baseRate || 600, markup: e.adminMarkup || 150 };
                        const clientPrice = m.base + m.markup;
                        const isFeatured = e.featuredOnLanding !== false;

                        return (
                          <tr key={e.id} className={isLight ? "hover:bg-slate-50/80 transition-colors" : "hover:bg-slate-800/40 transition-colors"}>
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-3">
                                <img
                                  src={getExpertPhoto(e)}
                                  onError={handleImgError}
                                  alt={e.name}
                                  className="w-10 h-10 rounded-full object-cover border shrink-0"
                                  style={{ borderColor: T.brassLight }}
                                />
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-bold text-xs ${isLight ? "text-slate-900" : "text-white"}`}>{e.name}</span>
                                    <span className={`text-[10px] font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>({e.field})</span>
                                  </div>
                                  <input
                                    type="text"
                                    defaultValue={getExpertPhoto(e)}
                                    onBlur={(ev) => {
                                      if (ev.target.value && onUpdatePhotoUrl) {
                                        onUpdatePhotoUrl(e.id, ev.target.value);
                                        alert(`✅ Updated photo URL for ${e.name}! Saved to MongoDB.`);
                                      }
                                    }}
                                    placeholder="Paste photo URL..."
                                    className={`w-40 px-2 py-0.5 text-[10px] rounded outline-none font-mono border ${
                                      isLight 
                                        ? "bg-white border-slate-300 text-amber-800 focus:border-amber-500" 
                                        : "bg-slate-900 border-slate-700 text-amber-300 focus:border-amber-400"
                                    }`}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-3">
                              <button
                                onClick={() => {
                                  if (onToggleVerification) onToggleVerification(e.id, !e.verified);
                                }}
                                className={`px-2.5 py-1 text-xs rounded-md font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                  e.verified
                                    ? isLight 
                                      ? "bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200"
                                      : "bg-emerald-950/90 text-emerald-300 border border-emerald-600 hover:bg-emerald-900"
                                    : isLight
                                      ? "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
                                      : "bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800"
                                }`}
                                title={e.verified ? "Click to Revoke Verification" : "Click to Grant Verified Badge"}
                              >
                                <ShieldCheck size={13} className={e.verified ? (isLight ? "text-emerald-700" : "text-emerald-400") : "text-slate-400"} />
                                <span>{e.verified ? "Verified" : "Unverified"}</span>
                              </button>
                            </td>

                            <td className="py-3.5 px-3">
                              <button
                                onClick={() => {
                                  if (onToggleFeatured) onToggleFeatured(e.id, !isFeatured);
                                }}
                                className={`px-2.5 py-1 text-xs rounded-md font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                  isFeatured
                                    ? isLight
                                      ? "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                                      : "bg-amber-950/90 text-amber-300 border border-amber-600 hover:bg-amber-900"
                                    : isLight
                                      ? "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
                                      : "bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800"
                                }`}
                              >
                                <Sparkles size={12} className={isFeatured ? "text-amber-500" : "text-slate-400"} />
                                <span>{isFeatured ? "Spotlight" : "Hidden"}</span>
                              </button>
                            </td>

                            <td className="py-3.5 px-3">
                              <input
                                type="number"
                                value={m.base}
                                onChange={(ev) => handleMarkupChange(e.id, "base", Number(ev.target.value))}
                                className={`w-20 px-2.5 py-1 text-xs rounded border font-bold outline-none ${
                                  isLight 
                                    ? "bg-white border-slate-300 text-slate-900 focus:border-amber-500 shadow-sm" 
                                    : "bg-slate-900 border-slate-700 text-white focus:border-amber-400"
                                }`}
                              />
                            </td>

                            <td className="py-3.5 px-3">
                              <input
                                type="number"
                                value={m.markup}
                                onChange={(ev) => handleMarkupChange(e.id, "markup", Number(ev.target.value))}
                                className={`w-20 px-2.5 py-1 text-xs rounded border font-bold outline-none ${
                                  isLight 
                                    ? "bg-white border-slate-300 text-amber-800 focus:border-amber-500 shadow-sm" 
                                    : "bg-slate-900 border-slate-700 text-amber-300 focus:border-amber-400"
                                }`}
                              />
                            </td>

                            <td className={`py-3.5 px-3 font-mono font-bold text-sm ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
                              ₹{clientPrice}
                            </td>

                            <td className="py-3.5 px-3 text-right">
                              <div className="flex justify-end items-center gap-2">
                                <button
                                  onClick={() => handleSaveMarkup(e.id)}
                                  className="px-3 py-1.5 text-xs rounded font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer flex items-center gap-1 shadow"
                                >
                                  <Save size={12} /> Save
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Demote ${e.name} back into Document Audit Queue?`)) {
                                      if (onDemoteToAuditQueue) onDemoteToAuditQueue(e.id);
                                    }
                                  }}
                                  className={`px-2.5 py-1.5 text-xs rounded font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                    isLight 
                                      ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm" 
                                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                                  }`}
                                  title="Demote to KYC Audit Queue"
                                >
                                  <UserX size={12} /> Demote
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
            </div>
          )}

          {/* ==========================================================
              DESK 4: HERO 3D SPOTLIGHT CARDS MANAGER
          ========================================================== */}
          {activeDesk === "spotlight" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <span className="text-xs uppercase font-bold tracking-widest text-amber-500">Desk 04 • Visual Merchandising</span>
                <h1 className={`text-2xl sm:text-3xl font-serif font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>
                  Landing Page Hero 3D Spotlight Cards
                </h1>
                <p className={`text-xs sm:text-sm mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Designate which 2 elite senior advisors appear in the 3D parallax floating spotlight cards on the public homepage hero banner.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Hero Card 1 (Top-Right) */}
                {(() => {
                  const currentTop = experts.find(e => e.heroSpotlight && e.heroPosition === "top") || experts.find(e => e.id === "exp-6") || experts[0];
                  return (
                    <div className="p-6 rounded-2xl border shadow-xl space-y-4" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                      <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: T.lineInk }}>
                        <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? "text-amber-800" : "text-amber-300"}`}>
                          <Sparkles size={14} /> Spotlight Card 1 (Top-Right Hero)
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          isLight ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-amber-950 text-amber-200 border-amber-800"
                        }`}>
                          Floating Card Top
                        </span>
                      </div>

                      <div className={`p-4 rounded-xl border flex items-center gap-4 ${
                        isLight ? "bg-slate-50 border-slate-200 shadow-inner" : "bg-slate-900/90 border-slate-700"
                      }`}>
                        <img
                          src={getExpertPhoto(currentTop)}
                          onError={handleImgError}
                          alt={currentTop?.name}
                          className="w-14 h-14 rounded-full object-cover border-2 shrink-0"
                          style={{ borderColor: T.brassLight }}
                        />
                        <div>
                          <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{currentTop?.name}</p>
                          <p className={`text-xs ${isLight ? "text-amber-800 font-semibold" : "text-amber-300"}`}>{currentTop?.field}</p>
                          <p className={`text-[11px] mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                            {currentTop?.years} Yrs Exp · Listed Rate: ₹{currentTop?.rate}/hr
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className={`text-xs font-semibold block mb-1.5 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                          Assign Senior Expert to Hero Card 1:
                        </label>
                        <select
                          value={currentTop?.id}
                          onChange={(ev) => {
                            if (onUpdateHeroSpotlight) onUpdateHeroSpotlight(ev.target.value, true, "top");
                            confetti({ particleCount: 35, spread: 45 });
                            alert(`✅ Assigned ${experts.find(e => e.id === ev.target.value)?.name} to Hero Card 1!`);
                          }}
                          className={`w-full px-3 py-2 text-xs rounded-lg border font-bold outline-none cursor-pointer ${
                            isLight 
                              ? "bg-white border-slate-300 text-slate-900 shadow-sm focus:border-amber-500" 
                              : "bg-slate-900 border-slate-700 text-white focus:border-amber-400"
                          }`}
                        >
                          {experts.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name} — {e.field} (₹{e.rate}/hr)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })()}

                {/* Hero Card 2 (Bottom-Left) */}
                {(() => {
                  const currentBottom = experts.find(e => e.heroSpotlight && e.heroPosition === "bottom") || experts.find(e => e.id === "exp-5") || experts[1];
                  return (
                    <div className="p-6 rounded-2xl border shadow-xl space-y-4" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                      <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: T.lineInk }}>
                        <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? "text-emerald-800" : "text-emerald-300"}`}>
                          <Sparkles size={14} /> Spotlight Card 2 (Bottom-Left Hero)
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          isLight ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-emerald-950 text-emerald-200 border-emerald-800"
                        }`}>
                          Floating Card Bottom
                        </span>
                      </div>

                      <div className={`p-4 rounded-xl border flex items-center gap-4 ${
                        isLight ? "bg-slate-50 border-slate-200 shadow-inner" : "bg-slate-900/90 border-slate-700"
                      }`}>
                        <img
                          src={getExpertPhoto(currentBottom)}
                          onError={handleImgError}
                          alt={currentBottom?.name}
                          className="w-14 h-14 rounded-full object-cover border-2 shrink-0"
                          style={{ borderColor: T.mossLight }}
                        />
                        <div>
                          <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{currentBottom?.name}</p>
                          <p className={`text-xs ${isLight ? "text-emerald-700 font-semibold" : "text-emerald-300"}`}>{currentBottom?.field}</p>
                          <p className={`text-[11px] mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                            {currentBottom?.years} Yrs Exp · Listed Rate: ₹{currentBottom?.rate}/hr
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className={`text-xs font-semibold block mb-1.5 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                          Assign Senior Expert to Hero Card 2:
                        </label>
                        <select
                          value={currentBottom?.id}
                          onChange={(ev) => {
                            if (onUpdateHeroSpotlight) onUpdateHeroSpotlight(ev.target.value, true, "bottom");
                            confetti({ particleCount: 35, spread: 45 });
                            alert(`✅ Assigned ${experts.find(e => e.id === ev.target.value)?.name} to Hero Card 2!`);
                          }}
                          className={`w-full px-3 py-2 text-xs rounded-lg border font-bold outline-none cursor-pointer ${
                            isLight 
                              ? "bg-white border-slate-300 text-slate-900 shadow-sm focus:border-amber-500" 
                              : "bg-slate-900 border-slate-700 text-white focus:border-amber-400"
                          }`}
                        >
                          {experts.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name} — {e.field} (₹{e.rate}/hr)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ==========================================================
              DESK 5: CLIENT REVIEWS MODERATION & GOVERNANCE
          ========================================================== */}
          {activeDesk === "reviews" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <span className="text-xs uppercase font-bold tracking-widest text-amber-500">Desk 05 • Reputation Governance</span>
                <h1 className={`text-2xl sm:text-3xl font-serif font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>
                  Client Consultation Reviews Moderation Desk ({platformReviews.length})
                </h1>
                <p className={`text-xs sm:text-sm mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Control which client reviews are approved and visible on the Expert's Profile, and which are featured on the Main Homepage.
                </p>
              </div>

              <div className="space-y-4">
                {platformReviews.length === 0 ? (
                  <div className={`p-8 rounded-2xl border text-center ${isLight ? "text-slate-600" : "text-slate-400"}`} style={{ background: T.cardBg, borderColor: T.lineInk }}>
                    No client reviews submitted yet.
                  </div>
                ) : (
                  platformReviews.map((rev: any) => (
                    <div
                      key={rev.id}
                      className="p-5 rounded-2xl border shadow-xl space-y-3.5 transition-all hover:border-amber-500/40"
                      style={{ background: T.cardBg, borderColor: T.lineInk }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={rev.clientAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"}
                            alt={rev.clientName}
                            className="w-10 h-10 rounded-full object-cover border"
                            style={{ borderColor: T.brassLight }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{rev.clientName}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                                isLight ? "bg-slate-100 text-amber-800 border-slate-300" : "bg-slate-800 text-amber-300 border-slate-700"
                              }`}>
                                Target: {rev.expertName}
                              </span>
                            </div>
                            <div className={`flex items-center gap-1.5 text-xs mt-0.5 ${isLight ? "text-amber-600" : "text-amber-400"}`}>
                              <span>{"★".repeat(rev.rating || 5)}</span>
                              <span className={`text-[10px] ml-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>{rev.date}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded border ${
                              rev.visibleToExpert
                                ? isLight 
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300" 
                                  : "bg-emerald-950 text-emerald-300 border-emerald-700"
                                : isLight 
                                  ? "bg-slate-100 text-slate-600 border-slate-300" 
                                  : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {rev.visibleToExpert ? "✓ Visible on Expert Profile" : "❌ Hidden from Expert"}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded border ${
                              rev.featuredOnLanding
                                ? isLight 
                                  ? "bg-amber-100 text-amber-900 border-amber-300" 
                                  : "bg-amber-950 text-amber-300 border-amber-700"
                                : isLight 
                                  ? "bg-slate-100 text-slate-600 border-slate-300" 
                                  : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {rev.featuredOnLanding ? "★ Spotlight on Landing Page" : "Standard"}
                          </span>
                        </div>
                      </div>

                      <p className={`text-xs p-3 rounded-lg border italic leading-relaxed ${
                        isLight 
                          ? "bg-slate-50 border-slate-200 text-slate-800" 
                          : "bg-slate-950/80 border-slate-800 text-slate-300"
                      }`}>
                        "{rev.comment}"
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: T.lineInk }}>
                        <span className={`text-[11px] font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>Admin Governance Actions:</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleVisibleToExpert(rev.id)}
                            className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              rev.visibleToExpert
                                ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow"
                                : isLight 
                                  ? "bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50 shadow-sm" 
                                  : "bg-slate-800 text-emerald-300 border border-emerald-600 hover:bg-slate-700"
                            }`}
                          >
                            {rev.visibleToExpert ? <EyeOff size={12} /> : <Eye size={12} />}
                            <span>{rev.visibleToExpert ? "Hide from Expert" : "Approve for Expert"}</span>
                          </button>

                          <button
                            onClick={() => toggleFeaturedOnLanding(rev.id)}
                            className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              rev.featuredOnLanding
                                ? "bg-amber-600 text-white hover:bg-amber-500 shadow"
                                : isLight 
                                  ? "bg-white text-amber-800 border border-amber-300 hover:bg-amber-50 shadow-sm" 
                                  : "bg-slate-800 text-amber-300 border border-amber-600 hover:bg-slate-700"
                            }`}
                          >
                            <Sparkles size={12} />
                            <span>{rev.featuredOnLanding ? "Remove from Landing" : "Feature on Homepage"}</span>
                          </button>

                          <button
                            onClick={() => deletePlatformReview(rev.id)}
                            className={`px-2.5 py-1.5 text-xs rounded-md font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                              isLight 
                                ? "bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100" 
                                : "bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900"
                            }`}
                            title="Delete / Reject Review"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ==========================================================
              DESK: CONSULTATION SESSIONS & MEETING OPERATIONS DESK
          ========================================================== */}
          {activeDesk === "sessions" && (() => {
            const filteredSessions = platformSessions.filter(s => {
              if (!sessionSearch.trim()) return true;
              const q = sessionSearch.toLowerCase();
              return (
                (s.client && s.client.toLowerCase().includes(q)) ||
                (s.expert && s.expert.toLowerCase().includes(q)) ||
                (s.topic && s.topic.toLowerCase().includes(q)) ||
                (s.meetCode && s.meetCode.toLowerCase().includes(q))
              );
            });

            const liveList = filteredSessions.filter(s => !s.completed && (s.isLive || s.status?.toLowerCase().includes("live")));
            const scheduledList = filteredSessions.filter(s => !s.completed && !s.isLive && !s.status?.toLowerCase().includes("live"));
            const completedList = filteredSessions.filter(s => s.completed || s.status?.toLowerCase().includes("completed"));

            const totalCompleted = completedList.length;
            const reviewedCount = completedList.filter(s => getSessionReviewStatus(s).hasReview).length;
            const paidCount = completedList.filter(s => s.payoutTransferred).length;

            return (
              <div className="space-y-8 animate-fadeIn">
                {/* Header with Title & Action Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs uppercase font-bold tracking-widest text-amber-500">
                      Desk 06 • Session Operations & Meeting Control Desk
                    </span>
                    <h1 className={`text-2xl sm:text-3xl font-serif font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>
                      Live, Scheduled & Completed Consultations
                    </h1>
                    <p className={`text-xs sm:text-sm mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      Oversight for active Google Meet live rooms, scheduled calendar bookings, and completed session reviews & escrow payout releases.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowNewSessionModal(true)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 flex items-center gap-2 cursor-pointer shadow-lg transition-all hover:scale-[1.02] shrink-0"
                  >
                    <Plus size={15} />
                    <span>+ Schedule / Register Session</span>
                  </button>
                </div>

                {/* 4 Stat Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Live Meetings Now */}
                  <div
                    onClick={() => setSessionTab("live")}
                    className="p-5 rounded-2xl border shadow-xl space-y-2 cursor-pointer transition-all hover:border-rose-500/50"
                    style={{ background: T.cardBg, borderColor: sessionTab === "live" ? "#F43F5E" : T.lineInk }}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                        Live Meetings Now
                      </span>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                      </span>
                    </div>
                    <p className="text-3xl font-serif font-bold text-rose-500">
                      {liveSessionsList.length} Live
                    </p>
                    <p className={`text-[11px] font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      Active Google Meet rooms connected
                    </p>
                  </div>

                  {/* Card 2: Scheduled Consultations */}
                  <div
                    onClick={() => setSessionTab("scheduled")}
                    className="p-5 rounded-2xl border shadow-xl space-y-2 cursor-pointer transition-all hover:border-amber-500/50"
                    style={{ background: T.cardBg, borderColor: sessionTab === "scheduled" ? "#F59E0B" : T.lineInk }}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                        Scheduled Consultations
                      </span>
                      <CalendarDays size={16} className="text-amber-500" />
                    </div>
                    <p className={`text-3xl font-serif font-bold ${isLight ? "text-amber-800" : "text-amber-300"}`}>
                      {scheduledSessionsList.length} Booked
                    </p>
                    <p className={`text-[11px] font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      Upcoming on advisory calendar
                    </p>
                  </div>

                  {/* Card 3: Completed Meetings */}
                  <div
                    onClick={() => setSessionTab("completed")}
                    className="p-5 rounded-2xl border shadow-xl space-y-2 cursor-pointer transition-all hover:border-emerald-500/50"
                    style={{ background: T.cardBg, borderColor: sessionTab === "completed" ? "#10B981" : T.lineInk }}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                        Completed Meetings
                      </span>
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                    <p className={`text-3xl font-serif font-bold ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
                      {completedSessionsList.length} Finished
                    </p>
                    <p className={`text-[11px] font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      Concluded & escrows eligible
                    </p>
                  </div>

                  {/* Card 4: Review & Escrow Governance */}
                  <div
                    onClick={() => setSessionTab("completed")}
                    className="p-5 rounded-2xl border shadow-xl space-y-2 cursor-pointer transition-all hover:border-cyan-500/50"
                    style={{ background: T.cardBg, borderColor: T.lineInk }}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                        Review & Payout Health
                      </span>
                      <IndianRupee size={16} className={isLight ? "text-cyan-700" : "text-cyan-400"} />
                    </div>
                    <p className={`text-2xl font-serif font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                      {reviewedCount}/{totalCompleted} Revs
                    </p>
                    <p className={`text-[11px] font-semibold ${isLight ? "text-cyan-800" : "text-cyan-300"}`}>
                      {paidCount}/{totalCompleted} Payouts Disbursed
                    </p>
                  </div>
                </div>

                {/* Sub-Navigation Filter Tabs & Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b" style={{ borderColor: T.lineInk }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setSessionTab("all")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        sessionTab === "all"
                          ? "bg-amber-500 text-slate-950 shadow"
                          : isLight ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      All Sessions ({filteredSessions.length})
                    </button>
                    <button
                      onClick={() => setSessionTab("live")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        sessionTab === "live"
                          ? "bg-rose-600 text-white shadow"
                          : isLight ? "bg-rose-50 text-rose-800 hover:bg-rose-100" : "bg-rose-950/60 text-rose-300 hover:bg-rose-900/60"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
                      🔴 Live Meetings ({liveList.length})
                    </button>
                    <button
                      onClick={() => setSessionTab("scheduled")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        sessionTab === "scheduled"
                          ? "bg-amber-500 text-slate-950 shadow"
                          : isLight ? "bg-amber-50 text-amber-900 hover:bg-amber-100" : "bg-amber-950/60 text-amber-300 hover:bg-amber-900/60"
                      }`}
                    >
                      <CalendarDays size={13} />
                      📅 Scheduled Meetings ({scheduledList.length})
                    </button>
                    <button
                      onClick={() => setSessionTab("completed")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        sessionTab === "completed"
                          ? "bg-emerald-600 text-white shadow"
                          : isLight ? "bg-emerald-50 text-emerald-900 hover:bg-emerald-100" : "bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60"
                      }`}
                    >
                      <CheckCircle2 size={13} />
                      ✅ Completed Meetings ({completedList.length})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search size={14} className={`absolute left-3 top-2.5 ${isLight ? "text-slate-400" : "text-slate-500"}`} />
                    <input
                      type="text"
                      value={sessionSearch}
                      onChange={(e) => setSessionSearch(e.target.value)}
                      placeholder="Search Client, Expert, Topic..."
                      className={`w-full pl-9 pr-3.5 py-1.5 text-xs rounded-lg border outline-none font-medium ${
                        isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                      }`}
                    />
                  </div>
                </div>

                {/* ==============================================================
                    SECTION 1: 🔴 LIVE MEETINGS IN PROGRESS
                ============================================================== */}
                {(sessionTab === "all" || sessionTab === "live") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                        </span>
                        <h2 className={`text-lg sm:text-xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                          Section 1: Live Meetings in Progress ({liveList.length})
                        </h2>
                      </div>
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/30">
                        Active Call Oversight
                      </span>
                    </div>

                    {liveList.length === 0 ? (
                      <div className={`p-8 rounded-2xl border text-center ${isLight ? "text-slate-600 bg-slate-50" : "text-slate-400 bg-slate-900/40"}`} style={{ borderColor: T.lineInk }}>
                        <Video size={28} className="mx-auto mb-2 opacity-40 text-rose-500" />
                        <p className="text-xs font-bold">No active live meetings right now.</p>
                        <p className="text-[11px] mt-0.5 opacity-80">
                          When a client and expert connect in a Google Meet consultation room, it will stream live here.
                        </p>
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-4">
                        {liveList.map((s) => (
                          <div
                            key={s.id}
                            className="p-5 rounded-2xl border shadow-xl space-y-4 transition-all hover:border-rose-500/40 relative overflow-hidden"
                            style={{ background: T.cardBg, borderColor: isLight ? "#FCA5A5" : "rgba(244,63,94,0.35)" }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500 text-white shadow-sm animate-pulse">
                                  ● LIVE NOW
                                </span>
                                <span className={`text-[11px] font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                  {s.startedAt || "Today, Active Call"}
                                </span>
                              </div>
                              <span className={`text-xs font-bold px-2.5 py-0.5 rounded font-mono ${
                                isLight ? "bg-amber-100 text-amber-900" : "bg-amber-950 text-amber-300"
                              }`}>
                                ₹{s.rate}/hr
                              </span>
                            </div>

                            {/* Participants Box: Kiske Kiske Beech Mein Chal Raha Hai */}
                            <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                              isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/90 border-slate-800"
                            }`}>
                              <div className="flex-1 min-w-0">
                                <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                  Client Partner:
                                </span>
                                <p className={`text-sm font-bold truncate ${isLight ? "text-slate-900" : "text-white"}`}>
                                  {s.client}
                                </p>
                              </div>

                              <div className="px-2 py-1 rounded bg-amber-500/20 text-amber-400 font-bold text-xs shrink-0">
                                ↔
                              </div>

                              <div className="flex-1 min-w-0 text-right">
                                <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                  Senior Expert:
                                </span>
                                <p className={`text-sm font-bold truncate ${isLight ? "text-amber-800" : "text-amber-300"}`}>
                                  {s.expert}
                                </p>
                              </div>
                            </div>

                            {/* Topic: Kis Topic Pe Chal Raha Hai */}
                            <div className="space-y-1">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                Consultation Subject & Topic:
                              </span>
                              <p className={`text-xs font-semibold leading-snug ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                                🎯 {s.topic}
                              </p>
                            </div>

                            {/* Google Meet Room Details & Admin Controls */}
                            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                              isLight ? "bg-white border-slate-200" : "bg-slate-950/80 border-slate-800"
                            }`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <Video size={16} className="text-emerald-500 shrink-0" />
                                <span className={`text-xs font-mono truncate font-bold ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                                  {s.meetUrl ? s.meetUrl : "Awaiting Google Meet link from Expert"}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {s.meetUrl && (
                                  <>
                                    <button
                                      onClick={() => window.open(s.meetUrl, "_blank")}
                                      className="px-2.5 py-1 text-xs rounded-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow flex items-center gap-1 transition-all"
                                      title="Join Google Meet as Admin Overseer"
                                    >
                                      <ExternalLink size={12} /> Join Meet ↗
                                    </button>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(s.meetUrl);
                                        alert(`📋 Google Meet Link Copied:\n${s.meetUrl}`);
                                      }}
                                      className={`px-2 py-1 text-xs rounded-lg font-bold border cursor-pointer ${
                                        isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                                      }`}
                                      title="Copy Meet Link"
                                    >
                                      <Copy size={12} />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => handleMarkSessionCompleted(s.id)}
                                  className="px-2.5 py-1 text-xs rounded-lg font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow flex items-center gap-1 transition-all"
                                  title="Conclude Session and Trigger Review & Payout"
                                >
                                  <Check size={12} /> Complete
                                </button>
                                <button
                                  onClick={() => handleDeleteSession(s.id)}
                                  className={`px-2 py-1 text-xs rounded-lg font-bold border cursor-pointer transition-colors ${
                                    isLight ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200" : "bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-500/30"
                                  }`}
                                  title="Delete Session Record"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ==============================================================
                    SECTION 2: 📅 SCHEDULED MEETINGS CALENDAR
                ============================================================== */}
                {(sessionTab === "all" || sessionTab === "scheduled") && (
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CalendarDays size={20} className="text-amber-500" />
                        <h2 className={`text-lg sm:text-xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                          Section 2: Scheduled & Confirmed Meetings ({scheduledList.length})
                        </h2>
                      </div>
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                        Upcoming Calendar
                      </span>
                    </div>

                    {scheduledList.length === 0 ? (
                      <div className={`p-8 rounded-2xl border text-center ${isLight ? "text-slate-600 bg-slate-50" : "text-slate-400 bg-slate-900/40"}`} style={{ borderColor: T.lineInk }}>
                        <CalendarDays size={28} className="mx-auto mb-2 opacity-40 text-amber-500" />
                        <p className="text-xs font-bold">No upcoming sessions scheduled.</p>
                        <p className="text-[11px] mt-0.5 opacity-80">
                          When a client books an expert or an expert schedules a session, it will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {scheduledList.map((s) => (
                          <div
                            key={s.id}
                            className="p-5 rounded-2xl border shadow-xl space-y-3.5 transition-all hover:border-amber-500/40"
                            style={{ background: T.cardBg, borderColor: T.lineInk }}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono border flex items-center gap-1.5 ${
                                  isLight ? "bg-amber-50 text-amber-900 border-amber-300" : "bg-amber-950/80 text-amber-300 border-amber-800"
                                }`}>
                                  <CalendarDays size={13} />
                                  Scheduled: {s.when}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                                  s.status?.toLowerCase().includes("sent") || s.meetUrl
                                    ? isLight ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-emerald-950 text-emerald-300 border-emerald-700"
                                    : isLight ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-slate-800 text-slate-400 border-slate-700"
                                }`}>
                                  {s.status}
                                </span>
                              </div>

                              <span className={`text-xs font-mono font-bold ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                                Package: {s.type} · Value: ₹{s.rate}
                              </span>
                            </div>

                            {/* Participants: Kiske Kiske Beech Mein Scheduled Hai */}
                            <div className="grid sm:grid-cols-2 gap-3 pt-1">
                              <div className={`p-3 rounded-xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/80 border-slate-800"}`}>
                                <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                  Booked Client Partner:
                                </span>
                                <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{s.client}</p>
                                <p className={`text-[11px] font-mono mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>{s.clientEmail || "client@company.com"}</p>
                              </div>

                              <div className={`p-3 rounded-xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/80 border-slate-800"}`}>
                                <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                  Assigned Senior Expert:
                                </span>
                                <p className={`text-sm font-bold ${isLight ? "text-amber-800" : "text-amber-300"}`}>{s.expert}</p>
                                <p className={`text-[11px] font-mono mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>{s.expertEmail || "expert@registry.com"}</p>
                              </div>
                            </div>

                            {/* Topic Details */}
                            <div className="space-y-1">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                Consultation Topic:
                              </span>
                              <p className={`text-xs font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
                                📌 {s.topic}
                              </p>
                            </div>

                            {/* Google Meet Info & Admin Controls */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: T.lineInk }}>
                              <div className="flex items-center gap-2">
                                {s.meetUrl ? (
                                  <div className="flex items-center gap-2 text-xs text-emerald-500 font-mono font-bold">
                                    <Video size={14} className="shrink-0" />
                                    <span className="truncate">Meet Link Ready: {s.meetUrl}</span>
                                    <button
                                      onClick={() => window.open(s.meetUrl, "_blank")}
                                      className="px-2.5 py-1 text-xs rounded-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow flex items-center gap-1 font-sans transition-all shrink-0"
                                      title="Join Google Meet in New Tab"
                                    >
                                      <ExternalLink size={12} /> Join Meet ↗
                                    </button>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(s.meetUrl);
                                        alert(`📋 Copied Link: ${s.meetUrl}`);
                                      }}
                                      className={`px-2 py-1 text-xs rounded-lg font-bold border cursor-pointer shrink-0 ${
                                        isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                                      }`}
                                      title="Copy Link"
                                    >
                                      <Copy size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <span className={`text-xs flex items-center gap-1.5 ${isLight ? "text-amber-700" : "text-amber-400"}`}>
                                    <Clock size={13} />
                                    Pending Google Meet Link Generation by Expert
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleStartLiveMeeting(s.id)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow flex items-center gap-1.5 transition-all"
                                >
                                  <Play size={12} /> Launch Live Now
                                </button>
                                <button
                                  onClick={() => handleMarkSessionCompleted(s.id)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow flex items-center gap-1.5 transition-all"
                                >
                                  <Check size={12} /> Mark Completed
                                </button>
                                <button
                                  onClick={() => handleDeleteSession(s.id)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                                    isLight ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200" : "bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-500/30"
                                  }`}
                                  title="Delete Session Record"
                                >
                                  <Trash2 size={12} /> Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ==============================================================
                    SECTION 3: ✅ COMPLETED MEETINGS & REVIEW/PAYOUT GOVERNANCE
                ============================================================== */}
                {(sessionTab === "all" || sessionTab === "completed") && (
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 size={20} className="text-emerald-500" />
                        <h2 className={`text-lg sm:text-xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                          Section 3: Completed Meetings & Review/Payout Governance ({completedList.length})
                        </h2>
                      </div>
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                        Post-Session Audit
                      </span>
                    </div>

                    {completedList.length === 0 ? (
                      <div className={`p-8 rounded-2xl border text-center ${isLight ? "text-slate-600 bg-slate-50" : "text-slate-400 bg-slate-900/40"}`} style={{ borderColor: T.lineInk }}>
                        <CheckCircle2 size={28} className="mx-auto mb-2 opacity-40 text-emerald-500" />
                        <p className="text-xs font-bold">No completed meetings logged yet.</p>
                        <p className="text-[11px] mt-0.5 opacity-80">
                          When sessions finish, client rating reviews and escrow payout statuses will appear here for admin audit.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {completedList.map((s) => {
                          const revInfo = getSessionReviewStatus(s);
                          return (
                            <div
                              key={s.id}
                              className="p-5 rounded-2xl border shadow-xl space-y-4 transition-all hover:border-emerald-500/40"
                              style={{ background: T.cardBg, borderColor: T.lineInk }}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                                    ✓ Completed Session
                                  </span>
                                  <span className={`text-[11px] font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                    Concluded: {s.completedAt || s.when}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 font-mono text-xs">
                                  <span className={`${isLight ? "text-slate-600" : "text-slate-400"}`}>Package: {s.type}</span>
                                  <span className="font-bold text-amber-500">Payout: ₹{s.payout || 600}</span>
                                  <button
                                    onClick={() => handleDeleteSession(s.id)}
                                    className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                      isLight ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200" : "bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-500/30"
                                    }`}
                                    title="Delete Session Record"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              {/* Participants & Topic Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border" style={{ borderColor: T.lineInk }}>
                                <div>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                    Consultation Parties:
                                  </span>
                                  <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                                    Client: <strong>{s.client}</strong> ↔ Senior Expert: <strong className={isLight ? "text-amber-800" : "text-amber-300"}>{s.expert}</strong>
                                  </p>
                                </div>

                                <div className="text-left sm:text-right">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                    Topic Handled:
                                  </span>
                                  <p className={`text-xs font-semibold ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                                    {s.topic}
                                  </p>
                                </div>
                              </div>

                              {/* Dual Audit Governance Cards: Client Review Status & Money Transfer Status */}
                              <div className="grid md:grid-cols-2 gap-3.5">
                                {/* Sub-Box 1: Client Review Status */}
                                {revInfo.hasReview ? (
                                  <div className={`p-3.5 rounded-xl border space-y-2 ${
                                    isLight ? "bg-emerald-50 text-emerald-950 border-emerald-300" : "bg-emerald-950/40 text-emerald-200 border-emerald-700/60"
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-500">
                                        <CheckCircle2 size={15} />
                                        Client Review: Submitted & Logged ✅
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                        isLight ? "bg-emerald-200 text-emerald-900 border-emerald-400" : "bg-emerald-900 text-emerald-200 border-emerald-600"
                                      }`}>
                                        Review Given
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-amber-500 font-bold">
                                        {"★".repeat(revInfo.rating || 5)} ({revInfo.rating || 5}/5 Stars)
                                      </span>
                                      <span className={`text-[10px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                                        · {revInfo.date}
                                      </span>
                                    </div>
                                    <p className={`text-xs italic leading-relaxed ${isLight ? "text-emerald-900" : "text-emerald-100"}`}>
                                      "{revInfo.comment}"
                                    </p>
                                  </div>
                                ) : (
                                  <div className={`p-3.5 rounded-xl border space-y-2 flex flex-col justify-between ${
                                    isLight ? "bg-amber-50 text-amber-950 border-amber-300" : "bg-amber-950/40 text-amber-200 border-amber-700/60"
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold flex items-center gap-1.5 text-amber-500">
                                        <Clock size={15} className="animate-pulse" />
                                        Client Review: Not Given Yet / Pending ⏳
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                        isLight ? "bg-amber-200 text-amber-950 border-amber-400" : "bg-amber-900 text-amber-200 border-amber-600"
                                      }`}>
                                        Review Awaited
                                      </span>
                                    </div>
                                    <p className={`text-xs leading-relaxed ${isLight ? "text-amber-900" : "text-amber-300/90"}`}>
                                      The client has successfully finished the meeting, but has not yet submitted their rating or review comments.
                                    </p>
                                    <div className="pt-1">
                                      <span className={`text-[11px] font-mono ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                                        Client notification prompt: Sent
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Sub-Box 2: Money Transfer / Payout Status */}
                                {s.payoutTransferred ? (
                                  <div className={`p-3.5 rounded-xl border space-y-2 ${
                                    isLight ? "bg-cyan-50 text-cyan-950 border-cyan-300" : "bg-cyan-950/40 text-cyan-200 border-cyan-700/60"
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold flex items-center gap-1.5 text-cyan-500">
                                        <IndianRupee size={15} />
                                        Money Transfer: Transferred to Expert Wallet ✅
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                        isLight ? "bg-cyan-200 text-cyan-950 border-cyan-400" : "bg-cyan-900 text-cyan-200 border-cyan-600"
                                      }`}>
                                        100% Disbursed
                                      </span>
                                    </div>
                                    <p className={`text-xs leading-relaxed ${isLight ? "text-cyan-900" : "text-cyan-200"}`}>
                                      Payout of <strong>₹{(s.payout || 600).toLocaleString("en-IN")}</strong> has been successfully credited to {s.expert}'s wallet / bank payout balance.
                                    </p>
                                    <div className={`text-[11px] font-mono ${isLight ? "text-cyan-800" : "text-cyan-300/80"}`}>
                                      Status: Settled via Platform Escrow Disburser
                                    </div>
                                  </div>
                                ) : (
                                  <div className={`p-3.5 rounded-xl border space-y-2 flex flex-col justify-between ${
                                    isLight ? "bg-rose-50 text-rose-950 border-rose-300" : "bg-rose-950/40 text-rose-200 border-rose-700/60"
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold flex items-center gap-1.5 text-rose-500">
                                        <AlertCircle size={15} />
                                        Money Transfer: In Escrow / Pending Release ⏳
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                        isLight ? "bg-rose-200 text-rose-950 border-rose-400" : "bg-rose-900 text-rose-200 border-rose-600"
                                      }`}>
                                        Held in Escrow
                                      </span>
                                    </div>
                                    <p className={`text-xs leading-relaxed ${isLight ? "text-rose-900" : "text-rose-300/90"}`}>
                                      Payout of <strong>₹{(s.payout || 600).toLocaleString("en-IN")}</strong> is secured in platform escrow awaiting final administrative disbursement.
                                    </p>
                                    <div className="pt-1 flex items-center justify-between">
                                      <span className={`text-[11px] font-mono ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                                        Escrow Protection: Active
                                      </span>
                                      <button
                                        onClick={() => handleDisbursePayout(s.id)}
                                        className="px-3 py-1 text-xs rounded-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow flex items-center gap-1 transition-all"
                                      >
                                        <IndianRupee size={12} /> Disburse Payout Now
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ==========================================================
              DESK 6: NOTIFICATION MANAGEMENT
          ========================================================== */}
          {activeDesk === "broadcast" && (
            <NotificationManagementDesk isLight={isLight} T={T} />
          )}

          {/* ==========================================================
              DESK 7: DATABASE & DIAGNOSTICS
          ========================================================== */}
          {activeDesk === "diagnostics" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <span className="text-xs uppercase font-bold tracking-widest text-amber-500">Desk 07 • Infrastructure</span>
                <h1 className={`text-2xl sm:text-3xl font-serif font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>
                  Database & Cluster Diagnostics
                </h1>
                <p className={`text-xs sm:text-sm mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Live state of MongoDB Atlas collections, active sessions, and disaster recovery controls.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl border shadow-xl space-y-2" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                  <span className={`text-xs font-bold uppercase ${isLight ? "text-slate-500" : "text-slate-400"}`}>Experts Collection</span>
                  <p className={`text-3xl font-serif font-bold ${isLight ? "text-amber-800" : "text-amber-300"}`}>{experts.length} Records</p>
                  <p className={`text-[11px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>Synchronized with client directory</p>
                </div>

                <div className="p-5 rounded-2xl border shadow-xl space-y-2" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                  <span className={`text-xs font-bold uppercase ${isLight ? "text-slate-500" : "text-slate-400"}`}>Pending KYC Queue</span>
                  <p className={`text-3xl font-serif font-bold ${isLight ? "text-emerald-700" : "text-emerald-300"}`}>{pendingVerifications.length} Applicants</p>
                  <p className={`text-[11px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>Awaiting executive approval</p>
                </div>

                <div className="p-5 rounded-2xl border shadow-xl space-y-2" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                  <span className={`text-xs font-bold uppercase ${isLight ? "text-slate-500" : "text-slate-400"}`}>Platform Reviews</span>
                  <p className={`text-3xl font-serif font-bold ${isLight ? "text-sky-700" : "text-sky-300"}`}>{platformReviews.length} Records</p>
                  <p className={`text-[11px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>Total client feedback submissions</p>
                </div>
              </div>

              <div className="p-6 rounded-2xl border shadow-xl space-y-4" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: T.lineInk }}>
                  <div className="flex items-center gap-2">
                    <Database className={`w-5 h-5 ${isLight ? "text-emerald-700" : "text-emerald-400"}`} />
                    <h3 className={`text-base font-bold ${isLight ? "text-slate-900" : "text-white"}`}>MongoDB Atlas Connection Setup</h3>
                  </div>
                  <button
                    onClick={onOpenMongoModal}
                    className="text-xs px-3.5 py-1.5 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow"
                  >
                    Configure URI / Connection String
                  </button>
                </div>

                <p className={`text-xs leading-relaxed ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                  The application is configured to run seamlessly against local in-memory storage with optional direct sync to any cloud MongoDB Atlas cluster (<code className={isLight ? "text-amber-800 font-semibold" : "text-amber-300"}>mongodb+srv://...</code>).
                </p>

                <div className="flex flex-wrap gap-3 pt-2">
                  {onResetPendingQueue && (
                    <button
                      onClick={async () => {
                        await onResetPendingQueue();
                        confetti({ particleCount: 30, spread: 40 });
                        alert("✅ Reset pending verification queue with fresh applicant records.");
                      }}
                      className={`text-xs px-3.5 py-2 rounded-lg font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isLight 
                          ? "bg-white hover:bg-slate-100 text-amber-800 border-slate-300 shadow-sm" 
                          : "bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700"
                      }`}
                    >
                      <RefreshCw size={13} /> Re-seed Sample Applicants
                    </button>
                  )}
                  <button
                    onClick={() => {
                      window.location.reload();
                    }}
                    className={`text-xs px-3.5 py-2 rounded-lg font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isLight 
                        ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm" 
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                    }`}
                  >
                    <RefreshCw size={13} /> Force Re-sync Cache
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================================
              DESK 8: EXPERTISE FIELDS & DOMAIN TAXONOMY MANAGER
          ========================================================== */}
          {activeDesk === "expertise" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs uppercase font-bold tracking-widest text-amber-500">Desk 08 • Advisory Taxonomy</span>
                  <h1 className={`text-2xl sm:text-3xl font-serif font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>
                    Expertise Fields & Domain Taxonomy
                  </h1>
                  <p className={`text-xs sm:text-sm mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    Add and delete senior expert advisory domains. Changes synchronize automatically across registration, search filters, and profile modals.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetFields}
                    className={`text-xs px-3.5 py-2 rounded-xl font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isLight 
                        ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm" 
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                    }`}
                    title="Restore default canonical domains"
                  >
                    <RefreshCw size={13} /> Reset Defaults
                  </button>
                </div>
              </div>

              {/* Taxonomy High-Level Stats */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl border shadow-xl space-y-1.5" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                  <span className={`text-xs font-bold uppercase ${isLight ? "text-slate-500" : "text-slate-400"}`}>Active Domains</span>
                  <p className={`text-3xl font-serif font-bold ${isLight ? "text-amber-800" : "text-amber-300"}`}>{expertiseFields.length} Categories</p>
                  <p className={`text-[11px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>Available for expert onboarding & client discovery</p>
                </div>

                <div className="p-5 rounded-2xl border shadow-xl space-y-1.5" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                  <span className={`text-xs font-bold uppercase ${isLight ? "text-slate-500" : "text-slate-400"}`}>Categorized Experts</span>
                  <p className={`text-3xl font-serif font-bold ${isLight ? "text-emerald-700" : "text-emerald-300"}`}>
                    {experts.filter(e => e.field).length} Advisors
                  </p>
                  <p className={`text-[11px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>Active verified profiles mapped to domains</p>
                </div>

                <div className="p-5 rounded-2xl border shadow-xl space-y-1.5" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                  <span className={`text-xs font-bold uppercase ${isLight ? "text-slate-500" : "text-slate-400"}`}>Leading Field</span>
                  {(() => {
                    const counts: Record<string, number> = {};
                    experts.forEach(e => {
                      if (e.field) counts[e.field] = (counts[e.field] || 0) + 1;
                    });
                    const topEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                    return (
                      <>
                        <p className={`text-xl font-serif font-bold truncate ${isLight ? "text-sky-700" : "text-sky-300"}`}>
                          {topEntry ? topEntry[0] : (expertiseFields[0] || "General")}
                        </p>
                        <p className={`text-[11px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                          {topEntry ? `${topEntry[1]} expert(s) registered` : "No experts assigned"}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Add New Expertise Field Form Card */}
              <div className="p-6 rounded-2xl border shadow-xl space-y-4" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: T.lineInk }}>
                  <Plus className="w-5 h-5 text-amber-500" />
                  <h3 className={`text-base font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                    Add New Expertise Field / Domain
                  </h3>
                </div>

                <form onSubmit={handleAddField} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      placeholder="Enter new expertise field (e.g. Artificial Intelligence & ML, HealthTech, Supply Chain...)"
                      className={`w-full px-4 py-2.5 text-xs rounded-xl outline-none border transition-colors ${
                        isLight 
                          ? "bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-amber-500 shadow-inner" 
                          : "bg-[#070C14] border-white/15 text-white placeholder-slate-500 focus:border-amber-500/80 shadow-inner"
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!newFieldName.trim()}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:brightness-110"
                    style={{
                      background: T.goldGradient,
                      color: "#05080E"
                    }}
                  >
                    <Plus size={15} /> Add Expertise Field
                  </button>
                </form>

                {/* Suggested Quick Add Tags */}
                <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`text-[11px] font-semibold ${isLight ? "text-slate-500" : "text-slate-400"}`}>Quick Add Suggestions:</span>
                  {[
                    "Artificial Intelligence & ML",
                    "Cybersecurity & Data Privacy",
                    "Healthcare & Biotech",
                    "Renewable Energy & ESG",
                    "Real Estate & Urban Planning"
                  ].filter(tag => !expertiseFields.some(f => f.toLowerCase() === tag.toLowerCase())).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        expertiseService.add(tag);
                        confetti({ particleCount: 30, spread: 40 });
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                        isLight
                          ? "bg-amber-50/60 border-amber-200 text-amber-800 hover:bg-amber-100"
                          : "bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20"
                      }`}
                    >
                      <Plus size={11} /> {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Expertise Fields Table & Management */}
              <div className="p-6 rounded-2xl border shadow-xl space-y-4" style={{ background: T.cardBg, borderColor: T.lineInk }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3" style={{ borderColor: T.lineInk }}>
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-500" />
                    <div>
                      <h3 className={`text-base font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                        Active Expertise Taxonomy ({expertiseFields.length})
                      </h3>
                      <p className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                        Delete or review domains currently live in all platform dropdowns and filter bars.
                      </p>
                    </div>
                  </div>

                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${isLight ? "bg-slate-50 border-slate-300" : "bg-slate-950/60 border-white/10"}`}>
                    <Search size={13} className="text-slate-400" />
                    <input
                      type="text"
                      value={fieldSearch}
                      onChange={(e) => setFieldSearch(e.target.value)}
                      placeholder="Filter fields..."
                      className={`bg-transparent outline-none text-xs w-36 ${isLight ? "text-slate-900" : "text-white"}`}
                    />
                    {fieldSearch && (
                      <button onClick={() => setFieldSearch("")} className="text-slate-400 hover:text-white cursor-pointer">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[min(520px,65vh)] pr-1.5 scrollbar-thin select-text">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {expertiseFields
                    .filter(f => !fieldSearch.trim() || f.toLowerCase().includes(fieldSearch.toLowerCase()))
                    .map((f, idx) => {
                      const assigned = experts.filter(e => e.field && (e.field.toLowerCase() === f.toLowerCase() || e.field.toLowerCase().includes(f.toLowerCase())));
                      return (
                        <div
                          key={f}
                          className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 group ${
                            isLight
                              ? "bg-white border-slate-200 hover:border-amber-400 hover:shadow-md"
                              : "bg-[#0B111A]/90 border-white/10 hover:border-amber-500/40 hover:bg-[#0E1622]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                                isLight ? "bg-amber-100 text-amber-800" : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              }`}>
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <div>
                                <h4 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                                  {f}
                                </h4>
                                <span className={`text-[10px] font-medium flex items-center gap-1 mt-0.5 ${
                                  assigned.length > 0
                                    ? isLight ? "text-emerald-700" : "text-emerald-400"
                                    : isLight ? "text-slate-500" : "text-slate-400"
                                }`}>
                                  <Users size={11} /> {assigned.length} {assigned.length === 1 ? "Expert" : "Experts"} Tagged
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteField(f)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer opacity-70 group-hover:opacity-100 ${
                                isLight
                                  ? "border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-400"
                                  : "border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500"
                              }`}
                              title={`Delete expertise field "${f}"`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {assigned.length > 0 ? (
                            <div className={`pt-2 border-t text-[11px] flex items-center justify-between ${isLight ? "border-slate-100 text-slate-500" : "border-white/5 text-slate-400"}`}>
                              <span className="truncate max-w-[180px]">
                                {assigned.map(e => e.name).slice(0, 2).join(", ")}
                                {assigned.length > 2 ? ` +${assigned.length - 2} more` : ""}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold shrink-0">
                                Active
                              </span>
                            </div>
                          ) : (
                            <div className={`pt-2 border-t text-[11px] flex items-center justify-between ${isLight ? "border-slate-100 text-slate-400" : "border-white/5 text-slate-500"}`}>
                              <span className="italic">Ready for new signups</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isLight ? "bg-slate-100 text-slate-500" : "bg-white/5 text-slate-400"}`}>
                                Unassigned
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={`p-3 rounded-xl border flex items-center justify-between text-xs mt-4 ${
                  isLight ? "bg-amber-50/70 border-amber-200 text-amber-900" : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                }`}>
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="shrink-0" />
                    <span>Any field added or deleted here broadcasts instantly to <strong>Client Portal</strong>, <strong>Expert Onboarding</strong>, and <strong>Registry Landing Page</strong>.</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-500/20 shrink-0">
                    Live Sync ⚡
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              EXPERT AVAILABILITY GOVERNANCE DESK
          ============================================================== */}
          {activeDesk === "availability" && (() => {
            const allAvailabilities = mongoDB.getLocalAvailabilities();
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const todayStr = `${y}-${m}-${d}`;

            // Platform-wide calculations
            const upcomingAvailableSlots = allAvailabilities.filter(a => a.availabilityDate >= todayStr && a.status === 'AVAILABLE');
            const upcomingBookedSlots = allAvailabilities.filter(a => a.availabilityDate >= todayStr && a.status === 'BOOKED');
            
            // Map of expertId to upcoming slot counts
            const expertSlotsMap: Record<string, { available: number; booked: number; total: number }> = {};
            allAvailabilities.forEach(a => {
              if (a.availabilityDate >= todayStr) {
                if (!expertSlotsMap[a.expertId]) {
                  expertSlotsMap[a.expertId] = { available: 0, booked: 0, total: 0 };
                }
                expertSlotsMap[a.expertId].total++;
                if (a.status === 'AVAILABLE') expertSlotsMap[a.expertId].available++;
                if (a.status === 'BOOKED') expertSlotsMap[a.expertId].booked++;
              }
            });

            const expertsWithActiveSchedule = Object.keys(expertSlotsMap).filter(id => expertSlotsMap[id].available > 0).length;

            const filteredExperts = experts.filter(e => {
              const counts = expertSlotsMap[e.id] || { available: 0, booked: 0, total: 0 };
              if (adminAvailabilityTabFilter === 'has_slots' && counts.available === 0) return false;
              if (adminAvailabilityTabFilter === 'no_slots' && counts.available > 0) return false;

              if (!adminExpertSearch.trim()) return true;
              const q = adminExpertSearch.toLowerCase();
              return (
                (e.name && e.name.toLowerCase().includes(q)) ||
                (e.field && e.field.toLowerCase().includes(q)) ||
                (e.email && e.email.toLowerCase().includes(q)) ||
                (e.id && e.id.toLowerCase().includes(q))
              );
            });

            const selectedExpert = experts.find(e => e.id === adminSelectedExpertId) || filteredExperts[0] || experts[0];

            return (
              <div className="space-y-8 animate-fadeIn">
                {/* Desk Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5" style={{ borderColor: T.lineInk }}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
                        <CalendarDays className="w-6 h-6 text-amber-500" />
                        Platform Availability Governance Desk
                      </h2>
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                        Global Audit Mode
                      </span>
                    </div>
                    <p className={`text-xs mt-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                      Audit, publish, override, or release consultation schedules across all senior advisors and corporate domains.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border bg-amber-500/10 text-amber-400 border-amber-500/25 shadow-sm">
                      <ShieldCheck size={14} /> Full Administrative Override Active
                    </span>
                  </div>
                </div>

                {/* Platform-Wide Availability KPI Banner */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div 
                    className="p-4 rounded-2xl border shadow-md"
                    style={{ background: T.cardBg, borderColor: T.lineInk }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Total Platform Slots
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black tracking-tight">{allAvailabilities.length}</span>
                      <span className="text-[11px] text-slate-400 font-mono">lifetime</span>
                    </div>
                  </div>

                  <div 
                    className="p-4 rounded-2xl border shadow-md"
                    style={{ background: T.cardBg, borderColor: T.lineInk }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block">
                      Active Open Slots
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-emerald-400 tracking-tight">{upcomingAvailableSlots.length}</span>
                      <span className="text-[11px] text-emerald-400/80 font-mono">bookable</span>
                    </div>
                  </div>

                  <div 
                    className="p-4 rounded-2xl border shadow-md"
                    style={{ background: T.cardBg, borderColor: T.lineInk }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">
                      Confirmed Bookings
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-amber-400 tracking-tight">{upcomingBookedSlots.length}</span>
                      <span className="text-[11px] text-amber-400/80 font-mono">sessions</span>
                    </div>
                  </div>

                  <div 
                    className="p-4 rounded-2xl border shadow-md"
                    style={{ background: T.cardBg, borderColor: T.lineInk }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Active Schedule Coverage
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black tracking-tight">{expertsWithActiveSchedule}</span>
                      <span className="text-[11px] text-slate-400 font-mono">/ {experts.length} experts</span>
                    </div>
                  </div>
                </div>

                {/* Expert Selection & Multi-Criteria Filtering Deck */}
                <div 
                  className="p-6 rounded-3xl border shadow-xl space-y-5"
                  style={{ background: T.cardBg, borderColor: T.lineInk }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-amber-500 flex items-center gap-2">
                        <Users size={16} /> Select Advisor to Manage
                      </h3>
                      <p className={`text-xs mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                        Filter and select an expert profile to inspect or modify their schedule calendar.
                      </p>
                    </div>

                    {/* Filter Tabs & Search */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                      {/* Filter Tabs */}
                      <div className={`flex items-center p-1 rounded-xl border text-xs font-bold ${
                        isLight ? "bg-slate-100 border-slate-200" : "bg-[#070C15] border-white/10"
                      }`}>
                        <button
                          type="button"
                          onClick={() => setAdminAvailabilityTabFilter('all')}
                          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                            adminAvailabilityTabFilter === 'all'
                              ? "bg-amber-500 text-slate-950 shadow-sm"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          All ({experts.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminAvailabilityTabFilter('has_slots')}
                          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                            adminAvailabilityTabFilter === 'has_slots'
                              ? "bg-amber-500 text-slate-950 shadow-sm"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Has Slots ({expertsWithActiveSchedule})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminAvailabilityTabFilter('no_slots')}
                          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                            adminAvailabilityTabFilter === 'no_slots'
                              ? "bg-amber-500 text-slate-950 shadow-sm"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          No Schedule ({experts.length - expertsWithActiveSchedule})
                        </button>
                      </div>

                      {/* Search Bar */}
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${isLight ? "bg-white border-slate-300" : "bg-[#070C15] border-white/15"}`}>
                        <Search size={14} className="text-slate-400 shrink-0" />
                        <input
                          type="text"
                          value={adminExpertSearch}
                          onChange={(e) => setAdminExpertSearch(e.target.value)}
                          placeholder="Search name, domain, ID..."
                          className={`bg-transparent outline-none text-xs w-36 sm:w-48 ${isLight ? "text-slate-900" : "text-white"}`}
                        />
                        {adminExpertSearch && (
                          <button onClick={() => setAdminExpertSearch("")} className="text-slate-400 hover:text-white cursor-pointer">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Interactive Expert Cards Strip */}
                  <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                    {filteredExperts.map((exp) => {
                      const isSelected = selectedExpert?.id === exp.id;
                      const counts = expertSlotsMap[exp.id] || { available: 0, booked: 0, total: 0 };

                      return (
                        <button
                          key={exp.id}
                          type="button"
                          onClick={() => setAdminSelectedExpertId(exp.id)}
                          className={`shrink-0 p-3 rounded-2xl border text-left transition-all cursor-pointer min-w-[200px] flex items-center gap-3 ${
                            isSelected
                              ? "bg-amber-500/15 border-amber-500 text-white font-extrabold shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/40"
                              : (isLight ? "bg-white hover:bg-slate-50 border-slate-200 text-slate-900" : "bg-[#070C15] hover:bg-white/5 border-white/10 text-white")
                          }`}
                        >
                          {exp.img ? (
                            <img
                              src={exp.img}
                              alt={exp.name}
                              className="w-10 h-10 rounded-xl object-cover border border-amber-500/30 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs border border-amber-500/30 shrink-0">
                              {exp.initials || "EX"}
                            </div>
                          )}

                          <div className="overflow-hidden space-y-0.5 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold truncate block">{exp.name}</span>
                              {exp.verified && <ShieldCheck size={11} className="text-emerald-400 shrink-0" />}
                            </div>
                            <span className="text-[10px] text-slate-400 truncate block">{exp.field}</span>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                                counts.available > 0
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-slate-500/20 text-slate-400"
                              }`}>
                                {counts.available} open slot{counts.available !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Expert Governance Details Card */}
                  {selectedExpert && (
                    <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isLight ? "bg-amber-50/60 border-amber-200" : "bg-[#0B111A] border-amber-500/30"
                    }`}>
                      <div className="flex items-center gap-3.5">
                        {selectedExpert.img ? (
                          <img
                            src={selectedExpert.img}
                            alt={selectedExpert.name}
                            className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-500/40 shadow-sm shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-sm border border-amber-500/30 shrink-0">
                            {selectedExpert.initials || "EX"}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-base">{selectedExpert.name}</span>
                            {selectedExpert.verified && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                                <ShieldCheck size={10} /> Verified Expert
                              </span>
                            )}
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/25">
                              {selectedExpert.id}
                            </span>
                          </div>
                          <p className={`text-xs mt-0.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                            {selectedExpert.title || selectedExpert.field} · Base Rate: <strong className={isLight ? "text-slate-900" : "text-white"}>₹{selectedExpert.baseRate}</strong> · Platform Client Rate: <strong className="text-amber-400">₹{selectedExpert.rate}/hr</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs px-3 py-1.5 rounded-xl font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                          <Clock size={13} /> Managing Schedule for {selectedExpert.name}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Embedded Availability Manager for Selected Expert */}
                {selectedExpert && (
                  <ExpertAvailabilityManager
                    key={selectedExpert.id}
                    expertId={selectedExpert.id}
                    expertName={selectedExpert.name}
                    isAdmin={true}
                    theme={isLight ? "light" : "dark"}
                  />
                )}
              </div>
            );
          })()}

          {/* ==============================================================
              PROJECT REVIEW OPS GOVERNANCE DESK (WORKFLOW B)
          ============================================================== */}
          {activeDesk === "project_reviews" && (
            <AdminProjectReviewDesk
              isLight={isLight}
              onInspectReview={(id) => setAdminInspectingReviewId(id)}
            />
          )}

          {/* ==============================================================
              BLOGS & ARTICLES CMS GOVERNANCE DESK
          ============================================================== */}
          {activeDesk === "blogs" && (
            <AdminBlogsDesk
              theme={isLight ? "light" : "dark"}
              onNavigateToPublicBlog={(slug) => {
                try {
                  window.history.pushState({ page: 'blogs', slug }, '', `/blogs/${slug}`);
                } catch {}
                setPage("blogs");
              }}
            />
          )}
        </main>
      </div>

      {/* Admin Project Review Workspace Inspection Modal */}
      {adminInspectingReviewId && (
        <ProjectReviewWorkspace
          projectReviewId={adminInspectingReviewId}
          userRole="admin"
          currentUserName="Platform SuperAdmin"
          currentUserId="admin-super"
          currentUserEmail="admin@registry.com"
          onClose={() => setAdminInspectingReviewId(null)}
          theme={isLight ? 'light' : 'dark'}
        />
      )}


      {/* ==============================================================
          PDF DOCUMENT INSPECTION AUDIT MODAL
      ============================================================== */}
      {selectedAuditItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div
            className={`w-full max-w-xl p-6 rounded-2xl border shadow-2xl space-y-5 ${isLight ? "text-slate-900" : "text-slate-100"}`}
            style={{
              background: isLight ? "#FFFFFF" : "#0E1520",
              borderColor: isLight ? "#CBD5E1" : "rgba(201,160,99,0.35)"
            }}
          >
            <div className={`flex justify-between items-center pb-3 border-b ${isLight ? "border-slate-200" : "border-slate-800"}`}>
              <div>
                <span className={`text-lg font-serif font-bold block ${isLight ? "text-slate-900" : "text-white"}`}>
                  Document Verification Audit
                </span>
                <span className={`text-xs ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Applicant: {selectedAuditItem.name} ({selectedAuditItem.field} · {selectedAuditItem.years} Years Exp)
                </span>
              </div>
              <button
                onClick={() => setSelectedAuditItem(null)}
                className={`p-1 cursor-pointer transition-colors ${isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-white"}`}
              >
                <X size={18} />
              </button>
            </div>

            {(() => {
              const auditDocsRecord = selectedAuditItem
                ? (mongoDB.getExpertDocuments(selectedAuditItem.id) ||
                   (selectedAuditItem.email ? mongoDB.getExpertDocuments(selectedAuditItem.email) : null) ||
                   (selectedAuditItem.name ? mongoDB.getExpertDocuments(selectedAuditItem.name) : null) ||
                   (selectedAuditItem.id ? mongoDB.getExpertDocuments(selectedAuditItem.id.toLowerCase().trim()) : null) ||
                   (selectedAuditItem.name ? mongoDB.getExpertDocuments(selectedAuditItem.name.toLowerCase().trim()) : null))
                : null;

              const pendingItems = (selectedAuditItem?.documents as any)?.items;

              const findDirectBinary = (fn?: string, slot?: string) => {
                if (typeof window === "undefined") return undefined;
                try {
                  if (fn) {
                    const cleanFn = fn.toLowerCase().trim();
                    const b = localStorage.getItem(`doc_bin_${cleanFn}`) || sessionStorage.getItem(`doc_bin_${cleanFn}`);
                    if (b && (b.startsWith("data:") || b.startsWith("/uploaded_docs/"))) return b;
                  }
                  if (slot && selectedAuditItem?.id) {
                    const b = localStorage.getItem(`doc_bin_${selectedAuditItem.id}_${slot}`) || sessionStorage.getItem(`doc_bin_${selectedAuditItem.id}_${slot}`);
                    if (b && (b.startsWith("data:") || b.startsWith("/uploaded_docs/"))) return b;
                  }
                  if (slot && selectedAuditItem?.name) {
                    const cleanName = selectedAuditItem.name.toLowerCase().trim();
                    const b = localStorage.getItem(`doc_bin_${cleanName}_${slot}`) || sessionStorage.getItem(`doc_bin_${cleanName}_${slot}`);
                    if (b && (b.startsWith("data:") || b.startsWith("/uploaded_docs/"))) return b;
                  }
                  if (slot && selectedAuditItem?.email) {
                    const cleanEmail = selectedAuditItem.email.toLowerCase().trim();
                    const b = localStorage.getItem(`doc_bin_${cleanEmail}_${slot}`) || sessionStorage.getItem(`doc_bin_${cleanEmail}_${slot}`);
                    if (b && (b.startsWith("data:") || b.startsWith("/uploaded_docs/"))) return b;
                  }
                } catch {}
                return undefined;
              };

              const expCertFileName = auditDocsRecord?.docs?.expCert?.fileName || pendingItems?.expCert?.fileName || selectedAuditItem.documents?.expCert || `${selectedAuditItem.name.replace(/\s+/g, "_")}_Work_Experience.pdf`;
              const expCertFileData = auditDocsRecord?.docs?.expCert?.fileData || pendingItems?.expCert?.fileData || findDirectBinary(expCertFileName, "expCert");

              const expCertDoc = {
                id: auditDocsRecord?.docs?.expCert?.id || pendingItems?.expCert?.id || `doc-${selectedAuditItem.id}-1`,
                type: "expCert" as const,
                title: "Work Experience & Tenure Certificate",
                fileName: expCertFileName,
                fileSize: auditDocsRecord?.docs?.expCert?.fileSize || pendingItems?.expCert?.fileSize || "1.8 MB",
                uploadedAt: auditDocsRecord?.docs?.expCert?.uploadedAt || auditDocsRecord?.updatedAt || selectedAuditItem.applied || "Recently submitted",
                fileData: expCertFileData,
                expertId: selectedAuditItem.id,
                expertName: selectedAuditItem.name,
                expertEmail: selectedAuditItem.email || "",
                status: "Pending Audit" as const
              };

              const offerLetterFileName = auditDocsRecord?.docs?.offerLetter?.fileName || pendingItems?.offerLetter?.fileName || selectedAuditItem.documents?.offerLetter || `${selectedAuditItem.name.replace(/\s+/g, "_")}_Relieving_Letter.pdf`;
              const offerLetterFileData = auditDocsRecord?.docs?.offerLetter?.fileData || pendingItems?.offerLetter?.fileData || findDirectBinary(offerLetterFileName, "offerLetter");

              const offerLetterDoc = {
                id: auditDocsRecord?.docs?.offerLetter?.id || pendingItems?.offerLetter?.id || `doc-${selectedAuditItem.id}-2`,
                type: "offerLetter" as const,
                title: "Company Relieving / Promotion Letter",
                fileName: offerLetterFileName,
                fileSize: auditDocsRecord?.docs?.offerLetter?.fileSize || pendingItems?.offerLetter?.fileSize || "950 KB",
                uploadedAt: auditDocsRecord?.docs?.offerLetter?.uploadedAt || auditDocsRecord?.updatedAt || selectedAuditItem.applied || "Recently submitted",
                fileData: offerLetterFileData,
                expertId: selectedAuditItem.id,
                expertName: selectedAuditItem.name,
                expertEmail: selectedAuditItem.email || "",
                status: "Pending Audit" as const
              };

              const resumeFileName = auditDocsRecord?.docs?.resume?.fileName || pendingItems?.resume?.fileName || selectedAuditItem.documents?.resume || `${selectedAuditItem.name.replace(/\s+/g, "_")}_Executive_CV.pdf`;
              const resumeFileData = auditDocsRecord?.docs?.resume?.fileData || pendingItems?.resume?.fileData || findDirectBinary(resumeFileName, "resume");

              const resumeDoc = {
                id: auditDocsRecord?.docs?.resume?.id || pendingItems?.resume?.id || `doc-${selectedAuditItem.id}-3`,
                type: "resume" as const,
                title: "Executive Dossier & Bio Resume",
                fileName: resumeFileName,
                fileSize: auditDocsRecord?.docs?.resume?.fileSize || pendingItems?.resume?.fileSize || "2.4 MB",
                uploadedAt: auditDocsRecord?.docs?.resume?.uploadedAt || auditDocsRecord?.updatedAt || selectedAuditItem.applied || "Recently submitted",
                fileData: resumeFileData,
                expertId: selectedAuditItem.id,
                expertName: selectedAuditItem.name,
                expertEmail: selectedAuditItem.email || "",
                status: "Pending Audit" as const
              };

              const formatDate = (dateStr?: string) => {
                if (!dateStr) return "Recently uploaded";
                if (dateStr.includes("T")) {
                  try { return new Date(dateStr).toLocaleDateString(); } catch {}
                }
                return dateStr;
              };

              const openAdminPreview = async (doc: any, slotType: "expCert" | "offerLetter" | "resume") => {
                let fileData = doc.fileData;

                // Direct static server check (same authoritative file reference as Expert Portal)
                if (doc.fileName && (!fileData || !fileData.startsWith("data:"))) {
                  try {
                    const staticUrl = `/uploaded_docs/${encodeURIComponent(doc.fileName)}`;
                    const chk = await fetch(staticUrl, { method: "HEAD" });
                    if (chk.ok) {
                      fileData = staticUrl;
                    }
                  } catch {}
                }

                if (!fileData || (!fileData.startsWith("data:") && !fileData.startsWith("/") && !fileData.startsWith("http") && !fileData.startsWith("blob:"))) {
                  fileData = (await getDocFile(doc.id, {
                    id: doc.id,
                    type: slotType,
                    title: doc.title,
                    fileName: doc.fileName,
                    expertId: doc.expertId || selectedAuditItem?.id,
                    expertName: doc.expertName || selectedAuditItem?.name,
                    expertEmail: doc.expertEmail || selectedAuditItem?.email,
                    status: doc.status || "Pending Audit"
                  })) || undefined;
                }
                setAdminPreviewDoc({
                  id: doc.id,
                  title: doc.title,
                  fileName: doc.fileName,
                  fileSize: doc.fileSize,
                  fileData,
                  uploadedAt: doc.uploadedAt,
                  status: doc.status || "Pending Audit",
                  expertName: doc.expertName || selectedAuditItem?.name,
                  expertEmail: doc.expertEmail || selectedAuditItem?.email,
                  expertField: selectedAuditItem?.field
                });
              };

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-amber-800" : "text-amber-400"}`}>
                      Uploaded Verification PDF Documents
                    </p>
                    <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Single Source of Truth (Database Synced)
                    </span>
                  </div>

                  <div className={`p-3 border rounded-xl flex items-center justify-between ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900 border-slate-800"
                  }`}>
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <FileText size={18} className={isLight ? "text-amber-600 shrink-0" : "text-amber-400 shrink-0"} />
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isLight ? "text-slate-900" : "text-white"}`}>
                          Work Experience & Tenure Certificate
                        </p>
                        <p className={`text-[11px] font-mono truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                          {expCertDoc.fileName}
                        </p>
                        <p className="text-[10px] text-amber-500 font-mono">
                          {expCertDoc.fileSize || "1.8 MB"} · Uploaded: {formatDate(expCertDoc.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openAdminPreview(expCertDoc, "expCert")}
                      className={`text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${
                        isLight ? "text-amber-800 hover:text-amber-950" : "text-amber-300 hover:text-white"
                      }`}
                      title="View Document"
                    >
                      <Eye size={13} /> View Document
                    </button>
                  </div>

                  <div className={`p-3 border rounded-xl flex items-center justify-between ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900 border-slate-800"
                  }`}>
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <FileCheck size={18} className={isLight ? "text-emerald-600 shrink-0" : "text-emerald-400 shrink-0"} />
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isLight ? "text-slate-900" : "text-white"}`}>
                          Company Relieving / Promotion Letter
                        </p>
                        <p className={`text-[11px] font-mono truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                          {offerLetterDoc.fileName}
                        </p>
                        <p className="text-[10px] text-emerald-500 font-mono">
                          {offerLetterDoc.fileSize || "950 KB"} · Uploaded: {formatDate(offerLetterDoc.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openAdminPreview(offerLetterDoc, "offerLetter")}
                      className={`text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${
                        isLight ? "text-amber-800 hover:text-amber-950" : "text-amber-300 hover:text-white"
                      }`}
                      title="View Document"
                    >
                      <Eye size={13} /> View Document
                    </button>
                  </div>

                  <div className={`p-3 border rounded-xl flex items-center justify-between ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900 border-slate-800"
                  }`}>
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <FileText size={18} className={isLight ? "text-sky-600 shrink-0" : "text-sky-400 shrink-0"} />
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isLight ? "text-slate-900" : "text-white"}`}>
                          Executive Dossier & Bio Resume
                        </p>
                        <p className={`text-[11px] font-mono truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                          {resumeDoc.fileName}
                        </p>
                        <p className="text-[10px] text-sky-500 font-mono">
                          {resumeDoc.fileSize || "2.4 MB"} · Uploaded: {formatDate(resumeDoc.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openAdminPreview(resumeDoc, "resume")}
                      className={`text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${
                        isLight ? "text-amber-800 hover:text-amber-950" : "text-amber-300 hover:text-white"
                      }`}
                      title="View Document"
                    >
                      <Eye size={13} /> View Document
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className={`p-3 rounded-xl text-xs space-y-1 border ${
              isLight ? "bg-amber-50/80 border-amber-200" : "bg-slate-900/80 border-slate-800"
            }`}>
              <p className={`font-semibold ${isLight ? "text-amber-950" : "text-white"}`}>Audit Summary & Validity Check:</p>
              <p className={isLight ? "text-slate-700" : "text-slate-400"}>
                Verified senior corporate executive credentials at {selectedAuditItem.company || "Enterprise Firm"} for {selectedAuditItem.years} years. Ready for verified platform badge.
              </p>
            </div>

            <div className={`flex gap-2 pt-2 border-t ${isLight ? "border-slate-200" : "border-slate-800"}`}>
              <button
                onClick={() => {
                  handleApprove(selectedAuditItem.id);
                  setSelectedAuditItem(null);
                }}
                className="w-full py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Check size={14} /> Approve Documents & Grant Verified Badge
              </button>
            </div>
          </div>
        </div>
      )}

      {adminPreviewDoc && (
        <DocumentViewerModal
          document={adminPreviewDoc}
          onClose={() => setAdminPreviewDoc(null)}
          theme={activeTheme}
        />
      )}

      {showNewSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div
            className={`w-full max-w-lg p-6 rounded-2xl border shadow-2xl space-y-5 ${isLight ? "text-slate-900 bg-white" : "text-slate-100 bg-[#0E1520]"}`}
            style={{
              borderColor: isLight ? "#CBD5E1" : "rgba(201,160,99,0.35)"
            }}
          >
            <div className={`flex justify-between items-center pb-3 border-b ${isLight ? "border-slate-200" : "border-slate-800"}`}>
              <div>
                <span className={`text-lg font-serif font-bold block ${isLight ? "text-slate-900" : "text-white"}`}>
                  Register / Schedule Consultation
                </span>
                <span className={`text-xs ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Add a real-time live video meeting or calendar scheduled consultation to Admin Operations.
                </span>
              </div>
              <button
                onClick={() => setShowNewSessionModal(false)}
                className={`p-1 cursor-pointer transition-colors ${isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-white"}`}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewSession} className="space-y-4 text-xs">
              <div>
                <label className={`font-bold block mb-1 uppercase tracking-wider ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                  1. Client Partner Name & Enterprise
                </label>
                <input
                  type="text"
                  required
                  value={newSessClient}
                  onChange={(e) => setNewSessClient(e.target.value)}
                  placeholder="e.g. Rahul Mehta (Alpha Ventures)"
                  className={`w-full p-2.5 rounded-lg border outline-none font-medium ${
                    isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                  }`}
                />
              </div>

              <div>
                <label className={`font-bold block mb-1 uppercase tracking-wider ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                  2. Select Senior Expert
                </label>
                <select
                  value={newSessExpert}
                  onChange={(e) => setNewSessExpert(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border outline-none font-bold cursor-pointer ${
                    isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                  }`}
                >
                  <option value="JK">JK (Senior Logistics & Advisory Expert)</option>
                  {experts.map((e) => (
                    <option key={e.id} value={e.name}>
                      {e.name} — {e.field} (₹{e.rate}/hr)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`font-bold block mb-1 uppercase tracking-wider ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                  3. Consultation Topic / Agenda
                </label>
                <input
                  type="text"
                  required
                  value={newSessTopic}
                  onChange={(e) => setNewSessTopic(e.target.value)}
                  placeholder="e.g. GST Audit Exposure & Valuation Strategy"
                  className={`w-full p-2.5 rounded-lg border outline-none font-medium ${
                    isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`font-bold block mb-1 uppercase tracking-wider ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                    4. Date & Time Slot
                  </label>
                  <input
                    type="text"
                    value={newSessWhen}
                    onChange={(e) => setNewSessWhen(e.target.value)}
                    placeholder="e.g. 2026-09-12, 04:00 PM"
                    disabled={newSessIsLive}
                    className={`w-full p-2.5 rounded-lg border outline-none font-medium ${
                      newSessIsLive ? "opacity-50" : ""
                    } ${
                      isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                    }`}
                  />
                </div>

                <div>
                  <label className={`font-bold block mb-1 uppercase tracking-wider ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                    5. Rate & Package
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={newSessType}
                      onChange={(e: any) => setNewSessType(e.target.value)}
                      className={`flex-1 p-2.5 rounded-lg border outline-none font-bold cursor-pointer ${
                        isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                      }`}
                    >
                      <option value="Hourly">Hourly</option>
                      <option value="Project">Project</option>
                    </select>
                    <input
                      type="number"
                      value={newSessRate}
                      onChange={(e) => setNewSessRate(Number(e.target.value))}
                      className={`w-20 p-2.5 rounded-lg border outline-none font-mono font-bold ${
                        isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                newSessIsLive 
                  ? isLight ? "bg-rose-50 border-rose-300" : "bg-rose-950/40 border-rose-700"
                  : isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/60 border-slate-800"
              }`}>
                <div className="flex items-center gap-2">
                  <Video size={16} className={newSessIsLive ? "text-rose-500" : "text-slate-400"} />
                  <div>
                    <span className="font-bold text-xs">Start Immediately as LIVE Meeting 🔴</span>
                    <p className={`text-[10px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      Auto-generate Google Meet URL and stream as active in Section 1 (Live Meetings)
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={newSessIsLive}
                  onChange={(e) => setNewSessIsLive(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-rose-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: T.lineInk }}>
                <button
                  type="button"
                  onClick={() => setShowNewSessionModal(false)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                    isLight ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-lg flex items-center gap-1.5"
                >
                  <Check size={14} /> Register Session to Operations Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
