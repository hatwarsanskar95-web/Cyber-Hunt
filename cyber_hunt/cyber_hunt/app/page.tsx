"use client";

import React from "react";
import CinematicBackground from "./components/CinematicBackground";
import CyberHUDHeader from "./components/CyberHUDHeader";
import StorySection from "./components/StorySection";
import ProtocolTransition from "./components/ProtocolTransition";
import { useLenisScroll } from "./hooks/useLenisScroll";

export default function Home() {
  const { scrollProgress, scrollToProgress } = useLenisScroll();

  return (
    <main className="relative min-h-screen bg-[#0a0a0c] text-white selection:bg-cyan-500 selection:text-black font-sans antialiased overflow-x-hidden">
      {/* 1. FIXED CYBER-HUD HEADER (Command-Center Telemetry, Live UTC, Clearance, Active Battle Levels, No Arena Button) */}
      <CyberHUDHeader
        scrollProgress={scrollProgress}
        onScrollToTop={() => scrollToProgress(0)}
      />

      {/* 2. CINEMATIC 3D BACKGROUND LAYER (Fixed 63-Frame Scrub Sequencer + 3D Warp Field) */}
      <CinematicBackground
        scrollProgress={scrollProgress}
        activeLevel={scrollProgress >= 0.7 ? 1 : 0}
      />

      {/* 3. MAIN CINEMATIC SCROLL CONTAINER (The Story -> The Security Protocol & Get Started CTA) */}
      <div className="relative z-10 w-full flex flex-col pointer-events-none pt-12">
        {/* ACT I: THE STORY (Gate -> Office -> Businessman -> Attack -> Secured) */}
        <StorySection
          scrollProgress={scrollProgress}
          onScrollToProtocol={() => scrollToProgress(0.85)}
        />

        {/* ACT II: THE SECURITY PROTOCOL (Final Section: 4 Battle Levels & Get Started Button) */}
        <div id="protocol-section">
          <ProtocolTransition />
        </div>
      </div>
    </main>
  );
}
