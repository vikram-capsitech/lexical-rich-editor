import type { DOMConversionMap, DOMExportOutput, EditorConfig, NodeKey, SerializedTextNode, Spread } from 'lexical';
import { TextNode } from 'lexical';

export type SerializedAutocompleteNode = Spread<{ uuid: string }, SerializedTextNode>;

export class AutocompleteNode extends TextNode {
  __uuid: string;

  static getType(): 'autocomplete' {
    return 'autocomplete';
  }

  static clone(node: AutocompleteNode): AutocompleteNode {
    return new AutocompleteNode(node.__text, node.__uuid, node.__key);
  }

  static importJSON(serializedNode: SerializedAutocompleteNode): AutocompleteNode {
    return new AutocompleteNode(serializedNode.text, serializedNode.uuid);
  }

  // AutocompleteNode is excluded from copy via excludeFromCopy(), so it is
  // never placed on the clipboard and never needs to be reconstructed from
  // HTML.  Returning null here satisfies Lexical's exportDOM/importDOM
  // contract check and silences the console warning.
  static importDOM(): DOMConversionMap | null {
    return null;
  }

  exportJSON(): SerializedAutocompleteNode {
    return { ...super.exportJSON(), uuid: this.__uuid };
  }

  constructor(text: string, uuid: string, key?: NodeKey) {
    super(text, key);
    this.__uuid = uuid;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.classList.add(config.theme?.autocomplete || 'autocomplete-node');
    dom.style.color = '#a79e9e';
    return dom;
  }

  updateDOM(prevNode: AutocompleteNode): boolean {
    return this.__uuid !== prevNode.__uuid || this.__text !== prevNode.__text;
  }

  exportDOM(): DOMExportOutput {
    const dom = document.createElement('span');
    dom.textContent = this.__text;
    dom.style.color = '#a79e9e';
    return { element: dom };
  }

  excludeFromCopy() {
    return true;
  }
}

export const $createAutocompleteNode = (text: string, uuid: string) =>
  new AutocompleteNode(text, uuid);
