import { useEffect } from "react";
import { animate } from "framer-motion";

/**
 * GlobalButtonMagnification
 * 
 * Applies the MagnificationDock-style hover animation system to ALL existing buttons
 * across the entire website.
 * 
 * Physics parameters:
 * mass: 0.1, stiffness: 150, damping: 12 (smooth, subtle, premium spring)
 * 
 * Proportional magnification:
 * - Large buttons (>220px width or >50px height): ~1.04x
 * - Medium buttons (100px - 220px): ~1.06x
 * - Small & icon buttons (<=100px): ~1.08x
 * - Base size (unhovered): 1.0x (original dimensions strictly preserved)
 * 
 * Zero layout shift:
 * Scales exclusively via GPU-accelerated CSS transforms.
 * Does not alter margins, padding, flex, grid, or flow.
 */

// Active animation controllers map to prevent overlapping animations
const activeAnimations = new WeakMap<HTMLButtonElement, { stop: () => void }>();

function getProportionalScale(button: HTMLButtonElement): number {
  const rect = button.getBoundingClientRect();
  if (rect.width > 220 || rect.height > 50) {
    return 1.04;
  }
  if (rect.width < 100 || rect.height < 38) {
    return 1.08;
  }
  return 1.06;
}

function isInteractiveButton(button: HTMLButtonElement): boolean {
  if (button.disabled) return false;
  if (button.getAttribute("aria-disabled") === "true") return false;
  if (button.classList.contains("cursor-not-allowed")) return false;
  if (button.classList.contains("opacity-50") && button.disabled) return false;
  // Skip buttons inside the main MagnificationDock nav because it already has its own cursor-proximity spring physics
  if (button.closest('nav[aria-label="Main Navigation Dock"]')) return false;
  return true;
}

export function useGlobalButtonMagnification() {
  useEffect(() => {
    // Only apply on fine-pointer devices (desktop/laptop with mouse/trackpad)
    // Preserves native touch behavior on mobile/touch screens
    const isTouchOnly = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    if (isTouchOnly) return;

    const handlePointerOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;

      const target = e.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || !isInteractiveButton(button)) return;

      // Avoid re-triggering if moving between child elements of the same button
      const related = e.relatedTarget as Node | null;
      if (related && button.contains(related)) return;

      const targetScale = getProportionalScale(button);

      // Stop previous animation on this button if running
      activeAnimations.get(button)?.stop();

      const controls = animate(
        button,
        { scale: targetScale, y: -1.5 },
        {
          type: "spring",
          mass: 0.1,
          stiffness: 150,
          damping: 12,
        }
      );
      activeAnimations.set(button, controls);
    };

    const handlePointerOut = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;

      const target = e.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;

      // Avoid triggering if moving between child elements of the same button
      const related = e.relatedTarget as Node | null;
      if (related && button.contains(related)) return;

      if (!isInteractiveButton(button)) return;

      activeAnimations.get(button)?.stop();

      const controls = animate(
        button,
        { scale: 1, y: 0 },
        {
          type: "spring",
          mass: 0.1,
          stiffness: 150,
          damping: 12,
        }
      );
      activeAnimations.set(button, controls);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;

      const target = e.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || !isInteractiveButton(button)) return;

      activeAnimations.get(button)?.stop();

      const controls = animate(
        button,
        { scale: 0.97, y: 0 },
        {
          type: "spring",
          mass: 0.1,
          stiffness: 220,
          damping: 16,
        }
      );
      activeAnimations.set(button, controls);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;

      const target = e.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || !isInteractiveButton(button)) return;

      const targetScale = getProportionalScale(button);

      activeAnimations.get(button)?.stop();

      const controls = animate(
        button,
        { scale: targetScale, y: -1.5 },
        {
          type: "spring",
          mass: 0.1,
          stiffness: 150,
          damping: 12,
        }
      );
      activeAnimations.set(button, controls);
    };

    // Keyboard focus accessibility
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || !isInteractiveButton(button)) return;

      const targetScale = getProportionalScale(button);
      activeAnimations.get(button)?.stop();

      const controls = animate(
        button,
        { scale: targetScale, y: -1.5 },
        {
          type: "spring",
          mass: 0.1,
          stiffness: 150,
          damping: 12,
        }
      );
      activeAnimations.set(button, controls);
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || !isInteractiveButton(button)) return;

      activeAnimations.get(button)?.stop();

      const controls = animate(
        button,
        { scale: 1, y: 0 },
        {
          type: "spring",
          mass: 0.1,
          stiffness: 150,
          damping: 12,
        }
      );
      activeAnimations.set(button, controls);
    };

    document.addEventListener("pointerover", handlePointerOver, { passive: true });
    document.addEventListener("pointerout", handlePointerOut, { passive: true });
    document.addEventListener("pointerdown", handlePointerDown, { passive: true });
    document.addEventListener("pointerup", handlePointerUp, { passive: true });
    document.addEventListener("focusin", handleFocusIn, { passive: true });
    document.addEventListener("focusout", handleFocusOut, { passive: true });

    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);
}

export function GlobalButtonMagnification() {
  useGlobalButtonMagnification();
  return null;
}
