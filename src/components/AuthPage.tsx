import React, { useState, useEffect } from 'react';
import type { AuthUser, UserRole, DomainCategory } from '../types';
import { expertiseService } from '../services/expertiseService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  User, 
  Mail, 
  Lock, 
  Building2, 
  Award, 
  ArrowRight, 
  Zap, 
  CheckCircle2,
  Briefcase,
  Layers,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';


interface AuthPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [selectedRole, setSelectedRole] = useState<UserRole>('client');

  // Form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [exCompany, setExCompany] = useState('');
  const [yearsExp, setYearsExp] = useState(28);
  const [availableDomains, setAvailableDomains] = useState<string[]>(() => expertiseService.getAll());
  const [domain, setDomain] = useState<DomainCategory>(() => {
    const list = expertiseService.getAll();
    return (list[0] || 'Finance & Taxation') as DomainCategory;
  });
  const [hourlyRate, setHourlyRate] = useState(799);

  useEffect(() => {
    return expertiseService.subscribe((fields) => {
      setAvailableDomains(fields);
      if (fields.length > 0 && !fields.includes(domain)) {
        setDomain(fields[0]);
      }
    });
  }, [domain]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      alert('Please fill in email and password.');
      return;
    }

    const newUser: AuthUser = {
      id: `user-${Date.now()}`,
      name: name || (selectedRole === 'client' ? 'Startup Founder & CEO' : 'Dr. Rameshwar Sharma'),
      email,
      role: selectedRole,
      avatarUrl: selectedRole === 'professional'
        ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
        : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      exCompany: exCompany || 'TATA Motors & L&T',
      yearsOfExperience: yearsExp,
      domain,
      hourlyRate,
      isVerified: selectedRole === 'professional' ? false : true
    };

    onLoginSuccess(newUser);
  };

  const handleQuickLogin = (role: UserRole) => {
    if (role === 'client') {
      onLoginSuccess({
        id: 'user-client-demo',
        name: 'Nexus Tech Innovations Pvt Ltd',
        email: 'founder@nexustech.in',
        role: 'client',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
      });
    } else if (role === 'professional') {
      onLoginSuccess({
        id: 'prof-1',
        name: 'Dr. Rameshwar Sharma',
        email: 'rameshwar.sharma@mentora.com',
        role: 'professional',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        exCompany: 'TATA Motors & L&T',
        yearsOfExperience: 34,
        domain: 'Finance & Audit',
        hourlyRate: 799,
        isVerified: true
      });
    } else {
      onLoginSuccess({
        id: 'admin-demo',
        name: 'Mentora Corporate Governance Desk',
        email: 'admin@mentora.com',
        role: 'admin'
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0b132b] text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Dynamic Background Glow Blobs */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-blue-600/20 via-amber-500/15 to-emerald-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10 space-y-6"
      >
        
        {/* Header Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center">
            <img
              src="/mentora-logo-dark.png"
              alt="Mentora — Empowering Future Leaders"
              className="h-28 sm:h-32 w-auto object-contain mx-auto drop-shadow-lg brightness-[1.02] contrast-[1.05]"
            />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Executive Advisory Platform
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-md mx-auto leading-relaxed">
            Connecting Retired CXOs, Board Members & Senior Experts with High-Growth Organizations.
          </p>
        </div>

        {/* Auth Mode Selector (Register vs Sign In) */}
        <div className="bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 flex text-xs font-bold shadow-xl">
          <button
            onClick={() => setAuthMode('signup')}
            className={`flex-1 py-3 rounded-xl transition-all duration-300 ${
              authMode === 'signup' 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg font-extrabold' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create New Account
          </button>
          <button
            onClick={() => setAuthMode('login')}
            className={`flex-1 py-3 rounded-xl transition-all duration-300 ${
              authMode === 'login' 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg font-extrabold' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In to Portal
          </button>
        </div>

        {/* Animated Auth Card */}
        <div className="bg-slate-900/95 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl space-y-6">
          
          {/* Role Choice Cards */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
              Select Portal Role:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Client Choice */}
              <button
                type="button"
                onClick={() => setSelectedRole('client')}
                className={`p-4 rounded-2xl border text-left transition-all duration-200 ${
                  selectedRole === 'client'
                    ? 'bg-blue-600/20 border-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 scale-[1.02]'
                    : 'bg-slate-950/70 border-white/5 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Building2 className={`w-6 h-6 mb-2 ${selectedRole === 'client' ? 'text-blue-400' : 'text-slate-500'}`} />
                <div className="text-xs font-bold text-white">Client / Enterprise</div>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">Startups & SMEs hiring retired CXO advisors</p>
              </button>

              {/* Senior Expert Choice */}
              <button
                type="button"
                onClick={() => setSelectedRole('professional')}
                className={`p-4 rounded-2xl border text-left transition-all duration-200 ${
                  selectedRole === 'professional'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-lg shadow-amber-500/20 scale-[1.02]'
                    : 'bg-slate-950/70 border-white/5 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Award className={`w-6 h-6 mb-2 ${selectedRole === 'professional' ? 'text-amber-400' : 'text-slate-500'}`} />
                <div className="text-xs font-bold text-white">Senior Retired Pro</div>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">Ex-CXOs & VPs offering advisory services</p>
              </button>

            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={selectedRole === 'client' ? 'e.g. Vikramaditya Singh (CEO)' : 'e.g. Dr. Rameshwar Sharma'}
                    className="w-full pl-10 pr-4 py-3.5 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Corporate Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="executive@company.com"
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3.5 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Senior Registration Fields */}
            {authMode === 'signup' && selectedRole === 'professional' && (
              <div className="space-y-4 pt-3 border-t border-white/10">
                <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider block">
                  🎓 Senior Professional Verification History
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Former Enterprise / Org</label>
                    <input
                      type="text"
                      value={exCompany}
                      onChange={(e) => setExCompany(e.target.value)}
                      placeholder="e.g. TATA Motors / ISRO / SBI"
                      className="w-full p-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Years of Experience</label>
                    <input
                      type="number"
                      value={yearsExp}
                      onChange={(e) => setYearsExp(Number(e.target.value))}
                      className="w-full p-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Domain Expertise</label>
                    <select
                      value={domain}
                      onChange={(e) => setDomain(e.target.value as DomainCategory)}
                      className="w-full p-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white font-medium cursor-pointer"
                    >
                      {availableDomains.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Hourly Advisory Rate (₹)</label>
                    <input
                      type="number"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      className="w-full p-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-amber-400 font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 px-6 rounded-2xl font-black text-sm shadow-xl shadow-blue-500/25 transition-all transform hover:scale-[1.01]"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>
                {authMode === 'signup' ? `Register & Launch ${selectedRole.toUpperCase()} Portal` : `Sign In to ${selectedRole.toUpperCase()} Portal`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick One-Click Instant Demo Bar */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block text-center">
              ⚡ Instant One-Click Demo Access
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => handleQuickLogin('client')}
                className="py-3 px-3 bg-slate-950 hover:bg-slate-800 text-slate-200 rounded-xl border border-white/10 font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>Client Demo</span>
              </button>

              <button
                onClick={() => handleQuickLogin('professional')}
                className="py-3 px-3 bg-slate-950 hover:bg-slate-800 text-slate-200 rounded-xl border border-white/10 font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>Senior Pro Demo</span>
              </button>
            </div>
          </div>

        </div>

      </motion.div>
    </div>
  );
};
