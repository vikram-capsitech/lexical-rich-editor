# lexical-rich-editor

A production-ready, feature-rich **rich text editor** built on Meta's [Lexical](https://lexical.dev) framework with a Fluent UI toolbar. Supports AI autocomplete, spell/grammar check, tables, images, YouTube embeds, code blocks, and more.

## Install

```bash
yarn add lexical-rich-editor
# or
npm install lexical-rich-editor
```

### Peer dependencies

```bash
yarn add lexical \
  @lexical/react @lexical/code @lexical/link @lexical/list \
  @lexical/rich-text @lexical/table @lexical/utils @lexical/selection @lexical/html \
  @fluentui/react @fluentui/react-components @fluentui/react-icons \
  react react-dom
```

## Quick start

```tsx
import { useRef, useState } from 'react';
import {
  ContentEditorComponent,
  ContentEditorLevel,
  ContentEditorRef,
} from 'lexical-rich-editor';

function MyEditor() {
  const [value, setValue] = useState('');
  const editorRef = useRef<ContentEditorRef>(null);

  return (
    <div style={{ height: 400 }}>
      <ContentEditorComponent
        ref={editorRef}
        namespace="my-editor"
        value={value}
        onChange={setValue}
        level={ContentEditorLevel.Pro}
        placeholder="Start typing…"
        showFloatingToolbar
      />
    </div>
  );
}
```

## Editor levels

| Level | Toolbar features |
|---|---|
| `ContentEditorLevel.None` | No toolbar — plain editable area |
| `ContentEditorLevel.Basic` | Bold, italic, underline, lists, links |
| `ContentEditorLevel.Standard` | Basic + tables |
| `ContentEditorLevel.Pro` | Full — images, YouTube, fonts, colors, code, page breaks |

## AI Autocomplete

Pass any async function that returns suggestions — the editor handles debounce, ghost text, and cancellation:

```tsx
<ContentEditorComponent
  suggestFn={async (text, cursorIndex) => {
    const res = await fetch('/api/suggest', {
      method: 'POST',
      body: JSON.stringify({ text, cursorIndex }),
    });
    return res.json();
    // Supported shapes: string[] | { generated_text: string } | { suggestions: string[] }
  }}
  onSuggestionAccept={({ suggestionText, triggerText, method }) => {
    // method: 'tab' | 'enter' | 'click'
    sendRewardSignal({ suggestionText, triggerText });
  }}
  suggestIdleMs={300}   // debounce delay (default 300ms)
/>
```

## Spell & Grammar check

```tsx
<ContentEditorComponent
  spellCheckFn={async (text) => {
    const res = await fetch('/api/spellcheck', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    return res.json();
    // Supported shapes:
    //   { misspelled_words: string[], suggestions: Record<string, string[]>, grammar_correction?: string }
    //   { misspelled: string[], suggestions: Record<string, string[]>, improved_text?: string }
    //   SpellCheckIssue[]
  }}
  onSpellCheckAccept={({ original, replacement, type }) => {
    // type: 'spelling' | 'grammar' | 'style'
  }}
  spellCheckIdleMs={1200}   // debounce delay (default 1200ms)
  spellCheckEnabled={true}
/>
```

## Ref API

```tsx
const editorRef = useRef<ContentEditorRef>(null);

// Get current HTML string
const html = editorRef.current?.getValue();

// Set content from HTML
editorRef.current?.setValue('<p>Hello <strong>world</strong></p>');

// Clear the editor
editorRef.current?.clear();

// Focus / blur
editorRef.current?.focus();
editorRef.current?.blur();

// Check state
const empty   = editorRef.current?.isEmpty();
const focused = editorRef.current?.isFocused();

// Insert / update a named block (e.g. email signature)
editorRef.current?.upsertBlock({
  kind: 'signature',
  html: '<p>Best regards,<br/>John Doe</p>',
  position: 'end',
});

// Remove a block
editorRef.current?.removeBlock('signature');

// Check if a block exists
const has = editorRef.current?.hasBlock('signature');

// Raw Lexical editor (advanced)
const lexicalEditor = editorRef.current?.getEditor();
```

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | required | Controlled HTML value |
| `onChange` | `(html: string) => void` | required | Change handler |
| `namespace` | `string` | `undefined` | Lexical namespace |
| `level` | `ContentEditorLevel` | `Basic` | Toolbar feature level |
| `readOnly` | `boolean` | `false` | Non-interactive mode |
| `placeholder` | `string` | `undefined` | Placeholder text |
| `width` | `string` | `'100%'` | Container width |
| `height` | `string` | `'100%'` | Container height |
| `margin` | `string\|number` | `'5px auto'` | Container margin |
| `autoFocus` | `boolean` | `false` | Focus on mount |
| `showFloatingToolbar` | `boolean` | `false` | Floating format bar on selection |
| `wordLimit` | `number` | `undefined` | Max word count (shows counter) |
| `onWordLimitExceeded` | `fn` | `undefined` | Fires when limit is crossed |
| `suggestFn` | `async fn` | `undefined` | Simple autocomplete API |
| `useQuery` | `fn` | `undefined` | Advanced autocomplete with cancellation |
| `suggestIdleMs` | `number` | `300` | Autocomplete debounce (ms) |
| `spellCheckFn` | `async fn` | `undefined` | Simple spell check API |
| `useSpellCheck` | `fn` | `undefined` | Advanced spell check with cancellation |
| `spellCheckIdleMs` | `number` | `1200` | Spell check debounce (ms) |
| `spellCheckEnabled` | `boolean` | `true` | Toggle spell check without unmounting |
| `onSuggestionAccept` | `fn` | `undefined` | Fires on autocomplete accept |
| `onSuggestionShown` | `fn` | `undefined` | Fires when suggestion is shown |
| `onSpellCheckAccept` | `fn` | `undefined` | Fires on spell check accept |
| `onFocus` | `fn` | `undefined` | Focus event |
| `onBlur` | `fn` | `undefined` | Blur event |

## Development

```bash
# Clone
git clone https://github.com/capsitech/lexical-rich-editor

# Install root deps (for building)
yarn install

# Run example app
cd example && yarn install && yarn dev
```

## Build & publish

```bash
yarn build          # outputs to dist/
npm publish         # publishes to npm
```

## License

MIT
