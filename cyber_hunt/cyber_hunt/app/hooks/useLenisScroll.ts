"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface LenisScrollState {
  scrollProgress: number; // 0.0 to 1.0 (smoothly interpolated)
  scrollY: number; // Current virtual scroll position in px
  maxScroll: number; // Maximum scroll distance in px
  velocity: number; // Normalized scroll velocity
  isScrolling: boolean;
  scrollToProgress: (targetProgress: number) => void;
  scrollToLevel: (levelId: number) => void;
}

/**
 * High-performance Lenis-style smooth scroll inertia hook.
 * Uses delta-time compensated exponential decay lerping for 60/120/144Hz displays.
 * Delivers buttery smooth inertia without layout shifts or jitter.
 */
export function useLenisScroll(totalHeightMultiplier: number = 6): LenisScrollState {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [maxScroll, setMaxScroll] = useState(1);
  const [velocity, setVelocity] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  // Performance-critical animation state stored in mutable refs (bypasses React render overhead)
  const currentScrollRef = useRef(0);
  const targetScrollRef = useRef(0);
  const maxScrollRef = useRef(1);
  const velocityRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isScrollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Level milestones mapped to scroll progress (0.0 to 1.0)
  const getLevelProgress = useCallback((levelId: number): number => {
    switch (levelId) {
      case 0:
        return 0.0; // The Story
      case 1:
        return 0.28; // Level 01: Email Security
      case 2:
        return 0.46; // Level 02: File Security
      case 3:
        return 0.64; // Level 03: Browser Security
      case 4:
        return 0.82; // Level 04: Financial Security
      case 5:
        return 0.96; // Master Architecture & Final Confrontation
      default:
        return 0.0;
    }
  }, []);

  const scrollToProgress = useCallback((targetProgress: number) => {
    const clamped = Math.max(0, Math.min(1, targetProgress));
    const targetPx = clamped * maxScrollRef.current;
    targetScrollRef.current = targetPx;
    window.scrollTo({ top: targetPx, behavior: "smooth" });
  }, []);

  const scrollToLevel = useCallback(
    (levelId: number) => {
      const p = getLevelProgress(levelId);
      scrollToProgress(p);
    },
    [getLevelProgress, scrollToProgress]
  );

  useEffect(() => {
    const updateDimensions = () => {
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const max = Math.max(1, docHeight - winHeight);
      maxScrollRef.current = max;
      setMaxScroll(max);

      // Clamp target scroll
      targetScrollRef.current = Math.max(0, Math.min(max, window.scrollY));
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions, { passive: true });

    // Track native window scroll
    const handleNativeScroll = () => {
      const nativeY = window.scrollY;
      targetScrollRef.current = nativeY;

      setIsScrolling(true);
      if (isScrollingTimeoutRef.current) clearTimeout(isScrollingTimeoutRef.current);
      isScrollingTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    window.addEventListener("scroll", handleNativeScroll, { passive: true });

    // Inertia physics loop (Lenis formula: y += (target - current) * factor)
    // Damping factor: 0.09 with delta-time normalization
    const DAMPING = 0.09;
    const TARGET_FPS = 60;
    const FRAME_MS = 1000 / TARGET_FPS;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Delta compensation ensures uniform inertia speed on 60Hz, 120Hz, or 144Hz monitors
      const timeFactor = Math.min(2.0, Math.max(0.1, delta / FRAME_MS));
      const adjustedDamping = 1 - Math.pow(1 - DAMPING, timeFactor);

      const current = currentScrollRef.current;
      const target = targetScrollRef.current;
      const diff = target - current;

      if (Math.abs(diff) > 0.1) {
        const next = current + diff * adjustedDamping;
        currentScrollRef.current = next;
        velocityRef.current = (next - current) * (1 / timeFactor);
      } else {
        currentScrollRef.current = target;
        velocityRef.current = 0;
      }

      const max = maxScrollRef.current;
      const progress = Math.max(0, Math.min(1, currentScrollRef.current / max));

      setScrollY(currentScrollRef.current);
      setScrollProgress(progress);
      setVelocity(velocityRef.current);

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", updateDimensions);
      window.removeEventListener("scroll", handleNativeScroll);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (isScrollingTimeoutRef.current) clearTimeout(isScrollingTimeoutRef.current);
    };
  }, [totalHeightMultiplier]);

  return {
    scrollProgress,
    scrollY,
    maxScroll,
    velocity,
    isScrolling,
    scrollToProgress,
    scrollToLevel,
  };
}

