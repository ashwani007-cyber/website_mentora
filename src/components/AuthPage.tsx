import React, { useState, useEffect, useMemo } from 'react';
import type { AuthUser, UserRole, DomainCategory } from '../types';
import { useDomains } from '../context/DomainsContext';
import { supabase } from '../supabaseClient';
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
  EyeOff,
  Phone,
  AlertCircle
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
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [exCompany, setExCompany] = useState('');
  const [yearsExp, setYearsExp] = useState(28);
  const { domains } = useDomains();
  const availableDomains = useMemo(() => domains.filter(d => d.is_active !== false).map(d => d.name), [domains]);
  const [domain, setDomain] = useState<DomainCategory>(() => (availableDomains[0] || 'Finance & Taxation') as DomainCategory);
  const [hourlyRate, setHourlyRate] = useState(799);

  useEffect(() => {
    if (availableDomains.length > 0 && !availableDomains.includes(domain)) {
      setDomain(availableDomains[0] as DomainCategory);
    }
  }, [availableDomains, domain]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please fill in both email and password.');
      return;
    }

    if (authMode === 'signup') {
      if (!name.trim()) {
        setErrorMessage('Please enter your full legal name.');
        return;
      }
      if (phone && phone.replace(/\D/g, '').length < 8) {
        setErrorMessage('Please enter a valid phone number with at least 8 digits.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (authMode === 'signup') {
        const payload = {
          email: email.trim().toLowerCase(),
          password,
          fullName: name.trim() || (selectedRole === 'client' ? 'Startup Founder & CEO' : 'Dr. Rameshwar Sharma'),
          role: selectedRole === 'professional' ? 'expert' : selectedRole,
          phone: phone.trim() || '',
          company: exCompany || (selectedRole === 'client' ? 'Client Enterprise' : 'TATA Motors & L&T'),
          field: domain,
          years: yearsExp,
          baseRate: hourlyRate,
          projectRate: 1000,
          bio: selectedRole === 'client' ? 'Seeking strategic advisory.' : 'Senior industry professional.'
        };

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.status === 409 || (!data.success && data.error === 'User already exists')) {
          setErrorMessage(data.message || 'An account with this email/phone already exists. Please sign in with your password.');
          setAuthMode('login');
          setIsLoading(false);
          return;
        }

        if (!data.success && res.status >= 400) {
          setErrorMessage(`❌ Registration error: ${data.message || data.error || 'Failed to register'}`);
          setIsLoading(false);
          return;
        }

        const userRecord = data.user || {};
        const returnedRole: UserRole = (userRecord.role === 'expert' || userRecord.role === 'professional') 
          ? 'professional' 
          : (userRecord.role === 'admin' ? 'admin' : 'client');

        const authUser: AuthUser = {
          id: userRecord.id || `user-${Date.now()}`,
          name: userRecord.name || userRecord.full_name || name,
          email: userRecord.email || email,
          phone: userRecord.phone || phone,
          role: returnedRole,
          avatarUrl: returnedRole === 'professional'
            ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
            : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
          exCompany: userRecord.company || exCompany,
          yearsOfExperience: userRecord.years || yearsExp,
          domain: (userRecord.field || domain) as DomainCategory,
          hourlyRate: userRecord.baseRate || hourlyRate,
          isVerified: userRecord.is_verified ?? false
        };

        if (data.token) {
          localStorage.setItem('admin_token', data.token);
          sessionStorage.setItem('admin_token', data.token);
        }

        // Live Realtime Broadcast to Admin "Document Audit & KYC" Desk
        try {
          const kycChannel = supabase.channel('admin-kyc-desk');
          kycChannel.send({
            type: 'broadcast',
            event: 'expert_registered',
            payload: {
              ...authUser,
              status: 'Registered / Documents Pending',
              verificationStatus: 'pending_verification',
              submittedAt: new Date().toISOString()
            }
          });
        } catch {}

        window.dispatchEvent(new Event('mongo_db_updated'));

        if (data.alreadyRegistered) {
          setInfoMessage('Account already registered. Automatically launching your portal...');
        }

        // Automatically open Expert Portal immediately
        onLoginSuccess(authUser);
      } else {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password })
        });
        const data = await res.json();

        if (!data.success) {
          setErrorMessage(`⚠️ Login Failed: ${data.message || data.error || 'Invalid credentials'}`);
          setIsLoading(false);
          return;
        }

        const userRecord = data.user || {};
        const returnedRole: UserRole = (userRecord.role === 'expert' || userRecord.role === 'professional') 
          ? 'professional' 
          : (userRecord.role === 'admin' ? 'admin' : 'client');

        const authUser: AuthUser = {
          id: userRecord.id || `user-${Date.now()}`,
          name: userRecord.name || userRecord.full_name || name,
          email: userRecord.email || email,
          phone: userRecord.phone || '',
          role: returnedRole,
          avatarUrl: returnedRole === 'professional'
            ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
            : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
          exCompany: userRecord.company || exCompany,
          yearsOfExperience: userRecord.years || yearsExp,
          domain: (userRecord.field || domain) as DomainCategory,
          hourlyRate: userRecord.baseRate || hourlyRate,
          isVerified: userRecord.is_verified ?? true
        };

        if (data.token) {
          localStorage.setItem('admin_token', data.token);
          sessionStorage.setItem('admin_token', data.token);
        }

        onLoginSuccess(authUser);
      }
    } catch (err: any) {
      setErrorMessage(`Network error: ${err?.message || 'Failed to authenticate. Please check connection.'}`);
    } finally {
      setIsLoading(false);
    }
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
            
            {errorMessage && (
              <div className="p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {infoMessage && (
              <div className="p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-start gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
            )}

            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Legal Name</label>
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

            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Phone Number (Required for KYC & Advisory)</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-4 py-3.5 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

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
