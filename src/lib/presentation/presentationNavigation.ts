import type {
  ExcalidrawElement,
  SavedViewport,
  AppState,
} from "./presentationTypes";
import { isFrame } from "./getPresentationFrames";

/**
 * Validates whether the given slide's frame still exists and is not deleted in the scene.
 */
export function findFrameById(
  elements: readonly ExcalidrawElement[],
  frameId: string
): ExcalidrawElement | undefined {
  return elements.find(
    (el) => el.id === frameId && isFrame(el) && !("isDeleted" in el && el.isDeleted)
  );
}

/**
 * Helper to safely clamp slide index between 0 and total - 1.
 */
export function clampSlideIndex(index: number, totalSlides: number): number {
  if (totalSlides <= 0) return 0;
  return Math.max(0, Math.min(index, totalSlides - 1));
}

/**
 * Calculates next slide index (bounded).
 */
export function getNextSlideIndex(currentIndex: number, totalSlides: number): number {
  if (totalSlides <= 0) return 0;
  return Math.min(currentIndex + 1, totalSlides - 1);
}

/**
 * Calculates previous slide index (bounded).
 */
export function getPreviousSlideIndex(currentIndex: number): number {
  return Math.max(0, currentIndex - 1);
}

/**
 * Captures current viewport from Excalidraw AppState.
 */
export function captureViewport(appState: AppState): SavedViewport {
  return {
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: {
      value: appState.zoom.value,
    },
  };
}
