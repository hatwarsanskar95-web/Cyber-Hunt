"use client";

import React, { useEffect, useRef } from "react";

const TOTAL_FRAMES = 63;

export const SCENES = [
  { id: 1, name: "Scene 1: Direct Prompt Injection", start: 1, end: 10 },
  { id: 2, name: "Scene 2: Vector Exfiltration", start: 11, end: 24 },
  { id: 3, name: "Scene 3: Tool Exploitation", start: 25, end: 44 },
  { id: 4, name: "Scene 4: High-Impact Action", start: 45, end: 63 },
];

const getFramePath = (index: number): string => {
  return `/frames/${index + 1}.jpg`;
};

export default function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Performance-critical animation state kept in refs (no React state updates at 60fps)
  const currentFrameRef = useRef<number>(0);
  const targetFrameRef = useRef<number>(0);
  const lastRenderedIndexRef = useRef<number>(-1);

  // Shared 63-frame preloading cache
  const framesCacheRef = useRef<(HTMLImageElement | null)[]>(new Array(TOTAL_FRAMES).fill(null));
  const framesLoadingRef = useRef<boolean[]>(new Array(TOTAL_FRAMES).fill(false));

  const rafIdRef = useRef<number | null>(null);
  const isRunningRef = useRef<boolean>(true);
  const prefersReducedMotionRef = useRef<boolean>(false);

  useEffect(() => {
    isRunningRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotionRef.current = mediaQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = e.matches;
      if (e.matches) {
        currentFrameRef.current = 0;
        targetFrameRef.current = 0;
        lastRenderedIndexRef.current = -1;
        drawFrameByIndex(0);
      }
    };
    mediaQuery.addEventListener("change", handleMotionChange);

    // 2. High-DPI Cover fit drawing helper
    const drawImageCover = (img: HTMLImageElement) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const cw = canvas.width;
      const ch = canvas.height;
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

    // 3. Fallback drawing to avoid blank screen or flickering
    const drawFrameByIndex = (targetIdx: number) => {
      const clampedIdx = Math.max(0, Math.min(TOTAL_FRAMES - 1, targetIdx));

      if (framesCacheRef.current[clampedIdx]) {
        drawImageCover(framesCacheRef.current[clampedIdx]!);
        lastRenderedIndexRef.current = clampedIdx;
        return;
      }

      // Trigger immediate fetch of missing target frame
      loadFrame(clampedIdx);

      // Render closest already loaded frame
      let bestDist = Infinity;
      let bestMatch: HTMLImageElement | null = null;
      let bestIdx = -1;

      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const cached = framesCacheRef.current[i];
        if (cached) {
          const dist = Math.abs(i - clampedIdx);
          if (dist < bestDist) {
            bestDist = dist;
            bestMatch = cached;
            bestIdx = i;
          }
        }
      }

      if (bestMatch) {
        drawImageCover(bestMatch);
        lastRenderedIndexRef.current = bestIdx;
      }
    };

    // 4. Frame loader
    const loadFrame = (index: number, onComplete?: (img: HTMLImageElement) => void) => {
      if (index < 0 || index >= TOTAL_FRAMES) return;
      if (framesCacheRef.current[index]) {
        onComplete?.(framesCacheRef.current[index]!);
        return;
      }
      if (framesLoadingRef.current[index]) return;

      framesLoadingRef.current[index] = true;
      const img = new Image();
      img.src = getFramePath(index);
      img.onload = () => {
        framesCacheRef.current[index] = img;
        framesLoadingRef.current[index] = false;
        onComplete?.(img);

        const curr = Math.round(currentFrameRef.current);
        if (Math.abs(curr - index) <= 1 || lastRenderedIndexRef.current === -1) {
          drawFrameByIndex(curr);
        }
      };
      img.onerror = () => {
        framesLoadingRef.current[index] = false;
      };
    };

    // 5. Viewport Resize handler
    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      const pxW = Math.round(width * dpr);
      const pxH = Math.round(height * dpr);

      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW;
        canvas.height = pxH;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      const curr = Math.round(currentFrameRef.current);
      drawFrameByIndex(curr);
    };

    // 6. Passive Scroll Handler
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

      if (maxScroll <= 0) {
        targetFrameRef.current = 0;
        return;
      }

      const progress = Math.max(0, Math.min(1, scrollY / maxScroll));
      const target = progress * (TOTAL_FRAMES - 1);
      targetFrameRef.current = target;

      // Dynamically load neighboring frames around current scroll position
      const targetIdx = Math.round(target);
      for (let offset = -4; offset <= 4; offset++) {
        const idx = targetIdx + offset;
        if (idx >= 0 && idx < TOTAL_FRAMES) {
          loadFrame(idx);
        }
      }
    };

    // 7. Progressive Preloading Across 4 Scenes
    loadFrame(0, (img) => {
      drawImageCover(img);
      lastRenderedIndexRef.current = 0;
    });

    for (let i = 1; i < 10; i++) {
      loadFrame(i);
    }

    const t1 = setTimeout(() => {
      if (!isRunningRef.current) return;
      for (let i = 10; i < 24; i++) loadFrame(i);
    }, 250);

    const t2 = setTimeout(() => {
      if (!isRunningRef.current) return;
      for (let i = 24; i < 44; i++) loadFrame(i);
    }, 600);

    const t3 = setTimeout(() => {
      if (!isRunningRef.current) return;
      for (let i = 44; i < 63; i++) loadFrame(i);
    }, 1100);

    handleResize();
    handleScroll();

    // 8. Continuous RAF loop with smooth lerp
    const LERP_FACTOR = 0.1;
    const animate = () => {
      if (!isRunningRef.current) return;

      const target = targetFrameRef.current;
      let current = currentFrameRef.current;

      if (prefersReducedMotionRef.current) {
        current = target;
        currentFrameRef.current = target;
      } else {
        const diff = target - current;
        if (Math.abs(diff) > 0.001) {
          current += diff * LERP_FACTOR;
          currentFrameRef.current = current;
        } else {
          current = target;
          currentFrameRef.current = target;
        }
      }

      const displayIdx = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(current)));
      if (displayIdx !== lastRenderedIndexRef.current) {
        drawFrameByIndex(displayIdx);
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      isRunningRef.current = false;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      mediaQuery.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 w-full h-full object-cover pointer-events-none z-0 overflow-hidden"
      style={{ backgroundColor: "#050505" }}
      aria-hidden="true"
    >
      {/* Deep luxury ambient glow */}
      <div className="absolute inset-0 bg-radial from-red-950/20 via-black/40 to-black/80 z-[1] pointer-events-none" />

      {/* Cybernetic grid overlay for tactical depth */}
      <div
        className="absolute inset-0 opacity-[0.07] z-[2] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #ff3333 1px, transparent 1px), linear-gradient(to bottom, #ff3333 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      {/* High-performance canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
      />
    </div>
  );
}
