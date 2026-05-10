import { useCallback } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  size: number;
  life: number;
  rotation: number;
  rotationSpeed: number;
}

const COLORS = ['#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#a78bfa'];

/**
 * Lightweight canvas-based confetti — no external library needed.
 * Fires a burst of particles from the top-center of the viewport.
 */
export function useConfetti() {
  const fire = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      pointer-events:none;z-index:9999;
    `;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;
    const particles: Particle[] = [];

    // Spawn 80 particles from top-center
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.3,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * -6 - 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: Math.random() * 8 + 4,
        life: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }

    let animId: number;

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18; // gravity
        p.vx *= 0.99;
        p.life -= 0.012;
        p.rotation += p.rotationSpeed;

        if (p.life <= 0) continue;
        alive = true;

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (alive) {
        animId = requestAnimationFrame(animate);
      } else {
        canvas.remove();
      }
    }

    animId = requestAnimationFrame(animate);

    // Safety cleanup after 4s
    setTimeout(() => {
      cancelAnimationFrame(animId);
      canvas.remove();
    }, 4000);
  }, []);

  return { fire };
}
