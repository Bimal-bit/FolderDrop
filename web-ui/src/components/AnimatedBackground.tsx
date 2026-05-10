import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

export function AnimatedBackground({ theme }: { theme: 'dark' | 'light' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasEl = canvas;
    const context = ctx;

    let width = 0;
    let height = 0;
    let raf = 0;
    let particles: Particle[] = [];

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = Math.max(window.innerHeight, document.documentElement.scrollHeight);
      canvasEl.width = Math.floor(width * ratio);
      canvasEl.height = Math.floor(height * ratio);
      canvasEl.style.width = `${width}px`;
      canvasEl.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function initParticles() {
      const count = Math.max(56, Math.min(86, Math.floor(width / 16)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.34,
        vy: (Math.random() - 0.5) * 0.34,
        r: Math.random() * 1.4 + 0.45,
      }));
    }

    function draw() {
      context.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        context.beginPath();
        context.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        context.fillStyle = theme === 'dark' ? 'rgba(0,229,204,0.45)' : 'rgba(0,122,112,0.26)';
        context.shadowColor = theme === 'dark' ? 'rgba(0,229,204,0.55)' : 'rgba(0,122,112,0.28)';
        context.shadowBlur = 8;
        context.fill();
        context.shadowBlur = 0;
      }

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 112) {
            context.beginPath();
            context.moveTo(particles[i].x, particles[i].y);
            context.lineTo(particles[j].x, particles[j].y);
            const alpha = (theme === 'dark' ? 0.12 : 0.09) * (1 - dist / 112);
            context.strokeStyle = theme === 'dark' ? `rgba(0,229,204,${alpha})` : `rgba(0,122,112,${alpha})`;
            context.lineWidth = 0.5;
            context.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    }

    function reset() {
      resize();
      initParticles();
    }

    reset();
    draw();
    window.addEventListener('resize', reset);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', reset);
    };
  }, [theme]);

  return <canvas ref={canvasRef} className="particle-canvas" aria-hidden="true" />;
}
