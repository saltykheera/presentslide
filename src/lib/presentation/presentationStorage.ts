import type {
  ExcalidrawElement,
  AppState,
} from "./presentationTypes";

export const LOCAL_STORAGE_KEY_ELEMENTS = "excaliprint_scene_elements";
export const LOCAL_STORAGE_KEY_APP_STATE = "excaliprint_app_state";
export const LOCAL_STORAGE_KEY_FILES = "excaliprint_files";
export const LOCAL_STORAGE_KEY_SLIDE_ORDER = "excaliprint_slide_order";

export interface StoredPresentationProject {
  elements: readonly ExcalidrawElement[];
  appState?: Partial<AppState>;
  files?: Record<string, unknown>;
  slideOrder?: string[];
  version: number;
}

/**
 * Saves current canvas elements, appState, files and slide order to localStorage.
 */
export function saveToStorage(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: Record<string, unknown>,
  slideOrder: string[]
): boolean {
  if (typeof window === "undefined") return false;

  try {
    const data: StoredPresentationProject = {
      elements,
      appState: {
        theme: appState.theme,
        viewBackgroundColor: appState.viewBackgroundColor,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom,
      },
      files,
      slideOrder,
      version: 1,
    };

    localStorage.setItem(LOCAL_STORAGE_KEY_ELEMENTS, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn("Error saving to localStorage:", err);
    return false;
  }
}

/**
 * Loads stored canvas data and slide order from localStorage.
 */
export function loadFromStorage(): StoredPresentationProject | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_ELEMENTS);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredPresentationProject;
    return parsed;
  } catch (err) {
    console.warn("Error reading from localStorage:", err);
    return null;
  }
}

/**
 * Clears stored presentation project from localStorage.
 */
export function clearStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY_ELEMENTS);
  } catch (err) {
    console.warn("Error clearing localStorage:", err);
  }
}

