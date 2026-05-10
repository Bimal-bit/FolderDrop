import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeProps {
  value: string;
  size?: number;
}

export function QrCode({ value, size = 180 }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!value) return;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      color: {
        dark: isDark ? '#e2e8f0' : '#1e1b4b',
        light: isDark ? '#0f0818' : '#ffffff',
      },
    })
      .then(setDataUrl)
      .catch((err: unknown) => {
        console.error('[QrCode] failed to generate:', err);
        setError('QR generation failed');
      });
  }, [value, size]);

  if (error) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'red' }}>
        {error}
      </div>
    );
  }

  if (!dataUrl) {
    return <div style={{ width: size, height: size, borderRadius: 12, background: 'rgba(255,255,255,0.05)' }} />;
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      style={{ borderRadius: 12, display: 'block' }}
      alt={`QR code for: ${value}`}
    />
  );
}
