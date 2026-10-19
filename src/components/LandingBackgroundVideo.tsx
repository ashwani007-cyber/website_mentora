import React, { useState, useEffect, useRef } from "react";
import { LANDING_VIDEO_CONFIG } from "../data/landingVideoConfig";

interface LandingBackgroundVideoProps {
  theme?: "dark" | "light";
}

export const LandingBackgroundVideo: React.FC<LandingBackgroundVideoProps> = ({
  theme = "dark",
}) => {
  const isLight = theme === "light";
  const videoRef = useRef<HTMLVideoElement>(null);

  // Accessibility: detect prefers-reduced-motion
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  // Video state management
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);

  // Listen to prefers-reduced-motion changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Programmatic autoplay attempt with graceful error handling
  useEffect(() => {
    if (reducedMotion) return;
    const video = videoRef.current;
    if (!video) return;

    // Ensure video is muted for cross-browser autoplay compliance
    video.muted = true;
    
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setAutoplayBlocked(false);
        })
        .catch((err) => {
          console.warn("[Mentora] Autoplay prevented by browser:", err);
          setAutoplayBlocked(true);
        });
    }
  }, [reducedMotion]);

  // Video event handlers
  const handleLoadedData = () => {
    setVideoLoaded(true);
    setVideoError(false);
  };

  const handleVideoError = () => {
    console.warn("[Mentora] Video stream failed or unavailable.");
    setVideoError(true);
  };

  // Determine if active video playback should be shown
  const isVideoActive = !reducedMotion && !videoError && !autoplayBlocked;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden select-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* ============================================================
          LAYER 1: BACKGROUND VIDEO ONLY (Wallpaper removed)
         ============================================================ */}
      {!reducedMotion && !videoError && (
        <video
          ref={videoRef}
          src={LANDING_VIDEO_CONFIG.videoUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onLoadedData={handleLoadedData}
          onCanPlay={() => setVideoLoaded(true)}
          onError={handleVideoError}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700 ease-out"
          style={{
            objectFit: "cover",
            width: "100%",
            height: "100%",
            opacity: isVideoActive && videoLoaded ? (isLight ? 0.84 : 0.85) : 0,
            filter: isLight
              ? "saturate(1.10) contrast(1.04) brightness(1.24)"
              : "saturate(1.20) contrast(1.16) brightness(1.10)",
            zIndex: 1,
          }}
        />
      )}

      {/* ============================================================
          LAYER 2: THEME-AWARE OVERLAY / GRADIENT (Light & Dark Mode)
         ============================================================ */}

      {/* Primary Atmospheric Theme Overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-500"
        style={{
          background: isLight
            ? "radial-gradient(ellipse at 50% 25%, rgba(255, 255, 255, 0.40) 0%, rgba(248, 250, 252, 0.60) 50%, rgba(241, 245, 249, 0.85) 100%)"
            : "radial-gradient(ellipse at 50% 25%, rgba(5, 8, 14, 0.25) 0%, rgba(11, 17, 26, 0.55) 50%, rgba(5, 8, 14, 0.88) 100%)",
          zIndex: 2,
        }}
      />

      {/* Top-to-Bottom Subtle Text Readability & Contrast Gradient */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-500"
        style={{
          background: isLight
            ? "linear-gradient(180deg, rgba(255, 255, 255, 0.20) 0%, rgba(248, 250, 252, 0.35) 40%, rgba(241, 245, 249, 0.75) 100%)"
            : "linear-gradient(180deg, rgba(5, 8, 14, 0.18) 0%, rgba(8, 13, 22, 0.38) 40%, rgba(5, 8, 14, 0.82) 100%)",
          zIndex: 2,
        }}
      />
    </div>
  );
};
