# Antigravity ↔ Claude Code: QA-Developer Coordination Hub

Welcome! This workspace file coordinates tasks between **Antigravity** (QA Tester & Organizer, running inside the IDE) and **Claude Code** (Software Developer, running in the terminal CLI). 

---

## 🤝 Roles & Workflow

1. **Antigravity (IDE Tester)**: Analyzes the codebase, identifies bugs/gaps, drafts implementation specifications, runs verification pipelines (lint, test), and marks tasks as verified.
2. **Claude Code (Terminal Developer)**: Implements the requested changes in the code, creates/modifies files, updates progress in this document, and leaves implementation notes.

### Lifecycle of a Task:
- `[ ] TODO` -> Initial state set by Antigravity.
- `[/] IN PROGRESS` -> Mark when Claude Code begins working on the item.
- `[x] FIXED (Pending Verification)` -> Mark when Claude Code completes implementation.
- `[V] VERIFIED` -> Set by Antigravity after verifying the fix.

---

## 📋 Active Tasks & Implementation Specs

### Task 1: Migrate Toolbar Popovers to Centered Overlay Dialogs
- **Problem**: Table insertion, Image uploading, and YouTube embeds use Fluent UI `Popover`s which overlap, clip on small screens, and dismiss easily.
- **Specification**: Refactor dialogues to use Fluent UI v9 `Dialog`, `DialogSurface`, `DialogBody`, `DialogTitle`, and `DialogActions` so they display as centered overlay modals with a shaded background scrim.
- **Files to Modify**:
  - [src/Plugins/ImagePlugin.tsx](file:///c:/Users/CT_USER/Desktop/lexical-rich-editor/src/Plugins/ImagePlugin.tsx)
  - [src/Plugins/Youtube.tsx](file:///c:/Users/CT_USER/Desktop/lexical-rich-editor/src/Plugins/Youtube.tsx)
  - [src/Plugins/Table.tsx](file:///c:/Users/CT_USER/Desktop/lexical-rich-editor/src/Plugins/Table.tsx)
- **Status**: `[V] VERIFIED`

---

### Task 2: Create a Unified "+ Insert" Dropdown & Implement Responsive Toolbar
- **Problem**: Toolbar controls wrap onto multiple rows on narrower viewports, and having separate buttons for Table, YouTube, Image, and Inline Image clutters the menu bar.
- **Specification**:
  - Combine media insertion actions under a single "+ Insert" menu button using Fluent UI `Menu` components.
  - Implement dynamic overflow inside the toolbar container (using Fluent UI's responsive `Overflow` or standard Flex CSS wrapping prevention) so excess options move into a `...` dropdown list.
- **Files to Modify**:
  - [src/Plugins/ToolBar.tsx](file:///c:/Users/CT_USER/Desktop/lexical-rich-editor/src/Plugins/ToolBar.tsx)
- **Status**: `[V] VERIFIED`

---

### Task 3: Add Input Constraints/Validation on Table Creation
- **Problem**: Table insertion allows entering an arbitrary number of rows and columns (e.g. 500x500), which freezes/crashes the browser.
- **Specification**:
  - Enforce a maximum limit of `50` rows and `50` columns.
  - Display inline error validation messages in the dialog when exceeding this limit.
- **Files to Modify**:
  - [src/Plugins/Table.tsx](file:///c:/Users/CT_USER/Desktop/lexical-rich-editor/src/Plugins/Table.tsx)
- **Status**: `[V] VERIFIED`

---

### Task 4 (Regression): Update Outdated E2E Color-Picker Tests
- **Problem**: The Playwright color-picker test suite (`tests/color-picker.spec.ts`) fails. It assumes an older color picker architecture (explicit "Apply" and "Close" buttons), but the picker was recently refactored to pointer-capture live commits.
- **Specification**:
  - Refactor `tests/color-picker.spec.ts` to assert that colors are applied live on preset selection or SV/hue slider inputs, rather than waiting for an "Apply" button.
  - Remove assertions expecting an `Apply` or `Close` button to be clicked.
- **Files to Modify**:
  - [tests/color-picker.spec.ts](file:///c:/Users/CT_USER/Desktop/lexical-rich-editor/tests/color-picker.spec.ts)
- **Status**: `[x] FIXED (Pending Verification)`

---

### Task 5 (New): Add `data-testid` Attributes to Color Picker Controls
- **Problem**: The Playwright tests need stable selectors for the Saturation-Value (SV) box and Hue bar in the color picker. The redesigned component uses inline styles and no CSS class names, so test selectors break.
- **Specification**:
  - Add `data-testid="color-sv-box"` to the SV canvas/interaction area.
  - Add `data-testid="color-hue-bar"` to the Hue slider element.
  - These attributes should be added as passthrough HTML attributes and should not affect styling.
- **Files to Modify**:
  - [src/Nodes/ColorPickerComponent.tsx](file:///c:/Users/CT_USER/Desktop/lexical-rich-editor/src/Nodes/ColorPickerComponent.tsx)
- **Status**: `[x] FIXED (Pending Verification)`

---

### Task 6 (New): Fix InsertLink URL Validation Bug
- **Problem**: The `InsertLink` plugin (`InsertLink.tsx`) has a broken URL auto-prefix logic that creates double-prefixed URLs (e.g., `https://ftp://...`) and mishandles fragments (`#`), relative paths (`/path`), and `mailto:` links.
- **Specification**:
  - Replace line 34's current check `link.startsWith('http') ? link : \`https://\${link}\`` with a regex guard:
    ```ts
    const href = /^https?:\/\/|^mailto:|^tel:|^#|^\//.test(link.trim())
      ? link.trim()
      : `https://${link.trim()}`;
    ```
  - Add Fluent UI `Field` inline `validationMessage` if the URL input appears structurally invalid (e.g., contains spaces or is a bare word without `.`).
- **Files to Modify**:
  - [src/Plugins/InsertLink.tsx](file:///c:/Users/CT_USER/Desktop/lexical-rich-editor/src/Plugins/InsertLink.tsx)
- **Status**: `[x] FIXED (Pending Verification)`

---

### Task 7 (New): Convert InsertLink Popover to Dialog (Consistency)
- **Problem**: After Task 1, all other media insert dialogs use `Dialog` modals, but `InsertLink` still uses a `Popover` anchored to the toolbar button. This is inconsistent and can clip or dismiss unexpectedly on scroll.
- **Specification**:
  - Refactor `InsertLink.tsx` to replace `Popover`/`PopoverTrigger`/`PopoverSurface` with `Dialog`/`DialogSurface`/`DialogBody`/`DialogContent`/`DialogActions` — same pattern as Task 1 dialogs.
  - The trigger button should remain as-is (LinkAddRegular icon), but open the centered dialog rather than a popover.
- **Files to Modify**:
  - [src/Plugins/InsertLink.tsx](file:///c:/Users/CT_USER/Desktop/lexical-rich-editor/src/Plugins/InsertLink.tsx)
- **Status**: `[x] FIXED (Pending Verification)`

---

### Task 8 (New): Wire Mock `suggestFn` & `spellCheckFn` in Demo App
- **Problem**: The demo app advertises AI Autocomplete and Spell Check as flagship features, but neither `suggestFn` nor `spellCheckFn` is passed to `ContentEditorComponent` in `App.tsx`. Users cannot experience these features from the browser demo.
- **Specification**:
  - In `example/src/App.tsx`, add a mock `suggestFn` that returns a simulated suggestion after a 300ms delay when text is present.
  - Add a mock `spellCheckFn` that returns at least one demo spelling issue so the underline and suggestion popover can be exercised.
  - Label these clearly as "Demo / Mock" in a UI comment so users know they need to provide their own API endpoint in production.
- **Files to Modify**:
  - [example/src/App.tsx](file:///c:/Users/CT_USER/Desktop/lexical-rich-editor/example/src/App.tsx)
- **Status**: `[ ] TODO`

---

### Task 9 (New): Remove Deprecated Props from Public API
- **Problem**: Two props are marked `@deprecated` in JSDoc but remain in the public `ContentEditorProps` type, polluting the API surface:
  - `topPlaceholderMargin` — documented as "Not used by the component".
  - `clearEditorMode` — documented as "currently not wired in the UI".
- **Specification**:
  - Remove both props from `ContentEditorProps` in `src/ContentEditorComponent.types.ts`.
  - Remove any corresponding references in `ContentEditorComponent.tsx` if they exist (likely no-ops).
  - If these were ever externally documented, add a CHANGELOG entry noting the breaking removal.
- **Files to Modify**:
  - [src/ContentEditorComponent.types.ts](file:///c:/Users/CT_USER/Desktop/lexical-rich-editor/src/ContentEditorComponent.types.ts)
  - [src/ContentEditorComponent.tsx](file:///c:/Users/CT_USER/Desktop/lexical-rich-editor/src/ContentEditorComponent.tsx)
- **Status**: `[ ] TODO`

---

## 🛠️ Verification & Pipeline Commands

When Claude Code marks a task as `[x] FIXED`, Antigravity will run the following commands to check correctness:

1. **Static Type Checking**:
   ```bash
   corepack yarn lint
   ```
2. **Build Verification**:
   ```bash
   corepack yarn build
   ```
3. **End-to-End Tests**:
   ```bash
   corepack yarn test:e2e
   ```

---

## 💬 Developer Notes (Claude Code Write-In)

*Claude Code, please leave notes or design questions in this section when you work on tasks:*

### Tasks 1, 2, 4 — Implementation Notes (2026-07-02)

**Task 1 (Popover → Dialog):** All four plugins (ImagePlugin, Youtube, Table, InlineImage) were converted from Fluent UI `Popover`/`PopoverSurface`/`PopoverTrigger` to `Dialog`/`DialogSurface`/`DialogBody`/`DialogTitle`/`DialogContent`/`DialogActions`. Each plugin was refactored to support two modes:
- **Uncontrolled** (no `open`/`onClose` props): renders its own trigger button that opens the dialog internally — preserves backward-compatible standalone token usage (`'Table'`, `'Image'`, etc.).
- **Controlled** (`open: boolean`, `onClose: () => void` props): no trigger button rendered; caller controls open state — used by the new `'Insert'` menu token (Task 2).

**Task 2 (Unified Insert Menu):** Added a new `'Insert'` toolbar token to `ToolBar.tsx` and `ALLOWED_TOKENS`. It renders a Fluent UI `Menu` with four items (Table, Image, Inline Image, YouTube). Clicking an item sets `activeInsertDialog` state in `ToolBarPlugins`, which opens the corresponding controlled dialog. `getToolbarGroupsByLevel` in `editorLevel.ts` was updated: Standard and Pro levels now use `['Insert', '|']` instead of separate `['Link', 'Table', '|']` and `['Image', 'Youtube', 'InlineImage', '|']` groups. The individual tokens (`'Table'`, `'Image'`, `'Youtube'`, `'InlineImage'`) remain in `ALLOWED_TOKENS` for consumers who configure custom toolbar groups.

**Task 3 (Table Validation):** `TableItemPlugin` now enforces a `MAX_ROWS = 50` / `MAX_COLS = 50` constant. Inline error messages are shown via Fluent UI `Field` `validationMessage`/`validationState` props. The Add button is disabled while any validation error is present. Values exceeding the limit are rejected server-side in `onAddTable` as a safety backstop.

**Build:** `tsc --noEmit` and `tsup` both pass with exit 0. The MarkdownShortcutPlugin task was intentionally skipped and removed per user instruction.

### Tasks 4, 5, 6, 7 — Implementation Notes (2026-07-03)

**Task 5 (data-testid on color picker controls):** Added `data-testid="color-sv-box"` and `data-testid="color-hue-bar"` as passthrough attributes on the existing SV canvas (`.aoLexSV`) and hue slider (`.aoLexHue`) `div`s in `ColorPickerComponent.tsx`. Existing class names/styles were left untouched — purely additive.

**Task 4 (Color-picker E2E tests):** Rewrote `tests/color-picker.spec.ts` to stop clicking "Apply"/"Close" — the picker already commits every preset click, hex-input blur, and SV/hue drag live via `onChange` (see the fix note already in the spec file header). Assertions now poll the computed style (`expect.poll(...)`) immediately after the triggering interaction instead of gating on an Apply click, since removing that extra click also removes the incidental render/microtask flush it used to provide — polling makes the wait explicit instead of relying on that side effect. The picker is now closed by toggling its own trigger button (`closePicker`) rather than a dedicated Close button. The drag test now targets the new `color-sv-box` test id from Task 5 instead of the `.aoLexSV` class selector. All 10 tests pass locally (`corepack yarn test:e2e tests/color-picker.spec.ts`).

**Task 6 (InsertLink URL validation):** In `src/Plugins/InsertLink.tsx`, replaced the old `link.startsWith('http') ? link : \`https://${link}\`` check (which double-prefixed already-schemed URLs) with the specified `VERBATIM_LINK_RE = /^https?:\/\/|^mailto:|^tel:|^#|^\//i` guard, so `http(s)://`, `mailto:`, `tel:`, in-page `#fragments`, and root-relative `/paths` are inserted verbatim while bare hosts get `https://` prefixed. Added `getLinkValidationMessage()` which flags whitespace-containing input or a bare word with no `.` and no recognized scheme/path prefix; wired into the Link `Field`'s `validationState`/`validationMessage` (live, on every keystroke) and into the Add button's `disabled` condition so an invalid URL can't be submitted.

**Task 7 (InsertLink Popover → Dialog):** Converted `InsertLinkPlugin` from `Popover`/`PopoverTrigger`/`PopoverSurface` to `Dialog`/`DialogSurface`/`DialogBody`/`DialogTitle`/`DialogContent`/`DialogActions`, following the same controlled/uncontrolled dual-mode pattern used for the Task 1 plugins (`open`/`onClose` props optional — omitted, it manages its own open state and renders its own trigger button, which is how `ToolBar.tsx` currently uses it via the `'Link'` token). The trigger button (`LinkAddRegular` icon, title "Add link") is unchanged. Enter-to-submit on the Link input was preserved (now also blocked while `linkError` is set).

**Verification:** `corepack yarn lint` (tsc --noEmit) and `corepack yarn build` (tsup) both pass with exit 0. No other spec files reference `InsertLink`, so no other E2E tests were affected.
