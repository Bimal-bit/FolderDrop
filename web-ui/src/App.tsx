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

function HeroHeading() {
  const lines = ['Share code.', 'Get a key.', 'Done.'];
  return (
    <motion.h1
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.2, delayChildren: 0.08 } } }}
    >
      {lines.map((line, i) => (
        <motion.span
          key={i}
          style={{ display: 'block' }}
          variants={{
            hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
            visible: {
              opacity: 1, y: 0, filter: 'blur(0px)',
              transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          {i === lines.length - 1
            ? <span className="hero-accent">{line}</span>
            : line}
        </motion.span>
      ))}
    </motion.h1>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" /><path d="M12 8v4l3 3" /></svg>,
    title: '10-minute expiry',
    desc: 'Codes self-destruct after 10 minutes. Nothing lingers on any server.',
  },
  {
    icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 11A6 6 0 0 0 6.06 11M1 1l22 22M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /></svg>,
    title: 'Burn after download',
    desc: 'Each code works exactly once. First download destroys it permanently.',
  },
  {
    icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>,
    title: 'Zero accounts',
    desc: 'No sign-up, no tracking. Share from VS Code, receive in browser.',
  },
  {
    icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M3 12h18" /></svg>,
    title: 'Folder or files',
    desc: 'Send a whole folder, a zip, or a few separate files from the same flow.',
  },
  {
    icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16M12 4v16" /><path d="m17 7 3 5-3 5M7 7l-3 5 3 5" /></svg>,
    title: 'Share link ready',
    desc: 'Copy the code, copy a redeem link, or share directly to common apps.',
  },
  {
    icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M4 12h10M4 17h7" /></svg>,
    title: 'Download limits',
    desc: 'Choose one-time use or allow a small number of downloads before cleanup.',
  },
  {
    icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>,
    title: 'Folder cleanup',
    desc: 'Exclude dependencies, env files, builds, logs, and custom patterns before upload.',
  },
  {
    icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20" /><path d="M5 5c4 3 10 3 14 0M5 19c4-3 10-3 14 0" /></svg>,
    title: 'QR handoff',
    desc: 'Show a QR code when moving a transfer from desktop to mobile is faster.',
  },
  {
    icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h6v6H4zM14 4h6v6h-6z" /><path d="m10 10 4 4M14 10h-4v4" /></svg>,
    title: 'Fast preview',
    desc: 'Review selected files and total size before committing the upload.',
  },
  {
    icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    title: 'End-to-end encrypted',
    desc: 'Files are AES-256-GCM encrypted in your browser. The server never sees plaintext.',
  },
  {
    icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M13 2v7h7" /></svg>,
    title: 'Up to 150 MB',
    desc: 'Send large projects, datasets, or media files up to 150 MB per transfer.',
  },
  {
    icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>,
    title: 'Live upload speed',
    desc: 'Real-time MB/s indicator so you always know how fast your transfer is going.',
  },
];

function FeaturesSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="features">
      <button
        className="features-toggle"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span className="section-label">Why FolderDrop</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="feat-grid"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.22, ease: 'easeIn' } }}
            style={{ overflow: 'hidden' }}
          >
            <motion.div
              className="feat-grid"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            >
              {FEATURES.map((f) => (
                <motion.article
                  key={f.title}
                  className="feat-card"
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                  }}
                >
                  <span className="feat-icon">{f.icon}</span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </motion.article>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
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
            <HeroHeading />
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

          <FeaturesSection />
        </main>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </AppContext.Provider>
  );
}
