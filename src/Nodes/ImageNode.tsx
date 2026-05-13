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
  Spread,
} from 'lexical';
import { $applyNodeReplacement, createEditor, DecoratorNode } from 'lexical';
import * as React from 'react';

const ImageComponent = React.lazy(() => import('./ImageComponent'));

export interface ImagePayload {
  altText: string;
  caption?: LexicalEditor;
  height?: number | 'inherit';
  key?: NodeKey;
  maxWidth?: number;
  showCaption?: boolean;
  src: string;
  width?: number | 'inherit';
  captionsEnabled?: boolean;
}

const isGoogleDocCheckboxImg = (img: HTMLImageElement) => {
  return (
    img.parentElement != null &&
    img.parentElement.tagName === 'LI' &&
    img.previousSibling === null &&
    img.getAttribute('aria-roledescription') === 'checkbox'
  );
};

function parsePx(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const v = value.trim();
  // "120px" -> 120, "120" -> 120
  const n = Number(v.replace(/px$/i, ''));
  return Number.isFinite(n) ? n : undefined;
}

function parseDimFromStyleOrAttr(img: HTMLImageElement): { width?: number; height?: number } {
  // Priority:
  // 1) width/height attributes
  // 2) inline style width/height
  // 3) DOM properties (img.width/img.height)
  const wAttr = parsePx(img.getAttribute('width'));
  const hAttr = parsePx(img.getAttribute('height'));

  const wStyle = parsePx(img.style?.width);
  const hStyle = parsePx(img.style?.height);

  // img.width/img.height are numbers but can be 0 before load; still useful sometimes
  const wProp = img.width || undefined;
  const hProp = img.height || undefined;

  return {
    width: wAttr ?? wStyle ?? wProp,
    height: hAttr ?? hStyle ?? hProp,
  };
}

const $convertImageElement = (domNode: Node): null | DOMConversionOutput => {
  const img = domNode as HTMLImageElement;

  if (!img || img.tagName !== 'IMG') return null;
  if (img.src.startsWith('file:///') || isGoogleDocCheckboxImg(img)) {
    return null;
  }

  const altText = img.getAttribute('alt') ?? img.alt ?? '';
  const src = img.getAttribute('src') ?? img.src ?? '';

  // IMPORTANT: Preserve signature scaling.
  const { width, height } = parseDimFromStyleOrAttr(img);

  // Optional: support max-width from inline styles if present
  // e.g. style="max-width: 220px"
  const maxWidth = parsePx(img.style?.maxWidth);

  const node = $createImageNode({
    altText,
    src,
    width: width ?? 'inherit',
    height: height ?? 'inherit',
    maxWidth: maxWidth ?? 500,
  });

  return { node };
};

export type SerializedImageNode = Spread<
  {
    altText: string;
    caption: SerializedEditor;
    height?: number;
    maxWidth: number;
    showCaption: boolean;
    src: string;
    width?: number;
    captionsEnabled?: boolean;
  },
  SerializedLexicalNode
>;

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __width: 'inherit' | number;
  __height: 'inherit' | number;
  __maxWidth: number;
  __showCaption: boolean;
  __caption: LexicalEditor;
  // Captions cannot yet be used within editor cells
  __captionsEnabled: boolean;

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__maxWidth,
      node.__width,
      node.__height,
      node.__showCaption,
      node.__caption,
      node.__captionsEnabled,
      node.__key
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { altText, height, width, maxWidth, src, showCaption, captionsEnabled } = serializedNode;

    // Note: exportJSON stores 0 for inherit. Convert back.
    const normalizedWidth = width && width > 0 ? width : 'inherit';
    const normalizedHeight = height && height > 0 ? height : 'inherit';

    return $createImageNode({
      altText,
      height: normalizedHeight,
      width: normalizedWidth,
      maxWidth,
      showCaption,
      src,
      captionsEnabled,
    }).updateFromJSON(serializedNode);
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedImageNode>): this {
    const node = super.updateFromJSON(serializedNode);
    const { caption } = serializedNode;

    const nestedEditor = node.__caption;
    const editorState = nestedEditor.parseEditorState(caption.editorState);
    if (!editorState.isEmpty()) {
      nestedEditor.setEditorState(editorState);
    }
    return node;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('img');
    element.setAttribute('src', this.__src);
    element.setAttribute('alt', this.__altText);

    // Preserve sizing for signatures: use width/height attributes + inline style
    if (this.__width !== 'inherit') {
      element.setAttribute('width', String(this.__width));
      element.style.width = `${this.__width}px`;
    }
    if (this.__height !== 'inherit') {
      element.setAttribute('height', String(this.__height));
      element.style.height = `${this.__height}px`;
    }

    // Preserve maxWidth behavior if set
    if (this.__maxWidth && this.__maxWidth > 0) {
      element.style.maxWidth = `${this.__maxWidth}px`;
    }

    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: $convertImageElement,
        priority: 2,
      }),
    };
  }

  constructor(
    src: string,
    altText: string,
    maxWidth: number,
    width?: 'inherit' | number,
    height?: 'inherit' | number,
    showCaption?: boolean,
    caption?: LexicalEditor,
    captionsEnabled?: boolean,
    key?: NodeKey
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__maxWidth = maxWidth;
    this.__width = width ?? 'inherit';
    this.__height = height ?? 'inherit';
    this.__showCaption = showCaption ?? false;
    this.__caption =
      caption ||
      createEditor({
        nodes: [],
      });
    this.__captionsEnabled = captionsEnabled ?? true;
  }

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      altText: this.getAltText(),
      caption: this.__caption.toJSON(),
      height: this.__height === 'inherit' ? 0 : this.__height,
      maxWidth: this.__maxWidth,
      showCaption: this.__showCaption,
      src: this.getSrc(),
      width: this.__width === 'inherit' ? 0 : this.__width,
      captionsEnabled: this.__captionsEnabled,
    };
  }

  setWidthAndHeight(width: 'inherit' | number, height: 'inherit' | number): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }

  setShowCaption(showCaption: boolean): void {
    const writable = this.getWritable();
    writable.__showCaption = showCaption;
  }

  // View

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    const theme = config.theme;
    const className = theme.image;
    if (className !== undefined) {
      span.className = className;
    } else {
      // fallback so your CSS `.editor-image ...` still applies even if theme.image isn't set
      span.className = 'editor-image';
    }
    return span;
  }

  updateDOM(): false {
    return false;
  }

  getSrc(): string {
    return this.__src;
  }

  getAltText(): string {
    return this.__altText;
  }

  decorate(): JSX.Element {
    return (
      <ImageComponent
        src={this.__src}
        altText={this.__altText}
        width={this.__width}
        height={this.__height}
        maxWidth={this.__maxWidth}
        nodeKey={this.getKey()}
        showCaption={this.__showCaption}
        caption={this.__caption}
        captionsEnabled={this.__captionsEnabled}
        resizable={true}
      />
    );
  }
}

export const $createImageNode = ({
  altText,
  height,
  maxWidth = 500,
  captionsEnabled,
  src,
  width,
  showCaption,
  caption,
  key,
}: ImagePayload): ImageNode => {
  return $applyNodeReplacement(
    new ImageNode(
      src,
      altText,
      maxWidth,
      (width as any) ?? 'inherit',
      (height as any) ?? 'inherit',
      showCaption,
      caption,
      captionsEnabled,
      key
    )
  );
};

export const $isImageNode = (node: LexicalNode | null | undefined): node is ImageNode => {
  return node instanceof ImageNode;
};
