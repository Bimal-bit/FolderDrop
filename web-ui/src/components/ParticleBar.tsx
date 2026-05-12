import { useEffect, useRef } from 'react';

interface ParticleBarProps {
  progress: number;   // 0–100
  label?: string;
  sublabel?: string;
}

/**
 * Animated particle progress bar.
 * Particles flow across the filled portion of the track.
 * Uses the CSS accent color (--accent) for particles and track fill.
 */
export function ParticleBar({ progress, label, sublabel }: ParticleBarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const progressRef = useRef(progress);

  // Keep progressRef in sync without restarting the animation loop
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const H = 44;
    const TRACK_H = 6;
    const TRACK_Y = H / 2 - TRACK_H / 2;
    const RADIUS = 3;

    // Read CSS variables for colors
    const style = getComputedStyle(document.documentElement);
    const accentColor = style.getPropertyValue('--accent').trim() || '#00e5cc';
    const trackColor = style.getPropertyValue('--border').trim() || 'rgba(255,255,255,0.08)';

    // Set canvas size to match its CSS width
    const resize = () => {
      cv.width = cv.offsetWidth;
    };
    resize();

    const ctx = cv.getContext('2d')!;

    // Particles initialise at x=0; they spread naturally as progress grows
    type Particle = { x: number; y: number; vx: number; vy: number; r: number };
    const pts: Particle[] = Array.from({ length: 40 }, () => ({
      x: Math.random() * cv.width * (progressRef.current / 100),
      y: H / 2 + (Math.random() - 0.5) * 20,
      vx: 0.5 + Math.random() * 1.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: 1.5 + Math.random() * 2.5,
    }));

    const draw = () => {
      const W = cv.width;
      const fillW = W * (progressRef.current / 100);

      ctx.clearRect(0, 0, W, H);

      // Track background (full width, always visible)
      ctx.fillStyle = trackColor;
      ctx.beginPath();
      ctx.roundRect(0, TRACK_Y, W, TRACK_H, RADIUS);
      ctx.fill();

      // Particles flow within the filled region — no separate filled-bar rect
      pts.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap horizontally within filled region
        if (p.x > fillW) p.x = 0;
        if (p.x < 0) p.x = fillW > 0 ? fillW : 0;

        // Bounce vertically
        if (p.y < 2 || p.y > H - 2) p.vy *= -1;

        // Only draw if inside filled area
        if (p.x <= fillW && fillW > 0) {
          ctx.fillStyle = accentColor;
          ctx.globalAlpha = 0.7 + Math.random() * 0.3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []); // run once — progress updates via ref

  return (
    <div className="particle-bar-wrap">
      {(label || sublabel) && (
        <div className="progress-label-row">
          <span>{label}</span>
          {sublabel && <span className="upload-speed">{sublabel}</span>}
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        height={44}
        style={{ width: '100%', display: 'block', borderRadius: 8 }}
        aria-label={`Progress: ${Math.round(progress)}%`}
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        role="progressbar"
      />
    </div>
  );
}
