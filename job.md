Build a **Presentation Mode for Excalidraw using the public `@excalidraw/excalidraw` npm package**.

## Objective

I want a standalone React/Next.js application that embeds Excalidraw and adds a presentation/slideshow system on top of it.

DO NOT:

- clone or modify the Excalidraw source repository
- patch `node_modules`
- modify Excalidraw internals
- bypass any Excalidraw+ functionality
- depend on private Excalidraw APIs

Use only functionality exposed by the public `@excalidraw/excalidraw` package and normal browser APIs.

---

# 1. First inspect the package API

Before implementing anything:

1. Inspect the installed version of `@excalidraw/excalidraw`.
2. Check its TypeScript types and public API.
3. Determine the correct supported APIs for:
   - obtaining scene elements
   - obtaining app state
   - receiving scene changes
   - updating the scene/app state
   - scrolling/zooming to content
   - working with frames
   - getting the Excalidraw API instance
4. Search for existing helpers such as:
   - `scrollToContent`
   - `updateScene`
   - `getSceneElements`
   - `getAppState`
   - `excalidrawAPI`

Do not assume API names from older versions.

Use the APIs actually exposed by the installed package.

---

# 2. Application architecture

Use:

- Next.js
- React
- TypeScript
- `@excalidraw/excalidraw`

The conceptual architecture should be:

```text
Next.js Application
        │
        ├── Application UI
        │
        │     └── Present button
        │
        ▼
<Excalidraw />
        │
        ▼
Excalidraw Public API
        │
        ├── Scene Elements
        ├── Frames
        ├── App State
        └── Viewport Controls
        │
        ▼
Presentation Controller
        │
        ├── Slide discovery
        ├── Slide ordering
        ├── Current slide
        ├── Navigation
        ├── Viewport movement
        └── State restoration
        │
        ▼
Presentation Overlay
        │
        ├── Previous
        ├── Slide counter
        ├── Next
        └── Exit
```

Keep presentation logic outside Excalidraw itself.

---

# 3. Frames are slides

Excalidraw frames should act as presentation slides.

Example canvas:

```text
┌─────────────┐

   FRAME 1

└─────────────┘


                    ┌─────────────┐

                       FRAME 2

                    └─────────────┘


┌─────────────┐

   FRAME 3

└─────────────┘
```

Presentation:

```text
Frame 1
   ↓
Frame 2
   ↓
Frame 3
```

Do NOT copy frame contents into another data structure.

The original Excalidraw scene remains the source of truth.

---

# 4. Detect slides

Get the current scene elements through the public Excalidraw API.

Identify frame elements using the correct type definitions provided by the installed package.

Conceptually:

```ts
const frames = elements.filter(
  element => element.type === "frame"
);
```

But use the package's actual types/type guards if available.

Create something like:

```ts
type PresentationSlide = {
    frameId: string;
    index: number;
};
```

Do not duplicate the actual frame contents.

---

# 5. Slide ordering

Create:

```ts
getPresentationFrames(elements)
```

Initially use a deterministic spatial ordering:

1. top to bottom
2. left to right

Take frame coordinates into account.

Keep ordering logic isolated so it can later be replaced with explicit user-defined slide ordering.

For example:

```text
Frame A       Frame B


Frame C       Frame D
```

should become:

```text
A → B → C → D
```

Add tests for this ordering.

---

# 6. Presentation Controller

Create a dedicated hook/controller such as:

```ts
usePresentation()
```

It should manage:

```ts
isPresenting
currentSlideIndex
slides

startPresentation()
exitPresentation()

nextSlide()
previousSlide()

firstSlide()
lastSlide()

goToSlide(index)
```

Do NOT unnecessarily put presentation state inside Excalidraw's AppState.

Presentation state belongs to our application.

---

# 7. Starting presentation

Add a button outside Excalidraw:

```text
Present
```

When clicked:

1. obtain current scene elements
2. find frames
3. determine slide order
4. save the current Excalidraw viewport state
5. set presentation mode to active
6. navigate to slide 1

If there are no frames:

show:

```text
Create at least one frame before starting a presentation.
```

Do not crash or enter an empty presentation state.

---

# 8. Save viewport

Before entering presentation mode, save the current viewport.

Use the installed package's actual public state/API.

Conceptually:

```ts
type SavedViewport = {
    scrollX: number;
    scrollY: number;
    zoom: number;
};
```

When presentation ends, restore this viewport.

The user should return to the canvas position they were at before clicking Present.

---

# 9. Navigate to frame

Implement:

```ts
goToSlide(index)
```

It should:

1. get the corresponding frame
2. verify the frame still exists
3. center it
4. zoom so the complete frame fits within the presentation viewport
5. preserve aspect ratio
6. leave a small margin

IMPORTANT:

First determine whether the Excalidraw package exposes something like:

```ts
scrollToContent(...)
```

or another public viewport API capable of fitting an element/frame into the viewport.

If it exists, USE IT.

Do not manually recreate Excalidraw's viewport mathematics unless the public API cannot accomplish the required behavior.

---

# 10. Presentation overlay

While presenting, render our own React overlay ABOVE the Excalidraw component.

Example:

```text
┌────────────────────────────────────────────┐
│                                            │
│                                            │
│              EXCALIDRAW FRAME              │
│                                            │
│                                            │
│                                            │
│       ←          2 / 8          →     ✕    │
└────────────────────────────────────────────┘
```

Controls:

- Previous
- slide number / total slides
- Next
- Exit

The overlay belongs to our application, not Excalidraw.

Use CSS `z-index` appropriately.

---

# 11. Hide editing UI

During presentation mode, the experience should look like a presentation rather than an editor.

Using only supported package configuration/props:

- hide unnecessary editing controls where possible
- disable editing interactions if supported
- avoid accidental modifications
- make the presentation occupy the available screen

DO NOT modify Excalidraw DOM internals using fragile selectors unless absolutely unavoidable.

Prefer documented package APIs and props.

If some Excalidraw UI cannot safely be hidden using public APIs, explain the limitation rather than implementing a brittle hack.

---

# 12. Keyboard navigation

While `isPresenting === true`:

NEXT:

```text
ArrowRight
ArrowDown
PageDown
Space
```

PREVIOUS:

```text
ArrowLeft
ArrowUp
PageUp
```

FIRST:

```text
Home
```

LAST:

```text
End
```

EXIT:

```text
Escape
```

Use application-level keyboard event handling.

Call `preventDefault()` where necessary.

Keyboard handling must only intercept these keys while presentation mode is active.

Normal Excalidraw keyboard behavior must remain unchanged outside presentation mode.

---

# 13. Fullscreen

Add fullscreen support using the standard browser Fullscreen API.

Conceptually:

```ts
container.requestFullscreen();
```

Presentation Mode and fullscreen MUST remain separate concepts.

Presentation should still work if:

- fullscreen permission is denied
- fullscreen isn't supported
- the user manually exits fullscreen
- browser restrictions prevent fullscreen

Do not automatically terminate presentation simply because fullscreen ends.

---

# 14. Mouse controls

Allow:

```text
Click right side → next

Click left side → previous
```

BUT clicks on presentation controls must not trigger slide navigation.

Use appropriate event propagation handling.

Do not interfere with Excalidraw when presentation mode is disabled.

---

# 15. Touch

Support:

```text
Swipe left → next slide

Swipe right → previous slide
```

Use a sensible minimum swipe distance to prevent accidental navigation.

Do not add a large gesture dependency just for this.

---

# 16. Presentation controls behavior

Controls should initially be visible.

After approximately 2–3 seconds without mouse movement:

```text
controls fade out
```

Moving the mouse:

```text
controls reappear
```

Keep transitions subtle.

Respect:

```css
@media (prefers-reduced-motion: reduce)
```

---

# 17. Frame transitions

When switching frames, use the smoothest behavior supported by the Excalidraw public API.

If Excalidraw's public viewport APIs support animated scrolling/zooming, use them.

Otherwise start with immediate transitions.

DO NOT implement complicated custom animation before the core presentation system works correctly.

Correctness is more important than animation.

---

# 18. Handle scene changes

Users may potentially modify/delete frames.

Presentation mode must never crash because a stored frame ID disappeared.

Before navigating:

```ts
findFrameById(frameId)
```

If it doesn't exist:

- refresh the slide list
- clamp the current slide index
- continue safely

If no frames remain:

exit presentation mode gracefully.

---

# 19. Exit presentation

When the user exits:

1. set `isPresenting = false`
2. clean up presentation keyboard listeners
3. clean up mouse timers
4. clean up touch listeners
5. exit fullscreen if our application entered it
6. restore Excalidraw editing UI
7. restore saved viewport
8. return control to the normal editor

Do not reload the Excalidraw component.

Do not destroy/recreate the scene.

---

# 20. Suggested project structure

Adapt this to the project's existing conventions:

```text
src/

  components/

    ExcalidrawEditor.tsx

    presentation/
      PresentationOverlay.tsx
      PresentationControls.tsx

  hooks/

    usePresentation.ts
    usePresentationKeyboard.ts
    usePresentationTouch.ts

  lib/

    presentation/
      getPresentationFrames.ts
      presentationNavigation.ts
      presentationTypes.ts
```

Avoid overengineering.

If fewer files produce a cleaner implementation, use fewer files.

---

# 21. API boundary

Create a clean boundary between our presentation system and Excalidraw.

For example:

```ts
interface PresentationExcalidrawAdapter {

    getElements(): readonly ExcalidrawElement[];

    getAppState(): AppState;

    focusFrame(frameId: string): void;

    restoreViewport(viewport: SavedViewport): void;

}
```

This exact interface is NOT mandatory.

The goal is simply to prevent presentation logic from becoming tightly coupled to random Excalidraw implementation details.

Use actual package types where possible.

---

# 22. TypeScript

Use strict TypeScript.

Avoid:

```ts
any
```

Use types exported by `@excalidraw/excalidraw` where appropriate.

If some internal Excalidraw type is intentionally not exported, do not import it through undocumented internal paths.

---

# 23. Persistence

The Excalidraw scene should remain compatible with normal Excalidraw serialization.

Do NOT modify frame elements just to support presentation mode.

Presentation-specific state should live outside the Excalidraw scene unless there is a strong reason otherwise.

For V1, slide order can be computed dynamically.

Later we may store metadata separately.

---

# 24. Testing

Add tests for the presentation logic.

At minimum test:

### Frame discovery

```text
scene with shapes only → 0 slides

scene with 3 frames → 3 slides
```

### Ordering

```text
frames spatially arranged → deterministic ordering
```

### Navigation

```text
next
previous
first
last
goToSlide
```

### Boundaries

```text
previous from first → remain first

next from last → remain last
```

### Scene changes

```text
current frame deleted → recover

all frames deleted → exit presentation
```

### Viewport

Verify presentation start stores viewport information and presentation exit restores it.

---

# 25. V1 scope

Do NOT initially implement:

- speaker notes
- presenter view
- remote controls
- multiplayer presentation sync
- slide transitions library
- PowerPoint export
- PDF generation
- custom slide themes
- recording
- animations inside frames

First build a robust:

```text
Excalidraw
     +
Frames
     +
Presentation Mode
```

system.

---

# 26. Future architecture

Design V1 so these features can later be added:

```text
Custom slide ordering

Slide overview
    □ □ □
    □ □ □

Speaker notes

Presenter timer

Laser pointer

"Follow presenter" collaboration

Slide transitions

Presentation links

PDF export

Presentation recording
```

Do not implement them now.

Just avoid architectural decisions that would make them unnecessarily difficult later.

---

# 27. Acceptance criteria

The implementation is complete when I can:

1. open the application
2. draw content in Excalidraw
3. create 3+ Excalidraw frames
4. click Present
5. see frame 1 fitted to the screen
6. press ArrowRight
7. see frame 2
8. press ArrowRight
9. see frame 3
10. press ArrowLeft
11. return to frame 2
12. use fullscreen
13. use mouse/touch navigation
14. press Escape
15. return to normal Excalidraw editing
16. return to approximately the viewport I had before presenting

Normal Excalidraw editing must continue working after presentation ends.

---

# 28. Implementation procedure

Do not just give me instructions.

Work directly on the project.

Follow this sequence:

1. Inspect the existing project.
2. Inspect `package.json`.
3. Install `@excalidraw/excalidraw` if necessary.
4. Inspect the installed package version and its public TypeScript API.
5. Determine the supported viewport/frame APIs.
6. Create the Excalidraw editor integration.
7. Implement frame discovery.
8. Implement ordering.
9. Implement presentation state/controller.
10. Implement viewport navigation.
11. Implement presentation overlay.
12. Implement keyboard navigation.
13. Implement fullscreen.
14. Implement mouse navigation.
15. Implement touch navigation.
16. Implement viewport restoration.
17. Handle frame deletion/scene changes.
18. Add tests.
19. Run tests.
20. Run TypeScript checking.
21. Run linting.
22. Fix all errors introduced by the implementation.

Do not stop after creating scaffolding.

Do not leave TODO placeholders for core functionality.

If an API I requested does not exist in the currently installed Excalidraw package, investigate the supported alternative and implement using that instead.

At the end, provide a concise report containing:

- package version used
- public Excalidraw APIs used
- files created
- files modified
- presentation architecture
- how frame ordering works
- keyboard controls
- fullscreen behavior
- tests executed and results
- limitations caused by the public Excalidraw API
- recommended next feature