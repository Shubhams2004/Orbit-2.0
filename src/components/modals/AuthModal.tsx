import React, { useState } from 'react';
import {
  loginWithEmail,
  registerWithEmail,
  formatFirebaseAuthError,
  isFirebaseConfigured,
  saveCustomFirebaseApiKey,
} from '../../lib/firebase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Lock, Mail, User, X, Loader2, ArrowRight, ShieldCheck, Key, AlertTriangle } from 'lucide-react';
import { isProductionEnv } from '../../services/apiClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const { setCurrentAuthToken, refreshData } = useWorkspace();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    if (mode === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const user = await registerWithEmail(email, password, displayName);
        const token = await user.getIdToken();
        setCurrentAuthToken(token);
      } else {
        const user = await loginWithEmail(email, password);
        const token = await user.getIdToken();
        setCurrentAuthToken(token);
      }

      await refreshData();
      onClose();
    } catch (err: unknown) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDevBypass = async (devToken: string) => {
    if (isProductionEnv()) {
      setError('Development bypass is disabled in production. Please sign in with Firebase.');
      return;
    }
    setCurrentAuthToken(devToken);
    await refreshData();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div
        className="w-full max-w-md glass-panel rounded-3xl shadow-2xl p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-200 border border-white/20 dark:border-white/10"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 rounded-2xl shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-neutral-100 tracking-tight">
                {mode === 'login' ? 'Sign In to Orbit 2.0' : 'Create Orbit Account'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                Secured by Firebase Authentication (orbit-2-auth)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full hover:bg-slate-100/60 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="mt-5 grid grid-cols-2 p-1 glass-pill rounded-2xl text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-slate-900 font-semibold shadow-md dark:bg-neutral-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-slate-900 font-semibold shadow-md dark:bg-neutral-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* API Key Configuration Banner */}
        {!isFirebaseConfigured() && (
          <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-xs text-amber-700 dark:text-amber-300">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Firebase API Key Required</span>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="text-[11px] underline text-amber-800 dark:text-amber-200 hover:text-black dark:hover:text-white cursor-pointer font-medium"
              >
                {showKeyInput ? 'Close' : 'Set Key'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
              Project <code className="font-mono bg-amber-100/70 dark:bg-neutral-900/60 px-1 py-0.5 rounded">orbit-2-auth</code> Web API key is not bundled in this build. Configure <code className="font-mono bg-amber-100/70 dark:bg-neutral-900/60 px-1 py-0.5 rounded">VITE_FIREBASE_API_KEY</code> in Cloudflare or paste below.
            </p>
            {showKeyInput && (
              <div className="mt-2.5 flex items-center gap-2">
                <div className="relative flex-1">
                  <Key className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-500 absolute left-2.5 top-2.5" />
                  <input
                    type="password"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full pl-8 pr-2.5 py-1.5 glass-input rounded-xl text-slate-900 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 text-xs focus:outline-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (customApiKey.trim()) {
                      await saveCustomFirebaseApiKey(customApiKey.trim());
                      setError(null);
                      setShowKeyInput(false);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Save Key
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/25 dark:text-rose-300 rounded-2xl text-xs leading-relaxed">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          {mode === 'register' && (
            <div>
              <label className="block text-slate-700 dark:text-neutral-300 font-medium mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-neutral-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="w-full pl-10 pr-3 py-2.5 glass-input rounded-xl text-slate-900 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-700 dark:text-neutral-300 font-medium mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.morgan@orbitwork.io"
                className="w-full pl-10 pr-3 py-2.5 glass-input rounded-xl text-slate-900 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-neutral-300 font-medium mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-neutral-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 glass-input rounded-xl text-slate-900 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.99] cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{mode === 'login' ? 'Authenticating...' : 'Creating Account...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Development sandbox bypass helper (disabled in production) */}
        {!isProductionEnv() && (
          <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-neutral-800/80">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400 mb-2">
              <span>Development Bypass</span>
              <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-mono">(dev/test only)</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDevBypass('dev_usr_main_01')}
                className="flex-1 py-1.5 px-2.5 glass-pill rounded-xl text-slate-700 hover:text-slate-900 text-[11px] dark:text-neutral-300 dark:hover:text-white transition-all cursor-pointer font-medium"
              >
                Sign in as Dev User 1
              </button>
              <button
                type="button"
                onClick={() => handleDevBypass('dev_user_beta_02')}
                className="flex-1 py-1.5 px-2.5 glass-pill rounded-xl text-slate-700 hover:text-slate-900 text-[11px] dark:text-neutral-300 dark:hover:text-white transition-all cursor-pointer font-medium"
              >
                Sign in as Dev User 2
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
