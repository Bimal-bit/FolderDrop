import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SenderView } from './components/SenderView';
import { ReceiverView } from './components/ReceiverView';
import { ToastContainer } from './components/ToastContainer';
import { AnimatedBackground } from './components/AnimatedBackground';
import { TiltCard } from './components/TiltCard';
import { AppContext } from './context/AppContext';
import { useToast } from './hooks/useToast';
import { getKeyFromHash } from './api/crypto';

type Mode = 'home' | 'send' | 'receive';
type Theme = 'dark' | 'light';

const pageVariants = {
  initial: { opacity: 0, y: 28, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -18, scale: 0.98, transition: { duration: 0.22, ease: 'easeIn' } },
};

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

function FolderIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

// Capture URL params immediately at load time before any React renders.
// The hash fragment (#key=...) must be read before anything can clear it.
const _initialParams = new URLSearchParams(window.location.search);
const _initialCode = _initialParams.get('code') ?? '';
const _initialKey = getKeyFromHash();
const _initialMode: Mode =
  _initialCode || window.location.pathname.includes('redeem') ? 'receive' : 'home';

export default function App() {
  const [mode, setMode] = useState<Mode>(_initialMode);
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('fd_theme') as Theme | null) ?? 'dark'
  );
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fd_theme', theme);
  }, [theme]);

  const showReceive = () => setMode('receive');
  const showSend = () => setMode('send');
  const showHome = () => setMode('home');
  const toggleTheme = () => setTheme(current => current === 'dark' ? 'light' : 'dark');

  return (
    <AppContext.Provider value={{ addToast }}>
      <AnimatedBackground theme={theme} />

      <div className="site-shell">
        <nav className="top-nav">
          <button className="brand" onClick={showHome} aria-label="FolderDrop home">
            <span className="brand-icon"><FolderIcon /></span>
            <span>FolderDrop</span>
          </button>
          <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </nav>

        <main className="landing">
          <section className="hero">
            <motion.div className="hero-orbit" aria-hidden="true" initial={{ opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }}>
              <div className="orbit-ring orbit-ring-a" />
              <div className="orbit-ring orbit-ring-b" />
              <div className="orbit-cube">
                <span className="cube-face cube-front" />
                <span className="cube-face cube-back" />
                <span className="cube-face cube-right" />
                <span className="cube-face cube-left" />
                <span className="cube-face cube-top" />
                <span className="cube-face cube-bottom" />
              </div>
            </motion.div>
            <motion.div className="badge" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <span className="dot" />
              No login required
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.5 }}>
              Share code.<br />Get a key.<br /><span>Done.</span>
            </motion.h1>
            <motion.p className="hero-sub" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.5 }}>
              No accounts. No unknown servers. A 6-digit code, valid for 10 minutes, that self-destructs on first use.
            </motion.p>
            <motion.div className="hero-actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.45 }}>
              <button className="cta" onClick={showReceive}>
                Redeem a code
                <ArrowIcon />
              </button>
              <button className="cta cta-secondary" onClick={showSend}>
                Share a file
              </button>
            </motion.div>
          </section>

          <section className="card-wrap" aria-live="polite">
            <TiltCard className="app-card-tilt" maxTilt={8} scale={1.01}>
              <motion.div className="card app-card" layout>
                <AnimatePresence mode="wait">
                  {mode === 'home' && (
                    <motion.div key="home" className="mode-select" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                      <motion.div className="card-header" variants={fadeUp}>
                        <span className="card-icon"><FolderIcon /></span>
                        <div>
                          <h2 className="card-title">Choose your flow</h2>
                          <p className="card-sub">Send a folder from VS Code or redeem a 6-digit code in the browser.</p>
                        </div>
                      </motion.div>

                      <motion.div className="mode-buttons" variants={fadeUp}>
                        <button className="mode-btn" onClick={showSend}>
                          <span className="mode-btn-label">Share a file</span>
                          <span className="mode-btn-desc">Zip files, upload, and get a key</span>
                        </button>
                        <button className="mode-btn" onClick={showReceive}>
                          <span className="mode-btn-label">Redeem a code</span>
                          <span className="mode-btn-desc">Enter the key and download once</span>
                        </button>
                      </motion.div>
                    </motion.div>
                  )}

                  {mode === 'send' && (
                    <motion.div key="send" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                      <SenderView onBack={showHome} />
                    </motion.div>
                  )}

                  {mode === 'receive' && (
                    <motion.div key="receive" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                      <ReceiverView onBack={showHome} initialCode={_initialCode} initialKey={_initialKey} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </TiltCard>
          </section>

          <section className="features">
            <div className="section-label">Why FolderDrop</div>
            <div className="feat-grid">
              <article className="feat-card">
                <span className="feat-icon">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" /><path d="M12 8v4l3 3" />
                  </svg>
                </span>
                <h3>10-minute expiry</h3>
                <p>Codes self-destruct after 10 minutes. Nothing lingers on any server.</p>
              </article>
              <article className="feat-card">
                <span className="feat-icon">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17.94 11A6 6 0 0 0 6.06 11M1 1l22 22M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  </svg>
                </span>
                <h3>Burn after download</h3>
                <p>Each code works exactly once. First download destroys it permanently.</p>
              </article>
              <article className="feat-card">
                <span className="feat-icon">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                  </svg>
                </span>
                <h3>Zero accounts</h3>
                <p>No sign-up, no tracking. Share from VS Code, receive in browser.</p>
              </article>
              <article className="feat-card">
                <span className="feat-icon">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18M3 12h18" />
                  </svg>
                </span>
                <h3>Folder or files</h3>
                <p>Send a whole folder, a zip, or a few separate files from the same flow.</p>
              </article>
              <article className="feat-card">
                <span className="feat-icon">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12h16M12 4v16" /><path d="m17 7 3 5-3 5M7 7l-3 5 3 5" />
                  </svg>
                </span>
                <h3>Share link ready</h3>
                <p>Copy the code, copy a redeem link, or share directly to common apps.</p>
              </article>
              <article className="feat-card">
                <span className="feat-icon">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16M4 12h10M4 17h7" />
                  </svg>
                </span>
                <h3>Download limits</h3>
                <p>Choose one-time use or allow a small number of downloads before cleanup.</p>
              </article>
              <article className="feat-card">
                <span className="feat-icon">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6h16M7 12h10M10 18h4" />
                  </svg>
                </span>
                <h3>Folder cleanup</h3>
                <p>Exclude dependencies, env files, builds, logs, and custom patterns before upload.</p>
              </article>
              <article className="feat-card">
                <span className="feat-icon">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M2 12h20" /><path d="M5 5c4 3 10 3 14 0M5 19c4-3 10-3 14 0" />
                  </svg>
                </span>
                <h3>QR handoff</h3>
                <p>Show a QR code when moving a transfer from desktop to mobile is faster.</p>
              </article>
              <article className="feat-card">
                <span className="feat-icon">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 14h6v6H4zM14 4h6v6h-6z" /><path d="m10 10 4 4M14 10h-4v4" />
                  </svg>
                </span>
                <h3>Fast preview</h3>
                <p>Review selected files and total size before committing the upload.</p>
              </article>
            </div>
          </section>
        </main>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </AppContext.Provider>
  );
}
