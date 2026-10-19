import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Star,
  Layers,
  ArrowUpDown,
  Upload,
  Image as ImageIcon,
  X,
  Check,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  AlignLeft,
  Heading,
  Quote,
  List,
  AlertTriangle,
  Monitor,
  Smartphone,
  Sun,
  Moon
} from 'lucide-react';
import {
  BlogArticleRecord,
  BlogCategoryRecord,
  BlogCMSStats,
  BlogArticleSection
} from '../types';
import { mongoDB } from '../mongoDBService';

interface AdminBlogsDeskProps {
  theme?: 'dark' | 'light';
  onNavigateToPublicBlog?: (slug?: string) => void;
}

const DEFAULT_EDITORIAL_PRESETS = [
  {
    title: 'Mentora Editorial Team',
    role: 'Knowledge Exchange & Senior Advisory Council',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
  },
  {
    title: 'Dr. Sunita Rao',
    role: 'Former Chief Strategy Officer & Senior Advisory Fellow',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80'
  },
  {
    title: 'Krishnan Iyer',
    role: 'Executive Director & Corporate Governance Lead',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80'
  }
];

const CURATED_IMAGE_PRESETS = [
  {
    label: 'Advisory Discussion',
    url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80'
  },
  {
    label: 'Executive Mentorship',
    url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1600&q=80'
  },
  {
    label: 'Leadership Strategy',
    url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1600&q=80'
  },
  {
    label: 'Technology Innovation',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80'
  },
  {
    label: 'Industry Perspective',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80'
  }
];

export const AdminBlogsDesk: React.FC<AdminBlogsDeskProps> = ({
  theme = 'dark',
  onNavigateToPublicBlog
}) => {
  const isLight = theme === 'light';

  // CMS state
  const [articles, setArticles] = useState<BlogArticleRecord[]>([]);
  const [categories, setCategories] = useState<BlogCategoryRecord[]>([]);
  const [stats, setStats] = useState<BlogCMSStats>({
    total: 0,
    published: 0,
    drafts: 0,
    featured: 0,
    categories: 0
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'blog' | 'article'>('all');
  const [featuredFilter, setFeaturedFilter] = useState<'all' | 'true' | 'false'>('all');

  // Active Modals & Views
  const [showEditorModal, setShowEditorModal] = useState<boolean>(false);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [previewArticle, setPreviewArticle] = useState<BlogArticleRecord | null>(null);
  const [deleteConfirmArticle, setDeleteConfirmArticle] = useState<BlogArticleRecord | null>(null);

  // Editor Form State
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [formType, setFormType] = useState<'blog' | 'article'>('article');
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [formCategory, setFormCategory] = useState('');
  const [formExcerpt, setFormExcerpt] = useState('');
  const [formAuthorName, setFormAuthorName] = useState('Mentora Editorial Team');
  const [formAuthorRole, setFormAuthorRole] = useState('Knowledge Exchange & Senior Advisory Council');
  const [formAuthorAvatar, setFormAuthorAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80');
  const [formReadTime, setFormReadTime] = useState('5 min read');
  const [formDate, setFormDate] = useState('October 2026');
  const [formCoverImage, setFormCoverImage] = useState('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80');
  const [formFeatured, setFormFeatured] = useState(false);
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(1);
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('published');
  const [formKeyTakeaways, setFormKeyTakeaways] = useState<string[]>([
    'Tacit judgment is built through lived cycles, not lectures.',
    'Seasoned veterans turn battle scars into mentorship capital.'
  ]);
  const [formSections, setFormSections] = useState<BlogArticleSection[]>([
    { type: 'paragraph', text: 'When professionals reach milestones in their careers, their experience becomes an invaluable asset for organizations and emerging leaders.' },
    { type: 'heading', text: 'The Value of Perspective' },
    { type: 'paragraph', text: 'Experience creates deep context that algorithms and textbooks cannot match.' }
  ]);
  const [formKeywords, setFormKeywords] = useState<string[]>(['experience', 'mentorship', 'advisory']);

  // Category Manager Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [catDeleteError, setCatDeleteError] = useState<string | null>(null);

  // Preview options
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>(theme);

  // Load data from MongoDB
  const loadData = async () => {
    try {
      setLoading(true);
      const res = await mongoDB.getAdminBlogs('admin', {
        status: statusFilter,
        category: categoryFilter,
        type: typeFilter,
        featured: featuredFilter,
        search: searchQuery
      });
      if (res.success) {
        setArticles(res.articles || []);
        if (res.stats) setStats(res.stats);
        if (res.categories) setCategories(res.categories);
      }
    } catch (err: any) {
      console.error('Failed to load admin blogs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for cross-tab or service updates
    const handleSync = () => loadData();
    window.addEventListener('blogs_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('blogs_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [statusFilter, categoryFilter, typeFilter, featuredFilter, searchQuery]);

  // Toast feedback auto-dismiss
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Title -> Slug auto-generation
  const handleTitleChange = (val: string) => {
    setFormTitle(val);
    if (!isSlugManuallyEdited) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setFormSlug(generated);
    }
  };

  // Open Create Form
  const handleOpenCreate = (type: 'blog' | 'article' = 'article') => {
    setEditingArticleId(null);
    setFormType(type);
    setFormTitle('');
    setFormSlug('');
    setIsSlugManuallyEdited(false);
    setFormCategory(categories[0]?.name || 'Mentorship');
    setFormExcerpt('');
    setFormAuthorName('Mentora Editorial Team');
    setFormAuthorRole('Knowledge Exchange & Senior Advisory Council');
    setFormAuthorAvatar('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80');
    setFormReadTime('5 min read');
    setFormDate(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    setFormCoverImage(CURATED_IMAGE_PRESETS[0].url);
    setFormFeatured(false);
    setFormDisplayOrder(articles.length + 1);
    setFormStatus('published');
    setFormKeyTakeaways([
      'Tacit judgment is built through lived cycles, not lectures.',
      'Translating career experience into active mentorship creates lasting impact.'
    ]);
    setFormSections([
      { type: 'paragraph', text: 'Write the opening paragraph of this insight here...' },
      { type: 'heading', text: 'Key Operational Principle' },
      { type: 'paragraph', text: 'Expand on the practical application and lessons learned...' }
    ]);
    setFormKeywords(['experience', 'mentorship', 'advisory']);
    setShowEditorModal(true);
  };

  // Open Edit Form
  const handleOpenEdit = (art: BlogArticleRecord) => {
    setEditingArticleId(art.id);
    setFormType(art.type || 'article');
    setFormTitle(art.title);
    setFormSlug(art.slug);
    setIsSlugManuallyEdited(true);
    setFormCategory(art.category);
    setFormExcerpt(art.excerpt || art.summary || '');
    setFormAuthorName(art.author?.name || art.authorName || 'Mentora Editorial Team');
    setFormAuthorRole(art.author?.role || art.authorRole || 'Knowledge Exchange');
    setFormAuthorAvatar(art.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80');
    setFormReadTime(art.readTime || '5 min read');
    setFormDate(art.date || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    setFormCoverImage(art.coverImage || art.image || CURATED_IMAGE_PRESETS[0].url);
    setFormFeatured(!!art.featured);
    setFormDisplayOrder(typeof art.displayOrder === 'number' ? art.displayOrder : 1);
    setFormStatus(art.status || 'draft');
    setFormKeyTakeaways(Array.isArray(art.keyTakeaways) && art.keyTakeaways.length > 0 ? [...art.keyTakeaways] : ['Actionable takeaway point...']);
    setFormSections(Array.isArray(art.sections) && art.sections.length > 0 ? [...art.sections] : [
      { type: 'paragraph', text: art.content || 'Article content...' }
    ]);
    setFormKeywords(Array.isArray(art.keywords) ? [...art.keywords] : []);
    setShowEditorModal(true);
  };

  // Save / Publish Action
  const handleSaveArticle = async (statusOverride?: 'draft' | 'published') => {
    if (!formTitle.trim()) {
      setFeedback({ type: 'error', message: 'Title is required.' });
      return;
    }
    if (!formSlug.trim()) {
      setFeedback({ type: 'error', message: 'Valid slug is required.' });
      return;
    }
    if (!formCategory.trim()) {
      setFeedback({ type: 'error', message: 'Category is required.' });
      return;
    }

    const targetStatus = statusOverride || formStatus;
    const contentString = formSections.map(s => s.text || (s.items ? s.items.join('\n') : '')).filter(Boolean).join('\n\n');

    if (!formExcerpt.trim() && !contentString.trim()) {
      setFeedback({ type: 'error', message: 'Article content cannot be empty.' });
      return;
    }

    const payload: Partial<BlogArticleRecord> = {
      type: formType,
      title: formTitle.trim(),
      slug: formSlug.trim(),
      excerpt: formExcerpt.trim() || contentString.slice(0, 180),
      summary: formExcerpt.trim() || contentString.slice(0, 180),
      content: contentString,
      sections: formSections,
      category: formCategory.trim(),
      author: {
        name: formAuthorName.trim() || 'Mentora Editorial Team',
        role: formAuthorRole.trim() || 'Knowledge Exchange Council',
        avatar: formAuthorAvatar
      },
      authorName: formAuthorName.trim(),
      authorRole: formAuthorRole.trim(),
      coverImage: formCoverImage,
      image: formCoverImage,
      readTime: formReadTime.trim() || '5 min read',
      status: targetStatus,
      featured: formFeatured,
      displayOrder: formDisplayOrder,
      date: formDate,
      keywords: formKeywords,
      keyTakeaways: formKeyTakeaways
    };

    try {
      setActionLoading(true);
      if (editingArticleId) {
        const res = await mongoDB.updateAdminBlog(editingArticleId, payload, 'admin');
        if (res.success) {
          setFeedback({ type: 'success', message: res.message || 'Article updated successfully.' });
          setShowEditorModal(false);
          await loadData();
        } else {
          setFeedback({ type: 'error', message: res.error || 'Unable to save article. Please try again.' });
        }
      } else {
        const res = await mongoDB.createAdminBlog(payload, 'admin');
        if (res.success) {
          setFeedback({ type: 'success', message: res.message || (targetStatus === 'published' ? 'Article published successfully.' : 'Draft saved successfully.') });
          setShowEditorModal(false);
          await loadData();
        } else {
          setFeedback({ type: 'error', message: res.error || 'Unable to save article. Please try again.' });
        }
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Database update failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle publish / unpublish
  const handleTogglePublish = async (art: BlogArticleRecord) => {
    try {
      setActionLoading(true);
      if (art.status === 'published') {
        const res = await mongoDB.unpublishAdminBlog(art.id, 'admin');
        if (res.success) {
          setFeedback({ type: 'success', message: 'Article unpublished successfully.' });
          await loadData();
        } else {
          setFeedback({ type: 'error', message: res.error || 'Failed to unpublish article.' });
        }
      } else {
        const res = await mongoDB.publishAdminBlog(art.id, 'admin');
        if (res.success) {
          setFeedback({ type: 'success', message: 'Article published successfully.' });
          await loadData();
        } else {
          setFeedback({ type: 'error', message: res.error || 'Failed to publish article.' });
        }
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Operation failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle feature / unfeature
  const handleToggleFeature = async (art: BlogArticleRecord) => {
    try {
      setActionLoading(true);
      const nextFeatured = !art.featured;
      const res = await mongoDB.toggleFeatureAdminBlog(art.id, nextFeatured, 'admin');
      if (res.success) {
        setFeedback({
          type: 'success',
          message: nextFeatured ? 'Article set as primary featured.' : 'Article removed from featured.'
        });
        await loadData();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update featured status.' });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Operation failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete article
  const handleDeleteArticle = async () => {
    if (!deleteConfirmArticle) return;
    try {
      setActionLoading(true);
      const res = await mongoDB.deleteAdminBlog(deleteConfirmArticle.id, 'admin');
      if (res.success) {
        setFeedback({ type: 'success', message: 'Article deleted successfully.' });
        setDeleteConfirmArticle(null);
        await loadData();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Database delete failed.' });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Failed to delete.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      setActionLoading(true);
      const res = await mongoDB.createBlogCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim()
      }, 'admin');
      if (res.success) {
        setFeedback({ type: 'success', message: 'Category created successfully.' });
        setNewCatName('');
        setNewCatDesc('');
        await loadData();
      } else {
        setCatDeleteError(res.error || 'Failed to create category');
      }
    } catch (e: any) {
      setCatDeleteError(e.message || 'Failed to create category');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (catId: string, force = false) => {
    setCatDeleteError(null);
    try {
      setActionLoading(true);
      const res = await mongoDB.deleteBlogCategory(catId, force, 'admin');
      if (res.success) {
        setFeedback({ type: 'success', message: 'Category deleted successfully.' });
        await loadData();
      } else {
        setCatDeleteError(res.error || 'Failed to delete category');
      }
    } catch (e: any) {
      setCatDeleteError(e.message || 'Failed to delete category');
    } finally {
      setActionLoading(false);
    }
  };

  // Cover image file upload handler
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please upload an image under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setFormCoverImage(result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8">
      {/* ==============================================================
          CMS HEADER & KPI STATS
      ============================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-500/10 text-amber-400'}`}>
              <BookOpen size={22} />
            </div>
            <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Blogs & Articles
            </h1>
          </div>
          <p className={`text-xs mt-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Create, manage, publish, and update Mentora's knowledge and insight content.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadData()}
            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-white/10'
            }`}
            title="Refresh from MongoDB"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            onClick={() => setShowCategoryModal(true)}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-white/10'
            }`}
          >
            <Layers size={14} className="text-amber-500" />
            <span>Categories</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500/20 text-amber-500">
              {stats.categories}
            </span>
          </button>

          <div className="relative group">
            <button
              onClick={() => handleOpenCreate('article')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 hover:to-amber-400"
            >
              <Plus size={15} />
              <span>+ Create New</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast Feedback Notification */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 shadow-lg transition-all animate-in fade-in ${
            feedback.type === 'success'
              ? isLight
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-emerald-950/70 text-emerald-200 border-emerald-800/60'
              : isLight
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-rose-950/70 text-rose-200 border-rose-800/60'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="cursor-pointer opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          className={`p-4 rounded-2xl border transition-all ${
            isLight ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-slate-900/60 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Total Articles
            </span>
            <FileText size={16} className="text-amber-500" />
          </div>
          <p className={`text-2xl font-black mt-2 font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {stats.total}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Live in MongoDB</p>
        </div>

        <div
          className={`p-4 rounded-2xl border transition-all ${
            isLight ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-slate-900/60 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Published
            </span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className={`text-2xl font-black mt-2 font-mono text-emerald-500`}>
            {stats.published}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Visible to public</p>
        </div>

        <div
          className={`p-4 rounded-2xl border transition-all ${
            isLight ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-slate-900/60 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Drafts
            </span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className={`text-2xl font-black mt-2 font-mono ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            {stats.drafts}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Hidden from public</p>
        </div>

        <div
          className={`p-4 rounded-2xl border transition-all ${
            isLight ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-slate-900/60 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Featured
            </span>
            <Star size={16} className="text-amber-400 fill-amber-400" />
          </div>
          <p className={`text-2xl font-black mt-2 font-mono text-amber-400`}>
            {stats.featured}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Main hero story</p>
        </div>

        <div
          className={`p-4 rounded-2xl border transition-all col-span-2 sm:col-span-1 ${
            isLight ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-slate-900/60 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Categories
            </span>
            <Layers size={16} className="text-blue-500" />
          </div>
          <p className={`text-2xl font-black mt-2 font-mono text-blue-500`}>
            {stats.categories}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Content topics</p>
        </div>
      </div>

      {/* ==============================================================
          SEARCH & FILTER TOOLBAR
      ============================================================== */}
      <div
        className={`p-4 rounded-2xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/70 border-white/10'
        }`}
      >
        <div className="relative flex-1">
          <Search size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, author, category, or slug..."
            className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs font-medium border outline-none transition-all ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500'
                : 'bg-black/30 border-white/10 text-white focus:border-amber-400'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Status Filter */}
          <div className="flex items-center p-1 rounded-xl border text-xs" style={{ borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }}>
            {(['all', 'published', 'draft'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                  statusFilter === st
                    ? isLight
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-amber-500 text-slate-950 font-bold'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Category Dropdown Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-800 border-white/10 text-slate-200'
            }`}
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id || c.slug} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Featured Filter */}
          <select
            value={featuredFilter}
            onChange={(e) => setFeaturedFilter(e.target.value as any)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-800 border-white/10 text-slate-200'
            }`}
          >
            <option value="all">All Placement</option>
            <option value="true">★ Featured Only</option>
            <option value="false">Standard Stories</option>
          </select>
        </div>
      </div>

      {/* ==============================================================
          CONTENT MANAGEMENT TABLE / RESPONSIVE VIEW
      ============================================================== */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/60 border-white/10'
        }`}
      >
        {articles.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'}`}>
              <BookOpen size={24} />
            </div>
            <h3 className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              No articles found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search criteria or create a new blog article.
            </p>
            <button
              onClick={() => handleOpenCreate('article')}
              className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer"
            >
              + Create Article
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                  isLight ? 'bg-slate-50/80 text-slate-500 border-slate-200' : 'bg-slate-950/60 text-slate-400 border-white/10'
                }`}>
                  <th className="py-3.5 px-4 w-14">Image</th>
                  <th className="py-3.5 px-4">Title & Slug</th>
                  <th className="py-3.5 px-3">Type</th>
                  <th className="py-3.5 px-3">Category</th>
                  <th className="py-3.5 px-3">Author</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Featured</th>
                  <th className="py-3.5 px-3">Published</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-white/5'}`}>
                {articles.map((art) => {
                  const isPub = art.status === 'published';
                  return (
                    <tr
                      key={art.id}
                      className={`transition-colors ${
                        isLight ? 'hover:bg-slate-50/60' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Image Thumbnail */}
                      <td className="py-3 px-4">
                        <div className="w-12 h-10 rounded-lg overflow-hidden border border-white/10 bg-slate-800 flex-shrink-0">
                          <img
                            src={art.coverImage || art.image}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = CURATED_IMAGE_PRESETS[0].url;
                            }}
                          />
                        </div>
                      </td>

                      {/* Title & Slug */}
                      <td className="py-3 px-4 max-w-xs md:max-w-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-bold line-clamp-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {art.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">
                            /{art.slug}
                          </span>
                          <span className="text-[10px] text-slate-500">· {art.readTime || '5 min'}</span>
                        </div>
                      </td>

                      {/* Content Type */}
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          art.type === 'blog'
                            ? isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/40'
                            : isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300 border border-white/10'
                        }`}>
                          {art.type || 'article'}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                          isLight ? 'bg-amber-50 text-amber-900 border border-amber-200/60' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}>
                          {art.category}
                        </span>
                      </td>

                      {/* Author */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={art.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                          />
                          <span className={`text-[11px] font-medium line-clamp-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                            {art.author?.name || art.authorName || 'Editorial'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          isPub
                            ? isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                            : isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isPub ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {art.status}
                        </span>
                      </td>

                      {/* Featured */}
                      <td className="py-3 px-3">
                        {art.featured ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <Star size={11} className="fill-amber-400" />
                            Primary
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                        {art.date || (art.publishedAt ? new Date(art.publishedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Draft')}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {/* Preview Action */}
                          <button
                            onClick={() => setPreviewArticle(art)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/10 text-slate-300'
                            }`}
                            title="Preview Article"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Edit Action */}
                          <button
                            onClick={() => handleOpenEdit(art)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/10 text-slate-300'
                            }`}
                            title="Edit Article"
                          >
                            <Edit3 size={14} />
                          </button>

                          {/* Publish / Unpublish Action */}
                          <button
                            onClick={() => handleTogglePublish(art)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              isPub
                                ? isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                            }`}
                            title={isPub ? 'Unpublish to draft' : 'Publish to live site'}
                          >
                            {isPub ? 'Unpublish' : 'Publish'}
                          </button>

                          {/* Feature / Unfeature Action */}
                          <button
                            onClick={() => handleToggleFeature(art)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              art.featured
                                ? 'text-amber-400 hover:bg-amber-400/10'
                                : isLight ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-600' : 'text-slate-500 hover:bg-white/10 hover:text-slate-300'
                            }`}
                            title={art.featured ? 'Remove from Featured' : 'Set as Featured Article'}
                          >
                            <Star size={14} className={art.featured ? 'fill-amber-400' : ''} />
                          </button>

                          {/* Delete Action */}
                          <button
                            onClick={() => setDeleteConfirmArticle(art)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Article"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==============================================================
          CONTENT EDITOR MODAL (STUDIO)
      ============================================================== */}
      {showEditorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div
            className={`w-full max-w-4xl max-h-[92vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden my-auto ${
              isLight ? 'bg-white border-slate-300' : 'bg-[#0E131F] border-white/10'
            }`}
          >
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-white/10'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h2 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {editingArticleId ? 'Edit Article & Insight' : 'Create New Article / Blog'}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    All updates persist to MongoDB and reflect immediately on public Mentora.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowEditorModal(false)}
                  className={`p-2 rounded-xl border text-slate-400 hover:text-white transition-colors cursor-pointer ${
                    isLight ? 'border-slate-300 hover:bg-slate-100' : 'border-white/10 hover:bg-white/5'
                  }`}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body / Scrollable Content Form */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Type Switcher & Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border" style={{ borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-400 text-[11px] uppercase tracking-wider">Content Type:</span>
                  <div className="flex items-center p-1 rounded-xl bg-slate-800/40 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setFormType('article')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        formType === 'article' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Article
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('blog')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        formType === 'blog' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Blog
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formFeatured}
                      onChange={(e) => setFormFeatured(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
                    />
                    <span className="font-bold text-amber-400 flex items-center gap-1">
                      <Star size={13} className={formFeatured ? 'fill-amber-400' : ''} />
                      Set as Primary Featured Hero
                    </span>
                  </label>
                </div>
              </div>

              {/* Title & Slug */}
              <div className="space-y-3.5">
                <div>
                  <label className="block font-bold mb-1.5 text-slate-400">
                    Article Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. What Decades of Experience Can Teach the Next Generation"
                    className={`w-full px-3.5 py-2.5 rounded-xl border font-semibold text-sm outline-none ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/30 border-white/15 text-white'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-400">
                      URL Slug <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-500">Auto-generated from title</span>
                  </div>
                  <div className="flex items-center">
                    <span className={`px-3 py-2.5 rounded-l-xl border border-r-0 font-mono text-[11px] ${
                      isLight ? 'bg-slate-100 border-slate-300 text-slate-500' : 'bg-slate-950 border-white/15 text-slate-400'
                    }`}>
                      /blogs/
                    </span>
                    <input
                      type="text"
                      value={formSlug}
                      onChange={(e) => {
                        setIsSlugManuallyEdited(true);
                        setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ''));
                      }}
                      placeholder="what-decades-of-experience-can-teach"
                      className={`flex-1 px-3.5 py-2.5 rounded-r-xl border font-mono text-xs outline-none ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/30 border-white/15 text-white'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Category, Read Time, Display Order */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold mb-1.5 text-slate-400">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border font-semibold outline-none cursor-pointer ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/30 border-white/15 text-white'
                    }`}
                  >
                    {categories.map((c) => (
                      <option key={c.id || c.slug} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1.5 text-slate-400">Read Time</label>
                  <input
                    type="text"
                    value={formReadTime}
                    onChange={(e) => setFormReadTime(e.target.value)}
                    placeholder="e.g. 6 min read"
                    className={`w-full px-3.5 py-2.5 rounded-xl border font-semibold outline-none ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/30 border-white/15 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1.5 text-slate-400">Display Order</label>
                  <input
                    type="number"
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(parseInt(e.target.value, 10) || 1)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border font-semibold outline-none ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/30 border-white/15 text-white'
                    }`}
                  />
                </div>
              </div>

              {/* Short Description / Excerpt */}
              <div>
                <label className="block font-bold mb-1.5 text-slate-400">
                  Short Description / Excerpt <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formExcerpt}
                  onChange={(e) => setFormExcerpt(e.target.value)}
                  placeholder="A concise executive summary shown on article cards and search results..."
                  className={`w-full p-3.5 rounded-xl border font-normal text-xs outline-none leading-relaxed ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/30 border-white/15 text-white'
                  }`}
                />
              </div>

              {/* Author Attribution */}
              <div className={`p-4 rounded-2xl border space-y-3 ${
                isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-950/40 border-white/10'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                    Author Information
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">Presets:</span>
                    {DEFAULT_EDITORIAL_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setFormAuthorName(p.title);
                          setFormAuthorRole(p.role);
                          setFormAuthorAvatar(p.avatar);
                        }}
                        className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 cursor-pointer"
                      >
                        {p.title.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Author Name</label>
                    <input
                      type="text"
                      value={formAuthorName}
                      onChange={(e) => setFormAuthorName(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border font-medium ${
                        isLight ? 'bg-white border-slate-300' : 'bg-black/30 border-white/10 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Author Role</label>
                    <input
                      type="text"
                      value={formAuthorRole}
                      onChange={(e) => setFormAuthorRole(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border font-medium ${
                        isLight ? 'bg-white border-slate-300' : 'bg-black/30 border-white/10 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Avatar Photo URL</label>
                    <input
                      type="text"
                      value={formAuthorAvatar}
                      onChange={(e) => setFormAuthorAvatar(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border font-mono text-[10px] ${
                        isLight ? 'bg-white border-slate-300' : 'bg-black/30 border-white/10 text-white'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Cover Image & Presets */}
              <div className={`p-4 rounded-2xl border space-y-3 ${
                isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-950/40 border-white/10'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                    Featured Cover Image
                  </span>
                  <label className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 flex items-center gap-1.5 cursor-pointer">
                    <Upload size={12} />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full sm:w-48 h-28 rounded-xl overflow-hidden border border-white/15 bg-black/40 flex-shrink-0 relative group">
                    <img
                      src={formCoverImage}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = CURATED_IMAGE_PRESETS[0].url;
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-[10px] text-white font-bold">Preview</span>
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Image URL</label>
                      <input
                        type="text"
                        value={formCoverImage}
                        onChange={(e) => setFormCoverImage(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className={`w-full px-3 py-2 rounded-xl border font-mono text-[11px] ${
                          isLight ? 'bg-white border-slate-300' : 'bg-black/30 border-white/10 text-white'
                        }`}
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 mr-2">Curated Presets:</span>
                      <div className="inline-flex gap-1.5 flex-wrap mt-1">
                        {CURATED_IMAGE_PRESETS.map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setFormCoverImage(p.url)}
                            className="px-2 py-0.5 rounded text-[10px] border border-white/10 hover:border-amber-500 cursor-pointer text-slate-400 hover:text-white"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Takeaways Section */}
              <div className={`p-4 rounded-2xl border space-y-3 ${
                isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-950/40 border-white/10'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                    Executive Takeaways
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormKeyTakeaways([...formKeyTakeaways, 'New actionable takeaway point...'])}
                    className="text-[11px] font-bold text-amber-500 hover:underline cursor-pointer"
                  >
                    + Add Takeaway
                  </button>
                </div>

                <div className="space-y-2">
                  {formKeyTakeaways.map((point, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => {
                          const updated = [...formKeyTakeaways];
                          updated[idx] = e.target.value;
                          setFormKeyTakeaways(updated);
                        }}
                        className={`flex-1 px-3 py-1.5 rounded-xl border text-xs ${
                          isLight ? 'bg-white border-slate-300' : 'bg-black/30 border-white/10 text-white'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = formKeyTakeaways.filter((_, i) => i !== idx);
                          setFormKeyTakeaways(updated);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Article Content Blocks / Structured Editor */}
              <div className={`p-4 rounded-2xl border space-y-4 ${
                isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-950/40 border-white/10'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                    Article Content Sections
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500">Insert block:</span>
                    <button
                      type="button"
                      onClick={() => setFormSections([...formSections, { type: 'paragraph', text: 'New paragraph text...' }])}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1 cursor-pointer"
                    >
                      <AlignLeft size={11} /> + Paragraph
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormSections([...formSections, { type: 'heading', text: 'Subheading Title' }])}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1 cursor-pointer"
                    >
                      <Heading size={11} /> + Heading
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormSections([...formSections, { type: 'quote', text: 'Key quote text...', quotee: 'Senior Leader' }])}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1 cursor-pointer"
                    >
                      <Quote size={11} /> + Quote
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormSections([...formSections, { type: 'callout', text: 'Key highlight statement...' }])}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={11} /> + Callout
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {formSections.map((sec, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border relative space-y-2 ${
                        isLight ? 'bg-white border-slate-300 shadow-xs' : 'bg-black/30 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                          {sec.type} {idx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...formSections];
                                const temp = updated[idx];
                                updated[idx] = updated[idx - 1];
                                updated[idx - 1] = temp;
                                setFormSections(updated);
                              }}
                              className="p-1 text-slate-400 hover:text-white"
                              title="Move up"
                            >
                              <ChevronUp size={13} />
                            </button>
                          )}
                          {idx < formSections.length - 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...formSections];
                                const temp = updated[idx];
                                updated[idx] = updated[idx + 1];
                                updated[idx + 1] = temp;
                                setFormSections(updated);
                              }}
                              className="p-1 text-slate-400 hover:text-white"
                              title="Move down"
                            >
                              <ChevronDown size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = formSections.filter((_, i) => i !== idx);
                              setFormSections(updated);
                            }}
                            className="p-1 text-rose-400 hover:text-rose-300"
                            title="Delete block"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {sec.type === 'heading' ? (
                        <input
                          type="text"
                          value={sec.text || ''}
                          onChange={(e) => {
                            const updated = [...formSections];
                            updated[idx].text = e.target.value;
                            setFormSections(updated);
                          }}
                          placeholder="Heading title..."
                          className={`w-full px-3 py-1.5 rounded-lg border font-bold text-sm outline-none ${
                            isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/20 border-white/10 text-white'
                          }`}
                        />
                      ) : sec.type === 'quote' ? (
                        <div className="space-y-2">
                          <textarea
                            rows={2}
                            value={sec.text || ''}
                            onChange={(e) => {
                              const updated = [...formSections];
                              updated[idx].text = e.target.value;
                              setFormSections(updated);
                            }}
                            placeholder="Quote quotation text..."
                            className={`w-full p-2.5 rounded-lg border italic outline-none ${
                              isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/20 border-white/10 text-white'
                            }`}
                          />
                          <input
                            type="text"
                            value={sec.quotee || ''}
                            onChange={(e) => {
                              const updated = [...formSections];
                              updated[idx].quotee = e.target.value;
                              setFormSections(updated);
                            }}
                            placeholder="Quotee attribution (e.g. Dr. Sunita Rao, Advisory Fellow)"
                            className={`w-full px-3 py-1.5 rounded-lg border text-xs outline-none ${
                              isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/20 border-white/10 text-white'
                            }`}
                          />
                        </div>
                      ) : (
                        <textarea
                          rows={3}
                          value={sec.text || ''}
                          onChange={(e) => {
                            const updated = [...formSections];
                            updated[idx].text = e.target.value;
                            setFormSections(updated);
                          }}
                          placeholder="Paragraph text..."
                          className={`w-full p-2.5 rounded-lg border outline-none leading-relaxed ${
                            isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/20 border-white/10 text-white'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className={`px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-white/10'
            }`}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditorModal(false)}
                  className={`px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                    isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const previewObj: BlogArticleRecord = {
                      id: editingArticleId || 'preview-temp',
                      type: formType,
                      title: formTitle,
                      slug: formSlug,
                      excerpt: formExcerpt,
                      summary: formExcerpt,
                      content: formSections.map(s => s.text || '').join('\n\n'),
                      sections: formSections,
                      category: formCategory,
                      author: {
                        name: formAuthorName,
                        role: formAuthorRole,
                        avatar: formAuthorAvatar
                      },
                      authorName: formAuthorName,
                      authorRole: formAuthorRole,
                      coverImage: formCoverImage,
                      image: formCoverImage,
                      readTime: formReadTime,
                      status: formStatus,
                      featured: formFeatured,
                      date: formDate,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      keywords: formKeywords,
                      keyTakeaways: formKeyTakeaways
                    };
                    setPreviewArticle(previewObj);
                  }}
                  className={`px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                    isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Eye size={13} />
                  <span>Preview</span>
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleSaveArticle('draft')}
                  className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      : 'bg-slate-800 border-white/10 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {actionLoading ? 'Saving...' : 'Save Draft'}
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleSaveArticle('published')}
                  className="px-5 py-2 rounded-xl text-xs font-bold transition-all bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:from-emerald-400 hover:to-teal-400 shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{actionLoading ? 'Publishing...' : editingArticleId ? 'Save & Publish' : 'Publish Article'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          CATEGORY MANAGEMENT MODAL
      ============================================================== */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div
            className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${
              isLight ? 'bg-white border-slate-300' : 'bg-[#0E131F] border-white/10'
            }`}
          >
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-white/10'
            }`}>
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-amber-500" />
                <h3 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Manage Content Categories
                </h3>
              </div>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              {catDeleteError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle size={15} className="flex-shrink-0" />
                  <span>{catDeleteError}</span>
                </div>
              )}

              {/* Add New Category Form */}
              <form onSubmit={handleAddCategory} className="space-y-3 p-3.5 rounded-2xl border bg-black/20" style={{ borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }}>
                <span className="font-bold text-[11px] text-slate-400 uppercase tracking-wider block">
                  Add New Category
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Category name (e.g. AI Strategy)..."
                    className={`flex-1 px-3 py-2 rounded-xl border text-xs outline-none ${
                      isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-black/30 border-white/10 text-white'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={!newCatName.trim() || actionLoading}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer disabled:opacity-50"
                  >
                    + Add
                  </button>
                </div>
              </form>

              {/* Category List Table */}
              <div className="space-y-2">
                <span className="font-bold text-[11px] text-slate-400 uppercase tracking-wider block">
                  Active Categories ({categories.length})
                </span>
                <div className="space-y-1.5">
                  {categories.map((c) => {
                    const articleCount = articles.filter(a => (a.category || '').toLowerCase() === (c.name || '').toLowerCase()).length;
                    return (
                      <div
                        key={c.id || c.slug}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-white/5'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              {c.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-amber-500/10 text-amber-500">
                              {articleCount} {articleCount === 1 ? 'article' : 'articles'}
                            </span>
                          </div>
                          {c.description && (
                            <p className="text-[10px] text-slate-500 mt-0.5">{c.description}</p>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            if (articleCount > 0) {
                              if (confirm(`Warning: "${c.name}" is used by ${articleCount} article(s). Force delete category?`)) {
                                handleDeleteCategory(c.id || c.slug, true);
                              }
                            } else {
                              handleDeleteCategory(c.id || c.slug, false);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                          title="Delete category"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          DELETE CONFIRMATION MODAL
      ============================================================== */}
      {deleteConfirmArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isLight ? 'bg-white border-slate-300' : 'bg-[#0E131F] border-white/10'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Delete this article?
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                This action will permanently remove <span className="font-semibold text-white">"{deleteConfirmArticle.title}"</span> from the Blogs & Articles system and database.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteConfirmArticle(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer border ${
                  isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-700' : 'border-white/10 hover:bg-white/5 text-slate-300'
                }`}
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleDeleteArticle}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Delete Article'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          FULL PUBLIC FIDELITY PREVIEW MODAL
      ============================================================== */}
      {previewArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md">
          <div
            className={`w-full max-w-5xl h-[92vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
              previewTheme === 'light' ? 'bg-[#FEF7EB] text-[#3E1117] border-amber-900/20' : 'bg-[#120D0E] text-[#F8EEE2] border-white/10'
            }`}
          >
            {/* Preview Toolbar */}
            <div className={`px-6 py-3 border-b flex items-center justify-between ${
              previewTheme === 'light' ? 'bg-[#F5EDDF] border-[#E8DFC9]' : 'bg-[#1A1315] border-white/10'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
                  Live Public Preview
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 font-mono">
                  /{previewArticle.slug}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Viewport switcher */}
                <div className="flex items-center p-0.5 rounded-lg border border-white/10 bg-black/20">
                  <button
                    onClick={() => setPreviewViewport('desktop')}
                    className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                      previewViewport === 'desktop' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                    title="Desktop layout"
                  >
                    <Monitor size={14} />
                  </button>
                  <button
                    onClick={() => setPreviewViewport('mobile')}
                    className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                      previewViewport === 'mobile' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                    title="Mobile layout"
                  >
                    <Smartphone size={14} />
                  </button>
                </div>

                {/* Theme switcher */}
                <button
                  onClick={() => setPreviewTheme(previewTheme === 'dark' ? 'light' : 'dark')}
                  className="p-1.5 rounded-lg border border-white/10 bg-black/20 text-amber-400 hover:text-white cursor-pointer"
                  title="Toggle Light / Dark Preview"
                >
                  {previewTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </button>

                <button
                  onClick={() => setPreviewArticle(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Preview Document Canvas */}
            <div className="flex-1 overflow-y-auto p-6 md:p-12 flex justify-center">
              <div className={`w-full transition-all ${
                previewViewport === 'mobile' ? 'max-w-md border rounded-3xl p-6 shadow-xl bg-black/10' : 'max-w-3xl'
              }`}>
                {/* Eyebrow */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    previewTheme === 'light' ? 'bg-[#601D22]/10 text-[#601D22]' : 'bg-[#A94B55]/20 text-[#A94B55]'
                  }`}>
                    {previewArticle.category}
                  </span>
                  <span className="text-xs text-slate-400">· {previewArticle.readTime || '5 min read'}</span>
                  {previewArticle.featured && (
                    <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                      <Star size={12} className="fill-amber-400" /> Featured
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight leading-tight mb-4">
                  {previewArticle.title}
                </h1>

                {/* Excerpt */}
                <p className="text-sm sm:text-base leading-relaxed opacity-80 mb-6 font-medium">
                  {previewArticle.excerpt || previewArticle.summary}
                </p>

                {/* Author Info */}
                <div className="flex items-center gap-3 py-4 border-y border-white/10 mb-8">
                  <img
                    src={previewArticle.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <h4 className="text-xs font-bold">{previewArticle.author?.name || 'Mentora Editorial'}</h4>
                    <p className="text-[11px] opacity-70">{previewArticle.author?.role}</p>
                  </div>
                  <span className="ml-auto text-xs opacity-60">
                    {previewArticle.date || 'October 2026'}
                  </span>
                </div>

                {/* Cover Image */}
                <div className="rounded-2xl overflow-hidden mb-8 border border-white/10 shadow-lg">
                  <img
                    src={previewArticle.coverImage || previewArticle.image}
                    alt=""
                    className="w-full h-64 sm:h-80 object-cover"
                  />
                </div>

                {/* Key Takeaways */}
                {Array.isArray(previewArticle.keyTakeaways) && previewArticle.keyTakeaways.length > 0 && (
                  <div className={`p-5 rounded-2xl mb-8 border ${
                    previewTheme === 'light' ? 'bg-[#F5EDDF] border-[#E8DFC9]' : 'bg-[#1C1415] border-white/10'
                  }`}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-3 flex items-center gap-1.5">
                      <Sparkles size={14} /> Executive Key Takeaways
                    </h4>
                    <ul className="space-y-2">
                      {previewArticle.keyTakeaways.map((point, idx) => (
                        <li key={idx} className="text-xs leading-relaxed flex items-start gap-2">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Article Content Sections */}
                <div className="space-y-6 text-sm leading-relaxed">
                  {Array.isArray(previewArticle.sections) && previewArticle.sections.length > 0 ? (
                    previewArticle.sections.map((sec, idx) => {
                      if (sec.type === 'heading') {
                        return (
                          <h3 key={idx} className="text-xl sm:text-2xl font-serif font-bold pt-4">
                            {sec.text}
                          </h3>
                        );
                      }
                      if (sec.type === 'quote') {
                        return (
                          <blockquote key={idx} className="p-4 border-l-4 border-amber-500 italic my-4 rounded-r-xl bg-white/[0.03]">
                            <p className="text-sm font-medium">"{sec.text}"</p>
                            {sec.quotee && <cite className="block text-xs not-italic text-amber-400 mt-2 font-bold">— {sec.quotee}</cite>}
                          </blockquote>
                        );
                      }
                      if (sec.type === 'callout') {
                        return (
                          <div key={idx} className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs font-medium">
                            {sec.text}
                          </div>
                        );
                      }
                      return (
                        <p key={idx} className="opacity-90">
                          {sec.text}
                        </p>
                      );
                    })
                  ) : (
                    <p className="opacity-90 whitespace-pre-line">{previewArticle.content}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
