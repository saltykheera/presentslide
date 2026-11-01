"use client";

import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import type {
  ExcalidrawImperativeAPI,
  PresentationExcalidrawAdapter,
  SavedViewport,
  PresentationSlide,
  ExcalidrawElement,
  ExportElements,
  ExportFrame,
} from "@/lib/presentation/presentationTypes";
import { usePresentation } from "@/hooks/usePresentation";
import { getPresentationFrames, isFrame } from "@/lib/presentation/getPresentationFrames";
import {
  saveToStorage,
  loadFromStorage,
} from "@/lib/presentation/presentationStorage";
import { PresentationOverlay } from "@/components/presentation/PresentationOverlay";
import { SlideNavigator } from "@/components/presentation/SlideNavigator";
import { Play, AlertCircle } from "lucide-react";
import {
  zoomToFitBounds,
  exportToCanvas,
  serializeAsJSON,
  loadFromBlob,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

// Standard 16:9 widescreen presentation dimensions
const SLIDE_WIDTH = 1600;
const SLIDE_HEIGHT = 900;
const SLIDE_GAP = 120;

// Dynamic import of Excalidraw since it uses browser APIs (window, canvas)
const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false }
);

export function ExcalidrawEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Custom user-arranged slide order (array of frame IDs)
  const [customSlideOrder, setCustomSlideOrder] = useState<string[]>([]);
  // Slides list tracked for the slide navigator sidebar
  const [editorSlides, setEditorSlides] = useState<PresentationSlide[]>([]);
  const [activeSlideId, setActiveSlideId] = useState<string | undefined>(undefined);
  const [isSaved, setIsSaved] = useState<boolean>(true);

  // Slide thumbnails data URLs (frameId -> dataURL)
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  // Track the viewport pixel bounds of the active presenting slide for pure presentation framing
  const [activeSlideViewportBox, setActiveSlideViewportBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Track frame fingerprint (ids, count, names) to avoid triggering state updates on pointer/cursor moves
  const lastFramesFingerprintRef = useRef<string>("");
  const thumbnailTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Asynchronously generate thumbnail previews for frames without blocking rendering
  const generateThumbnails = useCallback(
    async (elements: readonly ExcalidrawElement[], frames: PresentationSlide[], api: ExcalidrawImperativeAPI) => {
      if (typeof window === "undefined" || frames.length === 0) return;

      const appState = api.getAppState();
      const files = api.getFiles();
      const newThumbs: Record<string, string> = {};

      for (const slide of frames) {
        const frameEl = elements.find((el) => el.id === slide.frameId);
        if (!frameEl) continue;

        try {
          const canvas = await exportToCanvas({
            elements: elements as unknown as ExportElements,
            appState: {
              ...appState,
              exportWithDarkMode: appState.theme === "dark",
              exportBackground: true,
              viewBackgroundColor: appState.viewBackgroundColor || "#ffffff",
            },
            files,
            exportingFrame: frameEl as unknown as ExportFrame,
            maxWidthOrHeight: 280,
          });

          newThumbs[slide.frameId] = canvas.toDataURL("image/png");
        } catch {
          // Skip any errors during canvas generation
        }
      }

      setThumbnails((prev) => ({ ...prev, ...newThumbs }));
    },
    []
  );

  const updateSlidesIfChanged = useCallback(
    (elements: readonly ExcalidrawElement[], order: string[], api?: ExcalidrawImperativeAPI) => {
      const frames = elements.filter(isFrame);
      const fingerprint =
        frames
          .map((f) => `${f.id}:${f.name || ""}:${Math.round(f.width)}:${Math.round(f.height)}`)
          .join("|") + `_order:${order.join(",")}`;

      if (fingerprint !== lastFramesFingerprintRef.current) {
        lastFramesFingerprintRef.current = fingerprint;
        const updated = getPresentationFrames(elements, order);
        setEditorSlides(updated);

        // Schedule thumbnail generation debounced
        const activeApi = api || excalidrawAPI;
        if (activeApi) {
          if (thumbnailTimeoutRef.current) clearTimeout(thumbnailTimeoutRef.current);
          thumbnailTimeoutRef.current = setTimeout(() => {
            generateThumbnails(elements, updated, activeApi);
          }, 350);
        }
      }
    },
    [excalidrawAPI, generateThumbnails]
  );

  // Stable callback for initial Excalidraw API binding
  const handleExcalidrawAPI = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      setExcalidrawAPI(api);

      // Load saved project from localStorage if exists
      const saved = loadFromStorage();
      if (saved && saved.elements && saved.elements.length > 0) {
        api.updateScene({
          elements: saved.elements,
          appState: saved.appState
            ? {
                viewBackgroundColor: saved.appState.viewBackgroundColor || "#ffffff",
              }
            : undefined,
        });
        if (saved.files) {
          api.addFiles(Object.values(saved.files) as Parameters<ExcalidrawImperativeAPI["addFiles"]>[0]);
        }
        if (saved.slideOrder) {
          setCustomSlideOrder(saved.slideOrder);
          updateSlidesIfChanged(saved.elements, saved.slideOrder, api);
          return;
        }
        updateSlidesIfChanged(saved.elements, [], api);
        return;
      }

      const elements = api.getSceneElements();
      updateSlidesIfChanged(elements, customSlideOrder, api);
    },
    [updateSlidesIfChanged, customSlideOrder]
  );

  // Stable onChange listener with auto-save debounced to localStorage
  const handleSceneChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>["onChange"]>>[1]) => {
      updateSlidesIfChanged(elements, customSlideOrder);

      // Auto-save to localStorage debounced
      if (excalidrawAPI) {
        setIsSaved(false);
        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = setTimeout(() => {
          saveToStorage(
            elements,
            appState,
            excalidrawAPI.getFiles(),
            customSlideOrder
          );
          setIsSaved(true);
        }, 800);
      }
    },
    [updateSlidesIfChanged, customSlideOrder, excalidrawAPI]
  );

  // Focus a specific slide on canvas when selected in the slide navigator
  const handleSelectSlide = useCallback(
    (frameId: string) => {
      if (!excalidrawAPI) return;
      setActiveSlideId(frameId);
      const elements = excalidrawAPI.getSceneElements();
      const frame = elements.find((el) => el.id === frameId);
      if (!frame) return;

      const appState = excalidrawAPI.getAppState();
      const bounds = [
        frame.x,
        frame.y,
        frame.x + frame.width,
        frame.y + frame.height,
      ] as const;

      const fit = zoomToFitBounds({
        bounds,
        appState,
        fitToViewport: true,
        viewportZoomFactor: 0.88,
      });

      excalidrawAPI.updateScene({
        appState: {
          scrollX: fit.appState.scrollX,
          scrollY: fit.appState.scrollY,
          zoom: fit.appState.zoom,
        },
      });
    },
    [excalidrawAPI]
  );

  // Handle reordering from the SlideNavigator
  const handleReorderSlides = useCallback(
    (reorderedFrameIds: string[]) => {
      setCustomSlideOrder(reorderedFrameIds);
      if (excalidrawAPI) {
        lastFramesFingerprintRef.current = ""; // invalidate fingerprint to re-render
        updateSlidesIfChanged(excalidrawAPI.getSceneElements(), reorderedFrameIds);
        saveToStorage(
          excalidrawAPI.getSceneElements(),
          excalidrawAPI.getAppState(),
          excalidrawAPI.getFiles(),
          reorderedFrameIds
        );
      }
    },
    [excalidrawAPI, updateSlidesIfChanged]
  );

  // Add a consistent 16:9 presentation slide
  const handleAdd16x9Slide = useCallback(() => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const existingFrames = elements.filter(isFrame);

    let newX = 100;
    let newY = 100;

    if (existingFrames.length > 0) {
      const maxRight = Math.max(...existingFrames.map((f) => f.x + f.width));
      const rightmostFrame = existingFrames.find((f) => f.x + f.width === maxRight);
      newX = maxRight + SLIDE_GAP;
      newY = rightmostFrame ? rightmostFrame.y : 100;
    }

    const timestamp = Date.now();
    const newFrameId = `frame_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
    const slideNumber = existingFrames.length + 1;

    const new16x9Frame: ExcalidrawElement = {
      id: newFrameId,
      type: "frame",
      name: `Slide ${slideNumber}`,
      x: newX,
      y: newY,
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      angle: 0,
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roundness: null,
      roughness: 0,
      opacity: 100,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      index: null,
      isDeleted: false,
      groupIds: [],
      frameId: null,
      boundElements: null,
      updated: timestamp,
      link: null,
      locked: false,
      customData: {
        createdAt: timestamp,
      },
    } as unknown as ExcalidrawElement;

    const newElements = [...elements, new16x9Frame];
    excalidrawAPI.updateScene({
      elements: newElements,
    });

    const newOrder = [...customSlideOrder, newFrameId];
    setCustomSlideOrder(newOrder);
    setActiveSlideId(newFrameId);

    saveToStorage(newElements, excalidrawAPI.getAppState(), excalidrawAPI.getFiles(), newOrder);
    handleSelectSlide(newFrameId);
  }, [excalidrawAPI, customSlideOrder, handleSelectSlide]);

  // Duplicate a frame and all its contents (Ctrl+D)
  const handleDuplicateSlide = useCallback(
    (frameId: string) => {
      if (!excalidrawAPI) return;
      const elements = excalidrawAPI.getSceneElements();
      const targetFrame = elements.find((el) => el.id === frameId);
      if (!targetFrame || !isFrame(targetFrame)) return;

      const childElements = elements.filter(
        (el) => el.frameId === frameId && !("isDeleted" in el && el.isDeleted)
      );

      const offsetX = targetFrame.width + SLIDE_GAP;
      const offsetY = 0;

      const newFrameId = `frame_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const timestamp = Date.now();

      const duplicatedFrame: ExcalidrawElement = {
        ...targetFrame,
        id: newFrameId,
        x: targetFrame.x + offsetX,
        y: targetFrame.y + offsetY,
        name: targetFrame.name ? `${targetFrame.name} (Copy)` : `Slide (Copy)`,
        version: targetFrame.version + 1,
        versionNonce: Math.floor(Math.random() * 1000000),
        updated: timestamp,
        customData: {
          ...(targetFrame.customData || {}),
          createdAt: timestamp,
        },
      } as ExcalidrawElement;

      const duplicatedChildren: ExcalidrawElement[] = childElements.map((child) => ({
        ...child,
        id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        x: child.x + offsetX,
        y: child.y + offsetY,
        frameId: newFrameId,
        version: child.version + 1,
        versionNonce: Math.floor(Math.random() * 1000000),
        updated: timestamp,
      })) as ExcalidrawElement[];

      const newElements = [...elements, duplicatedFrame, ...duplicatedChildren];

      excalidrawAPI.updateScene({
        elements: newElements,
      });

      const existingOrder = customSlideOrder.length > 0
        ? [...customSlideOrder]
        : editorSlides.map((s) => s.frameId);

      const targetIdx = existingOrder.indexOf(frameId);
      if (targetIdx !== -1) {
        existingOrder.splice(targetIdx + 1, 0, newFrameId);
      } else {
        existingOrder.push(newFrameId);
      }

      setCustomSlideOrder(existingOrder);
      setActiveSlideId(newFrameId);

      saveToStorage(newElements, excalidrawAPI.getAppState(), excalidrawAPI.getFiles(), existingOrder);
      handleSelectSlide(newFrameId);
    },
    [excalidrawAPI, customSlideOrder, editorSlides, handleSelectSlide]
  );

  // Export current presentation project to an .excalidraw file
  const handleExportProject = useCallback(() => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();

    const jsonString = serializeAsJSON(elements, appState, files, "local");
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presentation-${new Date().toISOString().slice(0, 10)}.excalidraw`;
    a.click();
    URL.revokeObjectURL(url);
  }, [excalidrawAPI]);

  // Import an .excalidraw file
  const handleImportProject = useCallback(
    async (file: File) => {
      if (!excalidrawAPI) return;
      try {
        const data = await loadFromBlob(file, null, null);
        excalidrawAPI.updateScene({
          elements: data.elements,
          appState: data.appState,
        });
        if (data.files) {
          excalidrawAPI.addFiles(Object.values(data.files));
        }
        setCustomSlideOrder([]);
        updateSlidesIfChanged(data.elements, [], excalidrawAPI);
      } catch (err) {
        console.error("Failed to import file:", err);
        setToastMessage("Invalid or incompatible .excalidraw file.");
        setTimeout(() => setToastMessage(null), 3000);
      }
    },
    [excalidrawAPI, updateSlidesIfChanged]
  );

  // Implement PresentationExcalidrawAdapter boundary
  const adapter: PresentationExcalidrawAdapter | null = useMemo(() => {
    if (!excalidrawAPI) return null;

    return {
      getElements: () => excalidrawAPI.getSceneElements(),
      getAppState: () => excalidrawAPI.getAppState(),

      focusFrame: (frameId: string) => {
        const elements = excalidrawAPI.getSceneElements();
        const currentFrame = elements.find((el) => el.id === frameId);
        if (!currentFrame) return;

        const appState = excalidrawAPI.getAppState();

        const bounds = [
          currentFrame.x,
          currentFrame.y,
          currentFrame.x + currentFrame.width,
          currentFrame.y + currentFrame.height,
        ] as const;

        const fit = zoomToFitBounds({
          bounds,
          appState,
          fitToViewport: true,
          viewportZoomFactor: 0.90, // clean presentation fit
        });

        // Hide frame outline & frame title labels while strictly enabling element clipping
        excalidrawAPI.updateFrameRendering({
          enabled: true,
          outline: false,
          name: false,
          clip: true,
        });

        // Instant update without pan motion
        excalidrawAPI.updateScene({
          appState: {
            scrollX: fit.appState.scrollX,
            scrollY: fit.appState.scrollY,
            zoom: fit.appState.zoom,
          },
        });

        // Calculate screen viewport coordinates for exact boundary masking
        const zoom = fit.appState.zoom.value;
        const screenX = (currentFrame.x + fit.appState.scrollX) * zoom;
        const screenY = (currentFrame.y + fit.appState.scrollY) * zoom;
        const screenWidth = currentFrame.width * zoom;
        const screenHeight = currentFrame.height * zoom;

        setActiveSlideViewportBox({
          x: screenX,
          y: screenY,
          width: screenWidth,
          height: screenHeight,
        });
      },

      restoreViewport: (viewport: SavedViewport) => {
        // Restore standard frame rendering (show outlines & names in editor mode)
        excalidrawAPI.updateFrameRendering({
          enabled: true,
          outline: true,
          name: true,
          clip: true,
        });

        setActiveSlideViewportBox(null);

        excalidrawAPI.updateScene({
          appState: {
            scrollX: viewport.scrollX,
            scrollY: viewport.scrollY,
            zoom: {
              value: viewport.zoom.value,
            },
          },
        });
      },
    };
  }, [excalidrawAPI]);

  const handleEmptyPresentation = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  const {
    isPresenting,
    currentSlideIndex,
    currentSlide,
    totalSlides,
    isFullscreen,
    startPresentation,
    exitPresentation,
    nextSlide,
    previousSlide,
    toggleFullscreen,
  } = usePresentation({
    adapter,
    customSlideOrder,
    onEmptyPresentation: handleEmptyPresentation,
  });

  // Ensure frame outlines and names are restored if presentation exits
  useEffect(() => {
    if (!isPresenting && excalidrawAPI) {
      excalidrawAPI.updateFrameRendering({
        enabled: true,
        outline: true,
        name: true,
        clip: true,
      });
    }
  }, [isPresenting, excalidrawAPI]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (thumbnailTimeoutRef.current) clearTimeout(thumbnailTimeoutRef.current);
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, []);

  // Memoize UIOptions so Excalidraw does not re-render when not needed
  const uiOptions = useMemo(
    () => ({
      canvasActions: {
        changeViewBackgroundColor: !isPresenting,
        clearCanvas: !isPresenting,
        export: !isPresenting ? undefined : (false as const),
        loadScene: !isPresenting,
        saveToActiveFile: !isPresenting,
        toggleTheme: !isPresenting,
        saveAsImage: !isPresenting,
      },
    }),
    [isPresenting]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden select-none bg-white"
    >
      {/* Excalidraw Canvas Container */}
      <div className="relative w-full h-full">
        <Excalidraw
          excalidrawAPI={handleExcalidrawAPI}
          onChange={handleSceneChange}
          viewModeEnabled={isPresenting}
          zenModeEnabled={isPresenting}
          gridModeEnabled={false}
          UIOptions={uiOptions}
        />

        {/* Presentation Slide Viewport Mask: Pure white surrounding backdrop */}
        {isPresenting && activeSlideViewportBox && (
          <div
            className="absolute inset-0 pointer-events-none z-30"
            style={{
              boxShadow: `0 0 0 9999px #ffffff`,
              left: `${activeSlideViewportBox.x}px`,
              top: `${activeSlideViewportBox.y}px`,
              width: `${activeSlideViewportBox.width}px`,
              height: `${activeSlideViewportBox.height}px`,
              borderRadius: "2px",
            }}
          />
        )}

        {/* Draggable & Minimizable Slide Navigator with Import/Export & Storage status */}
        {!isPresenting && (
          <SlideNavigator
            slides={editorSlides}
            activeSlideId={activeSlideId}
            thumbnails={thumbnails}
            isSaved={isSaved}
            onSelectSlide={handleSelectSlide}
            onReorderSlides={handleReorderSlides}
            onDuplicateSlide={handleDuplicateSlide}
            onAdd16x9Slide={handleAdd16x9Slide}
            onExportProject={handleExportProject}
            onImportProject={handleImportProject}
          />
        )}

        {/* Floating Round Present Button (bottom right on canvas) */}
        {!isPresenting && (
          <button
            type="button"
            onClick={startPresentation}
            title="Start Presentation"
            aria-label="Start Presentation"
            className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-xl hover:shadow-2xl flex items-center justify-center transition-all duration-200 border border-indigo-400/30 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 group"
          >
            <Play className="w-6 h-6 fill-white ml-0.5 group-hover:scale-110 transition-transform" />
          </button>
        )}

        {/* Presentation Overlay */}
        {isPresenting && (
          <PresentationOverlay
            currentSlideIndex={currentSlideIndex}
            totalSlides={totalSlides}
            slideName={currentSlide?.name}
            isFullscreen={isFullscreen}
            onPrevious={previousSlide}
            onNext={nextSlide}
            onToggleFullscreen={() => toggleFullscreen(containerRef.current)}
            onExit={exitPresentation}
          />
        )}
      </div>

      {/* Notification Toast */}
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-zinc-900 text-white shadow-xl border border-zinc-700 text-sm">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
