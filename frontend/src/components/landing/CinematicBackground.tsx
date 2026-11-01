"use client";

import React, { useEffect, useRef } from "react";

const TOTAL_FRAMES = 63;

interface CinematicBackgroundProps {
  scrollProgress: number; // 0.0 to 1.0
  activeLevel: number;
}

const getFramePath = (index: number): string => {
  return `/frames/${index + 1}.jpg`;
};

export default function CinematicBackground({ scrollProgress, activeLevel }: CinematicBackgroundProps) {
  const frameCanvasRef = useRef<HTMLCanvasElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);

  // High-performance animation state held in mutable refs (bypasses React render cycles)
  const currentFrameRef = useRef<number>(0);
  const targetFrameRef = useRef<number>(0);
  const lastRenderedIndexRef = useRef<number>(-1);
  const framesCacheRef = useRef<(HTMLImageElement | null)[]>(new Array(TOTAL_FRAMES).fill(null));
  const framesLoadingRef = useRef<boolean[]>(new Array(TOTAL_FRAMES).fill(false));

  const rafIdRef = useRef<number | null>(null);
  const isRunningRef = useRef<boolean>(true);

  // 3D Volumetric Warp Stars & Energy Filaments
  const starsRef = useRef<{ x: number; y: number; z: number; size: number; color: string }[]>([]);

  useEffect(() => {
    isRunningRef.current = true;
    const frameCanvas = frameCanvasRef.current;
    const particleCanvas = particleCanvasRef.current;
    if (!frameCanvas || !particleCanvas) return;

    // 1. Initialize 3D Volumetric Space Particles (Clean, crisp points without noisy blur)
    const starCount = 190;
    const stars: { x: number; y: number; z: number; size: number; color: string }[] = [];
    const colors = ["#06b6d4", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444"];
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 2200,
        y: (Math.random() - 0.5) * 2200,
        z: Math.random() * 1600 + 1,
        size: Math.random() * 1.8 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    starsRef.current = stars;

    // 2. High-performance cover-fit rendering with subpixel quality
    const drawCover = (img: HTMLImageElement) => {
      const ctx = frameCanvas.getContext("2d");
      if (!ctx) return;
      const cw = frameCanvas.width;
      const ch = frameCanvas.height;
      if (cw === 0 || ch === 0) return;

      const iw = img.naturalWidth || 1280;
      const ih = img.naturalHeight || 720;
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, dx, dy, dw, dh);
    };

    // 3. Fallback nearest-frame rendering to prevent any blank frame
    const drawFrameByIndex = (idx: number) => {
      const clamped = Math.max(0, Math.min(TOTAL_FRAMES - 1, idx));
      if (framesCacheRef.current[clamped]) {
        drawCover(framesCacheRef.current[clamped]!);
        lastRenderedIndexRef.current = clamped;
        return;
      }

      loadFrame(clamped);

      let bestDist = Infinity;
      let bestMatch: HTMLImageElement | null = null;
      let bestIdx = -1;
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const c = framesCacheRef.current[i];
        if (c) {
          const d = Math.abs(i - clamped);
          if (d < bestDist) {
            bestDist = d;
            bestMatch = c;
            bestIdx = i;
          }
        }
      }

      if (bestMatch) {
        drawCover(bestMatch);
        lastRenderedIndexRef.current = bestIdx;
      }
    };

    // 4. Preload loader
    const loadFrame = (index: number) => {
      if (index < 0 || index >= TOTAL_FRAMES) return;
      if (framesCacheRef.current[index] || framesLoadingRef.current[index]) return;
      framesLoadingRef.current[index] = true;
      const img = new Image();
      img.src = getFramePath(index);
      img.onload = () => {
        framesCacheRef.current[index] = img;
        framesLoadingRef.current[index] = false;
        const curr = Math.round(currentFrameRef.current);
        if (Math.abs(curr - index) <= 1 || lastRenderedIndexRef.current === -1) {
          drawFrameByIndex(curr);
        }
      };
      img.onerror = () => {
        framesLoadingRef.current[index] = false;
      };
    };

    // 5. Canvas DPR resize handler
    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const pxW = Math.round(w * dpr);
      const pxH = Math.round(h * dpr);

      [frameCanvas, particleCanvas].forEach((c) => {
        if (c.width !== pxW || c.height !== pxH) {
          c.width = pxW;
          c.height = pxH;
          c.style.width = `${w}px`;
          c.style.height = `${h}px`;
        }
      });

      drawFrameByIndex(Math.round(currentFrameRef.current));
    };

    // 6. Proactive preloading of all 63 frames to guarantee zero jitter/pop-in
    loadFrame(0);
    for (let i = 1; i < 20; i++) loadFrame(i);
    const t1 = setTimeout(() => {
      for (let i = 20; i < 45; i++) loadFrame(i);
    }, 150);
    const t2 = setTimeout(() => {
      for (let i = 45; i < 63; i++) loadFrame(i);
    }, 350);

    handleResize();

    // 7. RequestAnimationFrame 60-120fps physics loop (Smooth, cinematic lerp factor)
    const LERP_FACTOR = 0.085;

    const animate = () => {
      if (!isRunningRef.current) return;

      // Scrub frame interpolation
      const target = targetFrameRef.current;
      let curr = currentFrameRef.current;
      const diff = target - curr;
      if (Math.abs(diff) > 0.001) {
        curr += diff * LERP_FACTOR;
        currentFrameRef.current = curr;
      } else {
        curr = target;
        currentFrameRef.current = target;
      }

      const displayIdx = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(curr)));
      if (displayIdx !== lastRenderedIndexRef.current) {
        drawFrameByIndex(displayIdx);
      }

      // Render 3D Volumetric Warp Space
      const pCtx = particleCanvas.getContext("2d");
      if (pCtx) {
        const cw = particleCanvas.width;
        const ch = particleCanvas.height;
        pCtx.clearRect(0, 0, cw, ch);

        const cx = cw / 2;
        const cy = ch / 2;
        const stars = starsRef.current;

        // Warp speed scales dynamically with scroll velocity
        const speed = 1.8 + Math.min(Math.abs(diff) * 2.2, 8);

        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          s.z -= speed;
          if (s.z <= 1) {
            s.z = 1600;
            s.x = (Math.random() - 0.5) * 2200;
            s.y = (Math.random() - 0.5) * 2200;
          }

          const k = 480 / s.z;
          const px = s.x * k + cx;
          const py = s.y * k + cy;

          if (px >= 0 && px <= cw && py >= 0 && py <= ch) {
            const alpha = Math.min(1, (1600 - s.z) / 1000);
            const size = Math.max(0.6, s.size * k * 0.85);

            pCtx.beginPath();
            pCtx.fillStyle = s.color;
            pCtx.globalAlpha = alpha * 0.75;
            pCtx.arc(px, py, size, 0, Math.PI * 2);
            pCtx.fill();

            // Dynamic relativistic streak trails during scroll
            if (speed > 3.5) {
              const prevK = 480 / (s.z + speed * 2.8);
              const ppx = s.x * prevK + cx;
              const ppy = s.y * prevK + cy;
              pCtx.beginPath();
              pCtx.strokeStyle = s.color;
              pCtx.globalAlpha = alpha * 0.4;
              pCtx.lineWidth = size * 0.7;
              pCtx.moveTo(px, py);
              pCtx.lineTo(ppx, ppy);
              pCtx.stroke();
            }
          }
        }
        pCtx.globalAlpha = 1.0;
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      isRunningRef.current = false;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Map scrollProgress across all 63 frames (0.0 to 0.74 scrubs frames 1..63 smoothly)
  useEffect(() => {
    const STORY_END_PROGRESS = 0.74;
    const clampedProgress = Math.min(1, Math.max(0, scrollProgress / STORY_END_PROGRESS));
    const target = clampedProgress * (TOTAL_FRAMES - 1);
    targetFrameRef.current = target;
  }, [scrollProgress]);

  // Story canvas remains fully visible throughout the experience
  const storyOpacity = 1;

  return (
    <div
      className="fixed inset-0 w-full h-full object-cover pointer-events-none z-0 overflow-hidden"
      style={{ backgroundColor: "#0a0a0c" }}
      aria-hidden="true"
    >
      {/* Layer 1: Frame sequence canvas with enhanced sharpness and contrast */}
      <canvas
        ref={frameCanvasRef}
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          width: "100%",
          height: "100%",
          opacity: storyOpacity,
          imageRendering: "-webkit-optimize-contrast",
          filter: "contrast(1.08) brightness(1.04) saturate(1.06)",
        }}
      />

      {/* Layer 2: Deep 3D Warp Stars & Particles */}
      <canvas
        ref={particleCanvasRef}
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          width: "100%",
          height: "100%",
        }}
      />

      {/* Layer 3: High-contrast Volumetric Lighting Accents with clear, crisp center */}
      <div
        className="absolute inset-0 pointer-events-none z-[2] transition-all duration-700"
        style={{
          background:
            activeLevel === 1
              ? "radial-gradient(ellipse at 50% 45%, rgba(6, 182, 212, 0.12) 0%, rgba(10, 10, 12, 0.32) 68%, rgba(10, 10, 12, 0.8) 100%)"
              : activeLevel === 2
              ? "radial-gradient(ellipse at 50% 45%, rgba(168, 85, 247, 0.12) 0%, rgba(10, 10, 12, 0.32) 68%, rgba(10, 10, 12, 0.8) 100%)"
              : activeLevel === 3
              ? "radial-gradient(ellipse at 50% 45%, rgba(245, 158, 11, 0.12) 0%, rgba(10, 10, 12, 0.32) 68%, rgba(10, 10, 12, 0.8) 100%)"
              : activeLevel === 4
              ? "radial-gradient(ellipse at 50% 45%, rgba(239, 68, 68, 0.15) 0%, rgba(10, 10, 12, 0.32) 68%, rgba(10, 10, 12, 0.8) 100%)"
              : "radial-gradient(ellipse at 50% 45%, rgba(14, 165, 233, 0.08) 0%, rgba(10, 10, 12, 0.28) 68%, rgba(10, 10, 12, 0.8) 100%)",
        }}
      />

      {/* Layer 4: Cybernetic Grid Perspective Grid Floor with Volumetric Illumination */}
      <div
        className="absolute inset-x-0 bottom-0 h-[450px] opacity-30 pointer-events-none z-[3]"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(6, 182, 212, 0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(6, 182, 212, 0.35) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          transform: "perspective(600px) rotateX(68deg) translateY(100px) translateZ(0)",
          backfaceVisibility: "hidden",
        }}
      />
    </div>
  );
}
