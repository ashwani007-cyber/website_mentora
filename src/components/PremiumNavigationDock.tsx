import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue, AnimatePresence } from "framer-motion";
import { Compass, UserCheck, Briefcase, GraduationCap, ShieldCheck } from "lucide-react";

export interface NavItemConfig {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  ariaLabel?: string;
}

interface PremiumNavigationDockProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  items?: NavItemConfig[];
  isLight?: boolean;
  className?: string;
  showIcons?: boolean;
}

const DEFAULT_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  landing: Compass,
  login: UserCheck,
  client: Briefcase,
  expert: GraduationCap,
  owner: ShieldCheck,
};

const DEFAULT_ITEMS: NavItemConfig[] = [
  {
    id: "landing",
    label: "Landing Page",
    shortLabel: "Landing",
    icon: Compass,
    ariaLabel: "Navigate to Landing Page",
  },
  {
    id: "login",
    label: "Sign In / Register",
    shortLabel: "Sign In",
    icon: UserCheck,
    ariaLabel: "Sign In or Register an Account",
  },
  {
    id: "client",
    label: "Client Portal",
    shortLabel: "Client",
    icon: Briefcase,
    ariaLabel: "Navigate to Client Advisory Portal",
  },
  {
    id: "expert",
    label: "Expert Portal",
    shortLabel: "Expert",
    icon: GraduationCap,
    ariaLabel: "Navigate to Senior Expert Executive Portal",
  },
];

interface DockItemProps {
  item: NavItemConfig;
  isActive: boolean;
  onClick: () => void;
  mouseX: MotionValue<number>;
  isLight: boolean;
  showIcons: boolean;
}

function DockItem({ item, isActive, onClick, mouseX, isLight, showIcons }: DockItemProps) {
  const itemRef = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const Icon = item.icon || DEFAULT_ICONS[item.id];

  // Calculate distance from cursor to center of this item
  const distance = useTransform(mouseX, (val: number) => {
    if (!Number.isFinite(val)) return Infinity;
    const el = itemRef.current;
    if (!el) return Infinity;
    const rect = el.getBoundingClientRect();
    return val - (rect.left + rect.width / 2);
  });

  // Smooth magnification bell curve within ±130px radius
  // Nearest item scales up to ~1.10 - 1.12, neighbors scale proportionally (~1.04-1.06), far items stay 1.0
  const scaleSync = useTransform(distance, [-130, 0, 130], [1, 1.10, 1], {
    clamp: true,
  });
  const scale = useSpring(scaleSync, { mass: 0.1, stiffness: 150, damping: 12 });

  // Subtle Y elevation (-2px) on cursor proximity for macOS floating dock feel
  const ySync = useTransform(distance, [-130, 0, 130], [0, -2, 0], {
    clamp: true,
  });
  const y = useSpring(ySync, { mass: 0.1, stiffness: 150, damping: 12 });

  return (
    <motion.button
      ref={itemRef}
      role="tab"
      aria-selected={isActive}
      aria-label={item.ariaLabel || item.label}
      tabIndex={0}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      style={{
        scale,
        y,
        transformOrigin: "center center",
      }}
      whileTap={{ scale: 0.96 }}
      className={`group relative flex items-center justify-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2.5 sm:px-3 md:px-3.5 lg:px-4 rounded-full cursor-pointer select-none transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 ${
        isLight
          ? "focus-visible:ring-offset-white"
          : "focus-visible:ring-offset-slate-950"
      }`}
    >
      {/* Tooltip: ONLY shown on mobile (< sm) when inactive item is icon-only */}
      <AnimatePresence>
        {!isActive && isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            className={`sm:hidden absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xl pointer-events-none whitespace-nowrap z-40 border ${
              isLight
                ? "bg-slate-900 text-white border-slate-700 shadow-slate-900/20"
                : "bg-slate-900 text-slate-100 border-white/20 shadow-black/40"
            }`}
          >
            {item.label}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active State Background Pill (Morphing spring layoutId) */}
      {isActive && (
        <motion.div
          layoutId="premium-dock-active-pill"
          className="absolute inset-0 rounded-full"
          style={{
            background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
            boxShadow: isLight
              ? "0 2px 14px rgba(245, 158, 11, 0.40)"
              : "0 0 18px rgba(245, 158, 11, 0.48), inset 0 1px 1px rgba(255, 255, 255, 0.35)",
          }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
        />
      )}

      {/* Inactive Hover Background Highlight */}
      {!isActive && (
        <div
          className={`absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${
            isLight ? "bg-slate-900/5" : "bg-white/[0.08]"
          }`}
        />
      )}

      {/* Content: Icon + Label */}
      <div className="relative z-10 flex items-center gap-1.5 sm:gap-2">
        {showIcons && Icon && (
          <Icon
            className={`w-3.5 h-3.5 shrink-0 transition-all duration-200 ${
              isActive
                ? "text-slate-950 stroke-[2.5]"
                : isLight
                ? "text-slate-500 group-hover:text-amber-600 group-hover:scale-105"
                : "text-slate-400 group-hover:text-amber-400 group-hover:scale-105"
            }`}
          />
        )}
        <span
          className={`text-xs tracking-tight transition-all duration-200 whitespace-nowrap ${
            isActive
              ? "font-extrabold text-slate-950"
              : isLight
              ? "font-semibold text-slate-600 group-hover:text-slate-950"
              : "font-semibold text-slate-300 group-hover:text-white"
          }`}
        >
          {/* On Desktop & Laptop (md+): Full label */}
          <span aria-hidden="true" className="hidden md:inline">{item.label}</span>
          {/* On Tablet (sm to md): Compact label */}
          <span aria-hidden="true" className="hidden sm:inline md:hidden">{item.shortLabel || item.label}</span>
          {/* On Mobile (< sm): Active item shows short label, inactive items are icon-only */}
          {isActive ? (
            <span aria-hidden="true" className="sm:hidden">{item.shortLabel || item.label}</span>
          ) : (
            <span className="sr-only">{item.label}</span>
          )}
        </span>
      </div>
    </motion.button>
  );
}

export const PremiumNavigationDock: React.FC<PremiumNavigationDockProps> = ({
  activeTab,
  onSelectTab,
  items = DEFAULT_ITEMS,
  isLight = false,
  className = "",
  showIcons = true,
}) => {
  const mouseX = useMotionValue<number>(Infinity);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    mouseX.set(e.clientX);
  };

  const handleMouseLeave = () => {
    mouseX.set(Infinity);
  };

  return (
    <nav
      aria-label="Main Navigation Dock"
      role="tablist"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-flex items-center gap-0.5 sm:gap-1 p-1 rounded-full transition-all duration-300 select-none ${
        isLight
          ? "bg-slate-100/90 border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(15,23,42,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)]"
          : "bg-slate-950/75 border border-white/10 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.06)]"
      } backdrop-blur-xl ${className}`}
      style={{
        // Stable dock dimensions: magnification only transforms items
        willChange: "transform",
      }}
    >
      {items.map((item) => (
        <DockItem
          key={item.id}
          item={item}
          isActive={activeTab === item.id}
          onClick={() => onSelectTab(item.id)}
          mouseX={mouseX}
          isLight={isLight}
          showIcons={showIcons}
        />
      ))}
    </nav>
  );
};
