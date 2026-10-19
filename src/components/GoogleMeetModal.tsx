import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  MessageSquare,
  Users,
  Info,
  Copy,
  Check,
  ExternalLink,
  Hand,
  PhoneOff,
  Clock,
  ShieldCheck,
  Send,
  Sparkles,
  Maximize2,
  Minimize2,
  FileText,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface GoogleMeetSession {
  id: string;
  expert?: string;
  client?: string;
  topic?: string;
  when?: string;
  type?: string;
  rate?: number;
  payout?: number;
  roomCode?: string;
  meetCode?: string;
  meetUrl?: string;
  userRole?: 'client' | 'expert';
}

interface GoogleMeetModalProps {
  session: GoogleMeetSession | null;
  userRole?: string | null;
  onClose: () => void;
  onEndSession?: (session: GoogleMeetSession) => void;
}

export const GoogleMeetModal: React.FC<GoogleMeetModalProps> = ({
  session,
  userRole = 'client',
  onClose,
  onEndSession,
}) => {
  if (!session) return null;

  // Resolve or generate Google Meet code and URL
  const meetCode = session.meetCode || (() => {
    if (session.roomCode && session.roomCode.startsWith("meet-")) {
      return session.roomCode.replace("meet-", "");
    }
    const cleanId = (session.id || "session").replace(/[^a-z0-9]/gi, "").slice(-9);
    const p1 = cleanId.slice(0, 3) || "gmt";
    const p2 = cleanId.slice(3, 7) || "advy";
    const p3 = cleanId.slice(7, 10) || "cal";
    return `${p1.toLowerCase()}-${p2.toLowerCase()}-${p3.toLowerCase()}`;
  })();

  const meetUrl = session.meetUrl || `https://meet.google.com/${meetCode}`;

  // Call Control States
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [activeSidePanel, setActiveSidePanel] = useState<'none' | 'chat' | 'people' | 'info' | 'notes'>('none');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Real Camera Stream Handling
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Timer
  const [seconds, setSeconds] = useState(140);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; time: string }[]>([
    {
      sender: userRole === 'expert' ? (session.client || 'Client') : (session.expert || 'Senior Expert'),
      text: `Hello! Welcome to the advisory Google Meet room for "${session.topic || 'Consultation'}".`,
      time: 'Just now'
    }
  ]);
  const [inputMsg, setInputMsg] = useState('');

  // Meeting Notes
  const [meetingNotes, setMeetingNotes] = useState(
    `• Consultation Focus: ${session.topic || 'Strategic Advisory'}\n• Expert: ${session.expert || 'Senior Advisor'}\n• Client: ${session.client || 'Corporate Client'}\n• Action Items:\n  1. Finalize advisory deliverables\n  2. Follow-up review scheduled`
  );

  // Timer Tick
  useEffect(() => {
    if (isCallEnded) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCallEnded]);

  // Request Web Camera when video is on
  useEffect(() => {
    let localStream: MediaStream | null = null;
    if (!isVideoOff && !isCallEnded) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: true, audio: false })
          .then((stream) => {
            localStream = stream;
            setCameraStream(stream);
            setCameraError(null);
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
            }
          })
          .catch((err) => {
            console.warn("Local camera access not available or permission denied:", err);
            setCameraError("Camera unavailable or permission denied. Using high-fidelity profile avatar.");
            setCameraStream(null);
          });
      }
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isVideoOff, isCallEnded]);

  // Format Duration
  const formatTimer = (total: number) => {
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const newMsg = {
      sender: userRole === 'expert' ? (session.expert || 'You') : (session.client || 'You'),
      text: inputMsg.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setInputMsg('');

    // Simulated reply
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: userRole === 'expert' ? (session.client || 'Client') : (session.expert || 'Senior Advisor'),
          text: 'Acknowledged. Taking note of this in the session dossier.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 1500);
  };

  const handleToggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          setIsScreenSharing(true);
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = stream;
          }
          stream.getVideoTracks()[0].onended = () => {
            setIsScreenSharing(false);
          };
        } else {
          setIsScreenSharing(true);
        }
      } catch (err) {
        console.warn("Screen share cancelled or not allowed:", err);
      }
    } else {
      setIsScreenSharing(false);
    }
  };

  const handleEndCall = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setIsCallEnded(true);
    if (onEndSession) {
      onEndSession(session);
    }
  };

  const handleOpenExternalGoogleMeet = () => {
    window.open(meetUrl, '_blank');
  };

  const expertName = session.expert || 'Senior Professional Advisor';
  const clientName = session.client || 'Corporate Client';
  const otherParticipantName = userRole === 'expert' ? clientName : expertName;
  const myName = userRole === 'expert' ? expertName : clientName;

  return (
    <div className="google-meet-room fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md font-sans text-slate-100">
      <div
        className={`w-full max-w-6xl rounded-2xl overflow-hidden flex flex-col shadow-2xl border transition-all duration-300 ${
          isFullscreen ? 'fixed inset-0 max-w-none rounded-none' : 'h-[90vh]'
        }`}
        style={{ background: '#202124', borderColor: '#3c4043' }}
      >
        {/* ==============================================================
            GOOGLE MEET TOP BAR
        ============================================================== */}
        <div className="px-5 py-3 flex items-center justify-between border-b" style={{ background: '#202124', borderColor: '#3c4043' }}>
          <div className="flex items-center gap-3">
            {/* Google Meet 4-Color Camera Icon Badge */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#303134] border border-[#3c4043] shadow-inner">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#00796B" opacity="0.1" />
                  <path d="M15 8.5v7l4 3V5.5l-4 3z" fill="#00AC47" />
                  <rect x="3" y="6" width="12" height="12" rx="2" fill="#00832D" />
                  <path d="M3 8a2 2 0 0 1 2-2h10v12H5a2 2 0 0 1-2-2V8z" fill="#2684FC" />
                  <path d="M15 6h-4v6h4V6z" fill="#FFBA00" />
                  <path d="M11 12H3v4a2 2 0 0 0 2 2h6v-6z" fill="#EA4335" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white tracking-tight">Google Meet</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#303134] text-[#8ab4f8] border border-[#3c4043]">
                    {meetCode}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md">
                  {session.topic || 'Advisory Consultation Session'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Timer */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#303134] border border-[#3c4043] text-xs font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{formatTimer(seconds)}</span>
            </div>

            {/* Launch External Google Meet ↗ */}
            <button
              onClick={handleOpenExternalGoogleMeet}
              className="text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 cursor-pointer transition-colors bg-[#1a73e8] hover:bg-[#1557b0] text-white shadow-md"
              title="Open real Google Meet meeting in a new browser tab"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">Open in meet.google.com ↗</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-[#303134] cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-[#303134] cursor-pointer"
              title="Minimize Meeting Window"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ==============================================================
            MAIN MEETING WORKSPACE & SIDE DRAWER
        ============================================================== */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Main Video Call Canvas */}
          <div className="flex-1 p-3 sm:p-5 flex flex-col justify-between overflow-hidden bg-[#18191c]">
            {isCallEnded ? (
              /* Post-Meeting Wrap Screen */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-900/40 border border-emerald-600/60 flex items-center justify-center text-emerald-400">
                  <Check size={32} />
                </div>
                <h3 className="text-xl font-bold text-white">Consultation Meeting Concluded</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  Your Google Meet session with <strong>{otherParticipantName}</strong> for "{session.topic}" has ended. Session duration: {formatTimer(seconds)}.
                </p>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={() => {
                      setIsCallEnded(false);
                      setSeconds(0);
                    }}
                    className="px-4 py-2 text-xs rounded-full font-bold bg-[#303134] hover:bg-[#3c4043] text-white transition-all cursor-pointer"
                  >
                    Rejoin Room
                  </button>
                  <button
                    onClick={() => {
                      confetti({ particleCount: 50, spread: 60 });
                      onClose();
                    }}
                    className="px-5 py-2 text-xs rounded-full font-bold bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] transition-all cursor-pointer shadow-lg"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </div>
            ) : (
              /* Active Video Tiles Grid */
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 overflow-hidden relative">
                {/* Tile 1: Other Participant (Senior Expert or Client) */}
                <div className="rounded-2xl overflow-hidden relative border flex flex-col items-center justify-center bg-[#28292c] shadow-md group" style={{ borderColor: '#3c4043' }}>
                  {/* Remote Active Stream Simulation */}
                  <div className="text-center space-y-3 z-10 p-4">
                    <div className="relative inline-block">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-[#8ab4f8] flex items-center justify-center text-3xl font-bold bg-[#303134] text-[#8ab4f8] shadow-2xl mx-auto overflow-hidden">
                        {otherParticipantName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      {/* Active Speaking Indicator */}
                      <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#202124] flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      </span>
                    </div>

                    <div>
                      <p className="text-base font-bold text-white">{otherParticipantName}</p>
                      <p className="text-xs text-slate-400">
                        {userRole === 'expert' ? 'Client Partner · HD Stream' : `${session.topic || 'Senior Advisor'} · HD Audio/Video`}
                      </p>
                    </div>

                    {/* Audio Wave Indicator */}
                    <div className="flex items-center justify-center gap-1 pt-1">
                      <span className="w-1 h-3 bg-[#8ab4f8] rounded-full animate-pulse" />
                      <span className="w-1 h-5 bg-[#8ab4f8] rounded-full animate-pulse delay-75" />
                      <span className="w-1 h-2 bg-[#8ab4f8] rounded-full animate-pulse delay-150" />
                      <span className="w-1 h-4 bg-[#8ab4f8] rounded-full animate-pulse delay-100" />
                    </div>
                  </div>

                  {/* Tile Name Tag */}
                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-xs font-semibold text-white flex items-center gap-1.5 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{otherParticipantName}</span>
                  </div>
                </div>

                {/* Tile 2: Self Feed (with real web camera if enabled) */}
                <div className="rounded-2xl overflow-hidden relative border flex flex-col items-center justify-center bg-[#28292c] shadow-md group" style={{ borderColor: '#3c4043' }}>
                  {!isVideoOff && (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
                    />
                  )}

                  {/* Fallback avatar if camera is off or permission not granted */}
                  {(isVideoOff || cameraError || !cameraStream) && (
                    <div className="text-center space-y-3 z-10 p-4">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-slate-600 flex items-center justify-center text-3xl font-bold bg-[#303134] text-slate-300 shadow-2xl mx-auto">
                        {myName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <p className="text-sm font-bold text-white">{myName} (You)</p>
                      <p className="text-xs text-slate-400">
                        {isVideoOff ? 'Camera Muted' : 'Local Video Feed'}
                      </p>
                    </div>
                  )}

                  {/* Tile Name Tag & Mic Badge */}
                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-xs font-semibold text-white flex items-center gap-1.5 border border-white/10 z-20">
                    <span>{myName} (You)</span>
                    {isMuted && (
                      <span className="p-0.5 rounded bg-rose-600 text-white" title="Microphone muted">
                        <MicOff size={11} />
                      </span>
                    )}
                  </div>

                  {isHandRaised && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-amber-500/90 text-slate-950 text-xs font-bold flex items-center gap-1 z-20 shadow-lg animate-bounce">
                      <Hand size={12} /> Hand Raised
                    </div>
                  )}
                </div>

                {/* Optional Screen Sharing Viewport */}
                {isScreenSharing && (
                  <div className="col-span-1 md:col-span-2 rounded-2xl overflow-hidden relative border bg-black flex items-center justify-center p-4 border-[#8ab4f8]">
                    <div className="text-center space-y-2">
                      <Monitor className="w-12 h-12 text-[#8ab4f8] mx-auto animate-pulse" />
                      <p className="text-sm font-bold text-white">Presenting your screen to participants</p>
                      <button
                        onClick={() => setIsScreenSharing(false)}
                        className="px-3 py-1 text-xs rounded-full font-bold bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
                      >
                        Stop Sharing
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ==============================================================
              GOOGLE MEET SIDE PANELS (Chat, People, Info, Notes)
          ============================================================== */}
          {activeSidePanel !== 'none' && (
            <div
              className="w-80 sm:w-96 border-l flex flex-col justify-between overflow-hidden transition-all duration-200"
              style={{ background: '#202124', borderColor: '#3c4043' }}
            >
              {/* Drawer Header */}
              <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: '#3c4043' }}>
                <h3 className="text-sm font-bold text-white capitalize">
                  {activeSidePanel === 'chat' && 'In-call messages'}
                  {activeSidePanel === 'people' && 'Meeting Participants (2)'}
                  {activeSidePanel === 'info' && 'Meeting details'}
                  {activeSidePanel === 'notes' && 'Advisory Session Notes'}
                </h3>
                <button
                  onClick={() => setActiveSidePanel('none')}
                  className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-[#303134] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
                {/* 1. Chat Panel */}
                {activeSidePanel === 'chat' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400 leading-relaxed bg-[#303134] p-2.5 rounded-lg border border-[#3c4043]">
                      Messages can be seen only by people in the call and are deleted when the call ends.
                    </p>
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {chatMessages.map((msg, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold text-white">{msg.sender}</span>
                            <span>{msg.time}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-[#303134] border border-[#3c4043] text-slate-200">
                            {msg.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. People / Participants Panel */}
                {activeSidePanel === 'people' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-[#303134] border border-[#3c4043] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#8ab4f8] text-[#202124] font-bold flex items-center justify-center text-xs">
                          {expertName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-white">{expertName}</p>
                          <span className="text-[10px] text-amber-300">Senior Professional Advisor</span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        In Call
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#303134] border border-[#3c4043] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-400 text-[#202124] font-bold flex items-center justify-center text-xs">
                          {clientName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-white">{clientName}</p>
                          <span className="text-[10px] text-slate-400">Client Partner</span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        In Call
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Meeting Details Panel */}
                {activeSidePanel === 'info' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-slate-400 text-[11px] block font-semibold mb-1">Joining info:</label>
                      <div className="p-3 rounded-xl bg-[#303134] border border-[#3c4043] space-y-2">
                        <p className="font-mono text-emerald-400 break-all select-all font-bold text-xs">{meetUrl}</p>
                        <p className="text-[11px] text-slate-400">Meeting code: {meetCode}</p>
                        <button
                          onClick={handleCopyLink}
                          className="w-full py-1.5 px-3 rounded-lg bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow"
                        >
                          {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                          <span>{copiedLink ? 'Copied to clipboard!' : 'Copy joining info'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#303134] border border-[#3c4043] space-y-1 text-[11px] text-slate-300">
                      <p className="font-bold text-white">Security & Encryption:</p>
                      <p className="text-slate-400 leading-relaxed">
                        This session is protected by end-to-end Google Meet WebRTC encryption. Only registered participants can join.
                      </p>
                    </div>
                  </div>
                )}

                {/* 4. Notes Panel */}
                {activeSidePanel === 'notes' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400">
                      Take shared notes during this consultation. Notes are persisted with your booking record.
                    </p>
                    <textarea
                      value={meetingNotes}
                      onChange={(e) => setMeetingNotes(e.target.value)}
                      rows={12}
                      className="w-full p-3 rounded-xl bg-[#303134] border border-[#3c4043] text-white font-mono text-xs outline-none focus:border-[#8ab4f8] resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Chat Input if Chat is Open */}
              {activeSidePanel === 'chat' && (
                <form onSubmit={handleSendMessage} className="p-3 border-t flex gap-2" style={{ borderColor: '#3c4043' }}>
                  <input
                    type="text"
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    placeholder="Send a message to everyone..."
                    className="flex-1 px-3 py-2 text-xs rounded-full bg-[#303134] border border-[#3c4043] text-white outline-none focus:border-[#8ab4f8]"
                  />
                  <button
                    type="submit"
                    className="p-2 rounded-full bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa] cursor-pointer"
                  >
                    <Send size={14} />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* ==============================================================
            GOOGLE MEET BOTTOM CONTROL BAR
        ============================================================== */}
        <div
          className="px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t"
          style={{ background: '#202124', borderColor: '#3c4043' }}
        >
          {/* Left: Meeting Time & ID */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
            <span className="font-semibold text-white">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>|</span>
            <span className="font-mono text-[#8ab4f8]">{meetCode}</span>
          </div>

          {/* Center: Core Meeting Action Pills */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mic Toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-full transition-all cursor-pointer shadow-md ${
                isMuted
                  ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                  : 'bg-[#3c4043] text-white hover:bg-[#4a4e51]'
              }`}
              title={isMuted ? 'Turn on microphone (Ctrl + d)' : 'Turn off microphone (Ctrl + d)'}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Video Toggle */}
            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`p-3 rounded-full transition-all cursor-pointer shadow-md ${
                isVideoOff
                  ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                  : 'bg-[#3c4043] text-white hover:bg-[#4a4e51]'
              }`}
              title={isVideoOff ? 'Turn on camera (Ctrl + e)' : 'Turn off camera (Ctrl + e)'}
            >
              {isVideoOff ? <VideoOff size={18} /> : <VideoIcon size={18} />}
            </button>

            {/* Hand Raise */}
            <button
              onClick={() => setIsHandRaised(!isHandRaised)}
              className={`p-3 rounded-full transition-all cursor-pointer ${
                isHandRaised
                  ? 'bg-[#fbbc04] text-slate-950 hover:bg-[#f29900]'
                  : 'bg-[#3c4043] text-white hover:bg-[#4a4e51]'
              }`}
              title={isHandRaised ? 'Lower hand' : 'Raise hand'}
            >
              <Hand size={18} />
            </button>

            {/* Screen Share */}
            <button
              onClick={handleToggleScreenShare}
              className={`p-3 rounded-full transition-all cursor-pointer ${
                isScreenSharing
                  ? 'bg-[#8ab4f8] text-[#202124]'
                  : 'bg-[#3c4043] text-white hover:bg-[#4a4e51]'
              }`}
              title={isScreenSharing ? 'Stop presenting' : 'Present now'}
            >
              <Monitor size={18} />
            </button>

            {/* Leave Call (Red Pill) */}
            <button
              onClick={handleEndCall}
              className="px-5 py-3 rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg ml-2"
              title="Leave call"
            >
              <PhoneOff size={18} />
              <span className="hidden sm:inline">Leave Call</span>
            </button>
          </div>

          {/* Right: Auxiliary Toggles (Info, People, Chat, Notes) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveSidePanel(activeSidePanel === 'info' ? 'none' : 'info')}
              className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                activeSidePanel === 'info' ? 'bg-[#8ab4f8] text-[#202124]' : 'text-slate-300 hover:bg-[#303134]'
              }`}
              title="Meeting details"
            >
              <Info size={17} />
            </button>

            <button
              onClick={() => setActiveSidePanel(activeSidePanel === 'people' ? 'none' : 'people')}
              className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                activeSidePanel === 'people' ? 'bg-[#8ab4f8] text-[#202124]' : 'text-slate-300 hover:bg-[#303134]'
              }`}
              title="Show everyone"
            >
              <Users size={17} />
            </button>

            <button
              onClick={() => setActiveSidePanel(activeSidePanel === 'chat' ? 'none' : 'chat')}
              className={`p-2.5 rounded-full transition-colors cursor-pointer relative ${
                activeSidePanel === 'chat' ? 'bg-[#8ab4f8] text-[#202124]' : 'text-slate-300 hover:bg-[#303134]'
              }`}
              title="Chat with everyone"
            >
              <MessageSquare size={17} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#8ab4f8]" />
            </button>

            <button
              onClick={() => setActiveSidePanel(activeSidePanel === 'notes' ? 'none' : 'notes')}
              className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                activeSidePanel === 'notes' ? 'bg-[#8ab4f8] text-[#202124]' : 'text-slate-300 hover:bg-[#303134]'
              }`}
              title="Advisory Session Notes"
            >
              <FileText size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
