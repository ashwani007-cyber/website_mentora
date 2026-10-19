import React, { useState, useEffect, useRef } from 'react';
import {
  X, ShieldCheck, FileText, Send, Calendar, Clock, Video, CheckCircle2,
  AlertCircle, ExternalLink, Download, Upload, MessageSquare, History,
  IndianRupee, Sparkles, ChevronRight, User, Award, Paperclip, RefreshCw,
  Archive, Info, Eye, Check, ArrowRight
} from 'lucide-react';
import { ProjectReviewRecord, ProjectReviewMeeting, ProjectReviewProposedTime } from '../types';
import { mongoDB } from '../mongoDBService';
import { notificationService } from '../services/notificationService';

interface ProjectReviewWorkspaceProps {
  projectReviewId: string;
  userRole: 'client' | 'expert' | 'admin';
  currentUserId?: string;
  currentUserEmail?: string;
  currentUserName?: string;
  onClose: () => void;
  onRefreshList?: () => void;
  theme?: 'dark' | 'light';
}

export const ProjectReviewWorkspace: React.FC<ProjectReviewWorkspaceProps> = ({
  projectReviewId,
  userRole,
  currentUserId,
  currentUserEmail,
  currentUserName,
  onClose,
  onRefreshList,
  theme = 'dark'
}) => {
  const isLight = theme === 'light' || (typeof document !== 'undefined' && document.documentElement.classList.contains('theme-light'));

  const [review, setReview] = useState<ProjectReviewRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'documents' | 'chat' | 'scheduling' | 'meetings' | 'findings' | 'financials' | 'timeline'
  >('overview');

  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const handleTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = tabsContainerRef.current;
    if (!el) return;

    if (e.shiftKey || Math.abs(e.deltaX) > 0) return;

    if (el.scrollWidth > el.clientWidth && e.deltaY !== 0) {
      el.scrollLeft += e.deltaY;
    }
  };

  // Form states
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Scheduling states
  const [propDate, setPropDate] = useState('');
  const [propStartTime, setPropStartTime] = useState('14:00');
  const [propEndTime, setPropEndTime] = useState('15:00');
  const [propReason, setPropReason] = useState('Consultation & Walkthrough');
  const [isSubmittingProp, setIsSubmittingProp] = useState(false);

  // Meet link states
  const [activeMeetModal, setActiveMeetModal] = useState<ProjectReviewMeeting | null>(null);
  const [meetLinkInput, setMeetLinkInput] = useState('');
  const [isSavingMeetLink, setIsSavingMeetLink] = useState(false);

  // Submission upload states
  const [subDesc, setSubDesc] = useState('');
  const [subQuestions, setSubQuestions] = useState('');
  const [subRepoUrl, setSubRepoUrl] = useState('');
  const [subDemoUrl, setSubDemoUrl] = useState('');
  const [subFiles, setSubFiles] = useState<Array<{ name: string; url: string; size?: string; uploadedAt: string }>>([]);
  const [isSubmittingDocs, setIsSubmittingDocs] = useState(false);

  // Final review findings state (Expert only)
  const [findingsSummary, setFindingsSummary] = useState('');
  const [findingsRecs, setFindingsRecs] = useState('');
  const [findingsStrengths, setFindingsStrengths] = useState('');
  const [findingsIssues, setFindingsIssues] = useState('');
  const [isSubmittingFindings, setIsSubmittingFindings] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  const loadReviewData = async () => {
    try {
      const data = await mongoDB.getProjectReview(projectReviewId);
      if (data) {
        setReview(data);
        if (data.submission) {
          setSubDesc(data.submission.description || '');
          setSubQuestions(data.submission.questions || '');
          setSubRepoUrl(data.submission.repositoryUrl || '');
          setSubDemoUrl(data.submission.demoUrl || '');
          setSubFiles(data.submission.files || []);
        }
        if (data.reviewFeedback) {
          setFindingsSummary(data.reviewFeedback.summary || '');
          setFindingsRecs((data.reviewFeedback.recommendations || []).join('\n'));
          setFindingsStrengths(data.reviewFeedback.strengths || '');
          setFindingsIssues(data.reviewFeedback.issues || '');
        }
      }
    } catch (e) {
      console.error('Failed to load project review:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReviewData();
    const interval = setInterval(loadReviewData, 2500);

    const handleUpdate = () => loadReviewData();
    window.addEventListener('project_review_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('project_review_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [projectReviewId]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, review?.chat]);

  if (isLoading || !review) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
        <div className="p-6 rounded-2xl border border-white/10 bg-[#0B111A] text-white text-center space-y-3">
          <RefreshCw size={28} className="animate-spin text-amber-400 mx-auto" />
          <p className="text-sm font-bold">Opening Dedicated Project Review Workspace...</p>
          <p className="text-xs text-slate-400 font-mono">{projectReviewId}</p>
        </div>
      </div>
    );
  }

  // Authoritative permissions
  const isClient = userRole === 'client';
  const isExpert = userRole === 'expert';
  const isAdmin = userRole === 'admin';

  // Handling Chat Send
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    setIsSendingChat(true);
    setActionError(null);

    const senderRole = isClient ? 'client' : (isExpert ? 'expert' : 'admin');
    const senderName = currentUserName || (isClient ? review.clientName : (isExpert ? review.expertName : 'Platform Admin'));
    const senderId = currentUserId || (isClient ? review.clientId : review.expertId);

    const result = await mongoDB.sendProjectReviewChat(projectReviewId, {
      senderId,
      senderRole,
      senderName,
      content: chatInput.trim()
    });

    if (result.success && result.projectReview) {
      setReview(result.projectReview);
      setChatInput('');
      notificationService.add({
        target: isClient ? 'expert' : 'client',
        recipientId: isClient ? review.expertEmail : review.clientEmail,
        type: 'message',
        title: `Project Review Message from ${senderName}`,
        message: chatInput.trim().slice(0, 100),
        actionLink: isClient ? 'expert' : 'client'
      });
    } else {
      setActionError(result.error || 'Failed to send message');
    }
    setIsSendingChat(false);
  };

  // Handling Document Submission
  const handleSubmitDocuments = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingDocs(true);
    setActionError(null);

    const result = await mongoDB.submitProjectMaterials(projectReviewId, {
      description: subDesc.trim(),
      questions: subQuestions.trim(),
      repositoryUrl: subRepoUrl.trim(),
      demoUrl: subDemoUrl.trim(),
      files: subFiles
    });

    if (result.success && result.projectReview) {
      setReview(result.projectReview);
      setActionSuccess('Project materials and audit questions submitted successfully!');
      notificationService.add({
        target: 'expert',
        recipientId: review.expertEmail,
        type: 'booking',
        title: 'New Project Materials Uploaded',
        message: `${review.clientName} uploaded project code & audit documents.`,
        actionLink: 'expert'
      });
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(result.error || 'Failed to upload project materials');
    }
    setIsSubmittingDocs(false);
  };

  // Handling Time Proposal
  const handleProposeTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propDate || !propStartTime || !propEndTime) {
      setActionError('Please specify date, start time, and end time');
      return;
    }

    setIsSubmittingProp(false);
    setActionError(null);

    const proposedBy = isClient ? 'client' : 'expert';
    const result = await mongoDB.proposeProjectReviewTime(projectReviewId, {
      proposedBy,
      date: propDate,
      startTime: propStartTime,
      endTime: propEndTime,
      reason: propReason.trim()
    });

    if (result.success && result.projectReview) {
      setReview(result.projectReview);
      setActionSuccess(`Consultation slot proposed for ${propDate} (${propStartTime} - ${propEndTime})`);
      setPropDate('');
      notificationService.add({
        target: isClient ? 'expert' : 'client',
        recipientId: isClient ? review.expertEmail : review.clientEmail,
        type: 'booking',
        title: 'Meeting Slot Proposed',
        message: `${isClient ? review.clientName : review.expertName} proposed a meeting for ${propDate} at ${propStartTime}.`,
        actionLink: isClient ? 'expert' : 'client'
      });
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(result.error || 'Failed to propose meeting time');
    }
  };

  // Handling Proposal Response (Accept / Decline)
  const handleRespondTime = async (proposedTimeId: string, action: 'accept' | 'decline') => {
    setActionError(null);
    const responderRole = isClient ? 'client' : 'expert';
    const result = await mongoDB.respondProjectReviewTime(projectReviewId, proposedTimeId, action, responderRole);

    if (result.success && result.projectReview) {
      setReview(result.projectReview);
      setActionSuccess(action === 'accept' ? 'Meeting confirmed and scheduled!' : 'Proposal declined');
      notificationService.add({
        target: isClient ? 'expert' : 'client',
        recipientId: isClient ? review.expertEmail : review.clientEmail,
        type: 'booking',
        title: action === 'accept' ? 'Meeting Confirmed!' : 'Meeting Proposal Declined',
        message: action === 'accept' ? 'Meeting scheduled. Google Meet link will be generated.' : 'Please propose an alternative time.',
        actionLink: isClient ? 'expert' : 'client'
      });
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(result.error || 'Failed to respond to meeting proposal');
    }
  };

  // Handling Google Meet Generation & Send
  const handleSaveAndSendMeetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMeetModal) return;

    if (!meetLinkInput.trim() || !meetLinkInput.includes('http')) {
      setActionError('Please provide a valid Google Meet URL (e.g. https://meet.google.com/abc-defg-hij)');
      return;
    }

    setIsSavingMeetLink(true);
    setActionError(null);

    const result = await mongoDB.sendProjectReviewMeetLink(
      projectReviewId,
      activeMeetModal.meetingId,
      meetLinkInput.trim()
    );

    if (result.success && result.projectReview) {
      setReview(result.projectReview);
      setActionSuccess(`Google Meet link sent to Client for Meeting #${activeMeetModal.meetingNumber}!`);
      notificationService.add({
        target: 'client',
        recipientId: review.clientEmail,
        type: 'booking',
        title: `Google Meet Link Ready (Meeting ${activeMeetModal.meetingNumber} of 2)`,
        message: `Your Google Meet link for ${activeMeetModal.date} at ${activeMeetModal.startTime} is now active.`,
        actionLink: 'client'
      });
      setActiveMeetModal(null);
      setMeetLinkInput('');
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(result.error || 'Failed to save and send Google Meet link');
    }
    setIsSavingMeetLink(false);
  };

  // Handling Meeting Completion
  const handleCompleteMeeting = async (meetingId: string) => {
    if (!confirm('Mark this meeting as Completed? This will consume 1 of the 2 allowed meeting credits.')) return;

    const result = await mongoDB.completeProjectReviewMeeting(projectReviewId, meetingId);
    if (result.success && result.projectReview) {
      setReview(result.projectReview);
      setActionSuccess('Meeting marked Completed!');
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(result.error || 'Failed to mark meeting complete');
    }
  };

  // Handling Final Review Completion (Expert only)
  const handleCompleteReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findingsSummary.trim()) {
      setActionError('Please provide a summary of your review findings');
      return;
    }

    if (!confirm(`Are you ready to submit your final review findings? This will mark the Project Review completed and release your earning of ₹${review.expertEarning.toLocaleString('en-IN')}.`)) {
      return;
    }

    setIsSubmittingFindings(true);
    setActionError(null);

    const recsList = findingsRecs
      .split('\n')
      .map(r => r.trim())
      .filter(Boolean);

    const result = await mongoDB.completeProjectReview(projectReviewId, {
      summary: findingsSummary.trim(),
      recommendations: recsList,
      strengths: findingsStrengths.trim(),
      issues: findingsIssues.trim()
    });

    if (result.success && result.projectReview) {
      setReview(result.projectReview);
      setActionSuccess(`🎉 Project Review successfully finalized! ₹${review.expertEarning.toLocaleString('en-IN')} released to your Expert Wallet.`);

      notificationService.add({
        target: 'client',
        recipientId: review.clientEmail,
        type: 'booking',
        title: 'Project Review Completed!',
        message: `${review.expertName} has finalized your review and published all architectural findings.`,
        actionLink: 'client'
      });

      notificationService.add({
        target: 'admin',
        type: 'booking',
        title: 'Project Review Completed & Settled',
        message: `${review.expertName} completed review for ${review.clientName}. Payout ₹${review.expertEarning} released.`,
        actionLink: 'owner'
      });

      setTimeout(() => setActionSuccess(null), 5000);
    } else {
      setActionError(result.error || 'Failed to complete review');
    }
    setIsSubmittingFindings(false);
  };

  // Handling History Archive / Soft-delete
  const handleArchive = async () => {
    if (!confirm('Archive this Project Review from your active history? (Audit and financial records remain permanently preserved for administration).')) {
      return;
    }

    const role = isClient ? 'client' : 'expert';
    const result = await mongoDB.archiveProjectReview(projectReviewId, role);
    if (result.success) {
      alert('Review successfully archived from your history.');
      if (onRefreshList) onRefreshList();
      onClose();
    } else {
      setActionError(result.error || 'Failed to archive review');
    }
  };

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PendingExpertAcceptance':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Pending Acceptance</span>;
      case 'Accepted':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Accepted & Active</span>;
      case 'Declined':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Declined</span>;
      case 'ProjectSubmitted':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Project Submitted</span>;
      case 'InReview':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">In Expert Review</span>;
      case 'MeetingRequested':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">Meeting Requested</span>;
      case 'MeetingScheduled':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Meeting Scheduled</span>;
      case 'Completed':
      case 'ReviewCompleted':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">Review Completed</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">{status}</span>;
    }
  };

  if (isLoading || !review) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
        <div className={`flex items-center gap-3 p-6 rounded-2xl border shadow-2xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0B111A] border-white/10 text-white'}`}>
          <RefreshCw className="animate-spin text-amber-400" size={24} />
          <span className="text-sm font-semibold">Loading Dedicated Project Review Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div id="project-review-workspace-root" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        className={`w-full max-w-5xl h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all duration-300 ${
          isLight
            ? 'bg-slate-50 border-slate-200 text-slate-900'
            : 'bg-[#070C15] border-white/10 text-white'
        }`}
      >
        {/* Top Executive Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
              <FileText size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-base truncate">Dedicated Project Review Workspace</h2>
                {getStatusBadge(review.status)}
                <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-black/30 text-slate-400 border border-white/5">
                  ID: {review.projectReviewId}
                </span>
              </div>
              <p className={`text-xs mt-0.5 truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Client: <strong className={isLight ? 'text-slate-900' : 'text-white'}>{review.clientName}</strong> · Expert: <strong className={isLight ? 'text-slate-900' : 'text-white'}>{review.expertName}</strong> · Meetings: <strong className="text-amber-400">{review.completedMeetingCount} / 2 Completed</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadReviewData}
              title="Refresh"
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isLight ? 'border-slate-200 hover:bg-slate-100 text-slate-500' : 'border-white/10 hover:bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isLight ? 'border-slate-200 hover:bg-slate-100 text-slate-500' : 'border-white/10 hover:bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Global Notifications Alert Banner */}
        {actionSuccess && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2.5 text-xs text-emerald-400 flex items-center gap-2 shrink-0">
            <CheckCircle2 size={15} />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-2.5 text-xs text-rose-300 flex items-center gap-2 shrink-0">
            <AlertCircle size={15} />
            <span>{actionError}</span>
          </div>
        )}

        {/* Workspace Navigation Tabs */}
        <div
          ref={tabsContainerRef}
          onWheel={handleTabsWheel}
          className={`px-6 border-b flex items-center gap-1 overflow-x-auto scrollbar-thin shrink-0 select-text ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A]/60 border-white/5'}`}
        >
          {[
            { id: 'overview', label: 'Overview', icon: Info },
            { id: 'documents', label: 'Documents & Code', icon: Upload, count: review.submission ? (review.submission.files?.length || 1) : 0 },
            { id: 'chat', label: 'Private Chat', icon: MessageSquare, count: review.chat?.length || 0 },
            { id: 'scheduling', label: 'Availability & Scheduling', icon: Calendar, count: review.proposedTimes?.length || 0 },
            { id: 'meetings', label: 'Meetings & Google Meet', icon: Video, count: `${review.completedMeetingCount}/2` },
            { id: 'findings', label: 'Review Findings', icon: Award },
            { id: 'financials', label: 'Financials & Wallet', icon: IndianRupee },
            { id: 'timeline', label: 'Activity Audit Trail', icon: History, count: review.activityTimeline?.length || 0 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={(e) => {
                  setActiveTab(tab.id as any);
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }}
                className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-amber-400 text-amber-400'
                    : isLight
                      ? 'border-transparent text-slate-500 hover:text-slate-900'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? 'bg-amber-400/20 text-amber-300'
                      : isLight ? 'bg-slate-200 text-slate-700' : 'bg-white/10 text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Lifecycle Progress Bar */}
              <div className={`p-5 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider mb-4 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Project Review Lifecycle Progression
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {[
                    { step: '1. Request', statusMatch: true, label: 'Initiated' },
                    { step: '2. Decision', statusMatch: review.status !== 'PendingExpertAcceptance', label: review.status === 'Declined' ? 'Declined' : 'Accepted' },
                    { step: '3. Submission', statusMatch: ['ProjectSubmitted', 'InReview', 'MeetingRequested', 'MeetingScheduled', 'Completed'].includes(review.status), label: review.submission ? 'Submitted' : 'Pending' },
                    { step: '4. In Review', statusMatch: ['InReview', 'MeetingRequested', 'MeetingScheduled', 'Completed'].includes(review.status), label: 'Reviewing' },
                    { step: '5. Meeting 1', statusMatch: review.completedMeetingCount >= 1 || review.meetings?.length >= 1, label: review.completedMeetingCount >= 1 ? 'Completed' : (review.meetings?.length ? 'Scheduled' : 'Pending') },
                    { step: '6. Meeting 2', statusMatch: review.completedMeetingCount >= 2, label: review.completedMeetingCount >= 2 ? 'Completed' : 'Optional' },
                    { step: '7. Finalized', statusMatch: review.status === 'Completed', label: review.status === 'Completed' ? 'Released' : 'Pending' },
                  ].map((s, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        s.statusMatch
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                          : isLight ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-[#070C15] border-white/5 text-slate-500'
                      }`}
                    >
                      <p className="text-[10px] uppercase font-bold">{s.step}</p>
                      <p className="text-xs font-bold mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid Cards: Scope, Details & Participants */}
              <div className="grid md:grid-cols-2 gap-5">
                {/* Details Card */}
                <div className={`p-5 rounded-2xl border space-y-3.5 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <FileText size={16} className="text-amber-400" />
                    Review Specification
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className={`block text-[10px] uppercase font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Review Type</span>
                      <p className="font-medium mt-0.5">{review.reviewType || 'Full Architecture & Code Review'}</p>
                    </div>
                    <div>
                      <span className={`block text-[10px] uppercase font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Expected Scope</span>
                      <p className="font-medium mt-0.5">{review.expectedScope || 'Document audit + 2 strategic consultation calls'}</p>
                    </div>
                    <div>
                      <span className={`block text-[10px] uppercase font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Client Objectives / Request Notes</span>
                      <p className={`p-3 rounded-xl border italic mt-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'}`}>
                        "{review.requestNotes || 'No notes provided'}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Financial & Meeting Status Card */}
                <div className={`p-5 rounded-2xl border space-y-3.5 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <IndianRupee size={16} className="text-amber-400" />
                    Financial & Operational Summary
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'}`}>
                      <span className={`text-[10px] uppercase font-bold block ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Package Price</span>
                      <span className="text-base font-bold font-mono text-amber-400">₹{review.price.toLocaleString('en-IN')}</span>
                      <span className={`text-[10px] block mt-0.5 ${review.paymentStatus === 'PaymentSuccessful' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {review.paymentStatus}
                      </span>
                    </div>

                    <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'}`}>
                      <span className={`text-[10px] uppercase font-bold block ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Expert Earning</span>
                      <span className="text-base font-bold font-mono text-emerald-400">₹{review.expertEarning.toLocaleString('en-IN')}</span>
                      <span className={`text-[10px] block mt-0.5 ${review.expertEarningStatus === 'EarningReleased' ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {review.expertEarningStatus}
                      </span>
                    </div>
                  </div>

                  <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'}`}>
                    <div>
                      <span className="font-bold block">Strict 2-Meeting Quota</span>
                      <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Maximum 2 completed strategy calls</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-base font-bold text-amber-400">
                        {review.completedMeetingCount} / 2
                      </span>
                      <span className="text-[10px] block text-slate-400">Completed</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {review.status === 'Completed' && (
                    <div className="pt-2">
                      <button
                        onClick={handleArchive}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-700' : 'border-white/10 hover:bg-white/5 text-slate-300'
                        }`}
                      >
                        <Archive size={14} />
                        <span>Archive from My History</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DOCUMENTS & SUBMISSION */}
          {activeTab === 'documents' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {review.submission ? (
                <div className={`p-6 rounded-2xl border space-y-5 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
                  <div className="flex items-center justify-between border-b pb-4">
                    <div>
                      <h3 className="font-bold text-base flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-emerald-400" />
                        Client Submission Package (v{review.submission.version})
                      </h3>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Submitted on {new Date(review.submission.submittedAt).toLocaleString()}
                      </p>
                    </div>
                    {isClient && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Active Submission
                      </span>
                    )}
                  </div>

                  {/* Description & Questions */}
                  <div className="space-y-4 text-xs">
                    <div>
                      <span className={`block font-bold uppercase tracking-wider mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Project Architecture & Architecture Description
                      </span>
                      <div className={`p-4 rounded-xl border leading-relaxed ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'}`}>
                        {review.submission.description}
                      </div>
                    </div>

                    {review.submission.questions && (
                      <div>
                        <span className={`block font-bold uppercase tracking-wider mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Key Review Inquiries & Questions for Expert
                        </span>
                        <div className={`p-4 rounded-xl border leading-relaxed ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'}`}>
                          {review.submission.questions}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Links & Repositories */}
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    {review.submission.repositoryUrl && (
                      <a
                        href={review.submission.repositoryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition-all group ${
                          isLight ? 'bg-slate-50 border-slate-200 hover:border-amber-500' : 'bg-[#070C15] border-white/10 hover:border-amber-400'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <span className={`text-[10px] uppercase font-bold block ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Git Repository</span>
                          <span className="font-mono font-medium truncate block">{review.submission.repositoryUrl}</span>
                        </div>
                        <ExternalLink size={16} className="text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                      </a>
                    )}

                    {review.submission.demoUrl && (
                      <a
                        href={review.submission.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition-all group ${
                          isLight ? 'bg-slate-50 border-slate-200 hover:border-amber-500' : 'bg-[#070C15] border-white/10 hover:border-amber-400'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <span className={`text-[10px] uppercase font-bold block ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Live Demo / Staging URL</span>
                          <span className="font-mono font-medium truncate block">{review.submission.demoUrl}</span>
                        </div>
                        <ExternalLink size={16} className="text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                      </a>
                    )}
                  </div>

                  {/* Attached Files List */}
                  {review.submission.files && review.submission.files.length > 0 && (
                    <div className="space-y-2">
                      <span className={`block text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Attached Project Files & Documents ({review.submission.files.length})
                      </span>
                      <div className="space-y-2">
                        {review.submission.files.map((f, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <FileText size={16} className="text-amber-400" />
                              <span className="font-medium">{f.name}</span>
                              {f.size && <span className="text-[10px] text-slate-500">({f.size})</span>}
                            </div>
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 flex items-center gap-1 transition-all"
                            >
                              <Download size={12} /> Download
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                !isClient && (
                  <div className={`p-8 rounded-2xl border text-center space-y-2 ${isLight ? 'bg-white border-slate-200 text-slate-500' : 'bg-[#0B111A] border-white/10 text-slate-400'}`}>
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
                      <Upload size={22} />
                    </div>
                    <h4 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Awaiting Client Project Materials</h4>
                    <p className="text-xs max-w-md mx-auto leading-relaxed">
                      The client has not yet uploaded architectural specifications, GitHub repositories, or audit questions. You will receive an immediate notification as soon as the client submits their documents.
                    </p>
                  </div>
                )
              )}

              {/* Client Upload Form (available if not yet completed) */}
              {isClient && review.status !== 'Completed' && (
                <div className={`p-6 rounded-2xl border space-y-4 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Upload size={16} className="text-amber-400" />
                    {review.submission ? 'Update / Resubmit Project Materials (New Version)' : 'Submit Project Materials for Review'}
                  </h3>

                  <form onSubmit={handleSubmitDocuments} className="space-y-4 text-xs">
                    <div>
                      <label className="font-bold uppercase tracking-wider block mb-1 text-slate-400">
                        Project Description & Architecture Overview
                      </label>
                      <textarea
                        rows={3}
                        value={subDesc}
                        onChange={(e) => setSubDesc(e.target.value)}
                        placeholder="Provide details about system architecture, tech stack, codebase structure..."
                        className={`w-full p-3 rounded-xl border outline-none font-medium resize-none ${
                          isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#070C15] border-white/10 text-white focus:border-amber-400'
                        }`}
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold uppercase tracking-wider block mb-1 text-slate-400">
                        Specific Questions or Vulnerabilities to Review
                      </label>
                      <textarea
                        rows={2}
                        value={subQuestions}
                        onChange={(e) => setSubQuestions(e.target.value)}
                        placeholder="What specific problems, bottlenecks, or trade-offs should the expert focus on?"
                        className={`w-full p-3 rounded-xl border outline-none font-medium resize-none ${
                          isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#070C15] border-white/10 text-white focus:border-amber-400'
                        }`}
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold uppercase tracking-wider block mb-1 text-slate-400">
                          GitHub / Repository URL
                        </label>
                        <input
                          type="url"
                          value={subRepoUrl}
                          onChange={(e) => setSubRepoUrl(e.target.value)}
                          placeholder="https://github.com/org/repo"
                          className={`w-full p-2.5 rounded-xl border outline-none font-medium ${
                            isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#070C15] border-white/10 text-white focus:border-amber-400'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="font-bold uppercase tracking-wider block mb-1 text-slate-400">
                          Live Application / Staging URL
                        </label>
                        <input
                          type="url"
                          value={subDemoUrl}
                          onChange={(e) => setSubDemoUrl(e.target.value)}
                          placeholder="https://staging.myapp.com"
                          className={`w-full p-2.5 rounded-xl border outline-none font-medium ${
                            isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#070C15] border-white/10 text-white focus:border-amber-400'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isSubmittingDocs}
                        className="px-6 py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-2"
                      >
                        <Upload size={14} />
                        <span>{isSubmittingDocs ? 'Uploading...' : 'Submit Project Materials'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PRIVATE CHAT */}
          {activeTab === 'chat' && (
            <div className={`flex flex-col h-[70vh] max-w-4xl mx-auto rounded-2xl border overflow-hidden ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0B111A] border-white/10'
            }`}>
              {/* Chat Header */}
              <div className={`px-5 py-3 border-b flex items-center justify-between ${
                isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-[#0F1724]'
              }`}>
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className={isLight ? 'text-amber-500' : 'text-amber-400'} />
                  <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Dedicated Client ↔ Expert Channel
                  </span>
                  <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    ({review.chat?.length || 0} messages)
                  </span>
                </div>
                <span className={`text-[11px] font-mono ${isLight ? 'text-amber-600 font-semibold' : 'text-amber-400/80'}`}>
                  {review.clientName} ↔ {review.expertName}
                </span>
              </div>

              {/* Chat Message List */}
              <div className={`flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin ${
                isLight ? 'bg-white' : 'bg-[#0B111A]'
              }`}>
                {review.chat?.length === 0 ? (
                  <div className={`text-center py-12 text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    No messages yet. Send a message to discuss project details or consultation availability!
                  </div>
                ) : (
                  review.chat?.map((msg) => {
                    const isMe = (isClient && msg.senderRole === 'client') || (isExpert && msg.senderRole === 'expert');
                    const isSystem = msg.senderRole === 'system';

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="text-center my-2">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-mono border ${
                            isLight
                              ? 'bg-slate-100 border-slate-200 text-slate-600'
                              : 'bg-white/5 border-white/10 text-slate-300'
                          }`}>
                            {msg.content} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className={`text-[10px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            {msg.senderName}
                          </span>
                          <span className={`text-[9px] font-mono ${isLight ? 'text-slate-400' : 'text-slate-400'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div
                          className={`max-w-[80%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                            isMe
                              ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none shadow-sm'
                              : isLight
                                ? 'bg-slate-100 text-slate-900 border border-slate-200/80 rounded-tl-none shadow-xs'
                                : 'bg-[#111A27] text-white border border-white/10 rounded-tl-none'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          {msg.attachmentUrl && (
                            <a
                              href={msg.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={`mt-2 inline-flex items-center gap-1 text-[11px] underline opacity-90 ${
                                isMe
                                  ? 'text-slate-950 hover:text-black font-semibold'
                                  : isLight
                                    ? 'text-amber-700 hover:text-amber-800 font-semibold'
                                    : 'text-amber-400 hover:text-amber-300'
                              }`}
                            >
                              <Paperclip size={11} /> {msg.attachmentName || 'Attachment'}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Footer */}
              <form
                onSubmit={handleSendChat}
                className={`p-3 border-t flex items-center gap-2 ${
                  isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-[#0F1724]'
                }`}
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message or discuss meeting availability..."
                  className={`flex-1 px-4 py-2.5 rounded-xl border text-xs outline-none transition-colors ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-amber-500'
                      : 'bg-[#070C15] border-white/10 text-white placeholder:text-slate-500 focus:border-amber-400'
                  }`}
                />
                <button
                  type="submit"
                  disabled={isSendingChat || !chatInput.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Send size={14} />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: AVAILABILITY & SCHEDULING */}
          {activeTab === 'scheduling' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className={`p-5 rounded-2xl border space-y-4 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Calendar size={16} className="text-amber-400" />
                      Propose Mutual Consultation Time
                    </h3>
                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Discuss and confirm a slot for one of the 2 strategic Google Meet sessions
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    Completed Meetings: {review.completedMeetingCount} / 2
                  </span>
                </div>

                {review.completedMeetingCount >= 2 ? (
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs">
                    Maximum 2 completed meetings limit has been reached for this Project Review.
                  </div>
                ) : (
                  <form onSubmit={handleProposeTime} className="grid sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="font-bold block mb-1 text-slate-400">Date</label>
                      <input
                        type="date"
                        value={propDate}
                        onChange={(e) => setPropDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className={`w-full p-2.5 rounded-xl border outline-none font-medium ${
                          isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#070C15] border-white/10 text-white focus:border-amber-400'
                        }`}
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold block mb-1 text-slate-400">Start Time</label>
                      <input
                        type="time"
                        value={propStartTime}
                        onChange={(e) => setPropStartTime(e.target.value)}
                        className={`w-full p-2.5 rounded-xl border outline-none font-medium ${
                          isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#070C15] border-white/10 text-white focus:border-amber-400'
                        }`}
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold block mb-1 text-slate-400">End Time</label>
                      <input
                        type="time"
                        value={propEndTime}
                        onChange={(e) => setPropEndTime(e.target.value)}
                        className={`w-full p-2.5 rounded-xl border outline-none font-medium ${
                          isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500' : 'bg-[#070C15] border-white/10 text-white focus:border-amber-400'
                        }`}
                        required
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={isSubmittingProp}
                        className="w-full py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-black shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Calendar size={14} />
                        <span>Propose Slot</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Proposed Slots List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Proposed Consultation Times ({review.proposedTimes?.length || 0})
                </h4>

                {review.proposedTimes?.length === 0 ? (
                  <div className={`p-8 text-center rounded-2xl border text-xs text-slate-500 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
                    No proposed meeting times yet. Use the form above to propose a date & time.
                  </div>
                ) : (
                  review.proposedTimes?.map((p) => {
                    const isProposedByMe = (isClient && p.proposedBy === 'client') || (isExpert && p.proposedBy === 'expert');
                    return (
                      <div
                        key={p.id}
                        className={`p-4 rounded-xl border flex items-center justify-between text-xs transition-all ${
                          p.status === 'accepted'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : p.status === 'declined'
                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              : isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl font-bold ${
                            p.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            <Clock size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-sm">
                              {p.date} · {p.startTime} - {p.endTime}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Proposed by <strong className="text-white">{p.proposedBy === 'client' ? review.clientName : review.expertName}</strong>
                              {p.reason ? ` · "${p.reason}"` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                            p.status === 'accepted'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : p.status === 'declined'
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          }`}>
                            {p.status}
                          </span>

                          {p.status === 'pending' && !isProposedByMe && review.completedMeetingCount < 2 && (
                            <div className="flex gap-1.5 ml-2">
                              <button
                                onClick={() => handleRespondTime(p.id, 'accept')}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black transition-all cursor-pointer"
                              >
                                Accept & Schedule
                              </button>
                              <button
                                onClick={() => handleRespondTime(p.id, 'decline')}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-all cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MEETINGS & GOOGLE MEET */}
          {activeTab === 'meetings' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Limit Counter Header Card */}
              <div className={`p-5 rounded-2xl border flex items-center justify-between ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Video size={16} className="text-amber-400" />
                    Dedicated Project Review Meetings
                  </h3>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Separate from 60-minute standard bookings · Maximum 2 completed strategy calls
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xl font-bold text-amber-400">
                    Meetings Used: {review.completedMeetingCount} / 2
                  </span>
                  <span className="text-[10px] block text-slate-400">Strictly Enforced Quota</span>
                </div>
              </div>

              {/* Meetings List */}
              <div className="space-y-4">
                {review.meetings?.length === 0 ? (
                  <div className={`p-8 text-center rounded-2xl border text-xs text-slate-500 space-y-2 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
                    <Calendar size={28} className="mx-auto text-slate-600" />
                    <p className="font-bold text-sm text-slate-300">No Meetings Scheduled Yet</p>
                    <p>Go to "Availability & Scheduling" tab to propose and confirm a mutually available consultation time.</p>
                  </div>
                ) : (
                  review.meetings?.map((m) => (
                    <div
                      key={m.meetingId}
                      className={`p-5 rounded-2xl border space-y-4 transition-all ${
                        m.meetingStatus === 'Completed'
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                          : isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10 text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-sm">
                            #{m.meetingNumber}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm">Meeting {m.meetingNumber} of 2</h4>
                            <p className="text-xs text-slate-400">
                              {m.date} · {m.startTime} - {m.endTime}
                            </p>
                          </div>
                        </div>

                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          m.meetingStatus === 'Completed'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : m.googleMeetLink
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {m.meetingStatus}
                        </span>
                      </div>

                      {/* Google Meet Link Display */}
                      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'
                      }`}>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Google Meet Room</span>
                          {m.googleMeetLink ? (
                            <span className="font-mono text-amber-400 truncate block mt-0.5">{m.googleMeetLink}</span>
                          ) : (
                            <span className="text-slate-500 italic">No Google Meet link attached yet</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {m.googleMeetLink ? (
                            <a
                              href={m.googleMeetLink}
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-black flex items-center gap-1.5 shadow transition-all"
                            >
                              <Video size={14} />
                              <span>Join Google Meet</span>
                            </a>
                          ) : (
                            isExpert && (
                              <button
                                onClick={() => {
                                  setActiveMeetModal(m);
                                  setMeetLinkInput('');
                                  // Open Google Meet creation tab
                                  window.open('https://meet.google.com/new', '_blank');
                                }}
                                className="px-4 py-2 rounded-xl font-bold bg-indigo-500 hover:bg-indigo-400 text-white flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Video size={14} />
                                <span>Generate Google Meet Meeting</span>
                              </button>
                            )
                          )}

                          {m.meetingStatus !== 'Completed' && (isExpert || isAdmin) && (
                            <button
                              onClick={() => handleCompleteMeeting(m.meetingId)}
                              className="px-3 py-2 rounded-xl text-xs font-bold border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer"
                            >
                              Mark Completed
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Expert Google Meet Link Modal */}
              {activeMeetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                  <div className="w-full max-w-lg p-6 rounded-2xl border border-white/10 bg-[#0B111A] text-white space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <Video size={16} className="text-amber-400" />
                        Send Google Meet Link (Meeting #{activeMeetModal.meetingNumber})
                      </h4>
                      <button onClick={() => setActiveMeetModal(null)} className="text-slate-400 hover:text-white">
                        <X size={16} />
                      </button>
                    </div>

                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
                      <p className="font-bold">Google Meet Opened in New Tab</p>
                      <p className="opacity-90">
                        1. Create the instant meeting in the Google Meet tab.
                        <br />2. Copy the generated meeting link (e.g. https://meet.google.com/xyz-abcd-efg).
                        <br />3. Paste the link below and click Send Meeting Link.
                      </p>
                    </div>

                    <form onSubmit={handleSaveAndSendMeetLink} className="space-y-4 text-xs">
                      <div>
                        <label className="font-bold block mb-1 text-slate-400">Google Meet URL</label>
                        <input
                          type="url"
                          value={meetLinkInput}
                          onChange={(e) => setMeetLinkInput(e.target.value)}
                          placeholder="https://meet.google.com/..."
                          className="w-full p-3 rounded-xl border border-white/10 bg-[#070C15] text-white outline-none focus:border-amber-400 font-mono"
                          required
                          autoFocus
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveMeetModal(null)}
                          className="px-4 py-2 rounded-xl font-bold border border-white/10 hover:bg-white/5 text-slate-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingMeetLink}
                          className="px-5 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-black shadow transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Send size={14} />
                          <span>{isSavingMeetLink ? 'Sending...' : 'Send Meeting Link'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: REVIEW FINDINGS */}
          {activeTab === 'findings' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {review.reviewFeedback ? (
                <div className={`p-6 rounded-2xl border space-y-5 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
                  <div className="flex items-center justify-between border-b pb-4">
                    <div>
                      <h3 className="font-bold text-base flex items-center gap-2">
                        <Award size={18} className="text-amber-400" />
                        Final Project Review Audit & Findings
                      </h3>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Completed by {review.expertName} on {new Date(review.reviewFeedback.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Audit Finalized
                    </span>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <span className={`block font-bold uppercase tracking-wider mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Executive Summary
                      </span>
                      <div className={`p-4 rounded-xl border leading-relaxed ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'}`}>
                        {review.reviewFeedback.summary}
                      </div>
                    </div>

                    {review.reviewFeedback.strengths && (
                      <div>
                        <span className={`block font-bold uppercase tracking-wider mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Key Architectural Strengths
                        </span>
                        <div className={`p-4 rounded-xl border leading-relaxed text-emerald-300 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'}`}>
                          {review.reviewFeedback.strengths}
                        </div>
                      </div>
                    )}

                    {review.reviewFeedback.issues && (
                      <div>
                        <span className={`block font-bold uppercase tracking-wider mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Vulnerabilities & Identified Bottlenecks
                        </span>
                        <div className={`p-4 rounded-xl border leading-relaxed text-amber-300 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'}`}>
                          {review.reviewFeedback.issues}
                        </div>
                      </div>
                    )}

                    {review.reviewFeedback.recommendations && review.reviewFeedback.recommendations.length > 0 && (
                      <div>
                        <span className={`block font-bold uppercase tracking-wider mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Strategic Recommendations
                        </span>
                        <div className="space-y-1.5">
                          {review.reviewFeedback.recommendations.map((rec, i) => (
                            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                              <span className="font-bold text-amber-400">#{i + 1}</span>
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Expert Submission Form */}
              {isExpert && review.status !== 'Completed' && (
                <div className={`p-6 rounded-2xl border space-y-4 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Award size={16} className="text-amber-400" />
                    Submit Final Project Review Findings & Release Earning
                  </h3>

                  <form onSubmit={handleCompleteReview} className="space-y-4 text-xs">
                    <div>
                      <label className="font-bold uppercase tracking-wider block mb-1 text-slate-400">
                        Executive Summary & Assessment
                      </label>
                      <textarea
                        rows={3}
                        value={findingsSummary}
                        onChange={(e) => setFindingsSummary(e.target.value)}
                        placeholder="Summarize your evaluation, overall architecture quality, and strategic conclusions..."
                        className="w-full p-3 rounded-xl border border-white/10 bg-[#070C15] text-white outline-none focus:border-amber-400 resize-none font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold uppercase tracking-wider block mb-1 text-slate-400">
                        Architectural Strengths
                      </label>
                      <textarea
                        rows={2}
                        value={findingsStrengths}
                        onChange={(e) => setFindingsStrengths(e.target.value)}
                        placeholder="What parts of the system are well engineered?"
                        className="w-full p-3 rounded-xl border border-white/10 bg-[#070C15] text-white outline-none focus:border-amber-400 resize-none font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-bold uppercase tracking-wider block mb-1 text-slate-400">
                        Vulnerabilities & Identified Bottlenecks
                      </label>
                      <textarea
                        rows={2}
                        value={findingsIssues}
                        onChange={(e) => setFindingsIssues(e.target.value)}
                        placeholder="What performance limits or security risks were identified?"
                        className="w-full p-3 rounded-xl border border-white/10 bg-[#070C15] text-white outline-none focus:border-amber-400 resize-none font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-bold uppercase tracking-wider block mb-1 text-slate-400">
                        Recommendations (one per line)
                      </label>
                      <textarea
                        rows={3}
                        value={findingsRecs}
                        onChange={(e) => setFindingsRecs(e.target.value)}
                        placeholder="e.g. Deploy Redis caching in front of PostgreSQL&#10;Add circuit breakers for third party payment gateway"
                        className="w-full p-3 rounded-xl border border-white/10 bg-[#070C15] text-white outline-none focus:border-amber-400 resize-none font-medium"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isSubmittingFindings}
                        className="px-6 py-2.5 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-2"
                      >
                        <Check size={14} />
                        <span>{isSubmittingFindings ? 'Finalizing Review...' : 'Finalize Review & Release Earning'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: FINANCIALS & WALLET */}
          {activeTab === 'financials' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className={`p-6 rounded-2xl border space-y-5 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10'}`}>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <IndianRupee size={18} className="text-amber-400" />
                  Financial Settlement Breakdown
                </h3>

                <div className="grid sm:grid-cols-3 gap-4 text-xs">
                  <div className={`p-4 rounded-xl border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'}`}>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Client Price</span>
                    <span className="text-xl font-bold font-mono text-amber-400">₹{review.price.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-slate-500 block">Authoritative configured rate</span>
                  </div>

                  <div className={`p-4 rounded-xl border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'}`}>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Expert Earning</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">₹{review.expertEarning.toLocaleString('en-IN')}</span>
                    <span className={`text-[10px] font-bold block ${review.expertEarningStatus === 'EarningReleased' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {review.expertEarningStatus}
                    </span>
                  </div>

                  <div className={`p-4 rounded-xl border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'}`}>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Platform Charge</span>
                    <span className="text-xl font-bold font-mono text-cyan-400">₹{review.platformFee.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-slate-500 block">Escrow & Governance fee</span>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border space-y-2 text-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070C15] border-white/5'}`}>
                  <p className="font-bold flex items-center justify-between">
                    <span>Client Payment Status:</span>
                    <span className={`font-mono ${review.paymentStatus === 'PaymentSuccessful' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {review.paymentStatus}
                    </span>
                  </p>
                  {review.clientWalletTxId && (
                    <p className="flex items-center justify-between text-slate-400">
                      <span>Client Wallet Transaction ID:</span>
                      <span className="font-mono text-white">{review.clientWalletTxId}</span>
                    </p>
                  )}
                  {review.expertWalletTxId && (
                    <p className="flex items-center justify-between text-slate-400">
                      <span>Expert Wallet Payout ID:</span>
                      <span className="font-mono text-white">{review.expertWalletTxId}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: ACTIVITY AUDIT TRAIL */}
          {activeTab === 'timeline' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <History size={16} className="text-amber-400" />
                  Chronological Audit Trail ({review.activityTimeline?.length || 0} events)
                </h3>
                <span className="text-[10px] font-mono text-slate-400">Immutable Backend Event Log</span>
              </div>

              <div className="space-y-2.5">
                {review.activityTimeline?.map((act, idx) => (
                  <div
                    key={act.activityId || idx}
                    className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                      isLight ? 'bg-white border-slate-200' : 'bg-[#0B111A] border-white/10 text-white'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-amber-400">{act.description}</p>
                      <p className="text-[11px] text-slate-400">
                        By <strong className="text-white">{act.userName || act.userId || 'System'}</strong> ({act.role})
                        {act.newStatus ? ` · State: ${act.newStatus}` : ''}
                      </p>

                    </div>
                    <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap ml-4">
                      {new Date(act.timestamp).toLocaleString()}
                    </span>
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
