# Changelog

All notable changes to `@tarviks/lexical-rich-editor` are documented here.

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
