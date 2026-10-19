import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Search,
  ArrowRight,
  ArrowLeft,
  Clock,
  Calendar,
  User,
  Share2,
  Check,
  ChevronRight,
  Sparkles,
  BookOpen,
  Filter,
  CheckCircle2,
  Bookmark,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Award,
  Layers,
  Quote,
  Copy,
  AlertTriangle
} from 'lucide-react';
import {
  BLOG_ARTICLES,
  FEATURED_ARTICLE,
  BLOG_CATEGORIES,
  BlogArticle,
  getAllArticles,
  getArticleBySlug,
  getRelatedArticles
} from '../data/blogArticles';
import { BlogArticleRecord } from '../types';
import { mongoDB } from '../mongoDBService';

import mentoraLogoHorizontalLight from '../assets/mentora-logo-horizontal-light.png';
import mentoraLogoHorizontalDark from '../assets/mentora-logo-horizontal-dark.png';

interface MentoraBlogsPageProps {
  setPage: (page: string, extraSlug?: string) => void;
  initialSlug?: string;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  userRole?: string | null;
  onLogout?: () => void;
  onOpenAuth?: (mode: 'signup' | 'login', role?: string) => void;
}

export const MentoraBlogsPage: React.FC<MentoraBlogsPageProps> = ({
  setPage,
  initialSlug,
  theme = 'dark',
  onToggleTheme,
  userRole,
  onLogout,
  onOpenAuth
}) => {
  const isLight = theme === 'light';

  // Active view state: list of articles or detailed article view
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug || null);

  // Dynamic MongoDB database state
  const [dbArticles, setDbArticles] = useState<BlogArticleRecord[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [loadingDb, setLoadingDb] = useState<boolean>(true);
  const [currentArticle, setCurrentArticle] = useState<BlogArticleRecord | BlogArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<(BlogArticleRecord | BlogArticle)[]>([]);
  const [notFound, setNotFound] = useState<boolean>(false);

  // Filter & Search state
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(6);
  const [hasLoadedMore, setHasLoadedMore] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Desktop Image Floating Cursor State
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isHoveringImage, setIsHoveringImage] = useState(false);

  // Fetch articles from MongoDB
  const fetchDbArticles = async () => {
    try {
      setLoadingDb(true);
      const res = await mongoDB.getPublicBlogs();
      if (res.success && Array.isArray(res.articles) && res.articles.length > 0) {
        setDbArticles(res.articles);
        if (Array.isArray(res.categories) && res.categories.length > 0) {
          setDbCategories(['All', ...res.categories.map((c: any) => c.name)]);
        } else {
          const uniqueCats = Array.from(new Set(res.articles.map(a => a.category))).filter(Boolean);
          setDbCategories(['All', ...uniqueCats]);
        }
      } else {
        // Fallback to seeded blog articles if fresh startup
        setDbArticles(getAllArticles() as any);
        setDbCategories([...BLOG_CATEGORIES]);
      }
    } catch (e) {
      console.warn('MongoDB fetch error, fallback to initial cache:', e);
      setDbArticles(getAllArticles() as any);
      setDbCategories([...BLOG_CATEGORIES]);
    } finally {
      setLoadingDb(false);
    }
  };

  useEffect(() => {
    fetchDbArticles();
    const handleSync = () => fetchDbArticles();
    window.addEventListener('blogs_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('blogs_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Fetch single article from MongoDB when selectedSlug changes
  useEffect(() => {
    if (!selectedSlug) {
      setCurrentArticle(null);
      setNotFound(false);
      return;
    }
    let isCancelled = false;
    const fetchSingle = async () => {
      try {
        const res = await mongoDB.getPublicBlogBySlug(selectedSlug);
        if (isCancelled) return;
        if (res.success && res.article) {
          setCurrentArticle(res.article);
          setRelatedArticles(res.relatedArticles || []);
          setNotFound(false);
        } else {
          // Check local fallback
          const fallback = getArticleBySlug(selectedSlug);
          if (fallback) {
            setCurrentArticle(fallback);
            setRelatedArticles(getRelatedArticles(fallback.slug, fallback.category, 3));
            setNotFound(false);
          } else {
            setCurrentArticle(null);
            setNotFound(true);
          }
        }
      } catch {
        if (!isCancelled) {
          const fallback = getArticleBySlug(selectedSlug);
          if (fallback) {
            setCurrentArticle(fallback);
            setRelatedArticles(getRelatedArticles(fallback.slug, fallback.category, 3));
            setNotFound(false);
          } else {
            setCurrentArticle(null);
            setNotFound(true);
          }
        }
      }
    };
    fetchSingle();
    return () => { isCancelled = true; };
  }, [selectedSlug]);

  // Handle browser popstate and URL synchronization
  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname.toLowerCase();
      if (pathname.startsWith('/blogs/')) {
        const slug = pathname.replace('/blogs/', '').replace(/\/+$/, '');
        setSelectedSlug(slug);
      } else if (pathname === '/blogs') {
        setSelectedSlug(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update URL whenever selected article changes
  const openArticle = (slug: string) => {
    setSelectedSlug(slug);
    try {
      const targetPath = `/blogs/${slug}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ page: 'blogs', slug }, '', targetPath);
      }
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToBlogs = () => {
    setSelectedSlug(null);
    try {
      if (window.location.pathname !== '/blogs') {
        window.history.pushState({ page: 'blogs' }, '', '/blogs');
      }
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleShare = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  // Color Tokens — Carefully Crafted for Light & Dark Editorial Excellence
  const palette = useMemo(() => {
    if (isLight) {
      return {
        bg: '#FEF7EB',
        surface: '#FFFFFF',
        surfaceSecondary: '#F9F1E2',
        surfaceHover: '#FFF9F0',
        primary: '#601D22',
        primaryHover: '#72232B',
        accentGold: '#B45309',
        accentGoldBg: 'rgba(180, 83, 9, 0.08)',
        text: '#3E1117',
        textMuted: '#6B4A4D',
        textSubtle: '#8C676A',
        border: 'rgba(62, 17, 23, 0.10)',
        borderHover: 'rgba(96, 29, 34, 0.30)',
        borderFocus: '#601D22',
        cardShadow: '0 8px 30px rgba(62, 17, 23, 0.04)',
        cardShadowHover: '0 16px 40px rgba(96, 29, 34, 0.12)',
        headerBg: 'rgba(254, 247, 235, 0.92)',
        badgeBg: 'rgba(96, 29, 34, 0.08)',
        badgeText: '#601D22',
        quoteBorder: '#601D22',
        cursorBg: '#601D22',
        cursorText: '#FFFFFF',
      };
    }
    return {
      bg: '#120D0E',
      surface: '#1C1415',
      surfaceSecondary: '#251A1C',
      surfaceHover: '#2A1F21',
      primary: '#A94B55',
      primaryHover: '#C15B66',
      accentGold: '#F59E0B',
      accentGoldBg: 'rgba(245, 158, 11, 0.10)',
      text: '#F8EEE2',
      textMuted: '#D5C5C0',
      textSubtle: '#9A8682',
      border: 'rgba(248, 238, 226, 0.12)',
      borderHover: 'rgba(169, 75, 85, 0.40)',
      borderFocus: '#A94B55',
      cardShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
      cardShadowHover: '0 16px 44px rgba(169, 75, 85, 0.20)',
      headerBg: 'rgba(18, 13, 14, 0.90)',
      badgeBg: 'rgba(169, 75, 85, 0.16)',
      badgeText: '#F5A3AC',
      quoteBorder: '#A94B55',
      cursorBg: '#A94B55',
      cursorText: '#FFFFFF',
    };
  }, [isLight]);

  // Typography Styles
  const serifHeading: React.CSSProperties = {
    fontFamily: "'Playfair Display', Georgia, Cambria, 'Times New Roman', serif",
    letterSpacing: '-0.02em',
  };
  const sansBody: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  // Safe helper extractors for polymorphic database/mock records
  const getAuthorName = (art: any): string => {
    if (!art) return '';
    if (typeof art.author === 'string') return art.author;
    if (art.author && typeof art.author.name === 'string') return art.author.name;
    return art.authorName || 'Mentora Editorial Team';
  };

  const getAuthorRole = (art: any): string => {
    if (!art) return 'Editorial Advisory Board';
    if (art.author && typeof art.author.role === 'string') return art.author.role;
    return art.authorRole || 'Editorial Advisory Board';
  };

  const getArticleImage = (art: any): string => {
    if (!art) return '';
    return art.coverImage || art.image || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80';
  };

  const getArticleDate = (art: any): string => {
    if (!art) return '';
    return art.publishedAt || art.date || '';
  };

  const getArticleExcerpt = (art: any): string => {
    if (!art) return '';
    return art.excerpt || art.summary || '';
  };

  // Active primary featured article from MongoDB (or fallback)
  const featuredArticle = useMemo(() => {
    if (dbArticles.length > 0) {
      return dbArticles.find(a => a.featured) || dbArticles[0];
    }
    return FEATURED_ARTICLE;
  }, [dbArticles]);

  // Standard articles excluding the primary featured article
  const allArticles = useMemo(() => {
    if (dbArticles.length > 0) {
      if (!featuredArticle) return dbArticles;
      return dbArticles.filter(a => a.id !== featuredArticle.id);
    }
    return BLOG_ARTICLES;
  }, [dbArticles, featuredArticle]);

  const filteredArticles = useMemo(() => {
    let list: (BlogArticleRecord | BlogArticle)[] = allArticles;

    // Filter by Category
    if (activeCategory !== 'All') {
      list = list.filter((art) => art.category.toLowerCase() === activeCategory.toLowerCase());
    }

    // Filter by Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (art) =>
          art.title.toLowerCase().includes(q) ||
          ((art.summary || (art as any).excerpt || '').toLowerCase().includes(q)) ||
          art.category.toLowerCase().includes(q) ||
          (Array.isArray(art.keywords) && art.keywords.some((kw) => kw.toLowerCase().includes(q))) ||
          ((typeof art.author === 'string' ? art.author : art.author?.name || (art as any).authorName || '').toLowerCase().includes(q))
      );
    }

    return list;
  }, [allArticles, activeCategory, searchQuery]);

  // Featured article filter check
  const showFeaturedArticle = useMemo(() => {
    if (!featuredArticle) return false;
    const featTitle = featuredArticle.title || '';
    const featSummary = featuredArticle.summary || (featuredArticle as any).excerpt || '';
    const featCat = featuredArticle.category || '';
    const featKw = Array.isArray(featuredArticle.keywords) ? featuredArticle.keywords : [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        featTitle.toLowerCase().includes(q) ||
        featSummary.toLowerCase().includes(q) ||
        featCat.toLowerCase().includes(q) ||
        featKw.some((kw) => kw.toLowerCase().includes(q))
      );
    }
    if (activeCategory === 'All' || activeCategory.toLowerCase() === featCat.toLowerCase()) {
      return true;
    }
    return false;
  }, [searchQuery, activeCategory, featuredArticle]);

  const displayedArticles = useMemo(() => {
    return filteredArticles.slice(0, visibleCount);
  }, [filteredArticles, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => {
      const next = prev + 6;
      if (next >= filteredArticles.length) {
        setHasLoadedMore(true);
      }
      return next;
    });
  };

  // Framer Motion Animation Variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 22 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
  };

  const heroVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
  };

  return (
    <div
      className="min-h-screen transition-colors duration-300 relative overflow-x-hidden selection:bg-amber-500/30"
      style={{
        backgroundColor: palette.bg,
        color: palette.text,
        ...sansBody,
      }}
      onMouseMove={(e) => {
        setCursorPos({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* Interactive Spring Cursor Follower (Desktop only, over article images) */}
      <AnimatePresence>
        {isHoveringImage && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed pointer-events-none z-50 hidden md:flex items-center justify-center rounded-full shadow-2xl backdrop-blur-md"
            style={{
              left: cursorPos.x - 36,
              top: cursorPos.y - 36,
              width: 72,
              height: 72,
              backgroundColor: palette.cursorBg,
              color: palette.cursorText,
              boxShadow: isLight
                ? '0 10px 25px rgba(96, 29, 34, 0.35)'
                : '0 10px 25px rgba(169, 75, 85, 0.5)',
            }}
          >
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider">Read</span>
              <ArrowRight className="w-4 h-4 mt-0.5 animate-pulse" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 1. EDITORIAL HEADER & BRAND NAVIGATION                         */}
      {/* ============================================================== */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl transition-all shadow-md"
        style={{
          borderColor: palette.border,
          backgroundColor: palette.headerBg,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Brand Logo & Back to Mentora */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={() => setPage('landing')}
              className="bg-transparent border-0 p-0 cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-2 group"
              title="Return to Mentora Home"
            >
              <img
                src={isLight ? mentoraLogoHorizontalLight : mentoraLogoHorizontalDark}
                alt="Mentora — Empowering Future Leaders"
                className="h-9 sm:h-10 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = isLight
                    ? '/mentora-logo-horizontal-light.png'
                    : '/mentora-logo-horizontal-dark.png';
                }}
              />
            </button>

            {/* Back to Mentora pill */}
            <button
              onClick={() => setPage('landing')}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all cursor-pointer"
              style={{
                borderColor: palette.border,
                color: palette.textMuted,
                backgroundColor: isLight ? 'rgba(62, 17, 23, 0.04)' : 'rgba(248, 238, 226, 0.05)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = palette.text;
                e.currentTarget.style.borderColor = palette.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = palette.textMuted;
                e.currentTarget.style.borderColor = palette.border;
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Mentora</span>
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs sm:text-sm font-semibold">
            <button
              onClick={() => setPage('landing')}
              className="transition-colors cursor-pointer"
              style={{ color: palette.textMuted }}
              onMouseEnter={(e) => (e.currentTarget.style.color = palette.primary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = palette.textMuted)}
            >
              Home
            </button>

            <button
              onClick={() => {
                setPage('landing');
                setTimeout(() => {
                  document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="transition-colors cursor-pointer"
              style={{ color: palette.textMuted }}
              onMouseEnter={(e) => (e.currentTarget.style.color = palette.primary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = palette.textMuted)}
            >
              How it works
            </button>

            <button
              onClick={() => {
                setPage('landing');
                setTimeout(() => {
                  document.getElementById('stories')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="transition-colors cursor-pointer"
              style={{ color: palette.textMuted }}
              onMouseEnter={(e) => (e.currentTarget.style.color = palette.primary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = palette.textMuted)}
            >
              Stories
            </button>

            <button
              onClick={() => setPage('about')}
              className="transition-colors cursor-pointer"
              style={{ color: palette.textMuted }}
              onMouseEnter={(e) => (e.currentTarget.style.color = palette.primary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = palette.textMuted)}
            >
              About
            </button>

            {/* ACTIVE "BLOGS & ARTICLES" ITEM */}
            <div className="relative py-1 cursor-pointer" onClick={() => backToBlogs()}>
              <span
                className="font-extrabold flex items-center gap-1.5"
                style={{
                  color: palette.primary,
                }}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Blogs & Articles</span>
              </span>
              <motion.span
                layoutId="blogsActiveIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ backgroundColor: palette.primary }}
              />
            </div>
          </nav>

          {/* Right Action Controls: Theme Toggle & Portal / Auth */}
          <div className="flex items-center gap-3">
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center"
                style={{
                  borderColor: palette.border,
                  backgroundColor: palette.surface,
                  color: palette.text,
                }}
                title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                aria-label="Toggle Theme Mode"
              >
                {isLight ? <Moon className="w-4 h-4 text-amber-800" /> : <Sun className="w-4 h-4 text-amber-400" />}
              </button>
            )}

            {userRole ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(userRole === 'client' ? 'client' : (userRole === 'expert' ? 'expert' : 'owner'))}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5"
                  style={{
                    backgroundColor: palette.primary,
                    borderColor: palette.primary,
                    color: '#FFFFFF',
                  }}
                >
                  <span>Portal</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                {onOpenAuth && (
                  <button
                    onClick={() => onOpenAuth('login')}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                    style={{
                      borderColor: palette.border,
                      backgroundColor: palette.surface,
                      color: palette.text,
                    }}
                  >
                    Sign in
                  </button>
                )}
                {onOpenAuth && (
                  <button
                    onClick={() => onOpenAuth('signup', 'expert')}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
                    style={{
                      backgroundColor: palette.primary,
                      color: '#FFFFFF',
                    }}
                  >
                    Join as Expert
                  </button>
                )}
              </div>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl border transition-colors cursor-pointer"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.surface,
                color: palette.text,
              }}
              aria-label="Toggle Navigation Drawer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden px-6 py-5 border-b space-y-3 backdrop-blur-2xl transition-all"
            style={{
              borderColor: palette.border,
              backgroundColor: palette.headerBg,
            }}
          >
            <div className="flex flex-col space-y-2 text-sm font-semibold">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setPage('landing');
                }}
                className="py-2 text-left cursor-pointer flex items-center justify-between"
                style={{ color: palette.textMuted }}
              >
                <span>Home</span>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setPage('landing');
                  setTimeout(() => {
                    document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' });
                  }, 120);
                }}
                className="py-2 text-left cursor-pointer flex items-center justify-between"
                style={{ color: palette.textMuted }}
              >
                <span>How it works</span>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setPage('landing');
                  setTimeout(() => {
                    document.getElementById('stories')?.scrollIntoView({ behavior: 'smooth' });
                  }, 120);
                }}
                className="py-2 text-left cursor-pointer flex items-center justify-between"
                style={{ color: palette.textMuted }}
              >
                <span>Stories</span>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setPage('about');
                }}
                className="py-2 text-left cursor-pointer flex items-center justify-between"
                style={{ color: palette.textMuted }}
              >
                <span>About Mentora</span>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  backToBlogs();
                }}
                className="py-2 text-left cursor-pointer flex items-center justify-between font-bold"
                style={{ color: palette.primary }}
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Blogs & Articles
                </span>
                <Check className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-3 border-t flex flex-col gap-2" style={{ borderColor: palette.border }}>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setPage('landing');
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer flex items-center justify-center gap-2"
                style={{
                  borderColor: palette.border,
                  backgroundColor: palette.surface,
                  color: palette.text,
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Mentora Landing Page
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ============================================================== */}
      {/* 2. DEDICATED ARTICLE DETAIL VIEW / 404 NOT FOUND               */}
      {/* ============================================================== */}
      {selectedSlug && notFound ? (
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <div
            className="p-10 rounded-3xl border shadow-xl"
            style={{
              borderColor: palette.border,
              backgroundColor: palette.surface,
            }}
          >
            <div
              className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-6"
              style={{
                backgroundColor: palette.badgeBg,
                color: palette.primary,
              }}
            >
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1
              className="text-3xl font-extrabold mb-3"
              style={{ color: palette.text, ...serifHeading }}
            >
              Article Not Found
            </h1>
            <p className="text-sm leading-relaxed mb-8" style={{ color: palette.textMuted }}>
              The article you are looking for may have been unpublished, removed, or the link has changed.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={backToBlogs}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white transition-all cursor-pointer shadow-md"
                style={{ backgroundColor: palette.primary }}
              >
                ← Back to Blogs & Articles
              </button>
              <button
                onClick={() => setPage('landing')}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer"
                style={{
                  borderColor: palette.border,
                  backgroundColor: palette.surfaceSecondary,
                  color: palette.text,
                }}
              >
                Back to Home
              </button>
            </div>
          </div>
        </main>
      ) : currentArticle ? (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
          
          {/* Top Return Breadcrumb */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <button
              onClick={backToBlogs}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold px-3.5 py-2 rounded-xl border transition-all cursor-pointer group"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.surface,
                color: palette.primary,
              }}
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>Back to Blogs & Articles</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer"
                style={{
                  borderColor: palette.border,
                  backgroundColor: palette.surface,
                  color: palette.textMuted,
                }}
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Share Article'}</span>
              </button>

              <button
                onClick={() => setPage('landing')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer"
                style={{
                  borderColor: palette.border,
                  backgroundColor: isLight ? 'rgba(62,17,23,0.04)' : 'rgba(248,238,226,0.06)',
                  color: palette.textMuted,
                }}
              >
                <span>Back to Mentora</span>
              </button>
            </div>
          </div>

          {/* Article Header & Metadata */}
          <article>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase"
                style={{
                  backgroundColor: palette.badgeBg,
                  color: palette.badgeText,
                  border: `1px solid ${palette.border}`,
                }}
              >
                {currentArticle.category}
              </span>

              <span
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: palette.textSubtle }}
              >
                <Clock className="w-3.5 h-3.5" />
                {currentArticle.readTime}
              </span>

              <span
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: palette.textSubtle }}
              >
                <Calendar className="w-3.5 h-3.5" />
                {getArticleDate(currentArticle)}
              </span>
            </div>

            {/* Editorial Title */}
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-[1.18] mb-6"
              style={{
                color: palette.text,
                ...serifHeading,
              }}
            >
              {currentArticle.title}
            </h1>

            {/* Author Attribution Card */}
            <div
              className="flex items-center gap-4 py-4 px-5 rounded-2xl border mb-10"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.surface,
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
                style={{
                  backgroundColor: palette.badgeBg,
                  color: palette.primary,
                  border: `1px solid ${palette.border}`,
                }}
              >
                {getAuthorName(currentArticle).charAt(0) || 'M'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm sm:text-base leading-tight" style={{ color: palette.text }}>
                  {getAuthorName(currentArticle)}
                </div>
                <div className="text-xs sm:text-sm truncate mt-0.5" style={{ color: palette.textMuted }}>
                  {getAuthorRole(currentArticle)}
                </div>
              </div>
            </div>

            {/* Hero Article Image */}
            <div
              className="relative rounded-3xl overflow-hidden mb-12 shadow-2xl border"
              style={{
                borderColor: palette.border,
                maxHeight: '520px',
              }}
            >
              <img
                src={getArticleImage(currentArticle)}
                alt={currentArticle.title}
                className="w-full h-[320px] sm:h-[420px] md:h-[480px] object-cover"
                referrerPolicy="no-referrer"
                loading="eager"
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: isLight
                    ? 'linear-gradient(to top, rgba(254, 247, 235, 0.4) 0%, transparent 60%)'
                    : 'linear-gradient(to top, rgba(18, 13, 14, 0.6) 0%, transparent 60%)',
                }}
              />
            </div>

            {/* Key Takeaways Highlight Box */}
            {currentArticle.keyTakeaways && currentArticle.keyTakeaways.length > 0 && (
              <div
                className="p-6 sm:p-8 rounded-3xl border mb-12 shadow-lg"
                style={{
                  borderColor: palette.borderHover,
                  backgroundColor: palette.surfaceSecondary,
                }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div
                    className="p-1.5 rounded-lg"
                    style={{ backgroundColor: palette.badgeBg, color: palette.primary }}
                  >
                    <Award className="w-5 h-5" />
                  </div>
                  <h3
                    className="text-lg sm:text-xl font-bold tracking-tight"
                    style={{ color: palette.text, ...serifHeading }}
                  >
                    Executive Takeaways
                  </h3>
                </div>
                <ul className="space-y-3">
                  {currentArticle.keyTakeaways.map((takeaway, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm sm:text-base leading-relaxed">
                      <CheckCircle2
                        className="w-5 h-5 mt-0.5 flex-shrink-0"
                        style={{ color: palette.primary }}
                      />
                      <span style={{ color: palette.text }}>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Article Content Render */}
            <div className="space-y-8 text-base sm:text-lg leading-relaxed">
              {Array.isArray(currentArticle.sections) && currentArticle.sections.map((section: any, idx: number) => {
                const textContent = section.content || section.text || '';
                if (section.type === 'heading') {
                  return (
                    <h2
                      key={idx}
                      className="text-2xl sm:text-3xl font-bold pt-4 pb-1"
                      style={{ color: palette.text, ...serifHeading }}
                    >
                      {textContent}
                    </h2>
                  );
                }
                if (section.type === 'quote') {
                  return (
                    <div
                      key={idx}
                      className="p-6 sm:p-8 my-8 rounded-2xl border-l-4 border shadow-sm italic relative"
                      style={{
                        borderColor: palette.border,
                        borderLeftColor: palette.quoteBorder,
                        backgroundColor: palette.surface,
                        color: palette.text,
                      }}
                    >
                      <Quote className="w-7 h-7 mb-2 opacity-30" style={{ color: palette.primary }} />
                      <p className="text-lg sm:text-xl font-medium leading-relaxed mb-3">
                        "{textContent}"
                      </p>
                      {(section.quotee || section.author) && (
                        <cite className="not-italic text-xs sm:text-sm font-bold uppercase tracking-wider block" style={{ color: palette.primary }}>
                          — {section.quotee || section.author}
                        </cite>
                      )}
                    </div>
                  );
                }
                if (section.type === 'callout') {
                  return (
                    <div
                      key={idx}
                      className="p-6 rounded-2xl border flex items-start gap-4 shadow-sm"
                      style={{
                        borderColor: palette.borderHover,
                        backgroundColor: isLight ? 'rgba(96, 29, 34, 0.05)' : 'rgba(169, 75, 85, 0.12)',
                        color: palette.text,
                      }}
                    >
                      <Sparkles className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: palette.primary }} />
                      <p className="text-sm sm:text-base font-semibold leading-relaxed">
                        {textContent}
                      </p>
                    </div>
                  );
                }
                if (section.type === 'list') {
                  const items = Array.isArray(section.items)
                    ? section.items
                    : typeof section.content === 'string'
                    ? section.content.split('\n').filter((s: string) => s.trim().length > 0)
                    : [];
                  return (
                    <ul key={idx} className="space-y-3.5 my-4 pl-2">
                      {items.map((item: string, itemIdx: number) => (
                        <li key={itemIdx} className="flex items-start gap-3 text-sm sm:text-base leading-relaxed">
                          <span
                            className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                            style={{ backgroundColor: palette.primary }}
                          />
                          <span style={{ color: palette.text }}>{item.replace(/^[•\-\*]\s*/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p key={idx} style={{ color: palette.text }} className="text-sm sm:text-base leading-relaxed whitespace-pre-line">
                    {textContent}
                  </p>
                );
              })}
            </div>

            {/* Author Footer Bio & Call to Connect */}
            <div
              className="mt-14 pt-8 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
              style={{ borderColor: palette.border }}
            >
              <div>
                <h4 className="text-base font-bold" style={{ color: palette.text }}>
                  Written by {getAuthorName(currentArticle)}
                </h4>
                <p className="text-xs sm:text-sm mt-0.5" style={{ color: palette.textMuted }}>
                  Published in {currentArticle.category} • {getArticleDate(currentArticle)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={backToBlogs}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer"
                  style={{
                    borderColor: palette.border,
                    backgroundColor: palette.surface,
                    color: palette.primary,
                  }}
                >
                  ← Back to All Articles
                </button>

                <button
                  onClick={() => setPage('landing')}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-md text-white"
                  style={{
                    backgroundColor: palette.primary,
                  }}
                >
                  Explore Mentors on Mentora
                </button>
              </div>
            </div>
          </article>

          {/* Related Articles Section */}
          {relatedArticles.length > 0 && (
            <section className="mt-20 pt-12 border-t" style={{ borderColor: palette.border }}>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: palette.primary }}>
                    Keep Learning
                  </span>
                  <h3
                    className="text-2xl sm:text-3xl font-bold mt-1"
                    style={{ color: palette.text, ...serifHeading }}
                  >
                    Related Perspectives
                  </h3>
                </div>
                <button
                  onClick={backToBlogs}
                  className="text-xs sm:text-sm font-bold hover:underline cursor-pointer flex items-center gap-1"
                  style={{ color: palette.primary }}
                >
                  <span>View all</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedArticles.map((rel: any) => (
                  <div
                    key={rel.id}
                    onClick={() => openArticle(rel.slug)}
                    className="group rounded-2xl border p-4 flex flex-col justify-between transition-all duration-300 cursor-pointer"
                    style={{
                      borderColor: palette.border,
                      backgroundColor: palette.surface,
                      boxShadow: palette.cardShadow,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = palette.borderHover;
                      e.currentTarget.style.boxShadow = palette.cardShadowHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = palette.border;
                      e.currentTarget.style.boxShadow = palette.cardShadow;
                    }}
                  >
                    <div>
                      <div className="relative rounded-xl overflow-hidden aspect-[16/10] mb-3">
                        <img
                          src={getArticleImage(rel)}
                          alt={rel.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: palette.primary }}>
                        {rel.category} • {rel.readTime}
                      </span>
                      <h4
                        className="text-base font-bold line-clamp-2 transition-colors duration-200 group-hover:text-amber-600"
                        style={{ color: palette.text, ...serifHeading }}
                      >
                        {rel.title}
                      </h4>
                    </div>

                    <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs" style={{ borderColor: palette.border }}>
                      <span style={{ color: palette.textSubtle }}>{getArticleDate(rel)}</span>
                      <span className="font-bold flex items-center gap-1" style={{ color: palette.primary }}>
                        Read <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      ) : (
        /* ============================================================== */
        /* 3. MAIN BLOGS DIRECTORY VIEW (HERO, CATEGORIES, FEATURED, GRID) */
        /* ============================================================== */
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
          
          {/* Editorial Hero */}
          <motion.div
            variants={heroVariants}
            initial="hidden"
            animate="visible"
            className="text-center max-w-4xl mx-auto mb-12 sm:mb-16"
          >
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest mb-5 border shadow-sm"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.badgeBg,
                color: palette.badgeText,
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>MENTORA INSIGHTS</span>
            </div>

            {/* Main Heading */}
            <h1
              className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.12] mb-6"
              style={{
                color: palette.text,
                ...serifHeading,
              }}
            >
              Experience worth sharing.{' '}
              <span style={{ color: palette.primary }}>Knowledge worth passing on.</span>
            </h1>

            {/* Supporting Text */}
            <p
              className="text-base sm:text-xl leading-relaxed mb-4 max-w-3xl mx-auto"
              style={{ color: palette.textMuted }}
            >
              Explore practical insights, professional lessons, career guidance, and real-world knowledge from experienced mentors and industry professionals.
            </p>

            {/* Subtle Statement */}
            <p
              className="text-xs sm:text-sm font-semibold tracking-wide uppercase italic opacity-85"
              style={{ color: palette.accentGold }}
            >
              Learn from experience. Grow with perspective.
            </p>
          </motion.div>

          {/* Search Bar Section */}
          <div className="max-w-2xl mx-auto mb-10">
            <div
              className="relative flex items-center rounded-2xl border shadow-sm transition-all focus-within:shadow-md"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.surface,
              }}
            >
              <Search className="w-5 h-5 ml-4 flex-shrink-0" style={{ color: palette.textSubtle }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search insights, careers, mentorship, technology..."
                className="w-full py-3.5 pl-3 pr-10 text-sm bg-transparent border-0 outline-none"
                style={{ color: palette.text }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mr-3 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" style={{ color: palette.textSubtle }} />
                </button>
              )}
            </div>
          </div>

          {/* Category Navigation (Horizontally scrollable on mobile) */}
          <div className="mb-12">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 sm:justify-center">
              {(dbCategories.length > 0 ? dbCategories : BLOG_CATEGORIES).map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className="flex-shrink-0 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer border"
                    style={{
                      borderColor: isActive ? palette.primary : palette.border,
                      backgroundColor: isActive ? palette.primary : palette.surface,
                      color: isActive ? '#FFFFFF' : palette.textMuted,
                      boxShadow: isActive ? (isLight ? '0 4px 14px rgba(96,29,34,0.2)' : '0 4px 14px rgba(169,75,85,0.3)') : 'none',
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ============================================================== */}
          {/* FEATURED ARTICLE HERO CARD                                     */}
          {/* ============================================================== */}
          {showFeaturedArticle && featuredArticle && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              onClick={() => openArticle(featuredArticle.slug)}
              className="group relative rounded-3xl border overflow-hidden mb-16 shadow-xl transition-all duration-300 cursor-pointer"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.surface,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = palette.borderHover;
                e.currentTarget.style.boxShadow = palette.cardShadowHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = palette.border;
                e.currentTarget.style.boxShadow = palette.cardShadow;
              }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch">
                {/* Visual Half */}
                <div
                  className="lg:col-span-7 relative overflow-hidden min-h-[300px] sm:min-h-[380px] lg:min-h-[460px]"
                  onMouseEnter={() => setIsHoveringImage(true)}
                  onMouseLeave={() => setIsHoveringImage(false)}
                >
                  <img
                    src={getArticleImage(featuredArticle)}
                    alt={featuredArticle.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    referrerPolicy="no-referrer"
                    loading="eager"
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: isLight
                        ? 'linear-gradient(to right, transparent 60%, rgba(254, 247, 235, 0.2) 100%)'
                        : 'linear-gradient(to right, transparent 60%, rgba(18, 13, 14, 0.4) 100%)',
                    }}
                  />
                  <div className="absolute top-4 left-4">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider backdrop-blur-md shadow-md"
                      style={{
                        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(18, 13, 14, 0.90)',
                        color: palette.primary,
                        border: `1px solid ${palette.border}`,
                      }}
                    >
                      Featured Insight
                    </span>
                  </div>
                </div>

                {/* Editorial Content Half */}
                <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between">
                  <div>
                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-xs mb-3 font-semibold">
                      <span
                        className="px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: palette.badgeBg,
                          color: palette.badgeText,
                        }}
                      >
                        {featuredArticle.category}
                      </span>
                      <span style={{ color: palette.textSubtle }}>•</span>
                      <span className="flex items-center gap-1" style={{ color: palette.textSubtle }}>
                        <Clock className="w-3.5 h-3.5" />
                        {featuredArticle.readTime}
                      </span>
                      <span style={{ color: palette.textSubtle }}>•</span>
                      <span style={{ color: palette.textSubtle }}>{getArticleDate(featuredArticle)}</span>
                    </div>

                    {/* Title */}
                    <h2
                      className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-4 transition-colors duration-200 group-hover:text-amber-600"
                      style={{
                        color: palette.text,
                        ...serifHeading,
                      }}
                    >
                      {featuredArticle.title}
                    </h2>

                    {/* Excerpt */}
                    <p
                      className="text-sm sm:text-base leading-relaxed line-clamp-4 mb-6"
                      style={{ color: palette.textMuted }}
                    >
                      {getArticleExcerpt(featuredArticle)}
                    </p>
                  </div>

                  {/* Card Bottom CTA & Author */}
                  <div className="pt-6 border-t flex items-center justify-between" style={{ borderColor: palette.border }}>
                    <div className="text-xs">
                      <div className="font-bold" style={{ color: palette.text }}>
                        {getAuthorName(featuredArticle)}
                      </div>
                      <div style={{ color: palette.textSubtle }}>
                        {getAuthorRole(featuredArticle)}
                      </div>
                    </div>

                    <div
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold group-hover:underline"
                      style={{ color: palette.primary }}
                    >
                      <span>Read Article</span>
                      <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Section Divider / Label */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b" style={{ borderColor: palette.border }}>
            <h3
              className="text-xl sm:text-2xl font-bold"
              style={{ color: palette.text, ...serifHeading }}
            >
              {activeCategory === 'All' ? 'Latest Publications' : `${activeCategory} Articles`}
              <span className="text-xs font-normal ml-2 font-mono" style={{ color: palette.textSubtle }}>
                ({filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'})
              </span>
            </h3>

            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold hover:underline cursor-pointer"
                style={{ color: palette.primary }}
              >
                Clear Search Filter
              </button>
            )}
          </div>

          {/* ============================================================== */}
          {/* ARTICLE GRID (3 COLUMNS DESKTOP, 2 TABLET, 1 MOBILE)            */}
          {/* ============================================================== */}
          {displayedArticles.length > 0 ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {displayedArticles.map((article: any) => (
                <motion.div
                  key={article.id}
                  variants={cardVariants}
                  onClick={() => openArticle(article.slug)}
                  className="group rounded-3xl border overflow-hidden flex flex-col justify-between transition-all duration-300 cursor-pointer"
                  style={{
                    borderColor: palette.border,
                    backgroundColor: palette.surface,
                    boxShadow: palette.cardShadow,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = palette.borderHover;
                    e.currentTarget.style.boxShadow = palette.cardShadowHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = palette.border;
                    e.currentTarget.style.boxShadow = palette.cardShadow;
                  }}
                >
                  {/* Article Card Visual */}
                  <div>
                    <div
                      className="relative overflow-hidden aspect-[16/10] w-full"
                      onMouseEnter={() => setIsHoveringImage(true)}
                      onMouseLeave={() => setIsHoveringImage(false)}
                    >
                      <img
                        src={getArticleImage(article)}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="absolute top-3 left-3">
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm"
                          style={{
                            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(28, 20, 21, 0.92)',
                            color: palette.primary,
                            border: `1px solid ${palette.border}`,
                          }}
                        >
                          {article.category}
                        </span>
                      </div>
                      <div className="absolute bottom-3 right-3">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold backdrop-blur-md shadow-sm flex items-center gap-1"
                          style={{
                            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.90)' : 'rgba(0, 0, 0, 0.75)',
                            color: palette.text,
                          }}
                        >
                          <Clock className="w-3 h-3" />
                          {article.readTime}
                        </span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-6">
                      <div className="text-[11px] font-medium mb-2" style={{ color: palette.textSubtle }}>
                        {getArticleDate(article)} • {getAuthorName(article)}
                      </div>

                      <h3
                        className="text-lg sm:text-xl font-bold leading-snug mb-3 transition-colors duration-200 group-hover:text-amber-600 line-clamp-2"
                        style={{
                          color: palette.text,
                          ...serifHeading,
                        }}
                      >
                        {article.title}
                      </h3>

                      <p
                        className="text-xs sm:text-sm leading-relaxed line-clamp-3"
                        style={{ color: palette.textMuted }}
                      >
                        {getArticleExcerpt(article)}
                      </p>
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div
                    className="p-6 pt-3 mt-auto border-t flex items-center justify-between text-xs font-bold"
                    style={{ borderColor: palette.border }}
                  >
                    <span style={{ color: palette.textSubtle }}>{getAuthorRole(article).split('&')[0]}</span>
                    <span
                      className="flex items-center gap-1 transition-colors group-hover:underline"
                      style={{ color: palette.primary }}
                    >
                      Read Article
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            /* Clean Empty State */
            <div
              className="py-20 text-center rounded-3xl border my-8"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.surface,
              }}
            >
              <div
                className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4"
                style={{
                  backgroundColor: palette.badgeBg,
                  color: palette.primary,
                }}
              >
                <Search className="w-7 h-7" />
              </div>
              <h4 className="text-xl font-bold mb-2" style={{ color: palette.text, ...serifHeading }}>
                No insights found
              </h4>
              <p className="text-sm max-w-md mx-auto mb-6" style={{ color: palette.textMuted }}>
                Try another keyword or explore a different category.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('All');
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                style={{
                  borderColor: palette.primary,
                  backgroundColor: palette.primary,
                  color: '#FFFFFF',
                }}
              >
                Reset All Filters
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* LOAD MORE BUTTON / ALL ARTICLES LOADED STATE                   */}
          {/* ============================================================== */}
          {filteredArticles.length > 0 && (
            <div className="mt-16 text-center">
              {visibleCount < filteredArticles.length ? (
                <button
                  onClick={handleLoadMore}
                  className="px-8 py-3.5 rounded-2xl text-sm font-bold border transition-all duration-300 shadow-md hover:shadow-lg cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                  style={{
                    borderColor: palette.borderHover,
                    backgroundColor: palette.surface,
                    color: palette.primary,
                  }}
                >
                  Load More Articles ({filteredArticles.length - visibleCount} remaining)
                </button>
              ) : (
                <div
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold border opacity-80"
                  style={{
                    borderColor: palette.border,
                    backgroundColor: palette.surfaceSecondary,
                    color: palette.textMuted,
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>All Articles Loaded</span>
                </div>
              )}
            </div>
          )}

          {/* Back to Mentora Bottom Navigation */}
          <div className="mt-20 pt-10 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold" style={{ borderColor: palette.border }}>
            <button
              onClick={() => setPage('landing')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-all cursor-pointer"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.surface,
                color: palette.primary,
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>← Back to Mentora</span>
            </button>

            <span style={{ color: palette.textSubtle }}>
              Mentora Insights © 2026 • Real-World Knowledge Exchange
            </span>
          </div>
        </main>
      )}
    </div>
  );
};
