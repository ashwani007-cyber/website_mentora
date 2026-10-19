import React, { useState, useEffect } from 'react';
import { Booking } from '../types';
import confetti from 'canvas-confetti';
import { 
  X, 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  Monitor, 
  MessageSquare, 
  FileText, 
  PhoneOff, 
  Star, 
  ShieldCheck, 
  Send, 
  CheckCircle2, 
  Clock,
  Sparkles
} from 'lucide-react';

interface TeleconsultProps {
  booking: Booking | null;
  onClose: () => void;
}

export const TeleconsultSimulatorModal: React.FC<TeleconsultProps> = ({
  booking,
  onClose,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('notes');
  const [notes, setNotes] = useState('• Focus on ESOP vesting schedule (4-year cliff)\n• Review Cap table dilution before Series A\n• Prepare POSH compliance auditor report');
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; time: string }[]>([
    { sender: 'Senior Expert', text: 'Namaste! Welcome to our advisory session. I have reviewed your cap table notes.', time: '10:00 AM' },
    { sender: 'You (Client)', text: 'Thank you sir! We would like to focus on ESOP pool size.', time: '10:01 AM' }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [seconds, setSeconds] = useState(252); // ~4 minutes mock elapsed
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isReviewSubmitted, setIsReviewSubmitted] = useState(false);

  useEffect(() => {
    if (!booking || isCallEnded) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [booking, isCallEnded]);

  if (!booking) return null;

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const userMsg = {
      sender: 'You (Client)',
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setNewMessage('');

    // Simulated reply from senior expert
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: booking.expertName,
          text: 'Understood. Based on my 30+ years experience, I recommend capping the ESOP pool at 10%.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 1200);
  };

  const handleEndCall = () => {
    setIsCallEnded(true);
  };

  const handleSubmitRating = () => {
    setIsReviewSubmitted(true);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.5 }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-lg overflow-y-auto">
      <div className="relative w-full max-w-6xl h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white">
        
        {/* Call Room Top Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                SilverConnect Room: {booking.topic}
              </h3>
              <p className="text-xs text-slate-400">Advisory with {booking.expertName} • {booking.expertTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-xl text-xs font-mono font-bold text-amber-400 border border-slate-700">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(seconds)} / 60:00</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Call Body */}
        {!isCallEnded ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 overflow-hidden">
            
            {/* Video Viewport (2 Columns) */}
            <div className="lg:col-span-2 bg-slate-950 p-4 flex flex-col justify-between relative overflow-hidden">
              
              {/* Screen Share Overlay Indicator */}
              {isScreenSharing && (
                <div className="absolute top-6 left-6 z-20 bg-amber-500 text-slate-950 text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5" /> Presenting Document View
                </div>
              )}

              {/* Main Remote Feed (Senior Expert) */}
              <div className="relative flex-1 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center">
                {!isScreenSharing ? (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    <img
                      src={booking.expertAvatar}
                      alt={booking.expertName}
                      className="w-36 h-36 rounded-full object-cover border-4 border-amber-500/50 shadow-2xl mb-4"
                    />
                    <h4 className="text-xl font-bold text-white">{booking.expertName}</h4>
                    <span className="text-xs text-amber-400 font-medium bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800 mt-1">
                      Senior Advisor • Online HD
                    </span>
                  </div>
                ) : (
                  <div className="p-6 text-center space-y-3">
                    <Monitor className="w-16 h-16 text-amber-400 mx-auto" />
                    <h4 className="text-lg font-bold text-white">Sharing Advisory Presentation Screen</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">"Cap Table Dilution & ESOP Allocation Strategy Matrix 2026.pdf"</p>
                  </div>
                )}

                {/* Self Feed Floating Picture-in-Picture */}
                <div className="absolute bottom-4 right-4 w-36 h-28 bg-slate-800 rounded-xl border-2 border-slate-700 overflow-hidden shadow-2xl flex items-center justify-center">
                  {!isVideoOff ? (
                    <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-xs text-slate-400">
                      <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-xs mb-1">You</span>
                      <span className="text-[10px]">Client Video</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 flex flex-col items-center gap-1">
                      <VideoOff className="w-5 h-5" /> Video Muted
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom In-Call Controls */}
              <div className="mt-4 flex items-center justify-center gap-4 py-2 bg-slate-900 rounded-2xl border border-slate-800">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-3.5 rounded-full transition-colors ${
                    isMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500' : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                  title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  onClick={() => setIsVideoOff(!isVideoOff)}
                  className={`p-3.5 rounded-full transition-colors ${
                    isVideoOff ? 'bg-rose-500/20 text-rose-400 border border-rose-500' : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                  title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
                </button>

                <button
                  onClick={() => setIsScreenSharing(!isScreenSharing)}
                  className={`p-3.5 rounded-full transition-colors ${
                    isScreenSharing ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                  title="Share Screen"
                >
                  <Monitor className="w-5 h-5" />
                </button>

                <button
                  onClick={handleEndCall}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-full font-bold text-xs shadow-lg transition-colors"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Advisory Call</span>
                </button>
              </div>

            </div>

            {/* Sidebar Tabs (Notes & Chat) */}
            <div className="bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden">
              
              <div className="flex border-b border-slate-800 bg-slate-950">
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`flex-1 py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 ${
                    activeTab === 'notes' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400'
                  }`}
                >
                  <FileText className="w-4 h-4" /> Meeting Notes
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 ${
                    activeTab === 'chat' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" /> Live Chat
                </button>
              </div>

              {activeTab === 'notes' ? (
                <div className="p-4 flex-1 flex flex-col">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Interactive Advisory Notes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Type key takeaway notes during your session..."
                    className="flex-1 w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono resize-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-2">Notes auto-save and remain accessible in your session history.</p>
                </div>
              ) : (
                <div className="p-4 flex-1 flex flex-col justify-between overflow-hidden">
                  <div className="space-y-3 overflow-y-auto pr-1 flex-1 mb-3">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-amber-400">{msg.sender}</span>
                          <span className="text-[10px] text-slate-500">{msg.time}</span>
                        </div>
                        <p className="text-slate-300">{msg.text}</p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <button type="submit" className="p-2 bg-amber-500 text-slate-950 rounded-xl">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

            </div>

          </div>
        ) : (
          /* Post Call Rating & Feedback Form (PDF Requirement #3) */
          <div className="p-8 max-w-xl mx-auto text-center space-y-6 my-auto">
            {!isReviewSubmitted ? (
              <>
                <div className="w-16 h-16 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto shadow-xl">
                  <Sparkles className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white">Session Completed!</h3>
                  <p className="text-xs text-slate-300">
                    How was your advisory session with <strong className="text-amber-400">{booking.expertName}</strong>?
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1 text-amber-400 transition-transform transform hover:scale-125"
                    >
                      <Star className={`w-8 h-8 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share a short review of the senior expert's guidance..."
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500"
                />

                <button
                  onClick={handleSubmitRating}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 py-3 rounded-xl font-bold text-sm shadow-lg"
                >
                  Submit Credibility Rating
                </button>
              </>
            ) : (
              <div className="space-y-4 py-4">
                <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
                <h3 className="text-2xl font-bold text-white">Thank You for Your Feedback!</h3>
                <p className="text-xs text-slate-300">Your review helps maintain credibility across the Silver Workforce platform.</p>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
