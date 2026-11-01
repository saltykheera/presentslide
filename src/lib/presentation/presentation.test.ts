import { describe, it, expect } from "vitest";
import { getPresentationFrames } from "./getPresentationFrames";
import {
  getNextSlideIndex,
  getPreviousSlideIndex,
  clampSlideIndex,
  findFrameById,
} from "./presentationNavigation";
import type { ExcalidrawElement } from "./presentationTypes";

// Mock helper to build minimal mock Excalidraw elements
function createMockElement(
  partial: Partial<ExcalidrawElement> & { id: string; type: string }
): ExcalidrawElement {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    angle: 0,
    strokeColor: "#000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roundness: null,
    roughness: 1,
    opacity: 100,
    seed: 123,
    version: 1,
    versionNonce: 1,
    index: "a0" as unknown as NonNullable<ExcalidrawElement["index"]>,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: 100,
    link: null,
    locked: false,
    customData: undefined,
    ...partial,
  } as unknown as ExcalidrawElement;
}

function createMockFrame(
  id: string,
  x: number,
  y: number,
  width: number = 800,
  height: number = 600,
  name: string = `Frame ${id}`,
  updatedTime: number = 100
): ExcalidrawElement {
  return createMockElement({
    id,
    type: "frame",
    x,
    y,
    width,
    height,
    name,
    updated: updatedTime,
  });
}

describe("Presentation Logic Tests", () => {
  describe("Frame Discovery", () => {
    it("returns 0 slides when scene has shapes only", () => {
      const elements: ExcalidrawElement[] = [
        createMockElement({ id: "rect-1", type: "rectangle" }),
        createMockElement({ id: "ellipse-1", type: "ellipse" }),
        createMockElement({ id: "diamond-1", type: "diamond" }),
      ];

      const slides = getPresentationFrames(elements);
      expect(slides).toHaveLength(0);
    });

    it("returns 3 slides for scene with 3 frames", () => {
      const elements: ExcalidrawElement[] = [
        createMockFrame("frame-1", 0, 0, 800, 600, "Frame 1", 1000),
        createMockElement({ id: "rect-1", type: "rectangle" }),
        createMockFrame("frame-2", 0, 800, 800, 600, "Frame 2", 2000),
        createMockFrame("frame-3", 0, 1600, 800, 600, "Frame 3", 3000),
      ];

      const slides = getPresentationFrames(elements);
      expect(slides).toHaveLength(3);
      expect(slides[0].frameId).toBe("frame-1");
      expect(slides[1].frameId).toBe("frame-2");
      expect(slides[2].frameId).toBe("frame-3");
    });

    it("ignores deleted frames", () => {
      const elements: ExcalidrawElement[] = [
        createMockFrame("frame-1", 0, 0),
        {
          ...createMockFrame("frame-deleted", 0, 800),
          isDeleted: true,
        } as ExcalidrawElement,
      ];

      const slides = getPresentationFrames(elements);
      expect(slides).toHaveLength(1);
      expect(slides[0].frameId).toBe("frame-1");
    });
  });

  describe("Creation-Time and Custom Slide Ordering", () => {
    it("orders frames deterministically based on creation time by default", () => {
      const elements: ExcalidrawElement[] = [
        createMockFrame("Frame-3", 500, 400, 800, 600, "Frame 3", 300),
        createMockFrame("Frame-1", 1000, 800, 800, 600, "Frame 1", 100),
        createMockFrame("Frame-2", 0, 0, 800, 600, "Frame 2", 200),
      ];

      const slides = getPresentationFrames(elements);
      const order = slides.map((s) => s.frameId);
      expect(order).toEqual(["Frame-1", "Frame-2", "Frame-3"]);
    });

    it("respects custom user-reordered slide sequence", () => {
      const elements: ExcalidrawElement[] = [
        createMockFrame("Frame-1", 0, 0, 800, 600, "Frame 1", 100),
        createMockFrame("Frame-2", 0, 0, 800, 600, "Frame 2", 200),
        createMockFrame("Frame-3", 0, 0, 800, 600, "Frame 3", 300),
      ];

      // Custom order: Move Frame 3 to the beginning, then 1, then 2
      const customOrder = ["Frame-3", "Frame-1", "Frame-2"];
      const slides = getPresentationFrames(elements, customOrder);
      const order = slides.map((s) => s.frameId);
      expect(order).toEqual(["Frame-3", "Frame-1", "Frame-2"]);
    });

    it("appends newly added frames after custom-ordered frames", () => {
      const elements: ExcalidrawElement[] = [
        createMockFrame("Frame-1", 0, 0, 800, 600, "Frame 1", 100),
        createMockFrame("Frame-2", 0, 0, 800, 600, "Frame 2", 200),
        createMockFrame("Frame-New", 0, 0, 800, 600, "Frame New", 400),
      ];

      const customOrder = ["Frame-2", "Frame-1"];
      const slides = getPresentationFrames(elements, customOrder);
      const order = slides.map((s) => s.frameId);
      expect(order).toEqual(["Frame-2", "Frame-1", "Frame-New"]);
    });
  });

  describe("Navigation & Boundaries", () => {
    it("getNextSlideIndex advances by 1 up to last slide", () => {
      expect(getNextSlideIndex(0, 3)).toBe(1);
      expect(getNextSlideIndex(1, 3)).toBe(2);
      expect(getNextSlideIndex(2, 3)).toBe(2);
    });

    it("getPreviousSlideIndex decrements by 1 down to first slide", () => {
      expect(getPreviousSlideIndex(2)).toBe(1);
      expect(getPreviousSlideIndex(1)).toBe(0);
      expect(getPreviousSlideIndex(0)).toBe(0);
    });

    it("clampSlideIndex keeps index within bounds", () => {
      expect(clampSlideIndex(-1, 5)).toBe(0);
      expect(clampSlideIndex(2, 5)).toBe(2);
      expect(clampSlideIndex(10, 5)).toBe(4);
      expect(clampSlideIndex(0, 0)).toBe(0);
    });
  });

  describe("Scene Change Resilience", () => {
    it("finds existing frame by ID", () => {
      const elements: ExcalidrawElement[] = [createMockFrame("frame-1", 0, 0)];
      const frame = findFrameById(elements, "frame-1");
      expect(frame).toBeDefined();
      expect(frame?.id).toBe("frame-1");
    });

    it("returns undefined if frame was removed or deleted", () => {
      const elements: ExcalidrawElement[] = [
        {
          ...createMockFrame("frame-1", 0, 0),
          isDeleted: true,
        } as ExcalidrawElement,
      ];
      expect(findFrameById(elements, "frame-1")).toBeUndefined();
      expect(findFrameById(elements, "nonexistent")).toBeUndefined();
    });
  });
});
