import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePresentation } from "./usePresentation";
import type {
  PresentationExcalidrawAdapter,
  ExcalidrawElement,
  AppState,
} from "@/lib/presentation/presentationTypes";

function createMockFrame(id: string, x: number, y: number, name: string = `Slide ${id}`): ExcalidrawElement {
  return {
    id,
    type: "frame",
    x,
    y,
    width: 800,
    height: 600,
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
    updated: 1,
    link: null,
    locked: false,
    name,
  } as unknown as ExcalidrawElement;
}

describe("usePresentation hook tests", () => {
  it("warns when trying to present with 0 frames", () => {
    const mockAdapter: PresentationExcalidrawAdapter = {
      getElements: () => [],
      getAppState: () => ({ scrollX: 100, scrollY: 200, zoom: { value: 1 as unknown as AppState["zoom"]["value"] } } as AppState),
      focusFrame: vi.fn(),
      restoreViewport: vi.fn(),
    };

    const onEmpty = vi.fn();
    const { result } = renderHook(() =>
      usePresentation({ adapter: mockAdapter, onEmptyPresentation: onEmpty })
    );

    act(() => {
      result.current.startPresentation();
    });

    expect(onEmpty).toHaveBeenCalledWith("Create at least one frame before starting a presentation.");
    expect(result.current.isPresenting).toBe(false);
  });

  it("stores viewport at start and restores at exit", () => {
    const elements = [createMockFrame("F1", 0, 0), createMockFrame("F2", 1000, 0)];
    const mockAdapter: PresentationExcalidrawAdapter = {
      getElements: () => elements,
      getAppState: () => ({ scrollX: 123, scrollY: 456, zoom: { value: 1.5 as unknown as AppState["zoom"]["value"] } } as AppState),
      focusFrame: vi.fn(),
      restoreViewport: vi.fn(),
    };

    const { result } = renderHook(() => usePresentation({ adapter: mockAdapter }));

    // Start presentation
    act(() => {
      result.current.startPresentation();
    });

    expect(result.current.isPresenting).toBe(true);
    expect(result.current.totalSlides).toBe(2);
    expect(result.current.currentSlideIndex).toBe(0);
    expect(mockAdapter.focusFrame).toHaveBeenCalledWith("F1", false);

    // Navigate to slide 2
    act(() => {
      result.current.nextSlide();
    });
    expect(result.current.currentSlideIndex).toBe(1);
    expect(mockAdapter.focusFrame).toHaveBeenCalledWith("F2", false);

    // Exit presentation
    act(() => {
      result.current.exitPresentation();
    });

    expect(result.current.isPresenting).toBe(false);
    expect(mockAdapter.restoreViewport).toHaveBeenCalledWith({
      scrollX: 123,
      scrollY: 456,
      zoom: { value: 1.5 as unknown as AppState["zoom"]["value"] },
    });
  });

  it("starts presentation directly on specified initial slide ID", () => {
    const elements = [createMockFrame("F1", 0, 0), createMockFrame("F2", 1000, 0)];
    const mockAdapter: PresentationExcalidrawAdapter = {
      getElements: () => elements,
      getAppState: () => ({ scrollX: 0, scrollY: 0, zoom: { value: 1 as unknown as AppState["zoom"]["value"] } } as AppState),
      focusFrame: vi.fn(),
      restoreViewport: vi.fn(),
    };

    const { result } = renderHook(() => usePresentation({ adapter: mockAdapter }));

    act(() => {
      result.current.startPresentation("F2");
    });

    expect(result.current.isPresenting).toBe(true);
    expect(result.current.currentSlideIndex).toBe(1);
    expect(mockAdapter.focusFrame).toHaveBeenCalledWith("F2", false);
  });
});
