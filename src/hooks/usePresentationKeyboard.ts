"use client";

import { useEffect } from "react";

interface UsePresentationKeyboardOptions {
  isPresenting: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onFirst: () => void;
  onLast: () => void;
  onExit: () => void;
}

/**
 * Handles keyboard shortcuts specifically when isPresenting === true.
 * Ensures default Excalidraw keyboard behavior is completely untouched outside presentation mode.
 */
export function usePresentationKeyboard({
  isPresenting,
  onNext,
  onPrevious,
  onFirst,
  onLast,
  onExit,
}: UsePresentationKeyboardOptions) {
  useEffect(() => {
    if (!isPresenting) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't intercept if an editable input/textarea or contentEditable is focused
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      switch (event.key) {
        // NEXT slide keys
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ": {
          event.preventDefault();
          onNext();
          break;
        }

        // PREVIOUS slide keys
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp": {
          event.preventDefault();
          onPrevious();
          break;
        }

        // FIRST slide key
        case "Home": {
          event.preventDefault();
          onFirst();
          break;
        }

        // LAST slide key
        case "End": {
          event.preventDefault();
          onLast();
          break;
        }

        // EXIT presentation
        case "Escape": {
          event.preventDefault();
          onExit();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [isPresenting, onNext, onPrevious, onFirst, onLast, onExit]);
}

