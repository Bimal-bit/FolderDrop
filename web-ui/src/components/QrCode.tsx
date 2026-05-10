import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QrCodeProps {
  value: string;
  size?: number;
}

export function QrCode({ value, size = 180 }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: {
        dark: isDark ? '#e2e8f0' : '#1e1b4b',
        light: isDark ? 'rgba(15,8,24,0)' : 'rgba(255,255,255,0)',
      },
    });
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ borderRadius: 12, display: 'block' }}
      aria-label={`QR code for: ${value}`}
    />
  );
}
