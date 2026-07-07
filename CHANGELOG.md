# Changelog

All notable changes to `@tarviks/lexical-rich-editor` are documented here.

## [1.3.10] — 2026-07-07

### Fixed
- Table cell action-menu dropdown drifted away from its cell when the page (or the editor's own scroll container) was scrolled after clicking into a cell. The button portals to `document.body` with `position: fixed`, positioned from a `getBoundingClientRect()` snapshot taken once whenever the selection changes — unlike `FloatLinkEditor`/`CharacterStylesPopupPlugin`, which both already reposition on `scroll`/`resize`, this plugin never recomputed that snapshot on those events. Added the same listeners the other floating surfaces use.

## [1.3.9] — 2026-07-07

### Fixed
- Table cell action-menu dropdown (row/column insert/delete) rendered invisibly when the editor was embedded in a host that uses its own Fluent `Modal`/`Panel` — it portaled to `document.body` at `z-index: 9999`, well below that host chrome's `Layer` (`z-index: 1000000`). Now portals into the same floating-UI host the other floating surfaces already use, at the same `z-index` convention.
- Clicking an image never selected it (no resize handles) when the editor was nested inside a host that renders through its own separate React root (e.g. a Modal) — React was cutting off native click propagation at the image decorator's own portal boundary before it could bubble to the editor root, where selection was handled. Now also handled via a JSX `onClick` inside the same portal.
- Deleting a selected image corrupted the caret afterward: the delete handler removed the node but always returned `false` ("not handled"), so Lexical's default delete handling ran again on a selection that now pointed at an already-removed node, leaving the caret anchored on an unrelated ancestor element instead of the emptied paragraph.
- An image that failed to load left its `Suspense` boundary suspended forever, rendering nothing at all — not even the existing broken-image fallback — because the thrown promise only ever resolved on `onload`, never `onerror`. Inline images additionally had no `onerror` handling at all.
- Uploaded/pasted images (inserted with a `data:image/...;base64,` src) turned into broken images after the editor was re-mounted elsewhere (e.g. a consumer switching between an inline compose panel and a "Full Panel" view) — every `value`/`setValue()` round-trip ran through the HTML sanitizer, which stripped `data:` URIs unconditionally, including legitimate image data on `img[src]`. Now allowlisted specifically for that case; `data:`/`javascript:` on links and any non-image `data:` URI are still blocked.
- Inline image "position: right" right-aligned any text already typed in the same paragraph as the image — positioning was implemented by calling `setFormat('right')` on the image's containing paragraph, which applies `text-align` to every child of that paragraph, not just the image. Replaced with real `float: left`/`float: right` CSS.
- Inserting a table shaded both the first row and first column gray by default (Lexical's `includeHeaders: true` marks both as headers), with no way to opt out from the Insert Table dialog. Now only the first row is shaded, the standard doc/spreadsheet convention.

### Changed
- Removed ~100 lines of dead CSS in `ColorPickerComponent.css` left over from an earlier refactor to inline styles (only `.aoColorCallout` was still referenced) — shrinks the library's built CSS output from 16.64 KB to 14.73 KB.

## [1.3.8] — 2026-07-06

### Fixed
- Clicking the URL text shown in the floating link editor's read-only popover didn't open the link — it looked like a normal `<a href target="_blank">`, but mousedown on it shifted focus/selection away from the editor, which triggered the popover's own reset logic and removed the anchor from the DOM before the browser's `click` event (and its native navigation) could fire. Added the same `onMouseDown` focus-preserving guard already used by the popover's Edit/Delete/Confirm/Cancel buttons, so a plain click on the URL now opens it in a new tab.

## [1.3.7] — 2026-07-06

### Fixed
- Editing an existing link's URL and confirming (✓ or Enter) silently did nothing: typing into the floating link editor's input moves DOM focus off the editor, which clears Lexical's internal selection, and `TOGGLE_LINK_COMMAND` is a no-op without one. The editor already tracked the selection at popover-open time (`lastSelection`) but never restored it before dispatching the command — it now does.
- The link edit input could show a stale or blank URL instead of the link actually under the cursor, because it was populated from a React state variable one render behind the freshly-read node URL.
- Clicking the toolbar's "Add Link" button (for brand-new links) didn't open the URL input: the button was missing the `onMouseDown` guard other floating-editor buttons use to keep focus on the editor, and this compounded with the floating editor resetting edit mode based on a link-detection flag from a different hook that hadn't caught up yet with the just-created link node.

## [1.3.6] — 2026-07-03

### Changed
- The floating link editor is now a Fluent `Popover` anchored to a virtual positioning target (the selection's bounding rect) instead of a hand-rolled `position: fixed` element with manual `getBoundingClientRect` math and its own DOM portal. Positioning is handled by `floating-ui` (via Fluent) and styling by Griffel (CSS-in-JS injected at runtime by `@fluentui/react-components`), so it no longer depends on `dist/index.css` being imported by the consuming app, and isn't affected by transformed/scrolling ancestor containers.

## [1.3.5] — 2026-07-03

### Changed
- `AoModal` (used by the Table, YouTube, Inline Image, and Image insert dialogs) replaced with Fluent's `Popover`/`PopoverSurface` instead of a custom fixed-position backdrop. Same motivation as above: Griffel-based styling and floating-ui positioning remove the dependency on this package's own CSS file and on manual containing-block handling. The insert-dialog trigger buttons are now passed to `AoModal` via a `trigger` prop instead of being rendered as a sibling.

## [1.3.4] — 2026-07-03

### Fixed
- Floating link editor, character-style popup, and insert-dialog overlays are now portaled directly to `document.body` instead of into the closest Fluent `Panel`/`Layer` ancestor. Nesting inside a host Panel inherited that Panel's own sizing/containing-block behavior, which could pin the popup/modal near the Panel's own chrome instead of the viewport or caret.

## [1.3.3] — 2026-07-03

### Fixed
- Floating link editor and character-style popup could render offset toward the wrong corner when embedded inside a host page's animated/sliding Panel (a CSS `transform` on an ancestor creates a new containing block for `position: fixed` descendants, so viewport-relative coordinates no longer land in the right place). Added `getFixedPositionOrigin` to detect this and adjust.
- `AoModal`'s backdrop switched from `position: absolute` (sized to the editor's own content-height container) to `position: fixed` portaled into the same Panel/Layer/body host as the other floating UI, so insert dialogs render as full overlays instead of in-flow content after the editor.

## [1.3.1] — 2026-07-03

### Fixed
- The floating link editor's CSS classes (`link-editor`, `link-input`, `link-edit`, `link-trash`, `link-confirm`, `link-cancel`, `link-view`, `link-input-actions`) were generic, unprefixed names that could collide with a host app's own CSS, breaking the popup's styling. Renamed to the `ao`-prefixed convention (`aoLinkEditor`, `aoLinkInput`, etc.) already used elsewhere in the codebase.

## [1.3.0] — 2026-07-03

### Changed
- Insert Link now reuses the same floating link editor used to edit/remove existing links (pill-shaped input with cancel/confirm on add, link preview with edit/delete on existing links) instead of a separate Popover form with Text/Link fields.
- Table, Image, Inline Image, and YouTube insert popovers converted from Fluent `Popover` to compact `Dialog` modals; their fields switched from horizontal to vertical label orientation, which was clipping labels and misrendering the input underline at the narrower dialog widths.

### Fixed
- The floating character-style toolbar (bold/italic/etc.) could render on top of the main toolbar when text was selected near the top of the editor; it now measures the toolbar's real bottom edge and flips below it when there isn't room above.
- The floating character-style toolbar could stay visible and overlap a Callout/Popover (e.g. the color picker) opened elsewhere, since focusing a popover control doesn't always fire `selectionchange`; it now hides as soon as focus leaves the editor for another floating surface.
- The floating link editor (`.link-editor`) could render as a visible empty box under any selected text, not just links, because its position/visibility update never actually checked whether the selection was inside a link.
- The floating character-style toolbar positioned itself using the full selection range's bounding box, which for multi-line selections could place it far from any actual text; it now anchors to the selection's focus point (the cursor), matching Lexical's own playground behavior, and aligns bottom-right of the caret instead of bottom-left.

## [1.2.1] — 2026-07-03

### Fixed
- `ContentEditorComponent.tsx` had duplicated imports, state declarations (`pageSetup`, `pageCanvas`, `refErrors`, `EditorStyles`), and an unclosed/interleaved JSX return block left over from an unresolved merge conflict between the Page Setup work (1.2.0) and the `ax.bugFixes` branch — the package did not compile. The duplicated code has been removed and the missing `onAnchorRef` callback (needed for floating link/table UI anchoring) restored.
- The example playground's HTML-preview `<div>` had duplicate `style` / `dangerouslySetInnerHTML` attributes from the same merge, which is invalid JSX.

## [1.0.9] — 2026-07-03

### Added
- Unified "+ Insert" toolbar menu (Table, Image, Inline Image, YouTube) replacing separate toolbar buttons, with responsive overflow so the toolbar no longer wraps onto multiple rows on narrow viewports.
- Inline images are now resizable via the same drag-handle resizer used by block images.
- `data-testid="color-sv-box"` / `data-testid="color-hue-bar"` on the color picker's saturation/value box and hue slider for stable test selectors.

### Changed
- Table, Image, YouTube, Inline Image, and Insert Link dialogs migrated from Fluent UI `Popover` to centered `Dialog` overlays for consistent modal behavior across all insert flows.
- Table insertion now enforces a 50×50 row/column limit with inline validation, preventing browser-freezing table sizes.

### Fixed
- Insert Link no longer double-prefixes URLs that already include a scheme (e.g. `https://ftp://...`) and now correctly leaves `mailto:`, `tel:`, `#fragment`, and `/relative` links untouched; added inline validation for structurally invalid URLs.
## [1.2.0] — 2026-07-02

### Added
- **Page Setup toolbar control** (Standard/Pro levels) — a Google Docs-style dropdown for Page size (Pageless plus 11 standard paper sizes: A4, Letter, Legal, Tabloid, A3, A5, B4, B5, Statement, Executive, Folio), Orientation (Portrait/Landscape), and Margins (Narrow/Normal/Moderate/Wide). Selecting a page size constrains the editing canvas to that paper width (96px/inch), centers it, and renders it as a white page sheet with a shadow on a neutral canvas background — a purely visual "page view," not multi-page pagination; content still scrolls continuously and does not auto-split across pages. Orientation and Margins are disabled while Pageless is selected. State is internal to the component (not currently persisted or exposed as a controlled prop).

### Fixed
- `getValue()` and the `onChange` HTML output no longer emit the doubled `<b><strong>text</strong></b>` markup that Lexical's `exportDOM` produces for bold text (`createDOM` uses `<strong>` for the live editable view; `exportDOM` additionally wraps it in `<b>` for email-client compatibility). The existing `postProcessOutput()` sanitizer — which already collapsed this pattern along with the equivalent `<i><em>` case — was written but never wired into the actual output paths; it's now applied in both `CustomOnChangePlugin` and `RefApiPlugin.getValue()`.
- Color picker: reworked the color-commit model back to live pointer-driven updates (saturation/value square and hue slider now commit continuously via Pointer Capture, rather than requiring a separate Apply click introduced in 1.1.0). Uses `setPointerCapture` on pointer-down so drag events keep targeting the picker even if focus shifts mid-drag, addressing the underlying focus-contention issue from 1.0.7–1.0.11 directly rather than by avoiding live updates. Popover header redesigned with a single Close (✕) button in place of separate Apply/Close buttons; hex field now live-commits once its value is a complete `#rgb`/`#rrggbb` token instead of requiring blur.

## [1.1.0] — 2026-06-30

### Changed
- Color picker redesigned around a click-to-pick, explicit-Apply model instead of live-applying color while dragging. Clicking the saturation/value box, the hue bar, a preset swatch, or editing the hex field now only updates the picker's local draft (hex field, swatches, and thumbs all still update live) — nothing is written to the editor until **Apply** is clicked. **Close** discards the draft entirely.
- This removes the entire class of bug investigated in 1.0.7–1.0.11: continuously calling into the editor on every `mousemove` depended on Lexical syncing DOM selection/focus dozens of times a second while a separate popover legitimately held focus, which in at least one production environment fought badly enough that a drag's `mouseup` was sometimes never delivered to `window` — leaving the drag "stuck" and silently overwriting the document with whatever color a later, unrelated stray cursor movement happened to compute. The editor is now only ever touched once per picker session, by a single deliberate user action, so pointer-event delivery issues can no longer corrupt document content.
- Removed the temporary `[AO-ColorPicker]` diagnostic logging added in 1.0.9 — no longer needed.
- `useDrag` and the `interactingRef`/drag-release dismiss-suppression machinery it required have been removed from `ColorPickerComponent.tsx` as dead complexity now that there's no continuous drag tracking.

## [1.0.11] — 2026-06-30

### Fixed
- The 1.0.10 fix reduced but did not eliminate the focus tug-of-war: a fresh diagnostic log from a real repro showed `commitHsv -> onChange` continuing to fire dozens of times with no further user input after a single discrete action (a hex field blur, not a drag), settling on `#ffffff`. This means a previous drag's `mouseup` never reached `window` (most likely a side effect of the same focus churn interrupting native event delivery), leaving the saturation/value and hue drag's `mousemove` listener permanently attached — so any subsequent stray cursor movement anywhere on the page kept recomputing and re-applying a color clamped to whatever screen edge the cursor drifted toward.
- The picker's saturation/value and hue drag handlers no longer call into the editor (`onChange`/`applyStyle`) on every `mousemove`. They now only update local preview state (hex field, swatches, thumbs — still fully live during the drag) on each move, and commit to the editor exactly once, on drag end (mouseup) or a plain click. This means even if a `mouseup` is missed for any reason, stray pointer movement can no longer silently keep overwriting the document — it can only affect the picker's own internal preview, which is recoverable by closing the popover.

## [1.0.10] — 2026-06-30

### Fixed
- Root-caused via diagnostic logging from a real consuming app: opening the color picker moves DOM focus into Fluent's `Callout` (portaled outside the editor's container), which `FocusEventsPlugin` correctly treats as "left the editor" and nulls the Lexical selection for. That alone was already handled (selection is restored from a saved bookmark before every style application). The actual bug was that Lexical's own reconciler force-focuses the editor root on *every* `editor.update()` that touches selection when the root doesn't already have focus — which, while the picker is open, is always true. That forced focus fought Fluent's Callout for focus on every single drag-driven color commit, repeatedly bouncing focus (and the selection null/restore cycle) between the editor and the popover, which could desync the in-progress drag from the cursor and ultimately apply the wrong color.
- `applyStyle` now tags its `editor.update()` calls with Lexical's `SKIP_SELECTION_FOCUS_TAG` so style application never forces DOM focus while the picker is open. Focus is returned to the editor exactly once, when the picker actually closes — and only if the editor was the active surface right before the picker opened (captured via a new `onOpenChange` callback on `ColorPickerControl`, fired before Fluent's `setInitialFocus` can steal focus, since checking "is the editor active" at apply-time is meaningless once a popover is already open).

## [1.0.9] — 2026-06-30 (diagnostic build)

### Added
- Temporary `console.log`/`console.warn` instrumentation (prefixed `[AO-ColorPicker]`) across the color-application pipeline: incoming `value` prop changes, open-popover seeding, every commit path (drag, preset click, hex field blur), selection capture/restore in `applyStyle`, the readback in `updateToolbar`, and `FocusEventsPlugin`'s focusout/selection-clear handling. Intended to diagnose a color-picker issue reported as still present in a consuming web app after 1.0.7/1.0.8 — no behavior changes. **Should be reverted once diagnosis is complete.**

## [1.0.8] — 2026-06-29

### Fixed
- Color picker no longer defaults to black when the current selection's existing color is in `rgb()`/`rgba()` format or `#rrggbbaa` — only literal `#rgb`/`#rrggbb` hex was previously recognized, silently falling back to `#000000` for anything else.
- Color picker's trigger button and Apply/Close buttons now set `type="button"` explicitly, removing a dependency on Fluent UI's default in case the picker is ever used inside a host `<form>`.

### Added
- Playwright integration suite covering text/background color application (preset and custom), picker reopen behavior, parent re-render survival, no accidental form submission, final HTML output, and unrelated-text isolation.

## [1.0.7] — 2026-06-29

### Fixed
- Color picker callout no longer resets to the default color when releasing a drag on the saturation/value or hue sliders. The picker was continuously re-syncing its local color from the host's `value` prop while open, so a momentarily stale/incorrect echo from the host's selection-based color readback (most visible right as focus shifts from the editor into the callout) could overwrite the in-progress selection the instant the mouse was released. It now only seeds from `value` when the popover transitions from closed to open.

## [1.0.3] — 2026-05-15

### Changed
- Focus tracking: toolbar buttons no longer blur the editor — selection is preserved when clicking any toolbar control
- `FocusEventsPlugin` now monitors the full editor container (`containerRef`) so focus events fire correctly on all child elements

### Fixed
- Removed accidental `"private": "true"` flag that could block `npm publish` in some toolchains

## [1.0.2] — 2025-05-01

### Added
- Example playground application (`example/`) with live demo, props reference, and Quick Start guide
- Full imperative Ref API: `getValue`, `setValue`, `clear`, `focus`, `blur`, `isEmpty`, `isFocused`, `upsertBlock`, `removeBlock`, `hasBlock`, `getEditor`

## [1.0.1] — 2025-04-15

### Added
- `spellCheckFn` / `spellCheckEnabled` / `spellCheckIdleMs` simple API surface
- `suggestFn` / `suggestIdleMs` simple async autocomplete API
- `wordLimit` + `onWordLimitExceeded` callback
- `showFloatingToolbar` prop for context-sensitive floating format bar

## [1.0.0] — 2025-04-01

### Added
- Initial release with `ContentEditorComponent`
- `ContentEditorLevel`: None / Basic / Standard / Pro toolbar presets
- Lexical node support: Headings, Lists, Links, Tables, Images, InlineImages, YouTube, Code, PageBreak, Autocomplete, SpellError, HtmlBlock
- Fluent UI (v8 + v9) integration
