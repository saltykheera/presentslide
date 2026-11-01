"use client";

import { useEffect, useRef } from "react";

interface UsePresentationTouchOptions {
  isPresenting: boolean;
  onNext: () => void;
  onPrevious: () => void;
  threshold?: number;
}

/**
 * Clean, lightweight touch swipe detection for presentation mode without external dependencies.
 */
export function usePresentationTouch({
  isPresenting,
  onNext,
  onPrevious,
  threshold = 60, // Minimum swipe distance in px
}: UsePresentationTouchOptions) {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );

  useEffect(() => {
    if (!isPresenting) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || e.changedTouches.length !== 1) {
        touchStartRef.current = null;
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      touchStartRef.current = null;

      // Only count as horizontal swipe if horizontal distance is dominant and exceeds threshold
      if (
        Math.abs(deltaX) > threshold &&
        Math.abs(deltaX) > Math.abs(deltaY) * 1.5 &&
        deltaTime < 800
      ) {
        if (deltaX < 0) {
          // Swiped left -> next slide
          onNext();
        } else {
          // Swiped right -> previous slide
          onPrevious();
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isPresenting, onNext, onPrevious, threshold]);
}

