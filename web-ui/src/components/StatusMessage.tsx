export type Status = 'idle' | 'loading' | 'success' | 'error';

interface StatusMessageProps {
  status: Status;
  errorMessage?: string;
}

export function StatusMessage({ status, errorMessage }: StatusMessageProps) {
  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <div className="status-message status-loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <span>Finding your file...</span>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="status-message status-success" role="status" aria-live="polite">
        <span className="status-icon" aria-hidden="true">OK</span>
        <span>Download starting...</span>
      </div>
    );
  }

  if (status === 'error') {
    const message = errorMessage ?? 'Invalid or expired code. Ask for a new one.';
    return (
      <div className="status-message status-error" role="alert" aria-live="assertive">
        <span className="status-icon" aria-hidden="true">ERR</span>
        <span>{message}</span>
      </div>
    );
  }

  return null;
}
