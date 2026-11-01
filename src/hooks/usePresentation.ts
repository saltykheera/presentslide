"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  PresentationSlide,
  SavedViewport,
  PresentationExcalidrawAdapter,
} from "@/lib/presentation/presentationTypes";
import { getPresentationFrames } from "@/lib/presentation/getPresentationFrames";
import {
  clampSlideIndex,
  captureViewport,
  findFrameById,
} from "@/lib/presentation/presentationNavigation";
import { usePresentationKeyboard } from "./usePresentationKeyboard";
import { usePresentationTouch } from "./usePresentationTouch";

interface UsePresentationProps {
  adapter: PresentationExcalidrawAdapter | null;
  customSlideOrder?: string[];
  onEmptyPresentation?: (message: string) => void;
}

export function usePresentation({
  adapter,
  customSlideOrder,
  onEmptyPresentation,
}: UsePresentationProps) {
  const [isPresenting, setIsPresenting] = useState<boolean>(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [slides, setSlides] = useState<PresentationSlide[]>([]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Store viewport state before entering presentation mode to restore upon exit
  const savedViewportRef = useRef<SavedViewport | null>(null);

  /**
   * Exits presentation mode:
   * 1. Restores saved viewport
   * 2. Resets presentation state
   */
  const exitPresentation = useCallback(() => {
    setIsPresenting(false);

    if (adapter && savedViewportRef.current) {
      adapter.restoreViewport(savedViewportRef.current);
      savedViewportRef.current = null;
    }

    // Exit fullscreen if browser is in fullscreen
    if (typeof document !== "undefined" && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [adapter]);

  /**
   * Navigates Excalidraw viewport to the frame corresponding to the slide index.
   */
  const goToSlide = useCallback(
    (index: number, animate: boolean = false) => {
      if (!adapter || slides.length === 0) return;

      const clamped = clampSlideIndex(index, slides.length);
      const targetSlide = slides[clamped];

      // Verify frame still exists in scene
      const elements = adapter.getElements();
      const frameEl = findFrameById(elements, targetSlide.frameId);

      if (!frameEl) {
        // Frame disappeared; refresh slides dynamically
        const freshSlides = getPresentationFrames(elements, customSlideOrder);
        if (freshSlides.length === 0) {
          exitPresentation();
          return;
        }
        setSlides(freshSlides);
        const safeIndex = clampSlideIndex(clamped, freshSlides.length);
        setCurrentSlideIndex(safeIndex);
        adapter.focusFrame(freshSlides[safeIndex].frameId, animate);
        return;
      }

      setCurrentSlideIndex(clamped);
      adapter.focusFrame(targetSlide.frameId, animate);
    },
    [adapter, slides, customSlideOrder, exitPresentation]
  );

  const nextSlide = useCallback(() => {
    if (currentSlideIndex < slides.length - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  }, [currentSlideIndex, slides.length, goToSlide]);

  const previousSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  }, [currentSlideIndex, goToSlide]);

  const firstSlide = useCallback(() => {
    goToSlide(0);
  }, [goToSlide]);

  const lastSlide = useCallback(() => {
    if (slides.length > 0) {
      goToSlide(slides.length - 1);
    }
  }, [slides.length, goToSlide]);

  /**
   * Starts presentation mode:
   * 1. Inspect elements and compute presentation frames using custom order if set
   * 2. If 0 frames, inform user and cancel
   * 3. Capture current viewport
   * 4. Focus slide 0 and activate presentation state
   */
  const startPresentation = useCallback(() => {
    if (!adapter) return;

    const elements = adapter.getElements();
    const discoveredSlides = getPresentationFrames(elements, customSlideOrder);

    if (discoveredSlides.length === 0) {
      onEmptyPresentation?.(
        "Create at least one frame before starting a presentation."
      );
      return;
    }

    // Save current viewport
    const appState = adapter.getAppState();
    savedViewportRef.current = captureViewport(appState);

    setSlides(discoveredSlides);
    setCurrentSlideIndex(0);
    setIsPresenting(true);

    // Initial transition to slide 1
    adapter.focusFrame(discoveredSlides[0].frameId, false);
  }, [adapter, customSlideOrder, onEmptyPresentation]);

  /**
   * Toggle fullscreen standard browser API
   */
  const toggleFullscreen = useCallback(async (containerElement?: HTMLElement | null) => {
    if (typeof document === "undefined") return;

    if (!document.fullscreenElement) {
      try {
        const target = containerElement || document.documentElement;
        await target.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.warn("Fullscreen request error:", err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.warn("Exit fullscreen error:", err);
      }
    }
  }, []);

  // Monitor document fullscreen changes
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  // Attach keyboard shortcuts
  usePresentationKeyboard({
    isPresenting,
    onNext: nextSlide,
    onPrevious: previousSlide,
    onFirst: firstSlide,
    onLast: lastSlide,
    onExit: exitPresentation,
  });

  // Attach touch gestures
  usePresentationTouch({
    isPresenting,
    onNext: nextSlide,
    onPrevious: previousSlide,
  });

  return {
    isPresenting,
    currentSlideIndex,
    slides,
    currentSlide: slides[currentSlideIndex] || null,
    totalSlides: slides.length,
    isFullscreen,
    startPresentation,
    exitPresentation,
    nextSlide,
    previousSlide,
    firstSlide,
    lastSlide,
    goToSlide,
    toggleFullscreen,
    setSlides,
  };
}
