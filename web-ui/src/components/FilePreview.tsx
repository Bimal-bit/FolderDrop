interface FilePreviewProps {
  files: File[];
  totalBytes: number;
  onClear: () => void;
}

const EXT_LABELS: Record<string, string> = {
  pdf: 'PDF', doc: 'DOC', docx: 'DOC', xls: 'XLS', xlsx: 'XLS',
  ppt: 'PPT', pptx: 'PPT', txt: 'TXT', csv: 'CSV', zip: 'ZIP',
  png: 'IMG', jpg: 'IMG', jpeg: 'IMG', gif: 'IMG', svg: 'SVG', webp: 'IMG',
  mp4: 'VID', mov: 'VID', avi: 'VID', mp3: 'AUD', wav: 'AUD',
  js: 'JS', ts: 'TS', py: 'PY', java: 'JAVA', html: 'HTML', css: 'CSS',
};

function getLabel(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_LABELS[ext] ?? 'FILE';
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function FilePreview({ files, totalBytes, onClear }: FilePreviewProps) {
  const shown = files.slice(0, 5);
  const extra = files.length - shown.length;

  return (
    <div className="file-preview">
      <div className="file-preview-header">
        <span className="file-preview-count">
          {files.length} file{files.length !== 1 ? 's' : ''} - {formatBytes(totalBytes)}
        </span>
        <button className="file-preview-clear" onClick={onClear} aria-label="Clear selection">
          Clear
        </button>
      </div>
      <ul className="file-preview-list">
        {shown.map((f, i) => (
          <li key={i} className="file-preview-item">
            <span className="file-preview-icon">{getLabel(f.name)}</span>
            <span className="file-preview-name" title={f.name}>{f.name}</span>
            <span className="file-preview-size">{formatBytes(f.size)}</span>
          </li>
        ))}
        {extra > 0 && (
          <li className="file-preview-more">+{extra} more file{extra !== 1 ? 's' : ''}</li>
        )}
      </ul>
    </div>
  );
}
