import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, X, Github, Mail, UserPlus, User, LogOut, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { auth, isFirebaseConfigured } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';

export interface ToastItem {
  id: string;
  message: string;
  type: 'error' | 'success';
}

export interface LayoutContext {
  showToast: (message: string, type?: 'error' | 'success') => void;
}

// Decode JWT token helper
const decodeJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT', e);
    return null;
  }
};

export default function Layout() {
  const [serverStatus, setServerStatus] = useState<
    'connected' | 'checking' | 'disconnected'
  >('checking');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Authentication State
  const { user, isAuthenticated, isAuthModalOpen, setAuthModalOpen, login, logout, syncUserProfile } = useAuthStore();
  const [simulatedLoginStep, setSimulatedLoginStep] = useState<'idle' | 'loading' | 'success'>('idle');
  const [simEmail, setSimEmail] = useState('');
  const [simName, setSimName] = useState('');

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const showToast = useCallback(
    (message: string, type: 'error' | 'success' = 'error') => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check server health on mount
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        const res = await fetch('/api/health');
        setServerStatus(res.ok ? 'connected' : 'disconnected');
      } catch {
        setServerStatus('disconnected');
      }
    };
    checkServerHealth();
    const interval = setInterval(checkServerHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Sync with Firebase Auth state listener
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const userObj = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
          };
          login(userObj);
        } else {
          if (isAuthenticated) {
            logout();
          }
        }
      });
      return () => unsubscribe();
    }
  }, [isFirebaseConfigured, auth, login, logout, isAuthenticated]);

  // Google GSI script initialization (fallback for standalone client-only OAuth)
  useEffect(() => {
    if (!isFirebaseConfigured && googleClientId && isAuthModalOpen) {
      const initGoogle = () => {
        if (typeof window !== 'undefined' && (window as any).google) {
          try {
            (window as any).google.accounts.id.initialize({
              client_id: googleClientId,
              callback: (response: any) => {
                const payload = decodeJwt(response.credential);
                if (payload) {
                  const isReturning = localStorage.getItem('roxanne-has-signed-in') === 'true';
                  login({
                    uid: payload.sub,
                    email: payload.email,
                    displayName: payload.name,
                    photoURL: payload.picture,
                  });
                  if (!isReturning) {
                    localStorage.setItem('roxanne-has-signed-in', 'true');
                    showToast(`Welcome to Roxanne, ${payload.name}!`, 'success');
                  } else {
                    showToast(`Welcome back, ${payload.name}!`, 'success');
                  }
                } else {
                  showToast('Authentication failed.', 'error');
                }
              },
            });
            (window as any).google.accounts.id.renderButton(
              document.getElementById('google-signin-btn'),
              {
                theme: 'filled_black',
                size: 'large',
                width: 320,
                shape: 'pill',
              }
            );
          } catch (e) {
            console.error('Google Sign-In render error', e);
          }
        }
      };

      if (!(window as any).google) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initGoogle;
        document.body.appendChild(script);
      } else {
        setTimeout(initGoogle, 100);
      }
    }
  }, [isFirebaseConfigured, googleClientId, isAuthModalOpen, login, showToast]);

  const handleFirebaseGoogleSignIn = async () => {
    if (!auth) return;
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userObj = {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || '',
        photoURL: result.user.photoURL || '',
      };
      
      const isNew = await syncUserProfile(userObj);
      login(userObj);

      if (isNew) {
        showToast(`Welcome to Roxanne, ${userObj.displayName}!`, 'success');
      } else {
        showToast(`Welcome back, ${userObj.displayName}!`, 'success');
      }
    } catch (error) {
      console.error('Firebase Google Sign-In error:', error);
      showToast('Failed to sign in with Google.', 'error');
    }
  };

  const handleSimulatedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simEmail || !simName) return;

    setSimulatedLoginStep('loading');
    setTimeout(() => {
      setSimulatedLoginStep('success');
      setTimeout(() => {
        const isReturning = localStorage.getItem('roxanne-has-signed-in') === 'true';
        login({
          uid: 'sim-' + Math.random().toString(36).substring(2, 9),
          email: simEmail,
          displayName: simName,
        });
        setSimulatedLoginStep('idle');
        setSimEmail('');
        setSimName('');
        if (!isReturning) {
          localStorage.setItem('roxanne-has-signed-in', 'true');
          showToast(`Welcome to Roxanne, ${simName}!`, 'success');
        } else {
          showToast(`Welcome back, ${simName}!`, 'success');
        }
      }, 500);
    }, 1200);
  };

  const handleQuickMockSelect = (email: string, name: string) => {
    setSimEmail(email);
    setSimName(name);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-black/40 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-4 group">
            <div className="w-10 h-10 flex items-center justify-center">
              {/* Monochromatic geometric logo representation */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-full h-full text-white">
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                <line x1="12" y1="22" x2="12" y2="12" />
                <line x1="22" y1="8.5" x2="12" y2="12" />
                <line x1="2" y1="8.5" x2="12" y2="12" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif font-medium text-2xl tracking-wider text-white uppercase">
                Roxanne
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium tracking-widest text-white/70">
            {/* Google Authentication Control */}
            <div className="relative" ref={dropdownRef}>
              {isAuthenticated && user ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="w-10 h-10 rounded-full border border-white/20 hover:border-white/40 overflow-hidden transition-all bg-white/10 flex items-center justify-center focus:outline-none"
                    title="User Profile"
                  >
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-white/80" />
                    )}
                  </button>
                  <AnimatePresence>
                    {showUserDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-64 rounded-2xl bg-black/90 border border-white/10 backdrop-blur-xl p-4 shadow-2xl z-50 flex flex-col gap-3"
                      >
                        <div className="border-b border-white/5 pb-3">
                          <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
                          <p className="text-xs text-white/50 truncate font-light mt-0.5">{user.email}</p>
                        </div>
                        <button
                          onClick={async () => {
                            if (isFirebaseConfigured && auth) {
                              try {
                                await signOut(auth);
                              } catch (e) {
                                console.error('Firebase signout error', e);
                              }
                            }
                            logout();
                            setShowUserDropdown(false);
                            showToast('Signed out successfully', 'success');
                          }}
                          className="w-full py-2 bg-white/5 hover:bg-rose-500/20 hover:text-rose-200 border border-white/10 hover:border-rose-500/30 rounded-xl text-xs font-semibold text-white/85 transition-all flex items-center justify-center gap-2"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          SIGN OUT
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white transition-all backdrop-blur-sm flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-glow"
                >
                  <UserPlus className="w-4 h-4" />
                  SIGN IN
                </button>
              )}
            </div>

            <a
              href="https://github.com/SrinivasaPrasadGade/Roxanne"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white transition-all backdrop-blur-sm flex items-center gap-2"
            >
              <Github className="w-4 h-4" />
            </a>
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 relative z-10">
        <Outlet context={{ showToast } satisfies LayoutContext} />
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-white/10 bg-black/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 text-xs tracking-widest text-white/50 flex flex-col md:flex-row items-center justify-between gap-4 uppercase">
          <div className="flex items-center gap-6">
            <span className="text-white/50"></span>
            <a href="https://www.linkedin.com/in/srinivasa-prasad-gade" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">LINKEDIN</a>
          </div>
          <p className="opacity-60 text-[10px]">LEGAL / © {new Date().getFullYear()} ROXANNE</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-white cursor-pointer transition-colors border-b border-white/20 pb-0.5"></span>
            <a href="mailto:srinivasaprasad.gade@gmail.com" className="hover:text-white transition-colors" title="Email">
              <Mail className="w-4 h-4" />
            </a>
            {/* Server Connection Status Indicator */}
            <div className="flex items-center ml-4 opacity-50" title={`Server: ${serverStatus}`}>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  serverStatus === 'connected'
                    ? 'bg-white/80 animate-pulse'
                    : serverStatus === 'checking'
                    ? 'bg-white/40'
                    : 'bg-red-500/80'
                }`}
              />
            </div>
          </div>
        </div>
      </footer>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className={`pointer-events-auto p-4 rounded-xl shadow-2xl flex items-center gap-4 border text-sm max-w-sm backdrop-blur-md ${
                toast.type === 'error'
                  ? 'bg-black/80 border-rose-500/30 text-rose-200'
                  : 'bg-black/80 border-white/20 text-white/90'
              }`}
            >
              {toast.type === 'error' ? (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-white/70 shrink-0" />
              )}
              <span className="font-light tracking-wide">{toast.message}</span>
              <button
                type="button"
                onClick={() =>
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                }
                className="ml-auto text-white/40 hover:text-white p-1 shrink-0 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Google Authentication Pop-up Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Glassmorphic Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAuthModalOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-zinc-950/80 border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden backdrop-blur-2xl z-10"
            >
              {/* Close Button */}
              <button
                onClick={() => setAuthModalOpen(false)}
                className="absolute top-6 right-6 text-white/40 hover:text-white hover:bg-white/5 p-2 rounded-full transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center text-center mt-4 mb-6">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-5 shadow-lg">
                  <ShieldAlert className="w-6 h-6 text-white/80" />
                </div>
                <h2 className="text-xl font-serif font-light text-white uppercase tracking-widest">
                  Authentication Required
                </h2>
                <p className="text-xs text-white/50 font-light mt-3 max-w-sm leading-relaxed">
                  Every tool you use, we'll be watching you. Please authenticate with Google to access Roxanne's tools.
                </p>
              </div>

              {isFirebaseConfigured ? (
                /* Firebase Google Sign-In Flow */
                <div className="flex flex-col items-center gap-4 py-4 border-t border-white/5">
                  <div className="text-xs tracking-widest text-white/40 uppercase mb-2">Connect via Firebase Auth</div>
                  <button
                    onClick={handleFirebaseGoogleSignIn}
                    className="w-full py-3.5 bg-white text-black hover:bg-white/90 border border-white rounded-full text-xs font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-3 shadow-lg"
                  >
                    {/* Inline Google Icon SVG */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    SIGN IN WITH GOOGLE
                  </button>
                </div>
              ) : googleClientId ? (
                /* Real Google OAuth Flow */
                <div className="flex flex-col items-center gap-4 py-4 border-t border-white/5">
                  <div className="text-xs tracking-widest text-white/40 uppercase mb-2">Connect via Google Platform</div>
                  <div id="google-signin-btn" className="w-full flex justify-center py-2" />
                </div>
              ) : (
                /* Simulated / Mock OAuth Flow */
                <div className="space-y-6 pt-4 border-t border-white/5">
                  <div className="text-center">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-yellow-500/80 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full">
                      Simulated OAuth Enabled
                    </span>
                  </div>

                  <form onSubmit={handleSimulatedSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold tracking-widest uppercase text-white/40 mb-1.5">
                        Display Name
                      </label>
                      <input
                        type="text"
                        required
                        value={simName}
                        onChange={(e) => setSimName(e.target.value)}
                        placeholder="e.g. Prasad Gade"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/30 transition-all font-light"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold tracking-widest uppercase text-white/40 mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={simEmail}
                        onChange={(e) => setSimEmail(e.target.value)}
                        placeholder="e.g. prasad@gmail.com"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/30 transition-all font-light"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={simulatedLoginStep !== 'idle'}
                      className="w-full py-3.5 mt-2 bg-white text-black hover:bg-white/90 border border-white rounded-xl text-xs font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                    >
                      {simulatedLoginStep === 'loading' ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          SIGNING IN...
                        </>
                      ) : simulatedLoginStep === 'success' ? (
                        'CONNECTED!'
                      ) : (
                        'SIGN IN WITH GOOGLE'
                      )}
                    </button>
                  </form>

                  {/* Quick select mock credentials */}
                  <div className="pt-2">
                    <p className="text-[9px] font-bold tracking-widest uppercase text-white/30 text-center mb-3">
                      Quick Select Credentials
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickMockSelect('srinivasaprasad.gade@gmail.com', 'Prasad Gade')}
                        className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl text-left transition-all text-glow"
                      >
                        <p className="text-[10px] font-semibold text-white truncate">Prasad Gade</p>
                        <p className="text-[8px] text-white/40 truncate font-light mt-0.5">srinivasaprasad.gade@...</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickMockSelect('test.user@gmail.com', 'Test User')}
                        className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl text-left transition-all text-glow"
                      >
                        <p className="text-[10px] font-semibold text-white truncate">Test User</p>
                        <p className="text-[8px] text-white/40 truncate font-light mt-0.5">test.user@gmail.com</p>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
