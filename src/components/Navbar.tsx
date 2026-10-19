import React, { useState } from 'react';
import { UserRole } from '../types';
import { 
  Sparkles, 
  Wallet, 
  Award, 
  Users, 
  Menu, 
  X, 
  TrendingUp, 
  GraduationCap,
  Search,
  ChevronRight
} from 'lucide-react';

interface NavbarProps {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  walletBalance: number;
  openAIMatchmaker: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  setRole,
  activeTab,
  setActiveTab,
  walletBalance,
  openAIMatchmaker,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'directory', label: 'Explore Experts', icon: Search },
    { id: 'training', label: 'Digital Skills Upsell', icon: GraduationCap },
    { id: 'subscriptions', label: 'Revenue & Plans', icon: TrendingUp },
    { id: 'stories', label: 'Retired & Rehired', icon: Award },
    { id: 'referrals', label: 'Community Hub', icon: Users },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 text-white shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('directory')}>
            <img
              src="/mentora-logo-horizontal-dark.png"
              alt="Mentora — Empowering Future Leaders"
              className="h-10 sm:h-11 w-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-md brightness-[1.02] contrast-[1.05]"
            />
          </div>

          {/* Nav Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-2xl border border-white/10">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => setActiveTab(link.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-extrabold'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action & Mode Switcher */}
          <div className="flex items-center gap-3">
            
            {/* AI Matchmaker Trigger */}
            <button
              onClick={openAIMatchmaker}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 px-4 py-2.5 rounded-xl font-extrabold text-xs shadow-lg shadow-amber-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Sparkles className="w-4 h-4 fill-slate-950 animate-spin text-slate-950" style={{ animationDuration: '6s' }} />
              <span className="hidden sm:inline">MentoraMatch</span> AI
            </button>

            {/* Wallet Button */}
            <button
              onClick={() => setActiveTab('wallet')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                activeTab === 'wallet'
                  ? 'bg-slate-900 text-emerald-300 border-emerald-500 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-900/80 text-slate-200 border-white/10 hover:border-slate-700'
              }`}
              title="View Mentora Wallet & Transactions"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="font-extrabold text-emerald-400">₹{walletBalance.toLocaleString('en-IN')}</span>
            </button>

            {/* Role Switcher Pill */}
            <div className="hidden sm:flex items-center bg-slate-900 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setRole('client')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  currentRole === 'client'
                    ? 'bg-slate-800 text-amber-300 border border-amber-500/30 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Client View
              </button>
              <button
                onClick={() => setRole('professional')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  currentRole === 'professional'
                    ? 'bg-slate-800 text-amber-300 border border-amber-500/30 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Senior Pro
              </button>
              <button
                onClick={() => setRole('admin')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  currentRole === 'admin'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Admin
              </button>
            </div>

            {/* Mobile Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-white/10"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-950 border-b border-white/10 px-4 pt-3 pb-6 space-y-3">
          
          <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-white/10 mb-2">
            <span className="text-xs text-slate-400 font-semibold">Select View Mode:</span>
            <div className="flex gap-1 text-xs font-bold">
              <button
                onClick={() => { setRole('client'); setMobileMenuOpen(false); }}
                className={`px-2.5 py-1 rounded-lg ${currentRole === 'client' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'}`}
              >
                Client
              </button>
              <button
                onClick={() => { setRole('professional'); setMobileMenuOpen(false); }}
                className={`px-2.5 py-1 rounded-lg ${currentRole === 'professional' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'}`}
              >
                Pro
              </button>
              <button
                onClick={() => { setRole('admin'); setMobileMenuOpen(false); }}
                className={`px-2.5 py-1 rounded-lg ${currentRole === 'admin' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'}`}
              >
                Admin
              </button>
            </div>
          </div>

          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => {
                  setActiveTab(link.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive ? 'bg-amber-500 text-slate-950' : 'text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>{link.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
