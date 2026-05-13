import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  ElementFormatType,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  Spread,
} from 'lexical';

import { BlockWithAlignableContents } from '@lexical/react/LexicalBlockWithAlignableContents';
import {
  DecoratorBlockNode,
  SerializedDecoratorBlockNode,
} from '@lexical/react/LexicalDecoratorBlockNode';
import { $getNodeByKey } from 'lexical';
import * as React from 'react';

const DEFAULT_WIDTH = 560;
const DEFAULT_HEIGHT = 315;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 113;

// ─── Resize handles ───────────────────────────────────────────────────────────

const handleBase: React.CSSProperties = {
  position: 'absolute',
  width: 10,
  height: 10,
  background: '#0078d4',
  border: '2px solid #fff',
  borderRadius: 2,
  zIndex: 10,
  boxShadow: '0 0 2px rgba(0,0,0,0.4)',
};

type ResizeDir = 'se' | 'e' | 's';

interface ResizeState {
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  ratio: number;
  dir: ResizeDir;
}

function VideoResizer({
  containerRef,
  onResizeStart,
  onResizeEnd,
}: {
  containerRef: React.RefObject<HTMLDivElement>;
  onResizeStart: () => void;
  onResizeEnd: (w: number, h: number) => void;
}) {
  const resizeState = React.useRef<ResizeState | null>(null);

  const startResize = (e: React.PointerEvent<HTMLDivElement>, dir: ResizeDir) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();
    resizeState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: width,
      startH: height,
      ratio: width / height,
      dir,
    };
    onResizeStart();

    const onMove = (ev: PointerEvent) => {
      const rs = resizeState.current;
      if (!rs || !container) return;

      const dx = ev.clientX - rs.startX;
      const dy = ev.clientY - rs.startY;
      let newW = rs.startW;
      let newH = rs.startH;

      if (dir === 'se') {
        newW = Math.max(MIN_WIDTH, rs.startW + dx);
        newH = newW / rs.ratio;
      } else if (dir === 'e') {
        newW = Math.max(MIN_WIDTH, rs.startW + dx);
      } else if (dir === 's') {
        newH = Math.max(MIN_HEIGHT, rs.startH + dy);
      }

      container.style.width = `${newW}px`;
      container.style.height = `${newH}px`;
    };

    const onUp = () => {
      if (!container) return;
      const { width, height } = container.getBoundingClientRect();
      resizeState.current = null;
      onResizeEnd(width, height);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  return (
    <>
      <div
        style={{
          ...handleBase,
          top: '50%',
          right: -5,
          transform: 'translateY(-50%)',
          cursor: 'ew-resize',
        }}
        onPointerDown={(e) => startResize(e, 'e')}
        title='Resize width'
      />
      <div
        style={{
          ...handleBase,
          bottom: -5,
          left: '50%',
          transform: 'translateX(-50%)',
          cursor: 'ns-resize',
        }}
        onPointerDown={(e) => startResize(e, 's')}
        title='Resize height'
      />
      <div
        style={{ ...handleBase, bottom: -5, right: -5, cursor: 'se-resize' }}
        onPointerDown={(e) => startResize(e, 'se')}
        title='Resize (proportional)'
      />
    </>
  );
}

// ─── YouTube component ────────────────────────────────────────────────────────

type YouTubeComponentProps = Readonly<{
  className: Readonly<{ base: string; focus: string }>;
  format: ElementFormatType | null;
  nodeKey: NodeKey;
  videoID: string;
  width: number;
  height: number;
  editor: LexicalEditor;
}>;

function YouTubeComponent({
  className,
  format,
  nodeKey,
  videoID,
  width,
  height,
  editor,
}: YouTubeComponentProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      node?.remove();
    });
  };

  const handleResizeEnd = (w: number, h: number) => {
    setIsResizing(false);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isYouTubeNode(node)) {
        node.setSize(Math.round(w), Math.round(h));
      }
    });
  };

  return (
    <BlockWithAlignableContents className={className} format={format} nodeKey={nodeKey}>
      <div
        ref={containerRef}
        style={{ position: 'relative', display: 'inline-block', width, height, lineHeight: 0 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!isResizing) setIsHovered(false);
        }}>
        <iframe
          width='100%'
          height='100%'
          src={`https://www.youtube.com/embed/${videoID}`}
          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
          allowFullScreen={true}
          title='YouTube video'
          style={{ display: 'block', border: 'none', pointerEvents: isResizing ? 'none' : 'auto' }}
        />

        {isHovered && (
          <>
            <button
              type='button'
              onClick={handleDelete}
              title='Remove video'
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.65)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
                padding: 0,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              ×
            </button>

            <VideoResizer
              containerRef={containerRef}
              onResizeStart={() => setIsResizing(true)}
              onResizeEnd={handleResizeEnd}
            />
          </>
        )}
      </div>
    </BlockWithAlignableContents>
  );
}

// ─── Serialized type ──────────────────────────────────────────────────────────

export type SerializedYouTubeNode = Spread<
  {
    videoID: string;
    width: number;
    height: number;
    type: 'youtube';
    version: 1;
  },
  SerializedDecoratorBlockNode
>;

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function extractYouTubeIdFromSrc(src: string): string | null {
  const m = src.match(/youtube\.com\/embed\/([^?&/]+)/i);
  return m?.[1] ?? null;
}

function convertYouTubeIframe(domNode: Node): DOMConversionOutput | null {
  if (!(domNode instanceof HTMLIFrameElement)) return null;
  const src = domNode.getAttribute('src') || '';
  const id = extractYouTubeIdFromSrc(src);
  if (!id) return null;
  const w = parseInt(domNode.getAttribute('width') || '560', 10) || DEFAULT_WIDTH;
  const h = parseInt(domNode.getAttribute('height') || '315', 10) || DEFAULT_HEIGHT;
  return { node: $createYouTubeNode(id, w, h) };
}

// ─── Node class ───────────────────────────────────────────────────────────────

export class YouTubeNode extends DecoratorBlockNode {
  __id: string;
  __width: number;
  __height: number;

  static getType(): string {
    return 'youtube';
  }

  static clone(node: YouTubeNode): YouTubeNode {
    return new YouTubeNode(node.__id, node.__width, node.__height, node.__format, node.__key);
  }

  static importJSON(serializedNode: SerializedYouTubeNode): YouTubeNode {
    const node = $createYouTubeNode(
      serializedNode.videoID,
      serializedNode.width ?? DEFAULT_WIDTH,
      serializedNode.height ?? DEFAULT_HEIGHT,
    );
    node.setFormat(serializedNode.format);
    return node;
  }

  exportJSON(): SerializedYouTubeNode {
    return {
      ...super.exportJSON(),
      type: 'youtube',
      version: 1,
      videoID: this.__id,
      width: this.__width,
      height: this.__height,
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      iframe: () => ({
        conversion: convertYouTubeIframe,
        priority: 2,
      }),
    };
  }

  exportDOM(): DOMExportOutput {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('width', String(this.__width));
    iframe.setAttribute('height', String(this.__height));
    iframe.style.border = 'none';
    iframe.setAttribute(
      'allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
    );
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('title', 'YouTube video');
    iframe.setAttribute('src', `https://www.youtube.com/embed/${this.__id}`);
    iframe.setAttribute('data-lexical-youtube', this.__id);
    return { element: iframe };
  }

  constructor(
    id: string,
    width: number = DEFAULT_WIDTH,
    height: number = DEFAULT_HEIGHT,
    format?: ElementFormatType,
    key?: NodeKey,
  ) {
    super(format, key);
    this.__id = id;
    this.__width = width;
    this.__height = height;
  }

  updateDOM(): false {
    return false;
  }

  getId(): string {
    return this.__id;
  }

  setSize(width: number, height: number): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }

  decorate(_editor: LexicalEditor, config: EditorConfig): JSX.Element {
    const embedBlockTheme = config.theme.embedBlock || {};
    const className = {
      base: embedBlockTheme.base || '',
      focus: embedBlockTheme.focus || '',
    };
    return (
      <YouTubeComponent
        className={className}
        format={this.__format}
        nodeKey={this.getKey()}
        videoID={this.__id}
        width={this.__width}
        height={this.__height}
        editor={_editor}
      />
    );
  }

  isTopLevel(): true {
    return true;
  }
}

// ─── Factories / guards ───────────────────────────────────────────────────────

export function $createYouTubeNode(
  videoID: string,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
): YouTubeNode {
  return new YouTubeNode(videoID, width, height);
}

export function $isYouTubeNode(
  node: YouTubeNode | LexicalNode | null | undefined,
): node is YouTubeNode {
  return node instanceof YouTubeNode;
}
