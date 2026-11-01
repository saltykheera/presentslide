"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { PresentationSlide } from "@/lib/presentation/presentationTypes";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
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

  // Position state (draggable modal)
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 16,
    y: 16,
  });

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
      className={`fixed z-30 select-none transition-shadow ${
        isMinimized ? "w-auto" : "w-64 max-h-[calc(100vh-2rem)]"
      }`}
      aria-label="Slides Modal"
    >
      <div className="flex flex-col rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
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
          className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50/80 dark:bg-zinc-800/60 cursor-move"
          title="Drag modal header to move around canvas"
        >
          <div className="flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5 text-zinc-400" />
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="font-semibold text-xs tracking-wider uppercase text-zinc-700 dark:text-zinc-200">
              Slides ({slides.length})
            </span>
            {isSaved && (
              <span
                className="flex items-center text-[10px] text-emerald-600 dark:text-emerald-400 gap-0.5 ml-1"
                title="Auto-saved to browser storage"
              >
                <Check className="w-3 h-3" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            {/* Add 16:9 Slide Button */}
            <button
              type="button"
              onClick={onAdd16x9Slide}
              title="Add 16:9 Presentation Frame (Ctrl+M / ⌘M)"
              aria-label="Add 16:9 Presentation Frame"
              className="p-1 rounded-md text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
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
                className="p-1 rounded-md text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-30"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Export File Button */}
            {!isMinimized && onExportProject && (
              <button
                type="button"
                onClick={onExportProject}
                title="Export presentation project (.excalidraw)"
                aria-label="Export project"
                className="p-1 rounded-md text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Import File Button */}
            {!isMinimized && onImportProject && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Import presentation project (.excalidraw)"
                aria-label="Import project"
                className="p-1 rounded-md text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Minimize / Expand Toggle */}
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? "Expand Modal" : "Minimize Modal"}
              aria-label={isMinimized ? "Expand Modal" : "Minimize Modal"}
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {isMinimized ? (
                <Maximize2 className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Modal Body / Slide List */}
        {!isMinimized && (
          <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[70vh]">
            {slides.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-400 leading-relaxed flex flex-col items-center gap-2">
                <span>No frames yet.</span>
                <button
                  type="button"
                  onClick={onAdd16x9Slide}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm transition-colors"
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
                      className={`group relative flex flex-col p-2 rounded-xl cursor-pointer border transition-all select-none ${
                        isActive
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-400/80 dark:border-indigo-500/80 shadow-sm"
                          : "bg-white/70 dark:bg-zinc-800/50 border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80"
                      } ${isDragging ? "opacity-30 scale-95" : "opacity-100"}`}
                    >
                      {/* Top Bar inside card */}
                      <div className="flex items-center gap-2 w-full mb-1.5">
                        <div
                          className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 shrink-0"
                          title="Drag to reorder slide"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>

                        <span
                          className={`text-[10px] font-bold w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                            isActive
                              ? "bg-indigo-600 text-white"
                              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                          }`}
                        >
                          {idx + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs truncate ${
                              isActive
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
                            title="Duplicate slide (Ctrl+D)"
                            aria-label="Duplicate slide"
                            className="p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSlide(idx, idx - 1);
                            }}
                            title="Move up"
                            aria-label="Move up"
                            className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-20 text-zinc-500"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === slides.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSlide(idx, idx + 1);
                            }}
                            title="Move down"
                            aria-label="Move down"
                            className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-20 text-zinc-500"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Visual Thumbnail Preview */}
                      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center">
                        {thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumbUrl}
                            alt={slide.name}
                            className="w-full h-full object-contain pointer-events-none"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1 text-zinc-400">
                            <ImageIcon className="w-4 h-4 opacity-40" />
                            <span className="text-[9px] opacity-60">Canvas frame</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Bottom Add Slide Button in list */}
                <button
                  type="button"
                  onClick={onAdd16x9Slide}
                  className="w-full mt-2 py-2 px-3 border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add 16:9 Slide</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
