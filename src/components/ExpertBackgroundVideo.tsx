import React, { useState, useEffect, useRef } from "react";
import { EXPERT_VIDEO_CONFIG } from "../data/expertVideoConfig";

interface ExpertBackgroundVideoProps {
  theme?: "dark" | "light";
}

export const ExpertBackgroundVideo: React.FC<ExpertBackgroundVideoProps> = ({
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

  // Listen to prefers-reduced-motion changes dynamically
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Programmatic autoplay attempt with error handling
  useEffect(() => {
    if (reducedMotion) return;
    const video = videoRef.current;
    if (!video) return;

    // Cross-browser autoplay policy compliance requires muted=true
    video.muted = true;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setAutoplayBlocked(false);
        })
        .catch((err) => {
          console.warn("[Mentora Expert] Autoplay prevented by browser:", err);
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
    console.warn("[Mentora Expert] Background video stream unavailable or failed to load. Using fallback.");
    setVideoError(true);
  };

  const isVideoActive = !reducedMotion && !videoError && !autoplayBlocked;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden select-none"
      style={{
        zIndex: 0,
        backgroundColor: isLight ? "#F8FAFC" : "#05080E",
      }}
      aria-hidden="true"
    >
      {/* ============================================================
          FALLBACK LAYER: High-Visibility Static Poster
         ============================================================ */}
      {(reducedMotion || videoError || !videoLoaded) && (
        <img
          src={EXPERT_VIDEO_CONFIG.posterUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700 ease-out"
          style={{
            objectFit: "cover",
            width: "100%",
            height: "100%",
            opacity: isLight ? 0.85 : 0.95,
            filter: isLight
              ? "saturate(1.25) contrast(1.10) brightness(1.35)"
              : "saturate(1.30) contrast(1.15) brightness(1.20)",
            zIndex: 1,
          }}
        />
      )}

      {/* ============================================================
          LAYER 1: VIBRANT & HIGH-VISIBILITY ANIMATED BACKGROUND VIDEO
         ============================================================ */}
      {!reducedMotion && !videoError && (
        <video
          ref={videoRef}
          src={EXPERT_VIDEO_CONFIG.videoUrl}
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
            opacity: isVideoActive && videoLoaded ? (isLight ? 0.90 : 0.96) : 0,
            filter: isLight
              ? "saturate(1.30) contrast(1.10) brightness(1.38)"
              : "saturate(1.35) contrast(1.15) brightness(1.22)",
            zIndex: 2,
          }}
        />
      )}

      {/* ============================================================
          LAYER 2: SUBTLE LUMINOUS THEME OVERLAYS (Light & Dark Mode)
          Delicately balanced to let the animated video shine through
          with peak brightness and vivid presence while preserving UI readability.
         ============================================================ */}

      {/* Atmospheric Radial Shimmer */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-500"
        style={{
          background: isLight
            ? "radial-gradient(ellipse at 50% 30%, rgba(255, 255, 255, 0.12) 0%, rgba(248, 250, 252, 0.28) 60%, rgba(241, 245, 249, 0.48) 100%)"
            : "radial-gradient(ellipse at 50% 30%, rgba(5, 8, 14, 0.05) 0%, rgba(11, 17, 26, 0.20) 60%, rgba(5, 8, 14, 0.40) 100%)",
          zIndex: 3,
        }}
      />

      {/* Subtle Top-to-Bottom Soft Glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-500"
        style={{
          background: isLight
            ? "linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 40%, rgba(241, 245, 249, 0.35) 100%)"
            : "linear-gradient(180deg, rgba(5, 8, 14, 0.10) 0%, transparent 40%, rgba(5, 8, 14, 0.35) 100%)",
          zIndex: 4,
        }}
      />
    </div>
  );
};
