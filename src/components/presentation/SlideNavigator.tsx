"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { PresentationSlide } from "@/lib/presentation/presentationTypes";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Monitor,
  Folder,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  ChevronUp,
  Download,
  Upload,
  GripVertical,
  ImageIcon,
  Command,
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

// Relative time formatting helper (e.g. "Just now", "2m ago", "1h ago", "26 Oct")
function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return "Just now";
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  // Drawer open / collapsed state (persisted)
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("presentslide_nav_open");
      if (stored !== null) return stored === "true";
    }
    return true;
  });

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("presentslide_nav_open", String(next));
      }
      return next;
    });
  }, []);

  // Section collapse state (like folder accordion in screenshot)
  const [isSectionOpen, setIsSectionOpen] = useState(true);

  // Search filter query
  const [searchQuery, setSearchQuery] = useState("");

  // More menu dropdown state
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as HTMLElement)) {
        setIsMoreMenuOpen(false);
      }
    };
    if (isMoreMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMoreMenuOpen]);

  // Filter slides by search query
  const filteredSlides = useMemo(() => {
    if (!searchQuery.trim()) return slides;
    const q = searchQuery.toLowerCase();
    return slides.filter((s) => s.name.toLowerCase().includes(q));
  }, [slides, searchQuery]);

  // Keyboard shortcuts: Ctrl+N / Cmd+N (new slide), Ctrl+D / Cmd+D (duplicate)
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

      if (
        (isModifier && e.key.toLowerCase() === "n") ||
        (isModifier && !e.shiftKey && e.key.toLowerCase() === "m")
      ) {
        e.preventDefault();
        onAdd16x9Slide();
        return;
      }

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
    e.target.value = "";
  };

  if (!isOpen) {
    return (
      <aside
        className="relative z-20 w-11 shrink-0 h-full bg-white border-r border-[#e0e0e0] flex flex-col items-center py-3 gap-2 select-none"
        aria-label="Collapsed Slides Rail"
      >
        <button
          type="button"
          onClick={toggleOpen}
          title="Expand slides sidebar"
          aria-label="Expand slides sidebar"
          className="group w-8 h-8 rounded-[8px] flex items-center justify-center text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6] transition-colors"
        >
          <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.6} />
        </button>
        <button
          type="button"
          onClick={onAdd16x9Slide}
          title="Add new 16:9 slide (Ctrl+N / ⌘N)"
          aria-label="Add slide"
          className="group w-8 h-8 rounded-[8px] flex items-center justify-center text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6] transition-colors"
        >
          <Plus className="w-[18px] h-[18px]" strokeWidth={1.6} />
        </button>
      </aside>
    );
  }

  return (
    <>
      {/* Hidden File Input for Importing .excalidraw files */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".excalidraw,.json"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Slide Navigator Sidebar Drawer on the side of the canvas */}
      <aside
        className="relative z-20 w-72 shrink-0 h-full bg-white border-r border-[var(--eb-border)] flex flex-col font-sans select-none overflow-hidden"
        aria-label="Presentation Slide Navigator"
      >
        {/* Top App Header (Brand Logo, Name, Command icon, Collapse Toggle) */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#f3f4f6] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-[6px] bg-[#6965db] flex items-center justify-center text-white shadow-xs">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5"
              >
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                <path d="m8 17 4-4 4 4" />
              </svg>
            </div>
            <span
              className="text-[18px] font-bold tracking-tight text-[#111827]"
              style={{ fontFamily: "'Virgil', cursive, system-ui, sans-serif" }}
            >
              presentslide
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Keyboard shortcuts (Ctrl+N / Ctrl+P)"
              aria-label="Keyboard shortcuts"
              className="p-1.5 rounded-[6px] text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6] transition-colors"
            >
              <Command className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleOpen}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="p-1.5 rounded-[6px] text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6] transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-3.5 pt-3 pb-2 shrink-0">
          <div className="relative flex items-center w-full">
            <Search className="absolute left-3 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search names & contents"
              className="w-full h-[36px] pl-9 pr-3 rounded-[8px] bg-white border border-[var(--eb-border)] focus:border-[#6965db] focus:ring-2 focus:ring-[#6965db]/20 outline-none text-[#1b1b1f] text-[14px] placeholder-[#9ca3af] transition-all"
            />
          </div>
        </div>

        {/* Action Buttons Row ("+ New slide", Copy, More options) */}
        <div className="px-3.5 py-1.5 flex items-center gap-2 shrink-0">
          {/* Main Primary Button: "+ New slide" with color #6965db and border-radius 8px */}
          <button
            type="button"
            onClick={onAdd16x9Slide}
            title="Create new 16:9 slide (Ctrl+N / ⌘N)"
            className="eb-btn eb-btn-primary flex-1 !bg-[#6965db] hover:!bg-[#5b57d1] active:!bg-[#4a47b1] !text-white !border-[#6965db]"
            style={{
              backgroundColor: "#6965db",
              borderColor: "#6965db",
              color: "#ffffff",
            }}
          >
            <Plus className="w-4 h-4 stroke-[2.5] text-white" />
            <span className="text-white">New slide</span>
          </button>

          {/* Quick Duplicate / Copy Button with border-radius 8px */}
          <button
            type="button"
            onClick={() => {
              const targetSlideId = activeSlideId || (slides.length > 0 ? slides[0].frameId : null);
              if (targetSlideId) onDuplicateSlide(targetSlideId);
            }}
            disabled={slides.length === 0}
            title="Duplicate active slide (Ctrl+D / ⌘D)"
            aria-label="Duplicate active slide"
            className="eb-btn eb-btn-icon disabled:opacity-40"
          >
            <Copy className="w-4 h-4 text-[#495057]" />
          </button>

          {/* Settings / More Options Button with border-radius 8px */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              title="More project options"
              aria-label="More options"
              className="eb-btn eb-btn-icon"
            >
              <MoreHorizontal className="w-4 h-4 text-[#495057]" />
            </button>

            {isMoreMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-[8px] bg-white border border-[var(--eb-border)] shadow-xl py-1 z-40 text-[13px] text-[#1b1b1f]">
                {onExportProject && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onExportProject();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#f8f9fa] hover:text-[#6965db] transition-colors"
                  >
                    <Download className="w-4 h-4 text-[#6b7280]" />
                    <span>Export project</span>
                  </button>
                )}
                {onImportProject && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#f8f9fa] hover:text-[#6965db] transition-colors"
                  >
                    <Upload className="w-4 h-4 text-[#6b7280]" />
                    <span>Import project</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-[1px] bg-[#f0f0f0] my-2 shrink-0" />

        {/* Slides Section Header Accordion */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div
            onClick={() => setIsSectionOpen(!isSectionOpen)}
            className="px-3.5 py-1.5 flex items-center justify-between text-[14px] font-medium text-[#1b1b1f] hover:text-[#6965db] cursor-pointer shrink-0 select-none"
          >
            <div className="flex items-center gap-2">
              {isSectionOpen ? (
                <ChevronDown className="w-4 h-4 text-[#868e96]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#868e96]" />
              )}
              <Monitor className="w-4 h-4 text-[#495057]" />
              <span>Slides in order</span>
            </div>
            <span className="text-[13px] text-[#868e96]">
              {filteredSlides.length}
            </span>
          </div>

          {/* Slides List Scroll Area */}
          {isSectionOpen && (
            <div className="flex-1 overflow-y-auto px-2.5 py-1 space-y-1 excali-scrollbar">
              {filteredSlides.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#9ca3af] leading-relaxed flex flex-col items-center justify-center gap-2">
                  <Folder className="w-8 h-8 text-[#d1d5db] stroke-1" />
                  <span>
                    {searchQuery ? "No slides match your search" : "No presentation slides yet"}
                  </span>
                  {!searchQuery && (
                    <button
                      type="button"
                      onClick={onAdd16x9Slide}
                      className="mt-1 px-3 py-1.5 rounded-[8px] bg-[#f3f4f6] hover:bg-[#e5e7eb] text-[#374151] text-xs font-medium transition-colors"
                    >
                      + Add first slide
                    </button>
                  )}
                </div>
              ) : (
                filteredSlides.map((slide, idx) => {
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
                      className={`group relative flex items-center gap-3 p-2 rounded-[8px] cursor-pointer transition-all duration-150 select-none ${
                        isActive
                          ? "bg-[#e3e2fe] text-[#2b2a33]"
                          : "hover:bg-[#f8f9fa] text-[#1b1b1f]"
                      } ${isDragging ? "opacity-30 scale-95" : "opacity-100"}`}
                    >
                      {/* Left: 16:9 Thumbnail Preview (matches screenshot card thumbnail) */}
                      <div className="relative w-[54px] h-[34px] shrink-0 rounded-[6px] overflow-hidden bg-white border border-[var(--eb-border)] flex items-center justify-center">
                        {thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumbUrl}
                            alt={slide.name}
                            className="w-full h-full object-contain pointer-events-none"
                            loading="lazy"
                          />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-[#adb5bd]" />
                        )}
                      </div>

                      {/* Middle: Title & Relative Time */}
                      <div className="flex-1 min-w-0 pr-1">
                        <p
                          className={`text-[14px] truncate leading-tight ${
                            isActive ? "font-medium text-[#2b2a33]" : "font-normal text-[#1b1b1f]"
                          }`}
                        >
                          {slide.name}
                        </p>
                        <p
                          className={`text-[12px] truncate mt-0.5 ${
                            isActive ? "text-[#6965db]" : "text-[#868e96]"
                          }`}
                        >
                          {formatTimeAgo(slide.updated)}
                        </p>
                      </div>

                      {/* Right: Drag Grip & Reorder Controls on Hover */}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveSlide(idx, idx - 1);
                          }}
                          title="Move up in order"
                          aria-label="Move up"
                          className="p-1 rounded-[4px] text-[#9ca3af] hover:text-[#111827] hover:bg-[#e5e7eb] disabled:opacity-20 transition-colors"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === slides.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveSlide(idx, idx + 1);
                          }}
                          title="Move down in order"
                          aria-label="Move down"
                          className="p-1 rounded-[4px] text-[#9ca3af] hover:text-[#111827] hover:bg-[#e5e7eb] disabled:opacity-20 transition-colors"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <div
                          className="cursor-grab active:cursor-grabbing p-1 text-[#9ca3af] hover:text-[#111827]"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Bottom Status Footer (matches "Saved" in screenshot) */}
        <div className="px-4 py-2.5 border-t border-[#f0f0f0] shrink-0 flex items-center justify-end">
          <span className="text-[13px] text-[#868e96]">
            {isSaved ? "Saved" : "Saving..."}
          </span>
        </div>
      </aside>
    </>
  );
}
