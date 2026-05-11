import { useState, useRef, useCallback, DragEvent, useContext } from 'react';
import JSZip from 'jszip';
import { uploadZip, pingBackend, UploadProgress } from '../api/upload';
import { encryptBlob } from '../api/crypto';
import { QrCode } from './QrCode';
import { ShareButtons } from './ShareButtons';
import { FilePreview } from './FilePreview';
import { useCountdown } from '../hooks/useCountdown';
import { useConfetti } from '../hooks/useConfetti';
import { AppContext } from '../context/AppContext';

type SenderStatus = 'idle' | 'preview' | 'zipping' | 'uploading' | 'done' | 'error';
type FileMode = 'folder' | 'files';
type FolderFile = File & { webkitRelativePath?: string };

interface SenderViewProps {
  onBack: () => void;
}

function SendIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 3h14" />
    </svg>
  );
}

const MAX_SIZE_MB = 150;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const DEFAULT_CUSTOM_EXCLUDES = '*.log, .DS_Store';

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatSpeed(bytesPerSec: number) {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
}

export function SenderView({ onBack }: SenderViewProps) {
  const { addToast } = useContext(AppContext);
  const { fire: fireConfetti } = useConfetti();

  // Options
  const [fileMode, setFileMode] = useState<FileMode>('folder');
  const [maxDownloads, setMaxDownloads] = useState(1);
  const [excludeDependencies, setExcludeDependencies] = useState(true);
  const [excludeSecrets, setExcludeSecrets] = useState(true);
  const [excludeBuildOutput, setExcludeBuildOutput] = useState(true);
  const [excludeVcs, setExcludeVcs] = useState(true);
  const [customExcludes, setCustomExcludes] = useState(DEFAULT_CUSTOM_EXCLUDES);

  // State
  const [status, setStatus] = useState<SenderStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [otp, setOtp] = useState('');
  const [expiresIn, setExpiresIn] = useState(600);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // File preview state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [selectedSize, setSelectedSize] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<FolderFile[]>([]);
  const [pendingMode, setPendingMode] = useState<FileMode>('folder');
  const [excludedCount, setExcludedCount] = useState(0);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const uploadStartRef = useRef<number>(0);
  const uploadedBytesRef = useRef<number>(0);

  const { label: countdownLabel, expired } = useCountdown(expiresIn, status === 'done');
  const redeemUrl = otp ? `${window.location.origin.replace(/\/$/, '')}/redeem?code=${encodeURIComponent(otp)}` : '';

  const shouldExclude = useCallback((file: FolderFile) => {
    if (fileMode !== 'folder') return false;

    const path = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
    const parts = path.split('/').map(part => part.toLowerCase());
    const lowerPath = path.toLowerCase();
    const name = file.name.toLowerCase();

    if (excludeDependencies && parts.some(part => ['node_modules', 'bower_components', 'vendor'].includes(part))) return true;
    if (excludeVcs && parts.some(part => ['.git', '.svn', '.hg'].includes(part))) return true;
    if (excludeBuildOutput && parts.some(part => ['dist', 'build', 'out', '.next', '.nuxt', 'coverage', '.cache', '.turbo'].includes(part))) return true;
    if (excludeSecrets && (name === '.env' || name.startsWith('.env.') || name.endsWith('.pem') || name.endsWith('.key') || name.includes('secret'))) return true;

    return customExcludes
      .split(',')
      .map(pattern => pattern.trim().toLowerCase())
      .filter(Boolean)
      .some(pattern => {
        if (pattern.startsWith('*.')) return name.endsWith(pattern.slice(1));
        if (pattern.includes('/')) return lowerPath.includes(pattern);
        return parts.includes(pattern) || name === pattern;
      });
  }, [customExcludes, excludeBuildOutput, excludeDependencies, excludeSecrets, excludeVcs, fileMode]);

  // ── File selection → preview ────────────────────────────────────────────────
  const handleFilesSelected = useCallback((files: FileList, mode: FileMode) => {
    if (!files.length) return;

    let totalBytes = 0;
    const raw: FolderFile[] = [];
    for (let i = 0; i < files.length; i++) {
      raw.push(files[i] as FolderFile);
    }

    const arr = mode === 'folder' ? raw.filter(file => !shouldExclude(file)) : raw;
    const skipped = raw.length - arr.length;

    for (const file of arr) {
      totalBytes += file.size;
    }

    if (!arr.length) {
      addToast('All selected files were excluded. Adjust folder cleanup and try again.', 'warning');
      return;
    }

    if (totalBytes > MAX_SIZE_BYTES) {
      addToast(`Too large. Max is ${MAX_SIZE_MB} MB. Your selection is ${formatBytes(totalBytes)}.`, 'error');
      return;
    }

    const firstFile = raw[0];
    const name = mode === 'folder'
      ? (firstFile.webkitRelativePath?.split('/')[0] || 'folder')
      : (arr.length === 1 ? arr[0].name : `${arr.length} files`);

    setSelectedFiles(arr);
    setSelectedName(name);
    setSelectedSize(totalBytes);
    setPendingFiles(arr);
    setPendingMode(mode);
    setExcludedCount(skipped);
    setStatus('preview');
  }, [addToast, shouldExclude]);

  // ── Zip + Upload ────────────────────────────────────────────────────────────
  const startUpload = useCallback(async () => {
    if (!pendingFiles.length) return;
    const files = pendingFiles;
    const mode = pendingMode;

    setStatus('zipping');
    setProgress(0);
    setProgressLabel(mode === 'folder' ? 'Waking server...' : 'Waking server...');
    setUploadSpeed('');

    // Wake the Render backend in parallel while we start zipping
    const wakePromise = pingBackend();

    try {
      let zipBlob: Blob;
      let uploadName: string;

      if (mode === 'folder' || files.length >= 1) {
        // If it's a single already-zipped file, skip re-zipping entirely
        const isSingleZip = files.length === 1 && files[0].name.toLowerCase().endsWith('.zip');
        if (isSingleZip) {
          zipBlob = files[0];
          uploadName = files[0].name;
          setProgress(50);
        } else {
          const zip = new JSZip();
          setProgressLabel(mode === 'folder' ? 'Zipping folder...' : 'Preparing files...');
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            zip.file(f.webkitRelativePath || f.name, f);
            setProgress(Math.round(((i + 1) / files.length) * 40));
          }
          // Use level 1 (fastest) — encryption makes further compression pointless
          zipBlob = await zip.generateAsync(
            { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } },
            (meta) => setProgress(Math.round(meta.percent * 0.5))
          );
          uploadName = selectedName.endsWith('.zip') ? selectedName : `${selectedName}.zip`;
        }
      } else {
        zipBlob = files[0];
        uploadName = files[0].name;
        setProgress(50);
      }

      setStatus('uploading');
      setProgress(50);
      setProgressLabel('Encrypting...');
      const encrypted = await encryptBlob(zipBlob);
      setProgressLabel('Uploading encrypted archive...');
      await wakePromise; // ensure backend is awake before sending
      uploadStartRef.current = Date.now();
      uploadedBytesRef.current = 0;

      const result = await uploadZip(
        encrypted.encrypted,
        uploadName,
        (p: UploadProgress) => {
          setProgress(50 + Math.round(p.percent / 2));
          setProgressLabel(`Uploading... ${p.percent}%`);
          const elapsed = (Date.now() - uploadStartRef.current) / 1000;
          const uploaded = (p.percent / 100) * encrypted.encrypted.size;
          if (elapsed > 0.5) setUploadSpeed(formatSpeed(uploaded / elapsed));
        },
        { maxDownloads, decryptionKey: encrypted.key }
      );

      setOtp(result.otp);
      setExpiresIn(result.expiresIn);
      setProgress(100);
      setStatus('done');

      fireConfetti();
      addToast('Code link copied to clipboard.', 'success');

      try {
        await navigator.clipboard.writeText(`${window.location.origin.replace(/\/$/, '')}/redeem?code=${encodeURIComponent(result.otp)}`);
      } catch { /* ignore */ }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const friendly =
        msg === 'FOLDER_TOO_LARGE' ? `Too large. Max is ${MAX_SIZE_MB} MB.`
        : msg === 'RATE_LIMITED' ? 'Too many uploads. Wait a minute and try again.'
        : msg === 'SERVER_UNREACHABLE' ? 'Cannot reach the server. Is the backend running?'
        : msg;
      setErrorMsg(friendly);
      setStatus('error');
      addToast(friendly, 'error');
    }
  }, [pendingFiles, pendingMode, selectedName, maxDownloads, addToast, fireConfetti]);

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    (fileMode === 'folder' ? folderInputRef : filesInputRef).current?.click();
  }, [fileMode]);

  const handleReset = () => {
    setStatus('idle');
    setProgress(0);
    setOtp('');
    setErrorMsg('');
    setCopied(false);
    setShowQr(false);
    setSelectedFiles([]);
    setSelectedName('');
    setSelectedSize(0);
    setPendingFiles([]);
    setExcludedCount(0);
    setUploadSpeed('');
    if (folderInputRef.current) folderInputRef.current.value = '';
    if (filesInputRef.current) filesInputRef.current.value = '';
  };

  const handleCopyOtp = async () => {
    try {
      await navigator.clipboard.writeText(otp);
      setCopied(true);
      addToast('Code copied!', 'success', 2000);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(redeemUrl);
      setLinkCopied(true);
      addToast('Link copied!', 'success', 2000);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* ignore */ }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="view-content">
      <button className="back-btn" onClick={onBack}>Back</button>

      <div className="view-header">
        <span className="view-icon"><SendIcon /></span>
        <h2 className="view-title">Send a File</h2>
        <p className="view-subtitle">Zip, upload, and share with a 6-digit code</p>
      </div>

      {/* ── Options (idle only) ── */}
      {status === 'idle' && (
        <div className="options-panel">
          <div className="option-row">
            <span className="option-label">What to share</span>
            <div className="toggle-group">
              <button className={`toggle-btn${fileMode === 'folder' ? ' toggle-btn--active' : ''}`} onClick={() => setFileMode('folder')}>Folder</button>
              <button className={`toggle-btn${fileMode === 'files' ? ' toggle-btn--active' : ''}`} onClick={() => setFileMode('files')}>Files</button>
            </div>
          </div>

          <div className="option-row">
            <span className="option-label">Download limit</span>
            <div className="limit-selector">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} className={`limit-btn${maxDownloads === n ? ' limit-btn--active' : ''}`} onClick={() => setMaxDownloads(n)}>{n}</button>
              ))}
            </div>
            <span className="option-hint">{maxDownloads === 1 ? 'One-time use' : `Up to ${maxDownloads} downloads`}</span>
          </div>

          {fileMode === 'folder' && (
            <div className="exclude-panel">
              <div className="exclude-panel-head">
                <span className="option-label">Folder cleanup</span>
                <span className="option-hint">Skip files you usually should not share</span>
              </div>
              <div className="exclude-grid">
                <label className="check-option">
                  <input type="checkbox" checked={excludeDependencies} onChange={(e) => setExcludeDependencies(e.target.checked)} />
                  <span>Dependencies</span>
                </label>
                <label className="check-option">
                  <input type="checkbox" checked={excludeSecrets} onChange={(e) => setExcludeSecrets(e.target.checked)} />
                  <span>Secrets and env files</span>
                </label>
                <label className="check-option">
                  <input type="checkbox" checked={excludeBuildOutput} onChange={(e) => setExcludeBuildOutput(e.target.checked)} />
                  <span>Build output</span>
                </label>
                <label className="check-option">
                  <input type="checkbox" checked={excludeVcs} onChange={(e) => setExcludeVcs(e.target.checked)} />
                  <span>Git metadata</span>
                </label>
              </div>
              <label className="custom-exclude">
                <span>Custom excludes</span>
                <input
                  value={customExcludes}
                  onChange={(e) => setCustomExcludes(e.target.value)}
                  placeholder="*.log, tmp, private.json"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* ── Drop zone (idle only) ── */}
      {status === 'idle' && (
        <div
          className={`drop-zone${dragging ? ' drop-zone--active' : ''}`}
          onClick={() => (fileMode === 'folder' ? folderInputRef : filesInputRef).current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && (fileMode === 'folder' ? folderInputRef : filesInputRef).current?.click()}
        >
          <span className="drop-icon">{fileMode === 'folder' ? 'Folder' : 'Files'}</span>
          <p className="drop-primary">{fileMode === 'folder' ? 'Click to select a folder' : 'Click to select files'}</p>
          <p className="drop-secondary">Max {MAX_SIZE_MB} MB - drag & drop supported</p>
          <input ref={folderInputRef} type="file"
            // @ts-ignore
            webkitdirectory="" multiple style={{ display: 'none' }}
            onChange={(e) => e.target.files?.length && handleFilesSelected(e.target.files, 'folder')}
          />
          <input ref={filesInputRef} type="file" multiple style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.png,.jpg,.jpeg,.gif,.mp4,.mp3"
            onChange={(e) => e.target.files?.length && handleFilesSelected(e.target.files, 'files')}
          />
        </div>
      )}

      {/* ── Preview ── */}
      {status === 'preview' && (
        <>
          <FilePreview files={selectedFiles} totalBytes={selectedSize} onClear={handleReset} />
          {excludedCount > 0 && (
            <div className="exclude-summary">{excludedCount} folder item{excludedCount !== 1 ? 's' : ''} excluded before upload.</div>
          )}
          <button className="upload-start-btn" onClick={startUpload}>Upload & Get Code</button>
          <button className="secondary-btn" onClick={handleReset}>Choose different files</button>
        </>
      )}

      {/* ── Progress ── */}
      {(status === 'zipping' || status === 'uploading') && (
        <div className="progress-block">
          <div className="progress-label-row">
            <span>{progressLabel}</span>
            <div className="progress-right">
              {uploadSpeed && <span className="upload-speed">{uploadSpeed}</span>}
              <span>{progress}%</span>
            </div>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="progress-meta">
            {fileMode === 'folder' ? 'Folder' : 'Files'} {selectedName}
            {selectedSize > 0 && <span className="progress-size"> - {formatBytes(selectedSize)}</span>}
          </p>
        </div>
      )}

      {/* ── Done ── */}
      {status === 'done' && (
        <div className="otp-result">
          <div className="otp-result-top">
            <span className="otp-result-icon">OK</span>
            <div>
              <p className="otp-result-label">Share this code with the recipient</p>
              <p className="otp-result-meta">
                {maxDownloads === 1 ? 'One-time use' : `Up to ${maxDownloads} downloads`}
                {' - '}
                <span className={`countdown${expired ? ' countdown--expired' : ''}`}>
                  {expired ? 'Expired' : countdownLabel}
                </span>
              </p>
            </div>
          </div>

          <div className="otp-display">
            {otp.split('').map((d, i) => <span key={i} className="otp-digit">{d}</span>)}
          </div>

          <div className="result-actions">
            <button className="copy-btn" onClick={handleCopyOtp} disabled={expired}>
              {copied ? 'Copied' : 'Copy Code'}
            </button>
            <button className="link-btn" onClick={handleCopyLink} disabled={expired}>
              {linkCopied ? 'Copied' : 'Copy Code Link'}
            </button>
          </div>

          {!expired && <ShareButtons otp={otp} redeemUrl={redeemUrl} />}

          <button className="qr-toggle-btn" onClick={() => setShowQr(v => !v)} disabled={expired}>
            {showQr ? 'Hide QR Code' : 'Show QR for Mobile'}
          </button>

          {showQr && !expired && (
            <div className="qr-block">
              <p className="qr-label">Scan to open on mobile</p>
              <QrCode value={redeemUrl} size={180} />
              <p className="qr-url">{redeemUrl}</p>
            </div>
          )}

          {expired && <div className="expired-notice">This code has expired. Share another file.</div>}

          <button className="secondary-btn" onClick={handleReset}>Share another file</button>
        </div>
      )}

      {/* ── Error ── */}
      {status === 'error' && (
        <div className="error-block">
          <span className="error-icon">ERR</span>
          <p className="error-text">{errorMsg}</p>
          <button className="secondary-btn" onClick={handleReset}>Try again</button>
        </div>
      )}
    </div>
  );
}
