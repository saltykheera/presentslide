"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { PresentationSlide } from "@/lib/presentation/presentationTypes";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Minus,
  Maximize2,
  Copy,
  Move,
  Plus,
  Image as ImageIcon,
  Download,
  Upload,
  Check,
  LayoutGrid,
  Columns3,
} from "lucide-react";

interface SlideNavigatorProps {
  slides: PresentationSlide[];
  activeSlideId?: string;
  thumbnails?: Record<string, string>;
  isSaved?: boolean;
  onSelectSlide: (frameId: string) => void;
  onReorderSlides: (reorderedSlideIds: string[]) => void;
  onDuplicateSlide: (frameId: string) => void;
  onAdd16x9Slide: () => void;
  onExportProject?: () => void;
  onImportProject?: (file: File) => void;
}

export function SlideNavigator({
  slides,
  activeSlideId,
  thumbnails = {},
  isSaved = true,
  onSelectSlide,
  onReorderSlides,
  onDuplicateSlide,
  onAdd16x9Slide,
  onExportProject,
  onImportProject,
}: SlideNavigatorProps) {
  // Minimization state
  const [isMinimized, setIsMinimized] = useState(false);

  // Orientation state: "vertical" (top-down) or "horizontal" (left-to-right / filmstrip)
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("excaliprint_slide_nav_orientation");
      if (stored === "horizontal" || stored === "vertical") return stored;
    }
    return "vertical";
  });

  const toggleOrientation = useCallback(() => {
    setOrientation((prev) => {
      const next = prev === "vertical" ? "horizontal" : "vertical";
      if (typeof window !== "undefined") {
        localStorage.setItem("excaliprint_slide_nav_orientation", next);
      }
      return next;
    });
  }, []);

  // Position state (draggable modal)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("excaliprint_slide_nav_pos");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch { }
      }
    }
    return { x: 16, y: 16 };
  });

  // Dock to bottom helper for horizontal view
  const dockToBottom = useCallback(() => {
    if (typeof window === "undefined") return;
    setOrientation("horizontal");
    localStorage.setItem("excaliprint_slide_nav_orientation", "horizontal");
    const bottomPos = {
      x: Math.max(16, (window.innerWidth - 640) / 2),
      y: Math.max(16, window.innerHeight - 130),
    };
    setPosition(bottomPos);
    localStorage.setItem("excaliprint_slide_nav_pos", JSON.stringify(bottomPos));
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDraggingModalRef = useRef(false);
  const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);

  // Handle modal dragging
  const handleModalHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;

    isDraggingModalRef.current = true;
    dragStartOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingModalRef.current) return;
      const nextX = Math.max(8, Math.min(window.innerWidth - 80, moveEvent.clientX - dragStartOffsetRef.current.x));
      const nextY = Math.max(8, Math.min(window.innerHeight - 80, moveEvent.clientY - dragStartOffsetRef.current.y));
      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      isDraggingModalRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setPosition((curr) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("excaliprint_slide_nav_pos", JSON.stringify(curr));
        }
        return curr;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Keyboard shortcuts:
  // - Ctrl+M or Cmd+M / Shift+Cmd+N: New Slide
  // - Ctrl+D or Cmd+D: Duplicate active slide
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isModifier = e.ctrlKey || e.metaKey;

      // New slide: Ctrl+M / Cmd+M (standard PowerPoint / Keynote) or Cmd+Shift+N / Ctrl+Shift+N
      if (
        (isModifier && !e.shiftKey && e.key.toLowerCase() === "m") ||
        (isModifier && e.shiftKey && e.key.toLowerCase() === "n")
      ) {
        e.preventDefault();
        onAdd16x9Slide();
        return;
      }

      // Duplicate slide: Ctrl+D / Cmd+D
      if (isModifier && !e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const targetSlideId = activeSlideId || (slides.length > 0 ? slides[0].frameId : null);
        if (targetSlideId) {
          onDuplicateSlide(targetSlideId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSlideId, slides, onDuplicateSlide, onAdd16x9Slide]);

  const moveSlide = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= slides.length) return;
      const newSlides = [...slides];
      const [moved] = newSlides.splice(fromIndex, 1);
      newSlides.splice(toIndex, 0, moved);
      onReorderSlides(newSlides.map((s) => s.frameId));
    },
    [slides, onReorderSlides]
  );

  const handleSlideDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSlideIndex(index);
    e.dataTransfer.setData("text/plain", `${index}`);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleSlideDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleSlideDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedSlideIndex === null || draggedSlideIndex === targetIndex) {
      setDraggedSlideIndex(null);
      return;
    }
    moveSlide(draggedSlideIndex, targetIndex);
    setDraggedSlideIndex(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0] && onImportProject) {
      onImportProject(files[0]);
    }
    // reset input
    e.target.value = "";
  };

  return (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      className={`fixed z-30 select-none transition-shadow ${isMinimized
          ? "w-auto"
          : orientation === "horizontal"
              ? "w-[min(88vw,700px)] max-h-40"
              : "w-52 max-h-[calc(100vh-3rem)]"
        }`}
      aria-label="Slides Modal"
    >
        <div className="flex flex-col rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800 shadow-xl overflow-hidden text-xs">
          {/* Hidden File Input for Importing .excalidraw files */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".excalidraw,.json"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Modal Header */}
          <div
            onMouseDown={handleModalHeaderMouseDown}
            className="flex items-center justify-between px-2.5 py-1.5 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50/90 dark:bg-zinc-800/80 cursor-move"
            title="Drag modal header to move around canvas"
          >
            <div className="flex items-center gap-1.5">
                <Move className="w-3 h-3 text-zinc-400" />
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="font-semibold text-[11px] tracking-wide uppercase text-zinc-700 dark:text-zinc-200">
                  Slides ({slides.length})
                </span>
                {isSaved && (
                  <span
                    className="flex items-center text-[9px] text-emerald-600 dark:text-emerald-400 gap-0.5"
                    title="Auto-saved"
                  >
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
            </div>

            <div className="flex items-center gap-0.5">
              {/* Orientation Toggle (Horizontal Filmstrip vs Vertical Column) */}
              {!isMinimized && (
                <button
                  type="button"
                  onClick={toggleOrientation}
                  title={
                    orientation === "vertical"
                        ? "Horizontal filmstrip"
                        : "Vertical list"
                  }
                  aria-label="Toggle slide orientation"
                  className="p-1 rounded text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {orientation === "vertical" ? (
                  <Columns3 className="w-3 h-3" />
                  ) : (
                  <LayoutGrid className="w-3 h-3" />
                  )}
                </button>
              )}

              {/* Quick dock to bottom button in horizontal mode */}
              {!isMinimized && orientation === "horizontal" && (
                <button
                  type="button"
                  onClick={dockToBottom}
                  title="Snap to bottom"
                  aria-label="Snap to bottom"
                  className="px-1 py-0.5 rounded text-[9px] font-medium text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Dock
                </button>
              )}

              {/* Add 16:9 Slide Button */}
              <button
                type="button"
                onClick={onAdd16x9Slide}
                title="Add 16:9 Frame (Ctrl+M / ⌘M)"
                aria-label="Add 16:9 Presentation Frame"
                className="p-1 rounded text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>

              {/* Duplicate button for active slide */}
              {!isMinimized && (
                <button
                  type="button"
                  onClick={() => {
                    const targetSlideId = activeSlideId || (slides.length > 0 ? slides[0].frameId : null);
                    if (targetSlideId) onDuplicateSlide(targetSlideId);
                  }}
                  disabled={slides.length === 0}
                  title="Duplicate slide (Ctrl+D / ⌘D)"
                  aria-label="Duplicate slide"
                  className="p-1 rounded text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-30"
                >
                  <Copy className="w-3 h-3" />
                </button>
              )}

              {/* Export File Button */}
              {!isMinimized && onExportProject && (
                <button
                  type="button"
                  onClick={onExportProject}
                  title="Export (.excalidraw)"
                  aria-label="Export project"
                  className="p-1 rounded text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <Download className="w-3 h-3" />
                </button>
              )}

              {/* Import File Button */}
              {!isMinimized && onImportProject && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Import (.excalidraw)"
                  aria-label="Import project"
                  className="p-1 rounded text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <Upload className="w-3 h-3" />
                </button>
              )}

              {/* Minimize / Expand Toggle */}
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Expand" : "Minimize"}
                aria-label={isMinimized ? "Expand" : "Minimize"}
                className="p-1 rounded text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {isMinimized ? (
                <Maximize2 className="w-3 h-3" />
                ) : (
                <Minus className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          {/* Modal Body / Slide List */}
          {!isMinimized && (
            <div
                      ? "flex flex-row items-center gap-1.5 overflow-x-auto overflow-y-hidden max-h-32 py-1.5"
                      : "flex flex-col overflow-y-auto space-y-1.5 max-h-[65vh]"
                  }`}
          >
            {slides.length === 0 ? (
              <div className="p-3 text-center text-[11px] text-zinc-400 leading-normal flex flex-col items-center justify-center gap-1.5 w-full">
                <span>No frames yet.</span>
                <button
                  type="button"
                  onClick={onAdd16x9Slide}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>New 16:9 Slide</span>
                </button>
              </div>
            ) : (
              <>
                {slides.map((slide, idx) => {
                  const isActive = activeSlideId === slide.frameId;
                  const isDragging = draggedSlideIndex === idx;
                  const thumbUrl = thumbnails[slide.frameId];

                  return (
                    <div
                      key={slide.frameId}
                      draggable
                      onDragStart={(e) => handleSlideDragStart(e, idx)}
                      onDragOver={handleSlideDragOver}
                      onDrop={(e) => handleSlideDrop(e, idx)}
                      onClick={() => onSelectSlide(slide.frameId)}
                      className={`group relative flex flex-col p-1 rounded-lg cursor-pointer border transition-all select-none shrink-0 ${orientation === "horizontal" ? "w-28 h-24" : "w-full"
            } ${isActive
                ? "bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-500 shadow-sm ring-1 ring-indigo-500/30"
                : "bg-white/80 dark:bg-zinc-800/60 border-zinc-200/90 dark:border-zinc-800 hover:bg-zinc-100/90 dark:hover:bg-zinc-800/90"
            } ${isDragging ? "opacity-30 scale-95" : "opacity-100"}`}
                    >
            {/* Compact Header inside slide card */}
            <div className="flex items-center gap-1 w-full mb-0.5">
              <div
                className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shrink-0"
                title="Drag to reorder"
              >
                <GripVertical className="w-2.5 h-2.5" />
              </div>

              <span
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                    }`}
                        >
                          {idx + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <p
                className = {`text-[10px] truncate ${isActive
                    ? "text-indigo-900 dark:text-indigo-200 font-semibold"
                    : "text-zinc-700 dark:text-zinc-300 font-medium"
                  }`}
                          >
              {slide.name}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateSlide(slide.frameId);
              }}
              title="Duplicate (Ctrl+D)"
              aria-label="Duplicate slide"
              className="p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300"
            >
              <Copy className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              disabled={idx === 0}
              onClick={(e) => {
                e.stopPropagation();
                moveSlide(idx, idx - 1);
              }}
              title={orientation === "horizontal" ? "Move left" : "Move up"}
              aria-label={orientation === "horizontal" ? "Move left" : "Move up"}
              className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-20 text-zinc-500"
            >
              {orientation === "horizontal" ? (
                <ChevronLeft className="w-2.5 h-2.5" />
              ) : (
                <ChevronUp className="w-2.5 h-2.5" />
              )}
            </button>
            <button
              type="button"
              disabled={idx === slides.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                moveSlide(idx, idx + 1);
              }}
              title={orientation === "horizontal" ? "Move right" : "Move down"}
              aria-label={orientation === "horizontal" ? "Move right" : "Move down"}
              className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-20 text-zinc-500"
            >
              {orientation === "horizontal" ? (
                <ChevronRight className="w-2.5 h-2.5" />
              ) : (
                <ChevronDown className="w-2.5 h-2.5" />
              )}
            </button>
          </div>
        </div>

        {/* Visual Thumbnail Preview */}
          <div className="relative w-full flex-1 min-h-0 aspect-video rounded overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-700/50 flex items-center justify-center">
            {thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbUrl}
                alt={slide.name}
                className="w-full h-full object-contain pointer-events-none"
                loading="lazy"
              />
            ) : (
                <div className="flex flex-col items-center justify-center text-zinc-400">
                  <ImageIcon className="w-3 h-3 opacity-40" />
                </div>
                        )}
              </div>
                    </div>
          );
                })}

          {/* Compact Add Slide Button */}
          <button
            type="button"
            onClick={onAdd16x9Slide}
                    ? "w-20 h-24 flex-col gap-1 text-[10px]"
                    : "w-full py-1.5 px-2 gap-1 text-[11px]"
                }`}
                  title="Add 16:9 Slide"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Slide</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
