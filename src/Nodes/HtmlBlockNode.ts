import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  ElementNode,
  LexicalNode,
  NodeKey,
  SerializedElementNode,
} from 'lexical';

export type SerializedHtmlBlockNode = SerializedElementNode & {
  type: 'htmlblock';
  version: 1;
  kind: string;
};

function convertHtmlBlockDiv(domNode: HTMLElement): DOMConversionOutput {
  const kind = domNode.getAttribute('data-kind') || 'unknown';
  return { node: $createHtmlBlockNode(kind) };
}

export class HtmlBlockNode extends ElementNode {
  __kind: string;

  static getType(): string {
    return 'htmlblock';
  }

  static clone(node: HtmlBlockNode): HtmlBlockNode {
    return new HtmlBlockNode(node.__kind, node.__key);
  }

  constructor(kind: string, key?: NodeKey) {
    super(key);
    this.__kind = kind;
  }

  getKind(): string {
    return this.getLatest().__kind;
  }

  setKind(kind: string) {
    const writable = this.getWritable();
    writable.__kind = kind;
  }

  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.setAttribute('data-lex-block', 'true');
    el.setAttribute('data-kind', this.__kind);
    return el;
  }

  updateDOM(prevNode: HtmlBlockNode, dom: HTMLElement): boolean {
    if (prevNode.__kind !== this.__kind) {
      dom.setAttribute('data-kind', this.__kind);
    }
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: Node) => {
        if (domNode instanceof HTMLElement && domNode.getAttribute('data-lex-block') === 'true') {
          return {
            conversion: (node: Node) => convertHtmlBlockDiv(node as HTMLElement),
            priority: 2,
          };
        }
        return null;
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const el = document.createElement('div');
    el.setAttribute('data-lex-block', 'true');
    el.setAttribute('data-kind', this.__kind);
    return { element: el };
  }

  exportJSON(): SerializedHtmlBlockNode {
    return {
      ...super.exportJSON(),
      type: 'htmlblock',
      version: 1,
      kind: this.__kind,
    };
  }

  static importJSON(serializedNode: SerializedHtmlBlockNode): HtmlBlockNode {
    return $createHtmlBlockNode(serializedNode.kind);
  }
}

export function $createHtmlBlockNode(kind: string): HtmlBlockNode {
  return $applyNodeReplacement(new HtmlBlockNode(kind));
}

export function $isHtmlBlockNode(node: LexicalNode | null | undefined): node is HtmlBlockNode {
  return node instanceof HtmlBlockNode;
}
