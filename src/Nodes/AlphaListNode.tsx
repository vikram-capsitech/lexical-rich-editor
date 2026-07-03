import { $insertList, $isListItemNode, $isListNode, $removeList, ListNode, SerializedListNode } from '@lexical/list';
import { $findMatchingParent } from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  createCommand,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalCommand,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  Spread,
} from 'lexical';

export const INSERT_ALPHA_LIST_COMMAND: LexicalCommand<void> = createCommand(
  'INSERT_ALPHA_LIST_COMMAND',
);

export type SerializedAlphaListNode = Spread<{ type: 'alpha-list' }, SerializedListNode>;

export class AlphaListNode extends ListNode {
  static getType(): string {
    return 'alpha-list';
  }

  static clone(node: AlphaListNode): AlphaListNode {
    return new AlphaListNode(node.getStart(), node.__key);
  }

  constructor(start: number = 1, key?: NodeKey) {
    super('number', start, key);
    (this as any).__listType = 'lower-alpha';
  }

  createDOM(config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const element = document.createElement('ol');
    element.setAttribute('type', 'a');
    if (this.getStart() !== 1) element.setAttribute('start', String(this.getStart()));
    element.style.listStyleType = 'lower-alpha';
    const olClass = (config.theme as any)?.list?.ol;
    if (olClass) element.className = olClass;
    return element;
  }

  updateDOM(): boolean {
    return false;
  }

  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const element = document.createElement('ol');
    element.setAttribute('type', 'a');
    if (this.getStart() !== 1) element.setAttribute('start', String(this.getStart()));
    element.style.listStyleType = 'lower-alpha';
    return { element };
  }

  static importDOM(): DOMConversionMap {
    return {
      ol: (domNode: Node) => {
        if (
          domNode instanceof HTMLOListElement &&
          (domNode.getAttribute('type') === 'a' || domNode.style.listStyleType === 'lower-alpha')
        ) {
          return { conversion: convertAlphaOL, priority: 1 };
        }
        return null;
      },
    };
  }

  exportJSON(): SerializedAlphaListNode {
    const base = super.exportJSON();
    return {
      ...base,
      type: 'alpha-list',
      listType: 'lower-alpha' as any,
      tag: 'ol',
      version: 1,
      start: this.getStart(),
    };
  }

  static importJSON(serialized: SerializedAlphaListNode): AlphaListNode {
    return new AlphaListNode(serialized.start ?? 1);
  }
}

function convertAlphaOL(domNode: Node): DOMConversionOutput {
  const start =
    domNode instanceof HTMLOListElement ? parseInt(domNode.getAttribute('start') || '1', 10) || 1 : 1;
  return { node: $createAlphaListNode(start) };
}

export function $createAlphaListNode(start: number = 1): AlphaListNode {
  return new AlphaListNode(start);
}

export function $isAlphaListNode(node: LexicalNode | null | undefined): node is AlphaListNode {
  return node instanceof AlphaListNode;
}

export function $toggleAlphaList(): void {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return;

  const anchor = selection.anchor.getNode();
  const currentList = $findMatchingParent(anchor, $isListNode);

  if ($isAlphaListNode(currentList)) {
    $removeList();
    return;
  }

  $insertList('number');

  const sel2 = $getSelection();
  if (!$isRangeSelection(sel2)) return;

  const newAnchor = sel2.anchor.getNode();
  const newList = $findMatchingParent(newAnchor, (n) => $isListNode(n) && !$isAlphaListNode(n));
  if (!newList || !$isListNode(newList)) return;

  const start = (newList as ListNode).getStart();
  const formatType =
    typeof (newList as any).getFormatType === 'function' ? (newList as any).getFormatType() : undefined;

  const alpha = $createAlphaListNode(start);
  for (const child of newList.getChildren()) {
    alpha.append(child);
  }
  newList.replace(alpha);

  if (formatType && typeof (alpha as any).setFormat === 'function') {
    (alpha as any).setFormat(formatType);
  }

  const firstItem = alpha.getFirstChild();
  if ($isListItemNode(firstItem)) {
    firstItem.selectStart();
  } else {
    alpha.select();
  }
}

export default AlphaListNode;
