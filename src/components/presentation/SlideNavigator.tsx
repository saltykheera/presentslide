"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { PresentationSlide } from "@/lib/presentation/presentationTypes";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Maximize2,
  Copy,
  Plus,
  Image as ImageIcon,
  Download,
  Upload,
  Check,
  LayoutGrid,
  Columns3,
  Dock,
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
  // - Ctrl+N or Cmd+N (also Ctrl+M, Cmd+M): New Slide
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

      // New slide: Ctrl+N / Cmd+N (also Ctrl+M / Cmd+M)
      if (
        (isModifier && e.key.toLowerCase() === "n") ||
        (isModifier && !e.shiftKey && e.key.toLowerCase() === "m")
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
        boxShadow:
          "0px 0px 1px 0px rgba(0, 0, 0, 0.17), 0px 0px 3px 0px rgba(0, 0, 0, 0.08), 0px 7px 14px 0px rgba(0, 0, 0, 0.08)",
      }}
      className={`fixed z-30 select-none rounded-[10px] bg-[#ffffff] border border-[#e0e0e0] overflow-hidden transition-all duration-150 ${isMinimized
          ? "w-auto"
          : orientation === "horizontal"
            ? "w-[min(90vw,720px)] max-h-44"
            : "w-56 max-h-[calc(100vh-2.5rem)]"
        }`}
      aria-label="Slides Navigator"
    >
      <div className="flex flex-col h-full text-xs font-sans text-[#1b1b1f]">
        {/* Hidden File Input for Importing .excalidraw files */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".excalidraw,.json"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Clean Excalidraw-White Island Header */}
        <div
          onMouseDown={handleModalHeaderMouseDown}
          className="flex items-center justify-between px-2.5 py-2 border-b border-[#ececf4] shrink-0 bg-[#f9f9fb] cursor-grab active:cursor-grabbing"
          title="Drag header to position slides navigator"
        >
          {/* Left badge & counter */}
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded-full bg-[#ececf4] text-[10px] font-semibold text-[#495057]">
              {slides.length}
            </span>
            {isSaved && (
              <span
                className="flex items-center text-[10px] text-[#0fb884] gap-0.5"
                title="Saved to local storage"
              >
                <Check className="w-3 h-3" />
              </span>
            )}
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-0.5">
            {/* Orientation Toggle */}
            {!isMinimized && (
              <button
                type="button"
                onClick={toggleOrientation}
                title={
                  orientation === "vertical"
                    ? "Switch to horizontal filmstrip (bottom dock)"
                    : "Switch to vertical panel"
                }
                aria-label="Toggle layout orientation"
                className="p-1 rounded-[6px] text-[#495057] hover:bg-[#ececf4] hover:text-[#6965db] transition-colors"
              >
                {orientation === "vertical" ? (
                  <Columns3 className="w-3.5 h-3.5" />
                ) : (
                  <LayoutGrid className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {/* Quick dock to bottom button in horizontal mode */}
            {!isMinimized && orientation === "horizontal" && (
              <button
                type="button"
                onClick={dockToBottom}
                title="Dock to bottom center"
                aria-label="Dock to bottom"
                className="p-1 rounded-[6px] text-[#495057] hover:bg-[#ececf4] hover:text-[#6965db] transition-colors"
              >
                <Dock className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Add 16:9 Slide Button */}
            <button
              type="button"
              onClick={onAdd16x9Slide}
              title="Add 16:9 Slide (Ctrl+N / ⌘N)"
              aria-label="Add 16:9 Slide"
              className="p-1 rounded-[6px] text-[#495057] hover:bg-[#ececf4] hover:text-[#6965db] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
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
                className="p-1 rounded-[6px] text-[#495057] hover:bg-[#ececf4] hover:text-[#6965db] transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Export File Button */}
            {!isMinimized && onExportProject && (
              <button
                type="button"
                onClick={onExportProject}
                title="Export .excalidraw project"
                aria-label="Export project"
                className="p-1 rounded-[6px] text-[#495057] hover:bg-[#ececf4] hover:text-[#6965db] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Import File Button */}
            {!isMinimized && onImportProject && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Import .excalidraw project"
                aria-label="Import project"
                className="p-1 rounded-[6px] text-[#495057] hover:bg-[#ececf4] hover:text-[#6965db] transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="w-[1px] h-3 bg-[#e0e0e0] mx-0.5" />

            {/* Minimize / Expand Toggle */}
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? "Expand" : "Minimize"}
              aria-label={isMinimized ? "Expand" : "Minimize"}
              className="p-1 rounded-[6px] text-[#495057] hover:bg-[#ececf4] transition-colors"
            >
              {isMinimized ? (
                <Maximize2 className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Body Slide List in White Island theme */}
        {!isMinimized && (
          <div
            className={`flex-1 p-2 bg-[#ffffff] excali-scrollbar ${orientation === "horizontal"
                ? "flex flex-row items-center gap-2 overflow-x-auto overflow-y-hidden max-h-36 py-2"
                : "flex flex-col overflow-y-auto space-y-2 max-h-[68vh]"
              }`}
          >
            {slides.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-[#868e96] leading-normal flex flex-col items-center justify-center gap-2 w-full">
                <span>No frames on canvas yet.</span>
                <button
                  type="button"
                  onClick={onAdd16x9Slide}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#6965db] hover:bg-[#5753d0] active:bg-[#4a47b1] text-white text-[11px] font-medium shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create 16:9 Slide</span>
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
                      className={`group relative flex flex-col p-1.5 rounded-[8px] cursor-pointer border transition-all duration-150 select-none shrink-0 ${orientation === "horizontal" ? "w-32 h-28" : "w-full"
                        } ${isActive
                          ? "bg-[#e3e2fe] border-[#6965db] ring-1 ring-[#6965db]/50"
                          : "bg-[#f8f9fa] border-[#e9ecef] hover:bg-[#f1f3f5]"
                        } ${isDragging ? "opacity-30 scale-95" : "opacity-100"}`}
                    >
                      {/* Card Header (Drag handle, Index, Title, Actions) */}
                      <div className="flex items-center gap-1.5 w-full mb-1">
                        <div
                          className="cursor-grab active:cursor-grabbing text-[#adb5bd] hover:text-[#495057] shrink-0"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-3 h-3" />
                        </div>

                        <span
                          className={`text-[9px] font-bold w-3.5 h-3.5 rounded-[4px] flex items-center justify-center shrink-0 ${isActive
                              ? "bg-[#6965db] text-white"
                              : "bg-[#dee2e6] text-[#495057]"
                            }`}
                        >
                          {idx + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[10px] truncate ${isActive
                                ? "text-[#343a40] font-semibold"
                                : "text-[#495057] font-medium"
                              }`}
                          >
                            {slide.name}
                          </p>
                        </div>

                        {/* Slide Card Actions on Hover */}
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicateSlide(slide.frameId);
                            }}
                            title="Duplicate (Ctrl+D)"
                            aria-label="Duplicate slide"
                            className="p-0.5 rounded text-[#868e96] hover:text-[#6965db] hover:bg-[#e3e2fe] transition-colors"
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
                            className="p-0.5 rounded text-[#868e96] hover:text-[#212529] hover:bg-[#dee2e6] disabled:opacity-20 transition-colors"
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
                            className="p-0.5 rounded text-[#868e96] hover:text-[#212529] hover:bg-[#dee2e6] disabled:opacity-20 transition-colors"
                          >
                            {orientation === "horizontal" ? (
                              <ChevronRight className="w-2.5 h-2.5" />
                            ) : (
                              <ChevronDown className="w-2.5 h-2.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* 16:9 Thumbnail Canvas Box */}
                      <div className="relative w-full flex-1 min-h-0 aspect-video rounded-[6px] overflow-hidden bg-white border border-[#e9ecef] flex items-center justify-center">
                        {thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumbUrl}
                            alt={slide.name}
                            className="w-full h-full object-contain pointer-events-none"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-[#adb5bd] gap-0.5">
                            <ImageIcon className="w-3.5 h-3.5 opacity-50" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Excalidraw Styled Add Slide Card */}
                <button
                  type="button"
                  onClick={onAdd16x9Slide}
                  className={`border border-dashed border-[#ced4da] hover:border-[#6965db] rounded-[8px] text-[#495057] hover:text-[#6965db] hover:bg-[#f1f0ff] flex items-center justify-center transition-all shrink-0 ${orientation === "horizontal"
                      ? "w-24 h-28 flex-col gap-1 text-[10px]"
                      : "w-full py-2 px-2.5 gap-1.5 text-[11px]"
                    }`}
                  title="Add 16:9 Slide"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="font-medium">Add Slide</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
