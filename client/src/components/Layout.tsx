import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, X, Github, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ToastItem {
  id: string;
  message: string;
  type: 'error' | 'success';
}

export interface LayoutContext {
  showToast: (message: string, type?: 'error' | 'success') => void;
}

export default function Layout() {
  const [serverStatus, setServerStatus] = useState<
    'connected' | 'checking' | 'disconnected'
  >('checking');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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
            {/* <Link to="/" className="hover:text-white transition-colors">PROCESS</Link> */}
            {/* <Link to="/" className="hover:text-white transition-colors">TOOLS</Link> */}
            {/* <Link to="/" className="hover:text-white transition-colors">ETHOS</Link> */}
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
    </div>
  );
}
