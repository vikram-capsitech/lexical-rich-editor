# Changelog

All notable changes to `@tarviks/lexical-rich-editor` are documented here.

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
