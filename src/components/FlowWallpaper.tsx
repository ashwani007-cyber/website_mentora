import React, { useEffect, useRef, useState } from "react";

interface FlowWallpaperProps {
  theme?: "dark" | "light";
}

const SCENE_NAMES = ["Aurora", "Sunset", "Neon Grid", "Stars", "Waves"] as const;
type SceneName = typeof SCENE_NAMES[number];

export const FlowWallpaper: React.FC<FlowWallpaperProps> = ({
  theme = "dark",
}) => {
  const isLight = theme === "light";
  const [activeScene, setActiveScene] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("wp");
      if (saved !== null) {
        const idx = Number(saved);
        if (!isNaN(idx) && idx >= 0 && idx < SCENE_NAMES.length) {
          return idx;
        }
      }
    } catch {}
    return 0; // Default: Aurora
  });

  const starsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wavesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keyboard navigation (ArrowLeft / ArrowRight) for switching scenes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "ArrowRight") {
        setActiveScene((prev) => {
          const next = (prev + 1) % SCENE_NAMES.length;
          try { localStorage.setItem("wp", String(next)); } catch {}
          return next;
        });
      } else if (e.key === "ArrowLeft") {
        setActiveScene((prev) => {
          const next = (prev - 1 + SCENE_NAMES.length) % SCENE_NAMES.length;
          try { localStorage.setItem("wp", String(next)); } catch {}
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Mouse Parallax Effect for Aurora blobs & Stars canvas
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth <= 0 || window.innerHeight <= 0) return;
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;

      if (containerRef.current) {
        containerRef.current.style.setProperty("--px", String(x));
        containerRef.current.style.setProperty("--py", String(y));
      }

      if (starsCanvasRef.current) {
        starsCanvasRef.current.style.transform = `translate(${-x * 24}px, ${-y * 24}px)`;
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Animation loop for Stars and Waves canvas scenes
  useEffect(() => {
    const sc = starsCanvasRef.current;
    const wc = wavesCanvasRef.current;
    if (!sc || !wc) return;

    const sx = sc.getContext("2d");
    const wx = wc.getContext("2d");
    if (!sx || !wx) return;

    let animId: number;
    let stars: Array<{ x: number; y: number; r: number; s: number; p: number }> = [];
    let sh: { x: number; y: number; l: number } | null = null;
    let nextSh = 3000;

    const fit = () => {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      sc.width = window.innerWidth * d;
      sc.height = window.innerHeight * d;
      wc.width = window.innerWidth * d;
      wc.height = window.innerHeight * d;
    };

    const init = () => {
      fit();
      stars = Array.from({ length: 220 }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.6 + 0.3,
        s: Math.random() * 0.0004 + 0.0001,
        p: Math.random() * 6,
      }));
    };

    init();

    const handleResize = () => {
      fit();
    };

    window.addEventListener("resize", handleResize);

    const shoot = (ms: number) => {
      if (!sh && ms > nextSh) {
        sh = { x: Math.random() * 0.7 + 0.2, y: Math.random() * 0.4, l: 0 };
        nextSh = ms + 4000 + Math.random() * 6000;
      }
      if (sh) {
        sh.l += 0.025;
        const d = Math.min(window.devicePixelRatio || 1, 2);
        const x = sh.x * sc.width + sh.l * sc.width * 0.35;
        const y = sh.y * sc.height + sh.l * sc.height * 0.2;
        const gr = sx.createLinearGradient(x, y, x - 90 * d, y - 35 * d);
        if (isLight) {
          gr.addColorStop(0, `rgba(79, 70, 229, ${1 - sh.l})`);
          gr.addColorStop(1, "rgba(79, 70, 229, 0)");
        } else {
          gr.addColorStop(0, `rgba(255, 255, 255, ${1 - sh.l})`);
          gr.addColorStop(1, "rgba(255, 255, 255, 0)");
        }
        sx.strokeStyle = gr;
        sx.lineWidth = 1.6 * d;
        sx.beginPath();
        sx.moveTo(x, y);
        sx.lineTo(x - 90 * d, y - 35 * d);
        sx.stroke();
        if (sh.l >= 1) sh = null;
      }
    };

    const draw = (ms: number) => {
      const d = Math.min(window.devicePixelRatio || 1, 2);

      // 1. Stars Scene Render
      sx.clearRect(0, 0, sc.width, sc.height);
      for (const s of stars) {
        s.y -= s.s;
        if (s.y < 0) s.y = 1;
        const a = 0.5 + 0.5 * Math.sin(ms / 700 + s.p);
        sx.fillStyle = isLight
          ? `rgba(79, 70, 229, ${0.3 + a * 0.45})`
          : `rgba(255, 255, 255, ${0.25 + a * 0.75})`;
        sx.beginPath();
        sx.arc(s.x * sc.width, s.y * sc.height, s.r * d, 0, Math.PI * 2);
        sx.fill();
      }
      shoot(ms);

      // 2. Waves Scene Render
      wx.clearRect(0, 0, wc.width, wc.height);
      const cols = isLight
        ? [
            "rgba(56, 189, 248, 0.3)",
            "rgba(14, 165, 233, 0.22)",
            "rgba(125, 211, 252, 0.2)",
            "rgba(186, 230, 253, 0.35)",
          ]
        : [
            "rgba(0, 180, 216, .35)",
            "rgba(72, 202, 228, .3)",
            "rgba(144, 224, 239, .25)",
            "rgba(3, 4, 94, .5)",
          ];

      for (let k = 0; k < 4; k++) {
        const g = wx.createLinearGradient(0, wc.height * 0.4, 0, wc.height);
        g.addColorStop(0, cols[k]);
        g.addColorStop(1, isLight ? "rgba(224, 242, 254, 0.85)" : "rgba(2, 10, 30, .9)");
        wx.fillStyle = g;
        wx.beginPath();
        wx.moveTo(0, wc.height);
        for (let x = 0; x <= wc.width; x += 12) {
          const y =
            wc.height * (0.45 + k * 0.12) +
            Math.sin(x / (180 + k * 60) + ms / (1200 - k * 150)) * 40 * d;
          wx.lineTo(x, y);
        }
        wx.lineTo(wc.width, wc.height);
        wx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [isLight]);

  return (
    <div
      ref={containerRef}
      className="wallpaper-pack-container fixed inset-0 overflow-hidden select-none pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <style>{`
        /* Core Scene Animation & Transitions */
        .wp-scene {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.8s ease-in-out;
          overflow: hidden;
          pointer-events: none;
        }
        .wp-scene.on {
          opacity: 1;
        }

        /* Aurora Blobs Animations */
        .wp-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          transition: translate 0.6s ease-out;
          translate: calc(var(--px, 0) * 3vw) calc(var(--py, 0) * 3vh);
        }
        @keyframes wp-m1 {
          to { transform: translate(30vw, 25vh) scale(1.2); }
        }
        @keyframes wp-m2 {
          to { transform: translate(-35vw, -20vh) scale(0.85); }
        }
        @keyframes wp-m3 {
          to { transform: translate(-30vw, 20vh) scale(1.25); }
        }

        /* Sunset Keyframes */
        @keyframes wp-sun {
          to { background-position: 0 100%; }
        }
        @keyframes wp-rise {
          to { transform: translateY(-12vh); }
        }

        /* Neon Grid Keyframe */
        @keyframes wp-g {
          to { background-position: 0 60px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .wallpaper-pack-container *, .wallpaper-pack-container *::after {
            animation: none !important;
          }
        }
      `}</style>

      {/* ==============================================================
          SCENE 0: AURORA BLOBS
          ============================================================== */}
      <div
        className={`wp-scene ${activeScene === 0 ? "on" : ""}`}
        style={{
          backgroundColor: isLight ? "#F8FAFC" : "#0b0d1a",
        }}
      >
        <div
          className="wp-blob"
          style={{
            width: "55vmax",
            height: "55vmax",
            background: isLight ? "#818cf8" : "#6c5ce7",
            top: "-15%",
            left: "-10%",
            opacity: isLight ? 0.3 : 0.75,
            animation: "wp-m1 22s ease-in-out infinite alternate",
          }}
        />
        <div
          className="wp-blob"
          style={{
            width: "45vmax",
            height: "45vmax",
            background: isLight ? "#2dd4bf" : "#00cec9",
            bottom: "-20%",
            right: "-10%",
            opacity: isLight ? 0.28 : 0.75,
            animation: "wp-m2 26s ease-in-out infinite alternate",
          }}
        />
        <div
          className="wp-blob"
          style={{
            width: "40vmax",
            height: "40vmax",
            background: isLight ? "#f472b6" : "#fd79a8",
            top: "30%",
            left: "45%",
            opacity: isLight ? 0.24 : 0.75,
            animation: "wp-m3 30s ease-in-out infinite alternate",
          }}
        />
        <div
          className="wp-blob"
          style={{
            width: "38vmax",
            height: "38vmax",
            background: isLight ? "#38bdf8" : "#0984e3",
            bottom: "5%",
            left: "5%",
            opacity: isLight ? 0.28 : 0.75,
            animation: "wp-m1 28s ease-in-out infinite alternate-reverse",
          }}
        />
      </div>

      {/* ==============================================================
          SCENE 1: SUNSET
          ============================================================== */}
      <div
        className={`wp-scene ${activeScene === 1 ? "on" : ""}`}
        style={{
          background: isLight
            ? "linear-gradient(180deg, #e0e7ff 0%, #fbcfe8 35%, #fed7aa 70%, #fef3c7 100%)"
            : "linear-gradient(180deg, #1a1040 0%, #6b2d8c 35%, #ff6b6b 70%, #ffd36b 100%)",
          backgroundSize: "100% 160%",
          animation: "wp-sun 18s ease-in-out infinite alternate",
        }}
      >
        {/* Glowing Sun Orb */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "18%",
            width: "30vmin",
            height: "30vmin",
            marginLeft: "-15vmin",
            borderRadius: "50%",
            background: isLight ? "#fffbeb" : "#fff3c4",
            boxShadow: isLight
              ? "0 0 12vmin 6vmin rgba(251, 191, 36, 0.28)"
              : "0 0 12vmin 6vmin rgba(255, 200, 120, 0.55)",
            animation: "wp-rise 18s ease-in-out infinite alternate",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* ==============================================================
          SCENE 2: NEON GRID
          ============================================================== */}
      <div
        className={`wp-scene ${activeScene === 2 ? "on" : ""}`}
        style={{
          background: isLight
            ? "linear-gradient(#f8fafc, #ede9fe 60%, #e0e7ff)"
            : "linear-gradient(#12002b, #2b0050 60%, #12002b)",
          perspective: "60vh",
        }}
      >
        {/* Animated Perspective Floor */}
        <i
          style={{
            position: "absolute",
            left: "-50%",
            right: "-50%",
            bottom: "-40%",
            height: "100%",
            transform: "rotateX(70deg)",
            transformOrigin: "center bottom",
            backgroundImage: isLight
              ? "linear-gradient(rgba(147, 51, 234, 0.25) 2px, transparent 2px), linear-gradient(90deg, rgba(147, 51, 234, 0.25) 2px, transparent 2px)"
              : "linear-gradient(#ff2fd6 2px, transparent 2px), linear-gradient(90deg, #ff2fd6 2px, transparent 2px)",
            backgroundSize: "60px 60px",
            animation: "wp-g 2s linear infinite",
            opacity: isLight ? 0.7 : 0.8,
            pointerEvents: "none",
          }}
        />
        {/* Horizon Glow */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: "45%",
            background: isLight
              ? "radial-gradient(ellipse at 50% 100%, rgba(192, 132, 252, 0.3), transparent 65%)"
              : "radial-gradient(ellipse at 50% 100%, rgba(255, 47, 214, 0.5), transparent 65%)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* ==============================================================
          SCENE 3: STARS & SHOOTING STARS
          ============================================================== */}
      <div
        className={`wp-scene ${activeScene === 3 ? "on" : ""}`}
        style={{
          background: isLight
            ? "radial-gradient(ellipse at 50% 120%, #dbeafe, #f8fafc 70%)"
            : "radial-gradient(ellipse at 50% 120%, #1b2a5c, #05060f 70%)",
        }}
      >
        <canvas
          ref={starsCanvasRef}
          className="w-full h-full block pointer-events-none"
          style={{
            transition: "transform 0.6s ease-out",
            transform: "scale(1.06)",
          }}
        />
      </div>

      {/* ==============================================================
          SCENE 4: WAVES
          ============================================================== */}
      <div
        className={`wp-scene ${activeScene === 4 ? "on" : ""}`}
        style={{
          background: isLight
            ? "radial-gradient(circle at 70% 22%, #ffffff 0, #bae6fd 2.5%, rgba(186, 230, 253, 0.4) 9%, transparent 28%), linear-gradient(#f0f9ff, #e0f2fe 60%)"
            : "radial-gradient(circle at 70% 22%, #e8f6ff 0, #9fd8ef 2.5%, rgba(120, 200, 240, 0.35) 9%, transparent 28%), linear-gradient(#071d33, #04141f 60%)",
        }}
      >
        <canvas
          ref={wavesCanvasRef}
          className="w-full h-full block pointer-events-none"
        />
      </div>

      {/* Vignette Layer */}
      <div
        className="fixed inset-0 pointer-events-none transition-colors duration-500"
        style={{
          background: isLight
            ? "radial-gradient(ellipse at center, transparent 65%, rgba(148, 163, 184, 0.16) 100%)"
            : "radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.45) 100%)",
        }}
      />

      {/* Subtle Grain Overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          opacity: 0.05,
          mixBlendMode: "overlay",
          backgroundImage:
            'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'.9\' numOctaves=\'2\'/></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23n)\'/></svg>")',
        }}
      />
    </div>
  );
};
