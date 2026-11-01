"use client";

import React from "react";
import { PresentationControls } from "./PresentationControls";

interface PresentationOverlayProps {
  currentSlideIndex: number;
  totalSlides: number;
  slideName?: string;
  isFullscreen: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToggleFullscreen: () => void;
  onExit: () => void;
}

export function PresentationOverlay({
  currentSlideIndex,
  totalSlides,
  slideName,
  isFullscreen,
  onPrevious,
  onNext,
  onToggleFullscreen,
  onExit,
}: PresentationOverlayProps) {
  /**
   * Section 14: Mouse controls
   * Click right half -> next slide
   * Click left half -> previous slide
   * Clicks on controls do not trigger navigation because PresentationControls uses stopPropagation()
   */
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const width = window.innerWidth;
    const clickX = e.clientX;

    if (clickX > width / 2) {
      onNext();
    } else {
      onPrevious();
    }
  };

  return (
    <div
      onClick={handleOverlayClick}
      className="absolute inset-0 z-40 cursor-default select-none overflow-hidden"
      aria-label="Presentation Slide Surface"
    >
      {/* Semi-transparent hover indicators on screen sides */}
      <div
        className="absolute left-0 top-0 bottom-0 w-24 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-r from-black/10 to-transparent pointer-events-none flex items-center justify-start pl-4"
        aria-hidden="true"
      >
        <div className="w-10 h-10 rounded-full bg-black/30 backdrop-blur text-white flex items-center justify-center">
          ‹
        </div>
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-24 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-l from-black/10 to-transparent pointer-events-none flex items-center justify-end pr-4"
        aria-hidden="true"
      >
        <div className="w-10 h-10 rounded-full bg-black/30 backdrop-blur text-white flex items-center justify-center">
          ›
        </div>
      </div>

      {/* Floating Presentation Controls */}
      <PresentationControls
        currentSlideIndex={currentSlideIndex}
        totalSlides={totalSlides}
        slideName={slideName}
        isFullscreen={isFullscreen}
        onPrevious={onPrevious}
        onNext={onNext}
        onToggleFullscreen={onToggleFullscreen}
        onExit={onExit}
      />
    </div>
  );
}

