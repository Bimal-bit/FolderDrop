import { useState, useCallback, useEffect, useContext } from 'react';
import { OtpInput } from './OtpInput';
import { downloadAndDecrypt, isValidOtp } from '../api/download';
import { AppContext } from '../context/AppContext';
import { ParticleBar } from './ParticleBar';

type ReceiverStatus = 'idle' | 'loading' | 'success' | 'error';

interface ReceiverViewProps {
  onBack: () => void;
  initialCode?: string;
}

function ReceiveIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function ReceiverView({ onBack, initialCode = '' }: ReceiverViewProps) {
  const { addToast } = useContext(AppContext);

  const [otp, setOtp] = useState(initialCode);
  const [status, setStatus] = useState<ReceiverStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [maxDownloads, setMaxDownloads] = useState<number | null>(null);
  const [dlProgress, setDlProgress] = useState(0);
  const [dlLabel, setDlLabel] = useState('Downloading...');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        navigator.clipboard.readText().then(text => {
          const digits = text.replace(/\D/g, '').slice(0, 6);
          if (digits.length === 6) {
            setOtp(digits);
            addToast('Code pasted from clipboard', 'info', 2000);
          }
        }).catch(() => {});
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addToast]);

  useEffect(() => {
    const trimmed = otp.replace(/\s/g, '');
    if (!isValidOtp(trimmed)) {
      setRemaining(null);
      setMaxDownloads(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/info/${encodeURIComponent(trimmed)}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { maxDownloads: number; remaining: number } | null) => {
        if (cancelled || !data) return;
        setRemaining(data.remaining);
        setMaxDownloads(data.maxDownloads);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [otp]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = otp.replace(/\s/g, '');
    if (!isValidOtp(trimmed)) return;

    setStatus('loading');
    setDlProgress(0);
    setDlLabel('Connecting...');
    setErrorMsg('');

    try {
      await downloadAndDecrypt(trimmed, (p) => {
        if (p.phase === 'fetching') {
          setDlLabel(p.percent < 100 ? `Downloading... ${p.percent}%` : 'Decrypting...');
          setDlProgress(Math.round(p.percent * 0.9)); // 0–90% for download
        } else {
          setDlLabel('Decrypting...');
          setDlProgress(90 + Math.round(p.percent * 0.1)); // 90–100% for decrypt
        }
      });
      setDlProgress(100);
      setStatus('success');
      addToast('Downloaded and decrypted.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
      setStatus('error');
      addToast(message, 'error');
    }
  }, [otp, addToast]);

  const handleOtpChange = useCallback((value: string) => {
    setOtp(value);
    if (status === 'error') {
      setStatus('idle');
      setErrorMsg('');
    }
  }, [status]);

  const isComplete = isValidOtp(otp.replace(/\s/g, ''));
  const isDisabled = status === 'loading' || status === 'success';

  return (
    <div className="view-content">
      <button className="back-btn" onClick={onBack}>Back</button>

      <div className="view-header">
        <span className="view-icon"><ReceiveIcon /></span>
        <h2 className="view-title">Receive a File</h2>
        <p className="view-subtitle">Enter the 6-digit code from the sender</p>
      </div>

      <p className="keyboard-hint">Tip: Press <kbd>Ctrl+V</kbd> anywhere to paste a code</p>

      <form onSubmit={handleSubmit} noValidate className="receiver-form">
        <OtpInput value={otp} onChange={handleOtpChange} disabled={isDisabled} />

        {isComplete && remaining !== null && status === 'idle' && (
          <div className="download-info-badge">
            <span>{remaining} of {maxDownloads} download{maxDownloads !== 1 ? 's' : ''} remaining</span>
          </div>
        )}

        <button type="submit" className="download-btn" disabled={!isComplete || isDisabled}>
          {status === 'loading'
            ? <><span className="btn-spinner" aria-hidden="true" /> {dlLabel}</>
            : 'Download & Decrypt'}
        </button>
      </form>

      {/* Download progress bar */}
      {status === 'loading' && (
        <div className="progress-block">
          <ParticleBar progress={dlProgress} label={dlLabel} />
        </div>
      )}

      {status === 'success' && (
        <div className="status-message status-success" role="status" aria-live="polite">
          <span className="status-icon">OK</span>
          <span>Download complete. Check your downloads folder.</span>
        </div>
      )}
      {status === 'error' && (
        <div className="status-message status-error" role="alert" aria-live="assertive">
          <span className="status-icon">ERR</span>
          <span>{errorMsg}</span>
        </div>
      )}

      <p className="receiver-hint">Codes expire after 10 min</p>
    </div>
  );
}
