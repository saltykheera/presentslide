import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  PresentationSlide,
} from "./presentationTypes";

/**
 * Type guard for Excalidraw Frame elements.
 * Checks for non-deleted elements with type === "frame".
 */
export function isFrame(
  element: ExcalidrawElement | null | undefined
): element is ExcalidrawFrameElement {
  return (
    !!element &&
    element.type === "frame" &&
    !("isDeleted" in element && element.isDeleted)
  );
}

/**
 * Extracts and orders frames from Excalidraw scene elements.
 *
 * Supports custom user-defined slide ordering (e.g. from the slide thumbnail list),
 * with fallback to creation-time ordering for newly added frames.
 *
 * @param elements Scene elements
 * @param customOrder Optional array of frame IDs in desired sequence
 */
export function getPresentationFrames(
  elements: readonly ExcalidrawElement[],
  customOrder?: string[]
): PresentationSlide[] {
  const frames = elements.filter(isFrame);
  if (frames.length === 0) return [];

  // Index map of frames by ID
  const frameMap = new Map<string, ExcalidrawFrameElement>();
  frames.forEach((f) => frameMap.set(f.id, f));

  // Determine base creation-time sequence
  const framesWithOriginalIndex = frames.map((frame, originalIndex) => ({
    frame,
    originalIndex,
  }));

  framesWithOriginalIndex.sort((a, b) => {
    const timeA =
      ((a.frame.customData as Record<string, unknown> | undefined)?.createdAt as number) ||
      ((a.frame as unknown as Record<string, unknown>).created as number) ||
      a.frame.updated ||
      0;
    const timeB =
      ((b.frame.customData as Record<string, unknown> | undefined)?.createdAt as number) ||
      ((b.frame as unknown as Record<string, unknown>).created as number) ||
      b.frame.updated ||
      0;

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    if (a.frame.index && b.frame.index && a.frame.index !== b.frame.index) {
      return a.frame.index.localeCompare(b.frame.index);
    }

    return a.originalIndex - b.originalIndex;
  });

  const creationOrderedFrames = framesWithOriginalIndex.map((x) => x.frame);

  let finalOrderedFrames: ExcalidrawFrameElement[] = [];

  if (customOrder && customOrder.length > 0) {
    const seen = new Set<string>();
    // First, add frames following the customOrder that still exist
    for (const id of customOrder) {
      const f = frameMap.get(id);
      if (f && !seen.has(id)) {
        finalOrderedFrames.push(f);
        seen.add(id);
      }
    }
    // Then append any newly created frames not in customOrder in creation order
    for (const f of creationOrderedFrames) {
      if (!seen.has(f.id)) {
        finalOrderedFrames.push(f);
        seen.add(f.id);
      }
    }
  } else {
    finalOrderedFrames = creationOrderedFrames;
  }

  return finalOrderedFrames.map((frame, index) => ({
    frameId: frame.id,
    name: frame.name || `Slide ${index + 1}`,
    index,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
  }));
}
