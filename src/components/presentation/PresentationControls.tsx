"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  X,
} from "lucide-react";

interface PresentationControlsProps {
  currentSlideIndex: number;
  totalSlides: number;
  slideName?: string;
  isFullscreen: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToggleFullscreen: () => void;
  onExit: () => void;
}

export function PresentationControls({
  currentSlideIndex,
  totalSlides,
  slideName,
  isFullscreen,
  onPrevious,
  onNext,
  onToggleFullscreen,
  onExit,
}: PresentationControlsProps) {
  const [isVisible, setIsVisible] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = useCallback(() => {
    setIsVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 2500);
  }, []);

  useEffect(() => {
    // Start timer on initial mount
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 2500);

    const handleMouseMove = () => {
      resetInactivityTimer();
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [resetInactivityTimer]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-300 pointer-events-auto select-none ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-label="Presentation Controls"
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-zinc-900/90 dark:bg-zinc-800/90 text-white shadow-xl backdrop-blur-md border border-zinc-200/20 text-xs">
        {/* Compact Previous Button */}
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentSlideIndex === 0}
          title="Previous slide (Left Arrow / PageUp)"
          aria-label="Previous slide"
          className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors focus:outline-none"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Compact Slide Counter */}
        <div className="flex items-center px-1.5">
          <span className="font-semibold text-xs tracking-tight">
            {totalSlides > 0 ? currentSlideIndex + 1 : 0} / {totalSlides}
          </span>
          {slideName && (
            <span className="text-[10px] text-zinc-400 truncate max-w-[90px] ml-1.5 hidden sm:inline">
              {slideName}
            </span>
          )}
        </div>

        {/* Compact Next Button */}
        <button
          type="button"
          onClick={onNext}
          disabled={currentSlideIndex >= totalSlides - 1}
          title="Next slide (Right Arrow / PageDown / Space)"
          aria-label="Next slide"
          className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors focus:outline-none"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />

        {/* Fullscreen Toggle Button */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          className="p-1 rounded-full hover:bg-white/20 transition-colors focus:outline-none"
        >
          {isFullscreen ? (
            <Minimize className="w-3 h-3" />
          ) : (
            <Maximize className="w-3 h-3" />
          )}
        </button>

        {/* Exit Presentation Button */}
        <button
          type="button"
          onClick={onExit}
          title="Exit Presentation (Esc)"
          aria-label="Exit Presentation"
          className="p-1 rounded-full hover:bg-red-500/30 text-red-300 hover:text-red-200 transition-colors focus:outline-none"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
