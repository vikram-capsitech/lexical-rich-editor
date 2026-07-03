# Changelog

All notable changes to `@tarviks/lexical-rich-editor` are documented here.

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
