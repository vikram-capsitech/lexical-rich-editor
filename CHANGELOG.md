# Changelog

All notable changes to `@tarviks/lexical-rich-editor` are documented here.

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
