import React, { useRef, useState, useCallback } from 'react';
import { ContentEditorComponent, ContentEditorLevel, ContentEditorRef } from 'lexical-rich-editor';

// ── Types ─────────────────────────────────────────────────────────────────────
type TabKey = 'pro' | 'standard' | 'basic' | 'none' | 'readonly';
type OutputTab = 'source' | 'preview';

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS: { key: TabKey; label: string; description: string; color: string }[] = [
  { key: 'pro', label: 'Pro', color: '#7c3aed', description: 'Full toolbar — images, YouTube embeds, tables, code blocks, fonts, colors, alignment & more' },
  { key: 'standard', label: 'Standard', color: '#2563eb', description: 'Everyday formatting: headings, bold/italic, lists, links & tables' },
  { key: 'basic', label: 'Basic', color: '#0891b2', description: 'Minimal set: bold, italic, underline, ordered & unordered lists, links' },
  { key: 'none', label: 'Minimal', color: '#059669', description: 'No toolbar — clean editable area, great for inline editors' },
  { key: 'readonly', label: 'Read-only', color: '#9ca3af', description: 'Non-interactive preview mode, perfect for rendering saved content' },
];

const LEVEL_MAP: Record<TabKey, ContentEditorLevel> = {
  pro: ContentEditorLevel.Pro,
  standard: ContentEditorLevel.Standard,
  basic: ContentEditorLevel.Basic,
  none: ContentEditorLevel.None,
  readonly: ContentEditorLevel.Pro,
};

const INITIAL_HTML = `
<h2>Welcome to <strong>Lexical Rich Editor</strong></h2>
<p>A production-ready rich text editor built on <a href="https://lexical.dev">Lexical</a> (Meta's editor framework), wrapped with a clean React API and Fluent UI components.</p>
<h3>Try these features</h3>
<ul>
  <li><strong>Rich formatting</strong> — bold, italic, underline, strikethrough, text color &amp; background</li>
  <li><strong>Headings &amp; structure</strong> — H1–H5, blockquotes, code blocks</li>
  <li><strong>Tables</strong> — insert, merge cells, resize columns, set cell background</li>
  <li><strong>Images &amp; media</strong> — block images, inline images with resize, YouTube embeds</li>
  <li><strong>AI Autocomplete</strong> — ghost-text suggestions via your own <code>suggestFn</code></li>
  <li><strong>Spell &amp; grammar check</strong> — real-time underlines with correction popovers</li>
  <li><strong>Ref API</strong> — <code>getValue</code>, <code>setValue</code>, <code>clear</code>, <code>focus</code>, <code>upsertBlock</code> and more</li>
</ul>
<p>Switch tabs above to explore different toolbar levels. Use the buttons below to test the imperative ref API.</p>
`.trim();

const PROPS_REFERENCE = [
  { prop: 'namespace', type: 'string', required: true, desc: 'Unique editor ID. Used as the Lexical namespace.' },
  { prop: 'value', type: 'string', required: true, desc: 'Controlled HTML content.' },
  { prop: 'onChange', type: '(html: string) => void', required: true, desc: 'Fires whenever content changes.' },
  { prop: 'level', type: 'ContentEditorLevel', required: false, desc: 'Toolbar preset: None | Basic | Standard | Pro. Default: Pro.' },
  { prop: 'readOnly', type: 'boolean', required: false, desc: 'Disables editing. Renders content as read-only.' },
  { prop: 'placeholder', type: 'string', required: false, desc: 'Placeholder text shown when editor is empty.' },
  { prop: 'height', type: 'string | number', required: false, desc: 'Outer container height (e.g. "400px", "100%").' },
  { prop: 'width', type: 'string | number', required: false, desc: 'Outer container width.' },
  { prop: 'margin', type: 'string', required: false, desc: 'CSS margin on the outer wrapper.' },
  { prop: 'contentHeight', type: 'string | number', required: false, desc: 'Inner editable area height.' },
  { prop: 'autoFocus', type: 'boolean', required: false, desc: 'Focus the editor on mount.' },
  { prop: 'showFloatingToolbar', type: 'boolean', required: false, desc: 'Show a floating format bar on text selection.' },
  { prop: 'wordLimit', type: 'number', required: false, desc: 'Maximum word count. Triggers onWordLimitExceeded.' },
  { prop: 'suggestFn', type: 'async (text, cursorIndex?) => Promise<string[] | { generated_text: string }>', required: false, desc: 'AI autocomplete provider. Return suggestions for ghost-text.' },
  { prop: 'suggestIdleMs', type: 'number', required: false, desc: 'Debounce delay before calling suggestFn (default 300ms).' },
  { prop: 'spellCheckFn', type: 'async (text) => Promise<SpellCheckPayload>', required: false, desc: 'Spell/grammar check provider. Return issues array.' },
  { prop: 'spellCheckEnabled', type: 'boolean', required: false, desc: 'Toggle spell check on/off (default true).' },
  { prop: 'spellCheckIdleMs', type: 'number', required: false, desc: 'Debounce delay before calling spellCheckFn (default 1200ms).' },
  { prop: 'onFocus', type: '() => void', required: false, desc: 'Fires when the editor gains focus.' },
  { prop: 'onBlur', type: '() => void', required: false, desc: 'Fires when the editor loses focus.' },
  { prop: 'onSuggestionAccept', type: '({ suggestionText, triggerText, method }) => void', required: false, desc: 'Fires when user accepts an AI suggestion.' },
  { prop: 'onSuggestionShown', type: '() => void', required: false, desc: 'Fires when a suggestion ghost text appears.' },
  { prop: 'onSpellCheckAccept', type: '({ original, replacement, message, type }) => void', required: false, desc: 'Fires when user accepts a spell/grammar correction.' },
  { prop: 'onWordLimitExceeded', type: '({ wordCount, wordLimit, exceeded }) => void', required: false, desc: 'Fires when content crosses the word limit.' },
];

const REF_API = [
  { method: 'getValue()', returns: 'string', desc: 'Returns the current content as an HTML string.' },
  { method: 'setValue(html)', returns: 'void', desc: 'Replaces editor content with the given HTML.' },
  { method: 'clear()', returns: 'void', desc: 'Clears all content.' },
  { method: 'focus()', returns: 'void', desc: 'Moves focus into the editor.' },
  { method: 'blur()', returns: 'void', desc: 'Removes focus from the editor.' },
  { method: 'isEmpty()', returns: 'boolean', desc: 'Returns true when the editor has no meaningful content.' },
  { method: 'isFocused()', returns: 'boolean', desc: 'Returns true when the editor is focused.' },
  { method: 'upsertBlock(spec)', returns: 'void', desc: 'Insert or replace a named block by kind.' },
  { method: 'removeBlock(kind)', returns: 'void', desc: 'Remove a named block from the content.' },
  { method: 'hasBlock(kind)', returns: 'boolean', desc: 'Returns true if a block of the given kind exists.' },
  { method: 'getEditor()', returns: 'LexicalEditor', desc: 'Returns the raw Lexical editor instance.' },
];

const FEATURES = [
  { icon: '⚡', title: 'Lexical-powered', color: '#7c3aed', desc: "Built on Meta's extensible Lexical framework — fast, reliable, and battle-tested." },
  { icon: '🤖', title: 'AI Autocomplete', color: '#2563eb', desc: 'Ghost-text inline suggestions with Tab/Enter to accept. Wire up any LLM API.' },
  { icon: '✅', title: 'Spell & Grammar', color: '#059669', desc: 'Real-time underlines (red=spelling, blue=grammar, yellow=style) with correction popovers.' },
  { icon: '🎨', title: 'Rich Toolbar', color: '#dc2626', desc: 'Headings, lists, tables, code blocks, links, fonts, colors, images and more.' },
  { icon: '📊', title: 'Full Tables', color: '#d97706', desc: 'Insert tables with cell merge, background color, and drag-to-resize columns.' },
  { icon: '🖼️', title: 'Images & Media', color: '#0891b2', desc: 'Block & inline images with resizing handles. YouTube video embeds.' },
  { icon: '🔧', title: 'Imperative Ref', color: '#7c3aed', desc: 'getValue, setValue, clear, focus, isEmpty, upsertBlock — full programmatic control.' },
  { icon: '📐', title: 'Four Levels', color: '#2563eb', desc: 'None / Basic / Standard / Pro toolbar levels. Pick the right UX for every context.' },
  { icon: '🔢', title: 'Word Limit', color: '#059669', desc: 'Set a word limit and receive a callback when the user exceeds it.' },
  { icon: '🎯', title: 'TypeScript', color: '#0891b2', desc: 'Fully typed with complete prop and ref interfaces. Ships with .d.ts files.' },
  { icon: '🎪', title: 'Floating Toolbar', color: '#dc2626', desc: 'Context-sensitive floating format bar appears on text selection.' },
  { icon: '📦', title: 'Peer-dep friendly', color: '#d97706', desc: 'Lexical & Fluent UI are peer deps — no version conflicts in your app.' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countChars(html: string): number {
  return html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').length;
}

function useCopy() {
  const [copied, setCopied] = useState('');
  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1800);
    });
  }, []);
  return { copied, copy };
}

// ── Sub-components ────────────────────────────────────────────────────────────
function CopyBtn({ text, label, copied, copy, id }: { text: string; label?: string; copied: string; copy: (t: string, k: string) => void; id: string }) {
  const done = copied === id;
  return (
    <button
      onClick={() => copy(text, id)}
      style={{
        padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, border: 'none',
        cursor: 'pointer', background: done ? '#059669' : '#334155', color: '#fff', transition: 'background 0.2s',
      }}
    >
      {done ? '✓ Copied' : (label ?? 'Copy')}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
      {children}
    </h2>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('pro');
  const [htmlValue, setHtmlValue] = useState(INITIAL_HTML);
  const [outputTab, setOutputTab] = useState<OutputTab>('source');
  const [showOutput, setShowOutput] = useState(true);
  const [showProps, setShowProps] = useState(false);
  const [showRefApi, setShowRefApi] = useState(false);
  const editorRef = useRef<ContentEditorRef>(null);
  const { copied, copy } = useCopy();

  const activeTabMeta = TABS.find(t => t.key === activeTab)!;
  const words = countWords(htmlValue);
  const chars = countChars(htmlValue);

  const INSTALL_CMD = 'yarn add @tarviks/lexical-rich-editor';
  const INSTALL_NPM = 'npm install @tarviks/lexical-rich-editor';
  const PEER_CMD = 'yarn add lexical @lexical/react @lexical/code @lexical/link @lexical/list @lexical/rich-text @lexical/table @lexical/utils @lexical/selection @lexical/html @fluentui/react @fluentui/react-components @fluentui/react-icons';
  const QUICK_START = `import { useRef, useState } from 'react';
import {
  ContentEditorComponent,
  ContentEditorLevel,
  ContentEditorRef,
} from '@tarviks/lexical-rich-editor';
import '@tarviks/lexical-rich-editor/dist/index.css';

function MyEditor() {
  const [value, setValue] = useState('');
  const editorRef = useRef<ContentEditorRef>(null);

  return (
    <ContentEditorComponent
      ref={editorRef}
      namespace="my-editor"
      value={value}
      onChange={setValue}
      level={ContentEditorLevel.Pro}
      placeholder="Start typing…"
      height={400}
      showFloatingToolbar
      // AI autocomplete — wire up any LLM:
      suggestFn={async (text) => {
        const res = await fetch('/api/suggest', {
          method: 'POST',
          body: JSON.stringify({ text }),
        });
        return res.json(); // string[] or { generated_text: string }
      }}
      // Spell check:
      spellCheckFn={async (text) => {
        const res = await fetch('/api/spellcheck', {
          method: 'POST',
          body: JSON.stringify({ text }),
        });
        return res.json();
      }}
      onSuggestionAccept={({ suggestionText, method }) => {
        console.log('Accepted:', suggestionText, 'via', method);
      }}
      wordLimit={500}
    />
  );
}`;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f1f5f9', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ── Nav ── */}
      <nav style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0 40px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#f8fafc', fontWeight: 800, fontSize: 15, letterSpacing: -0.3 }}>
            <span style={{ color: '#7c3aed' }}>@tarviks/</span>lexical-rich-editor
          </span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <a href="https://www.npmjs.com/package/@tarviks/lexical-rich-editor" target="_blank" rel="noreferrer"
              style={{ color: '#94a3b8', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
              npm
            </a>
            <a href="https://github.com/vikram-capsitech/lexical-rich-editor" target="_blank" rel="noreferrer"
              style={{ color: '#94a3b8', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
              GitHub
            </a>
            <span style={{ background: '#1e293b', color: '#94a3b8', fontSize: 11, padding: '3px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
              v1.0.5
            </span>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)', padding: '52px 40px 48px', color: '#f8fafc' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Lexical-based', bg: '#7c3aed' },
              { label: 'React 18', bg: '#0891b2' },
              { label: 'TypeScript', bg: '#2563eb' },
              { label: 'MIT License', bg: '#059669' },
              { label: 'Fluent UI', bg: '#b45309' },
            ].map(b => (
              <span key={b.label} style={{ background: b.bg + '33', color: '#e2e8f0', border: `1px solid ${b.bg}66`, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, letterSpacing: 0.5 }}>
                {b.label}
              </span>
            ))}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, margin: '0 0 12px', letterSpacing: -1.5, lineHeight: 1.15 }}>
            Lexical Rich Editor
          </h1>
          <p style={{ fontSize: 16, color: '#94a3b8', maxWidth: 640, lineHeight: 1.65, margin: '0 0 32px' }}>
            A production-ready, feature-complete rich text editor for React. Built on Meta's Lexical framework with
            AI autocomplete, real-time spell check, full table support, images, YouTube embeds, and an imperative ref API.
          </p>

          {/* Install box */}
          <div style={{ background: '#0f172a', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden', display: 'inline-block', minWidth: 380 }}>
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #1e293b', display: 'flex', gap: 6 }}>
              {['#ef4444', '#f59e0b', '#22c55e'].map(c => (
                <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
              ))}
            </div>
            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'yarn', cmd: INSTALL_CMD, id: 'yarn-install' },
                { label: 'npm', cmd: INSTALL_NPM, id: 'npm-install' },
              ].map(row => (
                <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: '#475569', fontSize: 11, fontFamily: 'monospace', minWidth: 28 }}>{row.label}</span>
                  <span style={{ color: '#7dd3fc', fontSize: 13, fontFamily: 'monospace', flex: 1 }}>{row.cmd}</span>
                  <CopyBtn text={row.cmd} id={row.id} copied={copied} copy={copy} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '36px 24px 60px' }}>

        {/* ── Live Demo ── */}
        <SectionTitle>🚀 Live Demo</SectionTitle>

        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', overflowX: 'auto' }}>
            {TABS.map(t => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    padding: '12px 20px', fontSize: 13, fontWeight: active ? 700 : 500,
                    color: active ? t.color : '#64748b',
                    background: active ? '#fff' : 'transparent',
                    borderBottom: active ? `2px solid ${t.color}` : '2px solid transparent',
                    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                    outline: 'none',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab description */}
          <div style={{ padding: '8px 20px', fontSize: 12, color: '#64748b', background: '#fafbfc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: activeTabMeta.color, display: 'inline-block', flexShrink: 0 }} />
            {activeTabMeta.description}
          </div>

          {/* Ref API controls */}
          <div style={{ display: 'flex', gap: 8, padding: '12px 20px', flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9', background: '#fafbfc', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.8, textTransform: 'uppercase', marginRight: 4 }}>Ref API</span>
            {[
              { label: 'Focus', color: '#2563eb', action: () => editorRef.current?.focus() },
              { label: 'Set Sample HTML', color: '#059669', action: () => editorRef.current?.setValue('<h3>Inserted via <code>ref.setValue()</code></h3><p>This content was set programmatically using the imperative ref API. The editor also supports <strong>rich formatting</strong>, <em>styles</em>, and more.</p>') },
              { label: 'Get Value', color: '#d97706', action: () => alert('HTML output:\n\n' + (editorRef.current?.getValue() ?? '').slice(0, 600)) },
              { label: 'Clear', color: '#dc2626', action: () => editorRef.current?.clear() },
            ].map(btn => (
              <button
                key={btn.label}
                onClick={btn.action}
                style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer', background: btn.color, color: '#fff', transition: 'opacity 0.15s' }}
              >
                {btn.label}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8', alignItems: 'center' }}>
              <span><strong style={{ color: '#1e293b' }}>{words}</strong> words</span>
              <span><strong style={{ color: '#1e293b' }}>{chars}</strong> chars</span>
            </div>
          </div>

          {/* Editor */}
          <div style={{ padding: 20, height: 460, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ContentEditorComponent
                ref={editorRef}
                namespace="demo-editor"
                value={htmlValue}
                onChange={setHtmlValue}
                level={LEVEL_MAP[activeTab]}
                readOnly={activeTab === 'readonly'}
                placeholder="Start typing here…"
                height="100%"
                width="100%"
                margin="0"
                showFloatingToolbar
              />
            </div>
          </div>

          {/* Output panel */}
          <div style={{ margin: '0 20px 20px', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: '#f1f5f9', borderBottom: showOutput ? '1px solid #e2e8f0' : 'none', cursor: 'pointer' }}
              onClick={() => setShowOutput(v => !v)}
            >
              <div style={{ display: 'flex', gap: 0 }}>
                {(['source', 'preview'] as OutputTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={e => { e.stopPropagation(); setShowOutput(true); setOutputTab(tab); }}
                    style={{
                      padding: '3px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                      textTransform: 'uppercase', border: 'none', cursor: 'pointer', borderRadius: 4,
                      background: (showOutput && outputTab === tab) ? '#fff' : 'transparent',
                      color: (showOutput && outputTab === tab) ? '#1e293b' : '#94a3b8',
                      boxShadow: (showOutput && outputTab === tab) ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {tab === 'source' ? 'HTML Source' : 'Preview'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {showOutput && outputTab === 'source' && (
                  <CopyBtn text={htmlValue} id="html-output" copied={copied} copy={copy} label="Copy HTML" />
                )}
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{showOutput ? '▲' : '▼'}</span>
              </div>
            </div>
            {showOutput && (
              outputTab === 'source' ? (
                <pre style={{ fontSize: 11, fontFamily: 'Consolas, Monaco, monospace', color: '#334155', padding: '14px 16px', maxHeight: 220, overflowY: 'auto', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, background: '#f8fafc' }}>
                  {htmlValue || '(empty)'}
                </pre>
              ) : (
                <div
                  style={{ padding: '14px 20px', maxHeight: 220, overflowY: 'auto', fontSize: 14, lineHeight: 1.7, color: '#1e293b', background: '#fff' }}
                  dangerouslySetInnerHTML={{ __html: htmlValue || '<em style="color:#94a3b8">(empty)</em>' }}
                />
              )
            )}
          </div>
        </div>

        {/* ── Feature grid ── */}
        <div style={{ marginTop: 48 }}>
          <SectionTitle>✨ Features</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `3px solid ${f.color}`, border: `1px solid #e2e8f0`, borderLeftWidth: 3 }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 5, color: '#1e293b' }}>{f.title}</div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Props Reference ── */}
        <div style={{ marginTop: 48 }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: showProps ? 16 : 0 }}
            onClick={() => setShowProps(v => !v)}
          >
            <SectionTitle>📋 Props Reference</SectionTitle>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{showProps ? '▲ Hide' : '▼ Show'}</span>
          </div>
          {showProps && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Prop', 'Type', 'Required', 'Description'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', letterSpacing: 0.4, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PROPS_REFERENCE.map((row, i) => (
                      <tr key={row.prop} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                        <td style={{ padding: '9px 16px', borderBottom: '1px solid #f1f5f9' }}>
                          <code style={{ color: '#7c3aed', fontWeight: 700, background: '#f5f3ff', padding: '1px 5px', borderRadius: 3 }}>{row.prop}</code>
                        </td>
                        <td style={{ padding: '9px 16px', borderBottom: '1px solid #f1f5f9' }}>
                          <code style={{ color: '#0891b2', fontSize: 11 }}>{row.type}</code>
                        </td>
                        <td style={{ padding: '9px 16px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                          {row.required
                            ? <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>Yes</span>
                            : <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>No</span>
                          }
                        </td>
                        <td style={{ padding: '9px 16px', borderBottom: '1px solid #f1f5f9', color: '#475569', lineHeight: 1.5 }}>{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Ref API ── */}
        <div style={{ marginTop: 32 }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: showRefApi ? 16 : 0 }}
            onClick={() => setShowRefApi(v => !v)}
          >
            <SectionTitle>🔧 Ref API Reference</SectionTitle>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{showRefApi ? '▲ Hide' : '▼ Show'}</span>
          </div>
          {showRefApi && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Method', 'Returns', 'Description'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {REF_API.map((row, i) => (
                      <tr key={row.method} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                        <td style={{ padding: '9px 16px', borderBottom: '1px solid #f1f5f9' }}>
                          <code style={{ color: '#2563eb', fontWeight: 700 }}>{row.method}</code>
                        </td>
                        <td style={{ padding: '9px 16px', borderBottom: '1px solid #f1f5f9' }}>
                          <code style={{ color: '#059669', fontSize: 11 }}>{row.returns}</code>
                        </td>
                        <td style={{ padding: '9px 16px', borderBottom: '1px solid #f1f5f9', color: '#475569', lineHeight: 1.5 }}>{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Quick Start ── */}
        <div style={{ marginTop: 48 }}>
          <SectionTitle>⚡ Quick Start</SectionTitle>

          {/* Step 1: install */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>1 — Install the package</span>
              <CopyBtn text={INSTALL_CMD} id="qs-install" copied={copied} copy={copy} />
            </div>
            <pre style={{ margin: 0, padding: '14px 20px', fontSize: 13, fontFamily: 'Consolas, Monaco, monospace', color: '#7dd3fc', background: '#0f172a' }}>
              {INSTALL_CMD}
            </pre>
          </div>

          {/* Step 2: peer deps */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>2 — Install peer dependencies</span>
              <CopyBtn text={PEER_CMD} id="qs-peer" copied={copied} copy={copy} />
            </div>
            <pre style={{ margin: 0, padding: '14px 20px', fontSize: 12, fontFamily: 'Consolas, Monaco, monospace', color: '#a5f3fc', background: '#0f172a', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {PEER_CMD}
            </pre>
          </div>

          {/* Step 3: usage */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>3 — Use in your component</span>
              <CopyBtn text={QUICK_START} id="qs-code" copied={copied} copy={copy} />
            </div>
            <pre style={{ margin: 0, padding: '20px 24px', fontSize: 12, fontFamily: 'Consolas, Monaco, monospace', color: '#e2e8f0', background: '#0f172a', overflowX: 'auto', lineHeight: 1.65 }}>
              {QUICK_START}
            </pre>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer style={{ textAlign: 'center', padding: '48px 0 8px', color: '#94a3b8', fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 10 }}>
            <a href="https://www.npmjs.com/package/@tarviks/lexical-rich-editor" target="_blank" rel="noreferrer" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>npm</a>
            <a href="https://github.com/vikram-capsitech/lexical-rich-editor" target="_blank" rel="noreferrer" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>GitHub</a>
            <a href="https://lexical.dev" target="_blank" rel="noreferrer" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>Lexical</a>
          </div>
          @tarviks/lexical-rich-editor · MIT License · Built with Lexical + Fluent UI
        </footer>
      </main>
    </div>
  );
}
