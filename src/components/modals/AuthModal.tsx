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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-white border border-slate-200 text-slate-900 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100 rounded-xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-neutral-100">
                {mode === 'login' ? 'Sign In to Orbit 2.0' : 'Create Orbit Account'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Secured by Firebase Authentication (Project: orbit-2-auth)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="mt-5 grid grid-cols-2 p-1 bg-slate-100 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-1.5 rounded-md transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-slate-900 font-semibold shadow-xs dark:bg-neutral-800 dark:text-white'
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
            className={`py-1.5 rounded-md transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-slate-900 font-semibold shadow-xs dark:bg-neutral-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* API Key Configuration Banner */}
        {!isFirebaseConfigured() && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Firebase API Key Required</span>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="text-[11px] underline text-amber-800 dark:text-amber-200 hover:text-black dark:hover:text-white cursor-pointer"
              >
                {showKeyInput ? 'Close' : 'Set Key'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
              Project <code className="font-mono bg-amber-100 dark:bg-neutral-900/60 px-1 py-0.5 rounded">orbit-2-auth</code> Web API key is not bundled in this build. Configure <code className="font-mono bg-amber-100 dark:bg-neutral-900/60 px-1 py-0.5 rounded">VITE_FIREBASE_API_KEY</code> in Cloudflare or paste below.
            </p>
            {showKeyInput && (
              <div className="mt-2.5 flex items-center gap-2">
                <div className="relative flex-1">
                  <Key className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-500 absolute left-2.5 top-2" />
                  <input
                    type="password"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 rounded text-slate-900 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 text-xs focus:outline-hidden focus:border-amber-500"
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
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium text-xs transition-colors cursor-pointer"
                >
                  Save Key
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300 rounded-lg text-xs leading-relaxed">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          {mode === 'register' && (
            <div>
              <label className="block text-slate-700 dark:text-neutral-300 font-medium mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-neutral-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-lg text-slate-900 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-700 dark:text-neutral-300 font-medium mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.morgan@orbitwork.io"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-lg text-slate-900 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-neutral-300 font-medium mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-neutral-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-lg text-slate-900 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
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
          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400 mb-2">
              <span>Development Bypass</span>
              <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-mono">(dev/test only)</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDevBypass('dev_usr_main_01')}
                className="flex-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 hover:text-slate-900 text-[11px] dark:bg-neutral-950 dark:hover:bg-neutral-800 dark:border-neutral-800 dark:text-neutral-300 dark:hover:text-white transition-colors cursor-pointer"
              >
                Sign in as Dev User 1
              </button>
              <button
                type="button"
                onClick={() => handleDevBypass('dev_user_beta_02')}
                className="flex-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 hover:text-slate-900 text-[11px] dark:bg-neutral-950 dark:hover:bg-neutral-800 dark:border-neutral-800 dark:text-neutral-300 dark:hover:text-white transition-colors cursor-pointer"
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
