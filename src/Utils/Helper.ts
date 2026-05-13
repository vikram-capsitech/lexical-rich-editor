import { $generateNodesFromDOM } from '@lexical/html';
import { $getRoot } from 'lexical';
import { $createHtmlBlockNode, $isHtmlBlockNode, HtmlBlockNode } from '../Nodes/HtmlBlockNode';

export type BlockSpec = {
  kind: string;
  html: string;
  position?: 'start' | 'end';
};

function findBlockByKind(kind: string): HtmlBlockNode | null {
  const root = $getRoot();
  for (const child of root.getChildren()) {
    if ($isHtmlBlockNode(child) && child.getKind() === kind) return child;
  }
  return null;
}

function importHtmlIntoBlock(editor: any, block: HtmlBlockNode, html: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '<p></p>', 'text/html');
  const nodes = $generateNodesFromDOM(editor, doc);

  block.clear();
  block.append(...nodes);
}

export function upsertBlock(editor: any, spec: BlockSpec) {
  const { kind, html, position = 'end' } = spec;

  editor.update(() => {
    const root = $getRoot();
    let block = findBlockByKind(kind);

    if (!block) {
      block = $createHtmlBlockNode(kind);
      if (position === 'start') {
        root.splice(0, 0, [block]);
      } else {
        root.append(block);
      }
    }

    importHtmlIntoBlock(editor, block, html);
  });
}

export function removeBlock(editor: any, kind: string) {
  editor.update(() => {
    const block = findBlockByKind(kind);
    block?.remove();
  });
}

export function hasBlock(editor: any, kind: string): boolean {
  let found = false;
  editor.getEditorState().read(() => {
    found = !!findBlockByKind(kind);
  });
  return found;
}
