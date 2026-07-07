import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  SerializedEditor,
  SerializedLexicalNode,
  Spread
} from 'lexical';
import {
  $applyNodeReplacement,
  createEditor,
  DecoratorNode,
  isHTMLElement
} from 'lexical';
import type { JSX } from 'react';
import * as React from 'react';

const InlineImageComponent = React.lazy(() => import('./InlineImageComponent'));

export type Position = 'left' | 'right' | 'full' | undefined;

export interface InlineImagePayload {
  altText: string;
  caption?: LexicalEditor;
  height?: number;
  key?: NodeKey;
  showCaption?: boolean;
  src: string;
  width?: number;
  position?: Position;
}

export interface UpdateInlineImagePayload {
  altText?: string;
  showCaption?: boolean;
  position?: Position;
}

// Both InlineImageNode and the block ImageNode register a DOM conversion for
// bare `img` tags, and Lexical picks whichever registrant reports the higher
// priority for a given element (see @lexical/html's getConversionFunction) —
// ImageNode's is a static, unconditional `priority: 2`. Without an explicit
// marker distinguishing "this img came from an InlineImageNode", any
// exported inline image (getValue()/copy-paste) would always re-import as a
// plain block image, silently losing its inline nature (and thus not just
// the position value, but the entire floated-inline layout) on every
// save/reload round-trip.
const INLINE_IMAGE_MARKER_ATTR = 'data-lexical-inline-image';

const $convertInlineImageElement = (domNode: Node): null | DOMConversionOutput => {
  if (isHTMLElement(domNode) && domNode.nodeName === 'IMG') {
    const {alt: altText, src, width, height} = domNode as HTMLImageElement;
    const positionAttr = domNode.getAttribute('data-position');
    const position: Position =
      positionAttr === 'left' || positionAttr === 'right' || positionAttr === 'full'
        ? positionAttr
        : undefined;
    const node = $createInlineImageNode({altText, height, position, src, width});
    return {node};
  }
  return null;
}

export type SerializedInlineImageNode = Spread<
  {
    altText: string;
    caption: SerializedEditor;
    height?: number;
    showCaption: boolean;
    src: string;
    width?: number;
    position?: Position;
  },
  SerializedLexicalNode
>;

export class InlineImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __width: 'inherit' | number;
  __height: 'inherit' | number;
  __showCaption: boolean;
  __caption: LexicalEditor;
  __position: Position;

  static getType(): string {
    return 'inline-image';
  }

  static clone(node: InlineImageNode): InlineImageNode {
    return new InlineImageNode(
      node.__src,
      node.__altText,
      node.__position,
      node.__width,
      node.__height,
      node.__showCaption,
      node.__caption,
      node.__key,
    );
  }

  static importJSON(
    serializedNode: SerializedInlineImageNode,
  ): InlineImageNode {
    const {altText, height, width, src, showCaption, position} = serializedNode;
    return $createInlineImageNode({
      altText,
      height,
      position,
      showCaption,
      src,
      width,
    }).updateFromJSON(serializedNode);
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedInlineImageNode>,
  ): this {
    const {caption} = serializedNode;
    const node = super.updateFromJSON(serializedNode);
    const nestedEditor = node.__caption;
    const editorState = nestedEditor.parseEditorState(caption.editorState);
    if (!editorState.isEmpty()) {
      nestedEditor.setEditorState(editorState);
    }
    return node;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: (node: Node) => {
        // Only outrank the block ImageNode's unconditional priority-2
        // conversion (see the comment above $convertInlineImageElement) when
        // this element actually came from an InlineImageNode; otherwise
        // don't contribute a conversion at all so a plain pasted <img>
        // still becomes a regular block image as before.
        if (isHTMLElement(node) && node.hasAttribute(INLINE_IMAGE_MARKER_ATTR)) {
          return {
            conversion: $convertInlineImageElement,
            priority: 3,
          };
        }
        return null;
      },
    };
  }

  constructor(
    src: string,
    altText: string,
    position: Position,
    width?: 'inherit' | number,
    height?: 'inherit' | number,
    showCaption?: boolean,
    caption?: LexicalEditor,
    key?: NodeKey,
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width || 'inherit';
    this.__height = height || 'inherit';
    this.__showCaption = showCaption || false;
    this.__caption = caption || createEditor();
    this.__position = position;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('img');
    element.setAttribute('src', this.__src);
    element.setAttribute('alt', this.__altText);
    element.setAttribute('width', this.__width.toString());
    element.setAttribute('height', this.__height.toString());
    // Always present, independent of __position, so importDOM can tell this
    // <img> apart from a plain pasted one and re-create an InlineImageNode
    // instead of letting it fall through to the block ImageNode's importer.
    element.setAttribute(INLINE_IMAGE_MARKER_ATTR, 'true');
    // Position must survive the HTML round-trip getValue()/setValue() do
    // (this is the only representation those persist), so it's written as
    // both a data attribute (exact, read back by $convertInlineImageElement)
    // and real inline float/margin (so it still renders correctly if this
    // HTML is ever displayed outside Lexical, e.g. a sent email body).
    if (this.__position) {
      element.setAttribute('data-position', this.__position);
      InlineImageNode.applyPositionStyle(element, this.__position);
    }
    return {element};
  }

  exportJSON(): SerializedInlineImageNode {
    return {
      ...super.exportJSON(),
      altText: this.getAltText(),
      caption: this.__caption.toJSON(),
      height: this.__height === 'inherit' ? 0 : this.__height,
      position: this.__position,
      showCaption: this.__showCaption,
      src: this.getSrc(),
      width: this.__width === 'inherit' ? 0 : this.__width,
    };
  }

  getSrc(): string {
    return this.__src;
  }

  getAltText(): string {
    return this.__altText;
  }

  setAltText(altText: string): void {
    const writable = this.getWritable();
    writable.__altText = altText;
  }

  setWidthAndHeight(
    width: 'inherit' | number,
    height: 'inherit' | number,
  ): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }

  getShowCaption(): boolean {
    return this.__showCaption;
  }

  setShowCaption(showCaption: boolean): void {
    const writable = this.getWritable();
    writable.__showCaption = showCaption;
  }

  getPosition(): Position {
    return this.__position;
  }

  setPosition(position: Position): void {
    const writable = this.getWritable();
    writable.__position = position;
  }

  update(payload: UpdateInlineImagePayload): void {
    const writable = this.getWritable();
    const {altText, showCaption, position} = payload;
    if (altText !== undefined) {
      writable.__altText = altText;
    }
    if (showCaption !== undefined) {
      writable.__showCaption = showCaption;
    }
    if (position !== undefined) {
      writable.__position = position;
    }
  }

  // View

  // The position-left/right/full behavior is also defined in the package's
  // CSS file as `.inline-editor-image.position-*` rules, but that file is a
  // separate import (`@tarviks/lexical-rich-editor/dist/index.css`) a
  // consuming app can forget to include. Applying it as inline styles here
  // too means positioning still works even when that stylesheet isn't
  // loaded, instead of silently no-op'ing back to normal block flow.
  static applyPositionStyle(span: HTMLElement, position: Position): void {
    span.style.removeProperty('float');
    span.style.removeProperty('display');
    span.style.removeProperty('margin');
    if (position === 'left') {
      span.style.float = 'left';
      span.style.margin = '4px 8px 4px 0';
    } else if (position === 'right') {
      span.style.float = 'right';
      span.style.margin = '4px 0 4px 8px';
    } else if (position === 'full') {
      span.style.display = 'block';
      span.style.margin = '8px 0';
    }
  }

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    const className = `${config.theme.inlineImage} position-${this.__position}`;
    if (className !== undefined) {
      span.className = className;
    }
    InlineImageNode.applyPositionStyle(span, this.__position);
    return span;
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): false {
    const position = this.__position;
    if (position !== prevNode.__position) {
      const className = `${config.theme.inlineImage} position-${position}`;
      if (className !== undefined) {
        dom.className = className;
      }
      InlineImageNode.applyPositionStyle(dom, position);
    }
    return false;
  }

  decorate(): JSX.Element {
    return (
      <InlineImageComponent
        src={this.__src}
        altText={this.__altText}
        width={this.__width}
        height={this.__height}
        nodeKey={this.getKey()}
        showCaption={this.__showCaption}
        caption={this.__caption}
        position={this.__position}
      />
    );
  }
}

export const $createInlineImageNode = ({ altText, position, height, src, width, showCaption, caption, key }: InlineImagePayload): InlineImageNode => {
  return $applyNodeReplacement(
    new InlineImageNode( src, altText, position, width, height, showCaption, caption, key ),
  );
}

export const $isInlineImageNode = ( node: LexicalNode | null | undefined): node is InlineImageNode => {
  return node instanceof InlineImageNode;
}
