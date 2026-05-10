import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeBackgroundProps {
  theme: 'dark' | 'light';
}

/**
 * Full-screen Three.js animated background.
 *
 * Dark:  Deep space — DNA helix, rotating torus knot, icosahedra, star field,
 *        neon grid plane, volumetric rings, floating cubes, particle trails.
 * Light: Soft aurora — translucent spheres, bokeh particles, pastel sky,
 *        slow-rotating rings, octahedra, ribbon geometry.
 */
export function ThreeBackground({ theme }: ThreeBackgroundProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    const W = mount.clientWidth;
    const H = mount.clientHeight;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // ── Scene & Camera ────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 300);
    camera.position.set(0, 0, 14);

    if (theme === 'dark') {
      scene.background = new THREE.Color('#04060f');
      scene.fog = new THREE.FogExp2('#04060f', 0.015);
    } else {
      scene.background = new THREE.Color('#eef2ff');
      scene.fog = new THREE.FogExp2('#eef2ff', 0.010);
    }

    const objects: THREE.Object3D[] = [];
    const clock = new THREE.Clock();

    // ── DARK MODE SCENE ───────────────────────────────────────────────────────
    if (theme === 'dark') {
      // Lights
      scene.add(new THREE.AmbientLight(0x0d0820, 3));
      const pl1 = new THREE.PointLight(0x6366f1, 120, 40);
      pl1.position.set(-6, 5, 4);
      scene.add(pl1);
      const pl2 = new THREE.PointLight(0x0ea5e9, 90, 35);
      pl2.position.set(7, -4, 3);
      scene.add(pl2);
      const pl3 = new THREE.PointLight(0xa855f7, 60, 28);
      pl3.position.set(0, 8, -5);
      scene.add(pl3);
      const pl4 = new THREE.PointLight(0xf472b6, 50, 22);
      pl4.position.set(-8, -5, 2);
      scene.add(pl4);

      // ── Central torus knot (hero piece) ──
      const tkGeo = new THREE.TorusKnotGeometry(2.4, 0.6, 200, 24, 2, 3);
      const tkMat = new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        emissive: 0x3730a3,
        emissiveIntensity: 0.5,
        roughness: 0.05,
        metalness: 0.95,
      });
      const torusKnot = new THREE.Mesh(tkGeo, tkMat);
      torusKnot.position.set(0, 0, -3);
      torusKnot.userData = { type: 'hero' };
      scene.add(torusKnot);
      objects.push(torusKnot);

      // Wireframe overlay
      const tkWire = new THREE.Mesh(
        tkGeo,
        new THREE.MeshBasicMaterial({ color: 0x818cf8, wireframe: true, transparent: true, opacity: 0.12 })
      );
      tkWire.position.copy(torusKnot.position);
      tkWire.userData = { type: 'heroWire' };
      scene.add(tkWire);
      objects.push(tkWire);

      // ── DNA Helix ──
      const helixGroup = new THREE.Group();
      const helixMat1 = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.8 });
      const helixMat2 = new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xbe185d, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.8 });
      const connMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, transparent: true, opacity: 0.5, roughness: 0.3, metalness: 0.6 });
      const sphereGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const connGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 8);

      for (let i = 0; i < 30; i++) {
        const t = (i / 30) * Math.PI * 4;
        const y = (i / 30) * 12 - 6;

        const s1 = new THREE.Mesh(sphereGeo, helixMat1);
        s1.position.set(Math.cos(t) * 0.8, y, Math.sin(t) * 0.8);
        helixGroup.add(s1);

        const s2 = new THREE.Mesh(sphereGeo, helixMat2);
        s2.position.set(Math.cos(t + Math.PI) * 0.8, y, Math.sin(t + Math.PI) * 0.8);
        helixGroup.add(s2);

        if (i % 3 === 0) {
          const conn = new THREE.Mesh(connGeo, connMat);
          conn.position.set(0, y, 0);
          conn.rotation.z = Math.PI / 2;
          conn.scale.x = 1.6;
          helixGroup.add(conn);
        }
      }
      helixGroup.position.set(-9, 0, -5);
      helixGroup.userData = { type: 'helix', rotY: 0.008 };
      scene.add(helixGroup);
      objects.push(helixGroup);

      // ── Floating icosahedra ──
      const icoColors = [0x6366f1, 0x0ea5e9, 0xa855f7, 0x22d3ee, 0xf472b6, 0x34d399];
      for (let i = 0; i < 14; i++) {
        const geo = new THREE.IcosahedronGeometry(0.25 + Math.random() * 0.55, 0);
        const m = new THREE.MeshStandardMaterial({
          color: icoColors[i % icoColors.length],
          emissive: icoColors[i % icoColors.length],
          emissiveIntensity: 0.2,
          roughness: 0.15,
          metalness: 0.85,
        });
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(
          (Math.random() - 0.5) * 26,
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 10 - 4
        );
        mesh.userData = {
          rotX: (Math.random() - 0.5) * 0.014,
          rotY: (Math.random() - 0.5) * 0.018,
          floatSpeed: 0.4 + Math.random() * 0.7,
          floatAmp: 0.3 + Math.random() * 0.6,
          baseY: mesh.position.y,
          phase: Math.random() * Math.PI * 2,
        };
        scene.add(mesh);
        objects.push(mesh);
      }

      // ── Floating cubes ──
      for (let i = 0; i < 8; i++) {
        const size = 0.2 + Math.random() * 0.4;
        const geo = new THREE.BoxGeometry(size, size, size);
        const m = new THREE.MeshStandardMaterial({
          color: icoColors[i % icoColors.length],
          wireframe: Math.random() > 0.5,
          transparent: true,
          opacity: 0.6 + Math.random() * 0.3,
          roughness: 0.2,
          metalness: 0.7,
        });
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(
          (Math.random() - 0.5) * 24,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 8 - 2
        );
        mesh.userData = {
          rotX: (Math.random() - 0.5) * 0.02,
          rotY: (Math.random() - 0.5) * 0.025,
          floatSpeed: 0.3 + Math.random() * 0.5,
          floatAmp: 0.2 + Math.random() * 0.4,
          baseY: mesh.position.y,
          phase: Math.random() * Math.PI * 2,
        };
        scene.add(mesh);
        objects.push(mesh);
      }

      // ── Neon grid plane ──
      const gridHelper = new THREE.GridHelper(60, 40, 0x6366f1, 0x1e1b4b);
      (gridHelper.material as THREE.Material).transparent = true;
      (gridHelper.material as THREE.Material).opacity = 0.2;
      gridHelper.position.y = -8;
      scene.add(gridHelper);

      // ── Star field ──
      const starGeo = new THREE.BufferGeometry();
      const starCount = 2000;
      const starPos = new Float32Array(starCount * 3);
      const starSizes = new Float32Array(starCount);
      for (let i = 0; i < starCount; i++) {
        starPos[i * 3] = (Math.random() - 0.5) * 160;
        starPos[i * 3 + 1] = (Math.random() - 0.5) * 160;
        starPos[i * 3 + 2] = (Math.random() - 0.5) * 160;
        starSizes[i] = Math.random() * 0.12 + 0.02;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
      const starMat = new THREE.PointsMaterial({ color: 0xc7d2fe, size: 0.1, transparent: true, opacity: 0.8, sizeAttenuation: true });
      scene.add(new THREE.Points(starGeo, starMat));

      // ── Concentric rings ──
      const ringConfigs = [
        { r: 5, tube: 0.04, color: 0x6366f1, opacity: 0.35, rx: Math.PI / 3, rz: 0 },
        { r: 7.5, tube: 0.03, color: 0x0ea5e9, opacity: 0.25, rx: Math.PI / 5, rz: Math.PI / 6 },
        { r: 10, tube: 0.02, color: 0xa855f7, opacity: 0.18, rx: Math.PI / 7, rz: Math.PI / 4 },
        { r: 3.5, tube: 0.05, color: 0xf472b6, opacity: 0.3, rx: Math.PI / 2.5, rz: Math.PI / 3 },
      ];
      for (const cfg of ringConfigs) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(cfg.r, cfg.tube, 8, 100),
          new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: cfg.opacity })
        );
        ring.rotation.x = cfg.rx;
        ring.rotation.z = cfg.rz;
        ring.position.set(0, 0, -4);
        ring.userData = { rotY: 0.003 + Math.random() * 0.004, rotX: (Math.random() - 0.5) * 0.002 };
        scene.add(ring);
        objects.push(ring);
      }

      // ── Particle trail system ──
      const trailGeo = new THREE.BufferGeometry();
      const trailCount = 500;
      const trailPos = new Float32Array(trailCount * 3);
      const trailVel = new Float32Array(trailCount * 3);
      for (let i = 0; i < trailCount; i++) {
        trailPos[i * 3] = (Math.random() - 0.5) * 30;
        trailPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
        trailPos[i * 3 + 2] = (Math.random() - 0.5) * 15 - 5;
        trailVel[i * 3] = (Math.random() - 0.5) * 0.02;
        trailVel[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
        trailVel[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
      }
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
      const trailMat = new THREE.PointsMaterial({ color: 0x818cf8, size: 0.06, transparent: true, opacity: 0.5 });
      const trailPoints = new THREE.Points(trailGeo, trailMat);
      trailPoints.userData = { type: 'trail', vel: trailVel };
      scene.add(trailPoints);
      objects.push(trailPoints);

    // ── LIGHT MODE SCENE ──────────────────────────────────────────────────────
    } else {
      scene.add(new THREE.AmbientLight(0xffffff, 3.5));
      const dl = new THREE.DirectionalLight(0xc7d2fe, 2.5);
      dl.position.set(5, 10, 5);
      scene.add(dl);
      const pl1 = new THREE.PointLight(0x818cf8, 40, 25);
      pl1.position.set(-5, 4, 5);
      scene.add(pl1);
      const pl2 = new THREE.PointLight(0x67e8f9, 30, 22);
      pl2.position.set(6, -3, 4);
      scene.add(pl2);
      const pl3 = new THREE.PointLight(0xfda4af, 25, 18);
      pl3.position.set(0, 7, -3);
      scene.add(pl3);

      // Translucent sphere cluster
      const sphereColors = [0xa5b4fc, 0x93c5fd, 0xc4b5fd, 0x6ee7b7, 0xfda4af, 0xfcd34d];
      for (let i = 0; i < 10; i++) {
        const r = 0.5 + Math.random() * 1.4;
        const geo = new THREE.SphereGeometry(r, 32, 32);
        const m = new THREE.MeshStandardMaterial({
          color: sphereColors[i % sphereColors.length],
          transparent: true,
          opacity: 0.18 + Math.random() * 0.22,
          roughness: 0.02,
          metalness: 0.15,
        });
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(
          (Math.random() - 0.5) * 22,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 8 - 3
        );
        mesh.userData = {
          rotX: (Math.random() - 0.5) * 0.006,
          rotY: (Math.random() - 0.5) * 0.008,
          floatSpeed: 0.25 + Math.random() * 0.45,
          floatAmp: 0.4 + Math.random() * 0.7,
          baseY: mesh.position.y,
          phase: Math.random() * Math.PI * 2,
        };
        scene.add(mesh);
        objects.push(mesh);
      }

      // Bokeh particles
      const bokehGeo = new THREE.BufferGeometry();
      const bCount = 500;
      const bPos = new Float32Array(bCount * 3);
      for (let i = 0; i < bCount * 3; i++) bPos[i] = (Math.random() - 0.5) * 60;
      bokehGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
      const bokehMat = new THREE.PointsMaterial({ color: 0x818cf8, size: 0.22, transparent: true, opacity: 0.3, sizeAttenuation: true });
      scene.add(new THREE.Points(bokehGeo, bokehMat));

      // Rotating torus rings
      const lightRingConfigs = [
        { r: 4.5, tube: 0.09, color: 0x818cf8, opacity: 0.3, rx: Math.PI / 4 },
        { r: 6.5, tube: 0.06, color: 0x93c5fd, opacity: 0.22, rx: Math.PI / 6 },
        { r: 8.5, tube: 0.04, color: 0xc4b5fd, opacity: 0.15, rx: Math.PI / 3 },
      ];
      for (const cfg of lightRingConfigs) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(cfg.r, cfg.tube, 16, 100),
          new THREE.MeshStandardMaterial({ color: cfg.color, transparent: true, opacity: cfg.opacity, roughness: 0.2, metalness: 0.5 })
        );
        ring.rotation.x = cfg.rx;
        ring.position.set(0, 0, -5);
        ring.userData = { rotY: 0.004 + Math.random() * 0.003, rotX: (Math.random() - 0.5) * 0.002 };
        scene.add(ring);
        objects.push(ring);
      }

      // Octahedra
      for (let i = 0; i < 8; i++) {
        const geo = new THREE.OctahedronGeometry(0.35 + Math.random() * 0.5, 0);
        const m = new THREE.MeshStandardMaterial({
          color: sphereColors[i % sphereColors.length],
          transparent: true, opacity: 0.45 + Math.random() * 0.3,
          roughness: 0.15, metalness: 0.5,
        });
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 6
        );
        mesh.userData = {
          rotX: (Math.random() - 0.5) * 0.012,
          rotY: (Math.random() - 0.5) * 0.015,
          floatSpeed: 0.4 + Math.random() * 0.6,
          floatAmp: 0.25 + Math.random() * 0.45,
          baseY: mesh.position.y,
          phase: Math.random() * Math.PI * 2,
        };
        scene.add(mesh);
        objects.push(mesh);
      }

      // Icosahedra (light)
      for (let i = 0; i < 6; i++) {
        const geo = new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.4, 1);
        const m = new THREE.MeshStandardMaterial({
          color: sphereColors[i % sphereColors.length],
          wireframe: true,
          transparent: true, opacity: 0.35,
        });
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(
          (Math.random() - 0.5) * 18,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 5
        );
        mesh.userData = {
          rotX: (Math.random() - 0.5) * 0.01,
          rotY: (Math.random() - 0.5) * 0.013,
          floatSpeed: 0.5 + Math.random() * 0.5,
          floatAmp: 0.2 + Math.random() * 0.35,
          baseY: mesh.position.y,
          phase: Math.random() * Math.PI * 2,
        };
        scene.add(mesh);
        objects.push(mesh);
      }
    }

    // ── Mouse parallax ────────────────────────────────────────────────────────
    let mouseX = 0, mouseY = 0;
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    // ── Resize ────────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // ── Animation loop ────────────────────────────────────────────────────────
    let animId: number;

    function animate() {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Camera parallax
      camera.position.x += (mouseX * 1.8 - camera.position.x) * 0.035;
      camera.position.y += (mouseY * 1.2 - camera.position.y) * 0.035;
      camera.lookAt(0, 0, 0);

      objects.forEach((obj) => {
        const d = obj.userData;

        // Helix rotation
        if (d.type === 'helix') {
          obj.rotation.y += d.rotY;
          return;
        }

        // Particle trail drift
        if (d.type === 'trail') {
          const pts = obj as THREE.Points;
          const pos = pts.geometry.attributes.position.array as Float32Array;
          const vel = d.vel as Float32Array;
          for (let i = 0; i < pos.length / 3; i++) {
            pos[i * 3] += vel[i * 3];
            pos[i * 3 + 1] += vel[i * 3 + 1];
            pos[i * 3 + 2] += vel[i * 3 + 2];
            // Wrap
            if (Math.abs(pos[i * 3]) > 15) vel[i * 3] *= -1;
            if (Math.abs(pos[i * 3 + 1]) > 10) vel[i * 3 + 1] *= -1;
            if (Math.abs(pos[i * 3 + 2]) > 8) vel[i * 3 + 2] *= -1;
          }
          pts.geometry.attributes.position.needsUpdate = true;
          return;
        }

        // Hero torus knot
        if (d.type === 'hero') {
          obj.rotation.x += 0.004;
          obj.rotation.y += 0.006;
          obj.rotation.z += 0.002;
          const s = 1 + Math.sin(t * 0.9) * 0.04;
          obj.scale.setScalar(s);
          return;
        }
        if (d.type === 'heroWire') {
          const hero = objects.find(o => o.userData.type === 'hero');
          if (hero) { obj.rotation.copy(hero.rotation); obj.scale.copy(hero.scale); }
          return;
        }

        // Rings
        if (d.rotY !== undefined && d.floatSpeed === undefined) {
          obj.rotation.y += d.rotY;
          obj.rotation.x += d.rotX ?? 0;
          return;
        }

        // Generic float + rotate
        if (d.rotX !== undefined) {
          obj.rotation.x += d.rotX;
          obj.rotation.y += d.rotY ?? 0;
        }
        if (d.floatSpeed !== undefined) {
          obj.position.y = d.baseY + Math.sin(t * d.floatSpeed + d.phase) * d.floatAmp;
        }
      });

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [theme]);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed', inset: 0,
        width: '100vw', height: '100vh',
        pointerEvents: 'none', zIndex: 0,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    />
  );
}
