"use client";

import React, { useEffect, useRef } from "react";

const TOTAL_FRAMES = 63;

// Scene boundaries as defined in project specifications
export const SCENES = [
  { name: "scene-1", start: 1, end: 10 },
  { name: "scene-2", start: 11, end: 24 },
  { name: "scene-3", start: 25, end: 44 },
  { name: "scene-4", start: 45, end: 63 },
];

/**
 * Returns the public path for a given 0-based frame index.
 * Index 0 -> /frames/1.jpg
 * Index 62 -> /frames/63.jpg
 */
const getFramePath = (index: number): string => {
  return `/frames/${index + 1}.jpg`;
};

interface HeroScrollAnimationProps {
  children: React.ReactNode;
}

export default function HeroScrollAnimation({ children }: HeroScrollAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animation values held in refs to avoid React re-renders during 60fps loop
  const currentFrameRef = useRef<number>(0);
  const targetFrameRef = useRef<number>(0);
  const lastRenderedIndexRef = useRef<number>(-1);

  // Preloaded image cache: exactly 63 frames
  const framesCacheRef = useRef<(HTMLImageElement | null)[]>(new Array(TOTAL_FRAMES).fill(null));
  const framesLoadingRef = useRef<boolean[]>(new Array(TOTAL_FRAMES).fill(false));

  // Loop & control refs
  const rafIdRef = useRef<number | null>(null);
  const isRunningRef = useRef<boolean>(true);
  const prefersReducedMotionRef = useRef<boolean>(false);

  useEffect(() => {
    isRunningRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Reduced Motion Detection
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

    // 2. Cover-fit Drawing Helper
    const drawImageCover = (img: HTMLImageElement) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const cw = canvas.width;
      const ch = canvas.height;
      if (cw === 0 || ch === 0) return;

      const iw = img.naturalWidth || 1280;
      const ih = img.naturalHeight || 720;

      // Cover-style scaling keeping aspect ratio
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

    // 3. Frame drawing & closest-fallback lookup
    const drawFrameByIndex = (targetIdx: number) => {
      const clampedIdx = Math.max(0, Math.min(TOTAL_FRAMES - 1, targetIdx));

      // Exact match
      if (framesCacheRef.current[clampedIdx]) {
        drawImageCover(framesCacheRef.current[clampedIdx]!);
        lastRenderedIndexRef.current = clampedIdx;
        return;
      }

      // If missing, trigger loading for requested frame
      loadFrame(clampedIdx);

      // Render closest already loaded frame so canvas NEVER goes blank
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

    // 4. Frame Loader
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

        // If newly loaded frame is close to current position, redraw smoothly
        const curr = Math.round(currentFrameRef.current);
        if (Math.abs(curr - index) <= 1 || lastRenderedIndexRef.current === -1) {
          drawFrameByIndex(curr);
        }
      };
      img.onerror = () => {
        framesLoadingRef.current[index] = false;
      };
    };

    // 5. Canvas Resize & DPR Handling
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

      // Redraw current frame preserving scroll position
      const curr = Math.round(currentFrameRef.current);
      drawFrameByIndex(curr);
    };

    // 6. Scroll Handler
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scrollDistance = rect.height - window.innerHeight;

      if (scrollDistance <= 0) {
        targetFrameRef.current = 0;
        return;
      }

      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / scrollDistance));
      const target = progress * (TOTAL_FRAMES - 1);
      targetFrameRef.current = target;

      // Dynamically prioritize loading around user scroll position
      const targetIdx = Math.round(target);
      for (let offset = -4; offset <= 4; offset++) {
        const idx = targetIdx + offset;
        if (idx >= 0 && idx < TOTAL_FRAMES) {
          loadFrame(idx);
        }
      }
    };

    // 7. Progressive Preloading Across 4 Scenes
    // Phase 1: Immediately load frame 1 (index 0) and first scene (indices 0..9)
    loadFrame(0, (img) => {
      drawImageCover(img);
      lastRenderedIndexRef.current = 0;
    });

    for (let i = 1; i < 10; i++) {
      loadFrame(i);
    }

    // Phase 2: Scene 2 (indices 10..23)
    const timer1 = setTimeout(() => {
      if (!isRunningRef.current) return;
      for (let i = 10; i < 24; i++) {
        loadFrame(i);
      }
    }, 250);

    // Phase 3: Scene 3 (indices 24..43)
    const timer2 = setTimeout(() => {
      if (!isRunningRef.current) return;
      for (let i = 24; i < 44; i++) {
        loadFrame(i);
      }
    }, 600);

    // Phase 4: Scene 4 (indices 44..62)
    const timer3 = setTimeout(() => {
      if (!isRunningRef.current) return;
      for (let i = 44; i < 63; i++) {
        loadFrame(i);
      }
    }, 1100);

    // Initial setup
    handleResize();
    handleScroll();

    // 8. Persistent RequestAnimationFrame Loop with Smooth Interpolation
    const LERP_FACTOR = 0.1; // Smooth cinematic interpolation (0.08 - 0.15 range)

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

    // Passive event listeners
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    // Cleanup
    return () => {
      isRunningRef.current = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      mediaQuery.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[400vh] bg-[#050505]"
      style={{
        // Deep luxury dark background blending seamlessly with cinematic frame edges
        backgroundColor: "#050505",
      }}
    >
      {/* Sticky Fullscreen Container */}
      <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col justify-center items-center">
        {/* Layer 0: Seamless dark luxury base */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ backgroundColor: "#050505" }}
        />

        {/* Layer 1: Cinematic Scroll-linked Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-[1]"
        />

        {/* Layer 2: Existing Hero UI (Interactive, untouched layout, typography & components) */}
        <div className="relative z-[2] w-full h-full flex flex-col items-center justify-center pointer-events-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

