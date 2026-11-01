import type { ComponentProps } from "react";
import type { Excalidraw } from "@excalidraw/excalidraw";

export type ExcalidrawComponentProps = ComponentProps<typeof Excalidraw>;
export type ExcalidrawImperativeAPI = Parameters<
  NonNullable<ExcalidrawComponentProps["excalidrawAPI"]>
>[0];
export type AppState = ReturnType<ExcalidrawImperativeAPI["getAppState"]>;
export type ExcalidrawElements = ReturnType<
  ExcalidrawImperativeAPI["getSceneElements"]
>;
export type ExcalidrawElement = ExcalidrawElements[number];
export type ExcalidrawFrameElement = Extract<
  ExcalidrawElement,
  { type: "frame" }
>;

export type ExportToCanvasParams = Parameters<
  typeof import("@excalidraw/excalidraw")["exportToCanvas"]
>[0];
export type ExportElements = ExportToCanvasParams["elements"];
export type ExportFrame = ExportToCanvasParams["exportingFrame"];

export interface PresentationSlide {
  frameId: string;
  name: string;
  index: number; // 0-based slide index
  x: number;
  y: number;
  width: number;
  height: number;
}

export type NormalizedZoomValue = AppState["zoom"]["value"];

export interface SavedViewport {
  scrollX: number;
  scrollY: number;
  zoom: {
    value: NormalizedZoomValue;
  };
}

export interface PresentationExcalidrawAdapter {
  getElements: () => readonly ExcalidrawElement[];
  getAppState: () => AppState;
  focusFrame: (frameId: string, animate?: boolean) => void;
  restoreViewport: (viewport: SavedViewport) => void;
}

export interface PresentationState {
  isPresenting: boolean;
  currentSlideIndex: number;
  slides: PresentationSlide[];
}
