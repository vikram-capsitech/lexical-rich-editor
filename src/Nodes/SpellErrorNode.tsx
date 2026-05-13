import type {
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedTextNode,
  Spread,
} from 'lexical';
import { TextNode } from 'lexical';

export type SpellIssueType = 'spelling' | 'grammar' | 'style';

export type SpellErrorMeta = {
  message: string;
  suggestions: string[];
  type: SpellIssueType;
  /** Original character offset in the plain-text snapshot (used for reward API) */
  offset: number;
  /**
   * When set, this node represents the full sentence that has an AI-suggested
   * improvement. The popover will show an "Improve sentence" option that
   * replaces the sentence with this text.
   */
  improvedText?: string;
};

export type SerializedSpellErrorNode = Spread<{ meta: SpellErrorMeta }, SerializedTextNode>;

// Inject CSS — always replace so hot-reload picks up changes
const STYLE_ID = '__spell_error_node_css__';
function ensureCSS() {
  if (typeof document === 'undefined') return;
  // Remove existing tag first so stale cached styles never win
  document.getElementById(STYLE_ID)?.remove();
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    /* SpellErrorNode underlines — thin, Grammarly-style */
    .sc-err-spelling,
    .sc-err-grammar,
    .sc-err-style {
      cursor: pointer;
      text-underline-offset: 3px;
      text-decoration-skip-ink: none;
    }

    /* Spelling — red dotted (classic spell-check look) */
    .sc-err-spelling {
      text-decoration: underline #e53e3e;
      text-decoration-thickness: 1.5px;
    }

    /* Grammar — blue dotted */
    .sc-err-grammar {
      text-decoration: underline dotted #3182ce;
      text-decoration-thickness: 1.5px;
    }

    /* Style — yellow/amber dotted */
    .sc-err-style {
      text-decoration: underline dotted #d97706;
      text-decoration-thickness: 1.5px;
    }
  `;
  document.head.appendChild(s);
}

function classForType(type: SpellIssueType): string {
  if (type === 'grammar') return 'sc-err-grammar';
  if (type === 'style') return 'sc-err-style';
  return 'sc-err-spelling';
}

export class SpellErrorNode extends TextNode {
  __meta: SpellErrorMeta;

  static getType(): string {
    return 'spell-error';
  }

  static clone(node: SpellErrorNode): SpellErrorNode {
    return new SpellErrorNode(node.__text, node.__meta, node.__key);
  }

  static importJSON(s: SerializedSpellErrorNode): SpellErrorNode {
    return new SpellErrorNode(s.text, s.meta);
  }

  constructor(text: string, meta: SpellErrorMeta, key?: NodeKey) {
    super(text, key);
    this.__meta = meta;
    // NOTE: Do NOT call ensureCSS() here.
    // This constructor is called inside editor.update() callbacks, and any
    // DOM mutation (appendChild, remove) inside a Lexical update throws an
    // error that gets silently swallowed by the editor's onError handler.
    // CSS is injected once by SpellCheckPlugin's useEffect instead.
  }

  exportJSON(): SerializedSpellErrorNode {
    return { ...super.exportJSON(), type: 'spell-error', meta: this.__meta };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config) as HTMLElement;
    dom.className = (dom.className + ' ' + classForType(this.__meta.type)).trim();
    dom.dataset.spellOffset = String(this.__meta.offset);
    return dom;
  }

  updateDOM(prev: SpellErrorNode, dom: HTMLElement, config: EditorConfig): boolean {
    const base = super.updateDOM(prev as any, dom, config);
    // Reapply class if meta changed
    if (prev.__meta.type !== this.__meta.type) {
      dom.classList.remove('sc-err-spelling', 'sc-err-grammar', 'sc-err-style');
      dom.classList.add(classForType(this.__meta.type));
    }
    return base;
  }

  exportDOM(): DOMExportOutput {
    // When copying/exporting, emit a plain span with no decoration
    const span = document.createElement('span');
    span.textContent = this.__text;
    return { element: span };
  }

  static importDOM(): DOMConversionMap | null {
    return null;
  }

  getMeta(): SpellErrorMeta {
    return this.getLatest().__meta;
  }

  setMeta(meta: SpellErrorMeta): SpellErrorNode {
    const writable = this.getWritable() as SpellErrorNode;
    writable.__meta = meta;
    return writable;
  }

  // Prevent the spell-error node from being copied as a SpellErrorNode
  excludeFromCopy() {
    return false;
  }
}

export function $createSpellErrorNode(text: string, meta: SpellErrorMeta): SpellErrorNode {
  return new SpellErrorNode(text, meta);
}

export function $isSpellErrorNode(node: LexicalNode | null | undefined): node is SpellErrorNode {
  return node instanceof SpellErrorNode;
}
